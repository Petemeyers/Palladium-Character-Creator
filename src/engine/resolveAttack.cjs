// src/engine/resolveAttack.cjs
// Pure worker-safe attack initiation: sets acting lock, schedules projectile animation.
// Actual damage is resolved later via resolveAttackImpact when projectile hits.

const { scheduleAttack } = require("./scheduleAttack.cjs");
const {
  buildMissImpactPoint,
  findStrayCandidate,
  rollChance,
  rollClock,
} = require("./projectileMiss.cjs");
const { rollInt } = require("./rng.cjs");

let attackConnectsVsTarget = null;
let pickPrimaryArmorSlot = null;
try {
  const armorMod = require("../utils/resolveWeaponImpactVsArmor.cjs");
  attackConnectsVsTarget = armorMod.attackConnectsVsTarget;
  pickPrimaryArmorSlot = armorMod.pickPrimaryArmorSlot;
} catch {
  /* optional */
}

// Optional timing engine (distance+altitude aware). If missing, we fall back to old flightMs logic.
let timingEngine = null;
try {
  timingEngine = require("./systems/timingEngine.cjs");
} catch (e) {
  try { timingEngine = require("./timingEngine.cjs"); } catch (_) {}
}

// Optional altitude utility
let getAltitude = null;
try {
  getAltitude = require("./utils/getAltitude.cjs").getAltitude;
} catch (_) {
  // Fallback: simple altitude getter
  getAltitude = (state, id) => {
    const f = state.fighters?.find(x => x.id === id);
    return Number.isFinite(f?.altitude) ? f.altitude : (Number.isFinite(f?.altitudeFeet) ? f.altitudeFeet : 0);
  };
}

function safeNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function findFighter(state, id) {
  const list = state?.fighters;
  if (!Array.isArray(list)) return null;
  return list.find((f) => f && (f.id === id || f._id === id)) || null;
}

function getARFromRuleset(ruleset, defender) {
  if (ruleset?.getAR) return safeNum(ruleset.getAR(defender), 10);
  return safeNum(defender?.guardRating ?? defender?.guardRating ?? defender?.guardRating, 10);
}

function getAttackFromRuleset(ruleset, attacker, kind) {
  if (ruleset?.getAttackBonus) return safeNum(ruleset.getAttackBonus(attacker, kind), 0);
  return safeNum(attacker?.bonuses?.attack ?? attacker?.bonuses?.attackMelee ?? attacker?.bonuses?.attackRanged, 0);
}

function isCritFromRuleset(ruleset, d20, critOn) {
  if (ruleset?.isCrit) return !!ruleset.isCrit(d20);
  return d20 >= safeNum(critOn, 20);
}

function isFumbleFromRuleset(ruleset, d20, alwaysMissOn) {
  if (ruleset?.isFumble) return !!ruleset.isFumble(d20);
  return d20 === safeNum(alwaysMissOn, 1);
}

function isProjectileAttack(attack, kind) {
  const attackKind = String(attack.kind || attack.attackKind || (attack.isMelee ? "melee" : "ranged")).toLowerCase();
  if (attackKind === "melee") return false;
  const projectileKind = String(kind || attack.projectileKind || "").toLowerCase();
  return attackKind === "ranged" || projectileKind.includes("arrow") || projectileKind.includes("bolt") || projectileKind === "stone";
}

function rollD20(rngState) {
  if (rngState) {
    const out = rollInt(rngState, 20);
    return { value: out.value, rngState: out.nextRngState };
  }
  return { value: 1 + Math.floor(Math.random() * 20), rngState };
}

