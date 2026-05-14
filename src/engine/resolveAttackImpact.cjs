// src/engine/resolveAttackImpact.cjs
// Worker-safe attack impact resolution (IMPACT phase).
// Now ruleset-aware + supports: elevation LOS, cover penalty, effective range w/ altitude.
// Backward compatible: if fighters/map not provided in state snapshot, falls back to old AR/bonus inputs.

const { rollInt } = require("./rng.cjs");

let strikeConnectsVsTarget = null;
let resolveWeaponImpactVsArmor = null;
let pickPrimaryArmorSlot = null;
try {
  const armorMod = require("../utils/resolveWeaponImpactVsArmor.cjs");
  strikeConnectsVsTarget = armorMod.strikeConnectsVsTarget;
  resolveWeaponImpactVsArmor = armorMod.resolveWeaponImpactVsArmor;
  pickPrimaryArmorSlot = armorMod.pickPrimaryArmorSlot;
} catch {
  /* optional */
}

// Optional core systems (present in your repo per the new architecture).
// If any are missing at runtime, we fall back gracefully.
let losElevationEngine = null;
let flightEngine = null;
let rangeEngine = null;

try {
  losElevationEngine = require("./systems/losElevationEngine.cjs");
} catch (e) {
  try { losElevationEngine = require("./losElevationEngine.cjs"); } catch (_) {}
}

try {
  flightEngine = require("./systems/flightEngine.cjs");
} catch (e) {
  try { flightEngine = require("./flightEngine.cjs"); } catch (_) {}
}

try {
  rangeEngine = require("./systems/rangeEngine.cjs");
} catch (e) {
  try { rangeEngine = require("./rangeEngine.cjs"); } catch (_) {}
}

// ----------------- basic dice helpers (kept for compatibility) -----------------

function rollDie(sides) {
  return 1 + Math.floor(Math.random() * sides);
}

// Supports: "2d6+3", "1d4 + 2", "3d6-1", "2d8"
function rollDiceFormula(formula, rngStateIn) {
  const f = String(formula || "").replace(/\s+/g, "").toLowerCase();
  const m = f.match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!m) throw new Error(`Bad damage formula: ${formula}`);

  const n = Number(m[1]);
  const sides = Number(m[2]);
  const mod = m[3] ? Number(m[3]) : 0;

  const rolls = [];
  let sum = 0;
  let nextRng = rngStateIn;

  for (let i = 0; i < n; i++) {
    const r = nextRng
      ? (function () {
          const out = rollInt(nextRng, sides);
          nextRng = out.nextRngState;
          return out.value;
        })()
      : rollDie(sides);
    rolls.push(r);
    sum += r;
  }

  const modStr = mod ? (mod > 0 ? `+${mod}` : `${mod}`) : "";
  const result = { total: sum + mod, rolls, mod, n, sides, formula: `${n}d${sides}${modStr}` };
  if (rngStateIn) result.nextRngState = nextRng;
  return result;
}

// ----------------- small helpers -----------------

function findFighter(state, id) {
  const list = state?.fighters;
  if (!Array.isArray(list)) return null;
  return list.find((f) => f && f.id === id) || null;
}

function safeNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function getAltitudeSafe(state, eid) {
  if (flightEngine?.getAltitude) return flightEngine.getAltitude(state, eid);
  const f = findFighter(state, eid);
  return safeNum(f?.altitude, 0);
}

function getARFromRuleset(ruleset, defender) {
  if (ruleset?.getAR) return safeNum(ruleset.getAR(defender), 10);
  return safeNum(defender?.AR ?? defender?.armorRating, 10);
}

function getStrikeFromRuleset(ruleset, attacker, kind) {
  if (ruleset?.getStrikeBonus) return safeNum(ruleset.getStrikeBonus(attacker, kind), 0);
  return safeNum(attacker?.bonuses?.strike ?? attacker?.bonuses?.strikeMelee ?? attacker?.bonuses?.strikeRanged, 0);
}