function prepareProjectileAttackSnapshot({
  attackerId,
  targetId,
  attack,
  state,
  ruleset,
  rngState: rngStateIn,
  from,
  to,
  kind,
}) {
  if (!isProjectileAttack(attack, kind) || attack.__deferRoll === true) return null;

  const attackerF = findFighter(state, attackerId);
  const targetF = findFighter(state, targetId);
  const baseAttack = attackerF ? getAttackFromRuleset(ruleset, attackerF, "ranged") : 0;
  const payloadBonus = safeNum(attack.toHitBonus, 0);
  const toHitBonus = baseAttack + payloadBonus;
  const targetGuardRating = targetF ? getARFromRuleset(ruleset, targetF) : safeNum(attack.targetGuardRating, NaN);
  if (!Number.isFinite(targetGuardRating)) return null;

  let rngState = rngStateIn ?? null;
  const d20Roll = rollD20(rngState);
  const d20 = d20Roll.value;
  rngState = d20Roll.rngState;

  const totalToHit = d20 + toHitBonus;
  const alwaysHitOn = safeNum(attack.alwaysHitOn, 20);
  const alwaysMissOn = safeNum(attack.alwaysMissOn, 1);
  const isAlwaysMiss = isFumbleFromRuleset(ruleset, d20, alwaysMissOn);
  const isAlwaysHit = d20 === alwaysHitOn;
  const isCritDice = !isAlwaysMiss && isCritFromRuleset(ruleset, d20, attack.critOn ?? 20);
  const hitSlotProj =
    attack.hitSlot ||
    (typeof pickPrimaryArmorSlot === "function" ? pickPrimaryArmorSlot(targetF, null) : "chest");
  let hit;
  if (typeof attackConnectsVsTarget === "function" && targetF) {
    const sc = attackConnectsVsTarget({
      defender: targetF,
      attackTotal: totalToHit,
      d20,
      slot: hitSlotProj,
      ruleset,
      critOn: attack.critOn ?? 20,
      alwaysMissOn,
    });
    hit = !isAlwaysMiss && (isAlwaysHit || sc.connects);
  } else {
    hit = !isAlwaysMiss && (isAlwaysHit || totalToHit >= targetGuardRating);
  }
  const missMargin = hit ? 0 : Math.max(1, Math.ceil(targetGuardRating - totalToHit));

  const snapshot = {
    d20,
    totalToHit,
    hit,
    isCrit: isCritDice,
    targetGuardRating,
    bonus: toHitBonus,
    baseAttack,
    payloadBonus,
    coverPenalty: 0,
    projectileReleased: !isAlwaysMiss,
    missMargin: hit ? null : missMargin,
  };

  const rollEvent = {
    type: "ATTACK_ROLL",
    attackerId,
    targetId,
    d20,
    bonus: toHitBonus,
    baseAttack,
    payloadBonus,
    coverPenalty: 0,
    total: totalToHit,
    targetGuardRating,
    hit,
    crit: isCritDice,
  };

  if (isAlwaysMiss) {
    snapshot.reason = "MISFIRE";
    rollEvent.reason = "MISFIRE";
    return { attackSnapshot: snapshot, rollEvent, projectileTo: null, rngState };
  }

  if (hit) {
    return { attackSnapshot: snapshot, rollEvent, projectileTo: to, rngState };
  }

  const clockRoll = rollClock(rngState, rollInt);
  rngState = clockRoll.rngState;
  const clock = clockRoll.clock;
  const impactPoint = buildMissImpactPoint({
    origin: from,
    targetPos: to,
    missMargin,
    clock,
    ringSpacing: safeNum(attack.missRingSpacing, 0.35),
    baseOvershoot: safeNum(attack.missBaseOvershoot, 0.4),
    overshootStep: safeNum(attack.missOvershootStep, 0.15),
  });

  snapshot.clock = clock;
  snapshot.impactPoint = impactPoint;
  rollEvent.clock = clock;
  rollEvent.missMargin = missMargin;
  rollEvent.impactPoint = impactPoint;

  const candidate = findStrayCandidate({
    origin: from,
    impactPoint,
    primaryTargetId: targetId,
    attackerId,
    fighters: state.fighters,
    positions: state.positions,
    missMargin,
  });

  if (candidate) {
    const chanceRoll = rollChance(rngState, rollInt);
    rngState = chanceRoll.rngState;
    snapshot.strayChance = candidate.chance;
    snapshot.strayRoll = chanceRoll.value;
    if (chanceRoll.value <= candidate.chance) {
      snapshot.strayTargetId = candidate.targetId;
      snapshot.strayHitPoint = candidate.hitPoint;
      rollEvent.strayTargetId = candidate.targetId;
      rollEvent.strayChance = candidate.chance;
      rollEvent.strayRoll = chanceRoll.value;
      return { attackSnapshot: snapshot, rollEvent, projectileTo: candidate.hitPoint, rngState };
    }
  }

  return { attackSnapshot: snapshot, rollEvent, projectileTo: impactPoint, rngState };
}