function isCritFromRuleset(ruleset, d20, critOn) {
  if (ruleset?.isCrit) return !!ruleset.isCrit(d20);
  return d20 >= safeNum(critOn, 20);
}

function isFumbleFromRuleset(ruleset, d20, alwaysMissOn) {
  if (ruleset?.isFumble) return !!ruleset.isFumble(d20);
  return d20 === safeNum(alwaysMissOn, 1);
}

/**
 * Resolve attack impact (damage application).
 * Payload is backward compatible with your current scheduler.
 *
 * @param {Object} payload
 * @param {string} payload.attackerId
 * @param {string} payload.targetId
 * @param {string} payload.projectileId
 * @param {Object} payload.attack  - may include { toHitBonus, targetAR, damageFormula, critOn, critMult, rangeHex, requiresLos }
 * @param {Object} payload.state   - snapshot; ideally includes { fighters, positions, map/cells } but may only include { hpById, positions }
 * @param {Object} payload.attackSnapshot - optional precomputed snapshot { d20, totalToHit, hit, isCrit }
 * @param {Object} payload.ammo
 * @param {Object} payload.rngState
 * @param {Object} payload.ruleset - injected by engine.cjs (optional but preferred)
 */
module.exports = function resolveAttackImpact(payload = {}) {
  const {
    attackerId,
    targetId,
    projectileId,
    attack = {},
    state = {},
    attackSnapshot = null,
    ammo = null,
    rngState: rngStateIn,
    ruleset = null,
    meta = {},
  } = payload;

  let rngState = rngStateIn ?? null;

  if (!attackerId || !targetId) {
    return { ok: false, error: { message: "resolveAttackImpact: missing attackerId/targetId" }, events: [] };
  }
  if (!attack.damageFormula) {
    return { ok: false, error: { message: "resolveAttackImpact: missing damageFormula" }, events: [] };
  }

  const events = [];

  // Fighters (optional but enables ruleset-based AR/bonuses, LOS/cover, range+altitude)
  const attackerF = findFighter(state, attackerId);
  const targetF = findFighter(state, targetId);

  const from = state.positions?.[attackerId];
  const to = state.positions?.[targetId];

  // ----------------- RANGE (effective distance = horiz + vert) -----------------
  // Backward compatible: if no positions/rangeEngine, we skip.
  const rangeHex = attack.rangeHex ?? attack.range ?? null;
  if (Number.isFinite(Number(rangeHex)) && from && to && rangeEngine?.effectiveDistanceFromState) {
    const weights = ruleset?.rangeWeights
      ? ruleset.rangeWeights({ kind: attack.kind || "ranged", weapon: attack })
      : { horizWeight: 1, vertWeight: 1 };

    const dist = rangeEngine.effectiveDistanceFromState({
      state,
      fromId: attackerId,
      toId: targetId,
      fromHex: from,
      toHex: to,
      horizWeight: weights.horizWeight,
      vertWeight: weights.vertWeight,
    });

    const eff = safeNum(dist, 0);
    if (eff > Number(rangeHex)) {
      // If snapshot exists, we still treat as OUT_OF_RANGE miss.
      events.push({
        type: "ATTACK_ROLL",
        attackerId,
        targetId,
        d20: attackSnapshot?.d20 ?? null,
        bonus: null,
        total: null,
        targetAR: null,
        hit: false,
        crit: false,
        reason: "OUT_OF_RANGE",
        distance: dist,
        range: Number(rangeHex),
      });
      events.push({ type: "MISS", attackerId, targetId, reason: "OUT_OF_RANGE" });

      // consume attacks & ammo same as normal resolution (keeps turn economy consistent)
      const remainingAttacks = Number(attack.remainingAttacks ?? 1);
      const nextRemainingAttacks = Math.max(0, remainingAttacks - 1);
      events.push({ type: "ATTACKS_CONSUMED", attackerId, prev: remainingAttacks, next: nextRemainingAttacks });
      if (nextRemainingAttacks <= 0) {
        events.push({ type: "TURN_SHOULD_END", actorId: attackerId, reason: "No remaining attacks" });
      }

      // Ammo delta (optional)
      let ammoDelta = null;
      if (ammo && ammo.current !== undefined) {
        ammoDelta = {
          ownerId: ammo.ammoOwnerId,
          ammoType: ammo.ammoType,
          next: Math.max(0, Number(ammo.current) - Math.max(0, Number(ammo.spend ?? 1))),
        };
        events.push({ type: "AMMO_SPENT", ...ammoDelta, spent: Number(ammo.spend ?? 1) });
      }

      return {
        ok: true,
        events,
        delta: {
          ...(ammoDelta ? { ammo: ammoDelta } : {}),
          remainingAttacksById: { [attackerId]: nextRemainingAttacks },
          ...(rngState ? { rngState } : {}),
        },
      };
    }
  }

  // ----------------- LOS + COVER (elevation-aware, optional) -----------------
  let coverPenalty = 0;
  if (attack.requiresLos !== false && losElevationEngine && from && to && attackerF && targetF) {
    const losFn = losElevationEngine.hasLineOfSightElevation || null;

    if (typeof losFn === "function") {
      const los = losFn(state, { fromHex: from, toHex: to, fromId: attackerId, toId: targetId });
      if (los && los.los === false) {
        events.push({
          type: "ATTACK_ROLL",
          attackerId,
          targetId,
          d20: attackSnapshot?.d20 ?? null,
          bonus: null,
          total: null,
          targetAR: null,
          hit: false,
          crit: false,
          reason: "NO_LOS",
          blockedAt: los.blockedAt ?? null,
        });
        events.push({ type: "MISS", attackerId, targetId, reason: "NO_LOS" });

        const remainingAttacks = Number(attack.remainingAttacks ?? 1);
        const nextRemainingAttacks = Math.max(0, remainingAttacks - 1);
        events.push({ type: "ATTACKS_CONSUMED", attackerId, prev: remainingAttacks, next: nextRemainingAttacks });
        if (nextRemainingAttacks <= 0) {
          events.push({ type: "TURN_SHOULD_END", actorId: attackerId, reason: "No remaining attacks" });
        }

        let ammoDelta = null;
        if (ammo && ammo.current !== undefined) {
          ammoDelta = {
            ownerId: ammo.ammoOwnerId,
            ammoType: ammo.ammoType,
            next: Math.max(0, Number(ammo.current) - Math.max(0, Number(ammo.spend ?? 1))),
          };
          events.push({ type: "AMMO_SPENT", ...ammoDelta, spent: Number(ammo.spend ?? 1) });
        }

        return {
          ok: true,
          events,
          delta: {
            ...(ammoDelta ? { ammo: ammoDelta } : {}),
            remainingAttacksById: { [attackerId]: nextRemainingAttacks },
            ...(rngState ? { rngState } : {}),
          },
        };
      }
    }

    // cover (optional)
    const coverFn = losElevationEngine.computeCoverElevation || null;
    if (typeof coverFn === "function") {
      const cover = coverFn(state, { fromHex: from, toHex: to, fromId: attackerId, toId: targetId });
      coverPenalty = safeNum(cover?.penalty, 0);
    }
  }

  // ----------------- TO-HIT (ruleset aware; snapshot still honored) -----------------
  let d20, totalToHit, hit, isCrit;

  if (attackSnapshot) {
    d20 = attackSnapshot.d20;
    totalToHit = attackSnapshot.totalToHit;
    hit = attackSnapshot.hit;
    isCrit = attackSnapshot.isCrit;

    // (Optional) still emit roll event if caller didn't already.
    // We keep original behavior: only emitted when we roll here.
  } else {
    // Determine kind for strike bonus
    const kind = String(attack.kind || attack.attackKind || (attack.isMelee ? "melee" : "ranged")).toLowerCase();

    // Base bonuses from ruleset + payload (payload stays as additive override)
    const baseStrike = attackerF ? getStrikeFromRuleset(ruleset, attackerF, kind) : 0;
    const payloadBonus = safeNum(attack.toHitBonus, 0);
    const toHitBonus = baseStrike + payloadBonus - coverPenalty;

    // Target AR from ruleset if possible, else payload (back compat)
    const targetAR = targetF ? getARFromRuleset(ruleset, targetF) : safeNum(attack.targetAR, NaN);
    if (!Number.isFinite(targetAR)) {
      return { ok: false, error: { message: "resolveAttackImpact: missing targetAR (and no defender/ruleset AR available)" }, events: [] };
    }

    // Roll d20
    if (rngState) {
      const r = rollInt(rngState, 20);
      d20 = r.value;
      rngState = r.nextRngState;
    } else {
      d20 = rollDie(20);
    }

    totalToHit = d20 + toHitBonus;

    const alwaysHitOn = safeNum(attack.alwaysHitOn, 20);
    const alwaysMissOn = safeNum(attack.alwaysMissOn, 1);
    const isAlwaysMiss = isFumbleFromRuleset(ruleset, d20, alwaysMissOn);
    const isAlwaysHit = d20 === alwaysHitOn;

    isCrit = !isAlwaysMiss && isCritFromRuleset(ruleset, d20, attack.critOn ?? 20);
    const hitSlotRoll = attack.hitSlot || meta.hitSlot || (pickPrimaryArmorSlot ? pickPrimaryArmorSlot(targetF, null) : "chest");
    if (strikeConnectsVsTarget && targetF) {
      const sc = strikeConnectsVsTarget({
        defender: targetF,
        attackTotal: totalToHit,
        d20,
        slot: hitSlotRoll,
        ruleset,
        critOn: attack.critOn ?? 20,
        alwaysMissOn,
      });
      hit = !isAlwaysMiss && (isAlwaysHit || sc.connects);
    } else {
      hit = !isAlwaysMiss && (isAlwaysHit || totalToHit >= targetAR);
    }

    events.push({
      type: "ATTACK_ROLL",
      attackerId,
      targetId,
      d20,
      bonus: toHitBonus,
      baseStrike,
      payloadBonus,
      coverPenalty,
      total: totalToHit,
      targetAR,
      hit,
      crit: hit && isCrit,
    });
  }

  // ----------------- DAMAGE (keeps existing roll+event shape) -----------------
  let ammoDelta = null;
  const isMisfire = attackSnapshot?.reason === "MISFIRE" || attackSnapshot?.projectileReleased === false || meta?.projectileReleased === false;

  if (isMisfire) {
    events.push({
      type: "MISFIRE",
      attackerId,
      targetId,
      reason: "MISFIRE",
      projectileReleased: false,
    });
    events.push({
      type: "MISS",
      attackerId,
      targetId,
      reason: "MISFIRE",
      projectileReleased: false,
    });

    const remainingAttacks = Number(attack.remainingAttacks ?? 1);
    const nextRemainingAttacks = Math.max(0, remainingAttacks - 1);
    events.push({ type: "ATTACKS_CONSUMED", attackerId, prev: remainingAttacks, next: nextRemainingAttacks });
    if (nextRemainingAttacks <= 0) {
      events.push({ type: "TURN_SHOULD_END", actorId: attackerId, reason: "No remaining attacks" });
    }

    return {
      ok: true,
      events,
      delta: {
        remainingAttacksById: { [attackerId]: nextRemainingAttacks },
        ...(rngState ? { rngState } : {}),
      },
    };
  }

  const strayTargetId = attackSnapshot?.strayTargetId || null;
  const effectiveTargetId = strayTargetId || targetId;
  const effDefender = findFighter(state, effectiveTargetId) || {};

  const alwaysMissOnImp = safeNum(attack.alwaysMissOn, 1);
  const critOnImp = attack.critOn ?? 20;
  const isFumbleRoll = isFumbleFromRuleset(ruleset, d20, alwaysMissOnImp);
  const isCritRoll = !isFumbleRoll && !strayTargetId && isCritFromRuleset(ruleset, d20, critOnImp);

  const hitSlot =
    attack.hitSlot ||
    meta.hitSlot ||
    (typeof pickPrimaryArmorSlot === "function" ? pickPrimaryArmorSlot(effDefender, null) : "chest");

  let strikeConnects = !!strayTargetId;
  if (!strayTargetId && typeof strikeConnectsVsTarget === "function") {
    const sc = strikeConnectsVsTarget({
      defender: effDefender,
      attackTotal: totalToHit,
      d20,
      slot: hitSlot,
      ruleset,
      critOn: critOnImp,
      alwaysMissOn: alwaysMissOnImp,
    });
    strikeConnects = sc.connects;
  } else if (!strayTargetId) {
    strikeConnects = !!hit;
  }

  const hitForDamage = strikeConnects;
  const critForDamage = isCritRoll && hitForDamage;

  if (strayTargetId) {
    events.push({
      type: "STRAY_HIT",
      attackerId,
      originalTargetId: targetId,
      targetId: strayTargetId,
      projectileId,
      missMargin: attackSnapshot?.missMargin ?? null,
      clock: attackSnapshot?.clock ?? null,
      impactPoint: attackSnapshot?.strayHitPoint ?? attackSnapshot?.impactPoint ?? null,
      chance: attackSnapshot?.strayChance ?? null,
      roll: attackSnapshot?.strayRoll ?? null,
      crit: false,
    });
  }

  if (hitForDamage) {
    let dmg;
    if (rngState) {
      dmg = rollDiceFormula(attack.damageFormula, rngState);
      rngState = dmg.nextRngState;
    } else {
      dmg = rollDiceFormula(attack.damageFormula);
    }

    let damageTotal = dmg.total;

    const critMult =
      ruleset?.critMultiplier
        ? safeNum(ruleset.critMultiplier({ attackerId, targetId, attack }), safeNum(attack.critMult, 2))
        : safeNum(attack.critMult, 2);

    if (critForDamage) {
      damageTotal *= critMult;
      events.push({ type: "CRIT", attackerId, targetId: effectiveTargetId, mult: critMult });
    }

    let impact;
    if (typeof resolveWeaponImpactVsArmor === "function") {
      impact = resolveWeaponImpactVsArmor({
        defender: effDefender,
        attackTotal: totalToHit,
        damage: damageTotal,
        slot: hitSlot,
        isCrit: isCritRoll && !strayTargetId,
        isFumble: isFumbleRoll,
      });
    } else {
      impact = {
        outcome: "hp",
        damageToHP: damageTotal,
        damageToArmor: 0,
        armorBroken: false,
      };
    }

    if (impact.outcome === "armor") {
      events.push({
        type: "DAMAGE",
        attackerId,
        targetId: effectiveTargetId,
        originalTargetId: strayTargetId ? targetId : undefined,
        projectileId,
        formula: dmg.formula,
        rolls: dmg.rolls,
        mod: dmg.mod,
        amount: impact.damageToArmor,
        stray: !!strayTargetId,
        vsArmor: true,
      });
      events.push({
        type: "ARMOR_CHANGED",
        targetId: effectiveTargetId,
        slot: impact.slot,
        prevSDC: impact.prevArmorSDC,
        nextSDC: impact.nextArmorSDC,
        broken: !!impact.armorBroken,
        name: impact.armor?.name,
      });

      const remainingAttacks = Number(attack.remainingAttacks ?? 1);
      const nextRemainingAttacks = Math.max(0, remainingAttacks - 1);
      events.push({ type: "ATTACKS_CONSUMED", attackerId, prev: remainingAttacks, next: nextRemainingAttacks });
      if (nextRemainingAttacks <= 0) {
        events.push({ type: "TURN_SHOULD_END", actorId: attackerId, reason: "No remaining attacks" });
      }

      let ammoDeltaArmor = null;
      if (ammo && ammo.current !== undefined) {
        ammoDeltaArmor = {
          ownerId: ammo.ammoOwnerId,
          ammoType: ammo.ammoType,
          next: Math.max(0, Number(ammo.current) - Math.max(0, Number(ammo.spend ?? 1))),
        };
        events.push({ type: "AMMO_SPENT", ...ammoDeltaArmor, spent: Number(ammo.spend ?? 1) });
      }

      return {
        ok: true,
        events,
        delta: {
          armorById: {
            [effectiveTargetId]: {
              slot: impact.slot,
              currentSDC: impact.nextArmorSDC,
              broken: !!impact.armorBroken,
            },
          },
          remainingAttacksById: { [attackerId]: nextRemainingAttacks },
          ...(ammoDeltaArmor ? { ammo: ammoDeltaArmor } : {}),
          ...(rngState ? { rngState } : {}),
        },
      };
    }

    if (impact.outcome === "hp") {
      const hpDmg = impact.damageToHP ?? damageTotal;
      events.push({
        type: "DAMAGE",
        attackerId,
        targetId: effectiveTargetId,
        originalTargetId: strayTargetId ? targetId : undefined,
        projectileId,
        formula: dmg.formula,
        rolls: dmg.rolls,
        mod: dmg.mod,
        amount: hpDmg,
        stray: !!strayTargetId,
      });

      if (state.hpById && state.hpById[effectiveTargetId] !== undefined) {
        const prevHP = Number(state.hpById[effectiveTargetId] ?? 0);
        const nextHP = prevHP - hpDmg;

        events.push({ type: "HP_CHANGED", targetId: effectiveTargetId, prevHP, nextHP });

        const remainingAttacks = Number(attack.remainingAttacks ?? 1);
        const nextRemainingAttacks = Math.max(0, remainingAttacks - 1);

        events.push({ type: "ATTACKS_CONSUMED", attackerId, prev: remainingAttacks, next: nextRemainingAttacks });

        if (nextRemainingAttacks <= 0) {
          events.push({ type: "TURN_SHOULD_END", actorId: attackerId, reason: "No remaining attacks" });
        }

        let ammoDelta = null;
        if (ammo && ammo.current !== undefined) {
          ammoDelta = {
            ownerId: ammo.ammoOwnerId,
            ammoType: ammo.ammoType,
            next: Math.max(0, Number(ammo.current) - Math.max(0, Number(ammo.spend ?? 1))),
          };
          events.push({ type: "AMMO_SPENT", ...ammoDelta, spent: Number(ammo.spend ?? 1) });
        }

        const nextHpById = { ...state.hpById, [effectiveTargetId]: nextHP };

        return {
          ok: true,
          events,
          delta: {
            hpById: nextHpById,
            remainingAttacksById: { [attackerId]: nextRemainingAttacks },
            ...(ammoDelta ? { ammo: ammoDelta } : {}),
            ...(rngState ? { rngState } : {}),
          },
        };
      }
    }
  } else {
    events.push({
      type: "MISS",
      attackerId,
      targetId,
      missMargin: attackSnapshot?.missMargin ?? null,
      clock: attackSnapshot?.clock ?? null,
      impactPoint: attackSnapshot?.impactPoint ?? null,
    });
  }

  // Ammo delta (optional) — existing behavior
  if (ammo && ammo.current !== undefined) {
    ammoDelta = {
      ownerId: ammo.ammoOwnerId,
      ammoType: ammo.ammoType,
      next: Math.max(0, Number(ammo.current) - Math.max(0, Number(ammo.spend ?? 1))),
    };
    events.push({ type: "AMMO_SPENT", ...ammoDelta, spent: Number(ammo.spend ?? 1) });
  }

  // Attacks consumed (existing)
  const remainingAttacks = Number(attack.remainingAttacks ?? 1);
  const nextRemainingAttacks = Math.max(0, remainingAttacks - 1);

  events.push({ type: "ATTACKS_CONSUMED", attackerId, prev: remainingAttacks, next: nextRemainingAttacks });

  if (nextRemainingAttacks <= 0) {
    events.push({ type: "TURN_SHOULD_END", actorId: attackerId, reason: "No remaining attacks" });
  }

  return {
    ok: true,
    events,
    delta: {
      ...(ammoDelta ? { ammo: ammoDelta } : {}),
      remainingAttacksById: { [attackerId]: nextRemainingAttacks },
      ...(rngState ? { rngState } : {}),
    },
  };
};