/**
 * Initiate an attack: set acting lock, spawn projectile, schedule impact resolution
 * @param {Object} payload
 * @param {string} payload.attackerId - Entity ID of attacker
 * @param {string} payload.targetId - Entity ID of target
 * @param {Object} payload.attack - Attack parameters (toHitBonus, targetGuardRating, damageFormula, etc.)
 * @param {Object} payload.state - State snapshot (positions, hpById, fighters, map, etc.)
 * @param {Object} payload.engine - Engine helpers (hasLock, addLock, removeLock, timeScale)
 * @param {Object} payload.meta - Optional metadata (projectileKind, flightMs, attackSnapshot, etc.)
 * @param {Object} payload.ammo - Ammo spending info (optional)
 * @param {Object} payload.rngState - RNG state for deterministic rolls (optional)
 * @param {Object} payload.ruleset - injected by engine.cjs (optional)
 * @returns {Object} { ok: boolean, events: Array, error?: Object }
 */
module.exports = function resolveAttack(payload = {}) {
  // Support both old format (attack) and new format (weapon) for backward compatibility
  const attack = payload.attack || payload.weapon || {};
  
  const {
    attackerId = payload.attackerId || payload.attacker,
    targetId = payload.targetId || payload.target,
    state = {},
    engine,
    meta = {},
    ammo = null,
    rngState,
    ruleset = null,
  } = payload;

  if (!attackerId || !targetId) {
    return { ok: false, error: { message: "resolveAttack: missing attackerId/targetId" }, events: [] };
  }

  const events = [];

  // ---- LOCK CHECK: Block if already acting ----
  if (engine?.hasLock?.(attackerId, "acting")) {
    return { ok: false, error: { message: "LOCKED_ACTING" }, events: [] };
  }

  // Set acting lock
  engine?.addLock?.(attackerId, "acting");

  // Emit lock event for UI
  events.push({
    type: "ENGINE_SET_LOCK",
    lock: { type: "entity", id: attackerId, lock: "acting" },
  });

  // Get positions for projectile path
  const from = state.positions?.[attackerId];
  const to = state.positions?.[targetId];
  if (!from || !to) {
    // Clear lock immediately if invalid
    engine?.removeLock?.(attackerId, "acting");
    events.push({
      type: "ENGINE_CLEAR_LOCK",
      lock: { type: "entity", id: attackerId, lock: "acting" },
    });
    return { ok: false, error: { message: "Missing positions" }, events };
  }

  // Create projectile descriptor (UI uses kind to choose model: arrow/bolt/stone/technique)
  const projectileId = `proj:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  const kind = meta?.projectileKind || attack?.projectileKind || "arrow";
  const prepared = meta?.attackSnapshot
    ? null
    : prepareProjectileAttackSnapshot({
        attackerId,
        targetId,
        attack,
        state,
        ruleset,
        rngState,
        from,
        to,
        kind,
      });
  const attackSnapshot = meta?.attackSnapshot || prepared?.attackSnapshot || null;
  const impactRngState = prepared?.rngState ?? rngState;

  if (prepared?.rollEvent) {
    events.push(prepared.rollEvent);
  }

  if (attackSnapshot?.reason === "MISFIRE" && attackSnapshot.projectileReleased === false) {
    events.push({
      type: "ENGINE_CALL",
      method: "resolveAttackImpact",
      payload: {
        attackerId,
        targetId,
        projectileId: null,
        attack,
        state,
        attackSnapshot,
        ammo,
        rngState: impactRngState,
        meta: { ...meta, projectileReleased: false },
        ruleset,
      },
    });
    events.push({
      type: "ENGINE_CLEAR_LOCK",
      lock: { type: "entity", id: attackerId, lock: "acting" },
    });
    return { ok: true, events };
  }

  const projectile = {
    id: projectileId,
    kind,
    from: { x: from.x, y: from.y },
    to: {
      x: (prepared?.projectileTo || to).x,
      y: (prepared?.projectileTo || to).y,
      ...(Number.isFinite(Number((prepared?.projectileTo || to).altitudeFeet))
        ? { altitudeFeet: Number((prepared?.projectileTo || to).altitudeFeet) }
        : {}),
    },
  };

  // ---- FLIGHT TIME (distance+altitude aware when timingEngine exists) ----
  // Backward compatible precedence:
  // 1) meta.flightMs
  // 2) attack.flightMs
  // 3) computed from effective distance (horiz + vert)
  // 4) 450ms fallback
  let computed = null;
  if (timingEngine?.computeFlightMs) {
    const kindForTiming =
      String(attack.kind || meta.kind || (attack.isMelee ? "melee" : "ranged")).toLowerCase();

    try {
      computed = timingEngine.computeFlightMs({
        state,
        ruleset,
        fromId: attackerId,
        toId: targetId,
        weaponOrProjectile: attack,
        kind: kindForTiming,
      });
    } catch (_) {
      computed = null;
    }
  }

  const flightMs =
    meta?.flightMs ??
    attack?.flightMs ??
    computed?.ms ??
    450;
  projectile.flightMs = flightMs;

  // Optional debug/event (safe even if UI ignores it)
  if (computed?.dist) {
    // Embed distance into projectile for better step scaling
    projectile.distance = computed.dist; // { horiz, vert, eff, ... }
    
    // Embed altitude info for arc calculation (optional)
    projectile.meta = projectile.meta || {};
    
    // Get altitude from fighters if available
    const attackerAlt = getAltitude ? getAltitude(state, attackerId) : 0;
    const targetAlt = getAltitude ? getAltitude(state, targetId) : 0;
    
    projectile.meta.fromAlt = attackerAlt;
    projectile.meta.toAlt = targetAlt;
    
    // Optional: arrows arc, bolts flatter
    if (kind === "bolt" || kind === "techniqueBolt") {
      projectile.meta.useArc = false;
    }
    
    events.push({
      type: "PROJECTILE_LAUNCHED",
      attackerId,
      targetId,
      projectileId,
      kind,
      flightMs,
      distance: computed.dist,   // { horiz, vert, eff, ... }
      timing: computed.params,   // { speedHexPerSecond, minMs, maxMs, accel, weights }
    });
  } else {
    // Even without computed.dist, initialize meta for arc settings
    projectile.meta = projectile.meta || {};
    
    // Get altitude from fighters if available
    const attackerAlt = getAltitude ? getAltitude(state, attackerId) : 0;
    const targetAlt = getAltitude ? getAltitude(state, targetId) : 0;
    
    projectile.meta.fromAlt = attackerAlt;
    projectile.meta.toAlt = targetAlt;
    
    // Optional: arrows arc, bolts flatter
    if (kind === "bolt" || kind === "techniqueBolt") {
      projectile.meta.useArc = false;
    }
  }

  // Build timeline (clock player will execute these)
  const timeScale = meta?.timeScale ?? engine?.timeScale ?? 1;
  const items = scheduleAttack({ attackerId, projectile, flightMs, timeScale });

  // On impact, call engine worker to resolve impact math
  items.push({
    t: flightMs + 1,
    e: {
      type: "ENGINE_CALL",
      method: "resolveAttackImpact",
      payload: {
        attackerId,
        targetId,
        projectileId,
        attack,
        state,
        attackSnapshot,
        ammo,
        rngState: impactRngState,
        meta,
        ruleset,
      },
    },
  });

  // Clear acting lock AFTER impact resolves + visuals are done
  items.push({
    t: flightMs + 2,
    e: {
      type: "ENGINE_CLEAR_LOCK",
      lock: { type: "entity", id: attackerId, lock: "acting" },
    },
  });

  // Emit scheduled events bundle
  const scheduleId = `sched:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  events.push({
    type: "SCHEDULED_EVENTS",
    id: scheduleId,
    kind: "attack",
    owner: { type: "entity", id: attackerId },
    locks: [{ type: "entity", id: attackerId, lock: "acting" }],
    items,
  });

  return { ok: true, events };
};
