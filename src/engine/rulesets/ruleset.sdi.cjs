// src/engine/rulesets/ruleset.sdi.cjs
// SDI / "Star Wars" missile defense ruleset plugin.
// Works with your portable core: hitEngine, saveEngine, damageEngine, reactionEngine, statusEngine, losElevationEngine.

const { makeRulesetBase } = require("./ruleset.base.cjs");

// ---------- Helpers ----------
function clamp01(x) {
  x = Number(x) || 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function clampInt(x, lo = 0, hi = 999) {
  x = Math.floor(Number(x) || 0);
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

function normType(t) {
  return t ? String(t).toLowerCase().trim() : "generic";
}

// Missile/warhead are often 1-HP "kill vehicles"
function isThreat(f) {
  const k = normType(f?.kind);
  return k === "missile" || k === "warhead" || k === "decoy" || k === "threat";
}

function isDefender(f) {
  const k = normType(f?.kind);
  return k === "satellite" || k === "radar" || k === "laser" || k === "interceptorbattery" || k === "defender";
}

function getAltitudeLike(f) {
  return clampInt(f?.altitude ?? f?.flightAltitude ?? 0, 0, 99);
}

function getECM(f) {
  // jamming in 0..1, decoys integer
  const j = clamp01(f?.ecm?.jamming ?? f?.jamming ?? 0);
  const d = clampInt(f?.ecm?.decoys ?? f?.decoys ?? 0, 0, 20);
  return { jamming: j, decoys: d };
}

function getTrackConfidence(state, targetId) {
  // If you create state.tracks keyed by targetId, use it. Otherwise default = 1 (perfect info).
  const t = state?.tracks?.[targetId];
  if (!t) return 1;
  return clamp01(t.confidence ?? 1);
}

// Effective range penalty uses horiz + vertical delta.
// You can tune vertWeight from 1..3 for "altitude is harder to reach".
function effectiveDistance(state, fromHex, toHex, fromAlt, toAlt, vertWeight = 1) {
  const { hexDistance } = require("../utils/hexLine.cjs"); // local import to avoid cycles
  const horiz = hexDistance(fromHex, toHex);
  const vert = Math.abs((fromAlt ?? 0) - (toAlt ?? 0));
  return horiz + vert * vertWeight;
}

// ---------- SDI Ruleset ----------
function makeRulesetSdi() {
  const r = makeRulesetBase();
  r.id = "sdi";

  // Hex scale/time can differ; SDI may treat 1 hex as large geographic tile.
  // Keep these as defaults you can tune.
  r.feetPerHex = 5280; // 1 mile per hex feel (optional)
  r.meleesPerMinute = 60; // "ticks" can be seconds-ish (optional)

  // --- Target numbers (AR equivalent) ---
  // For SDI, "AR" is more like "intercept difficulty" (signature/stealth/speed).
  // hitEngine asks ruleset.getAR(defender).
  r.getAR = (defender) => {
    if (!defender) return 14;

    // Threats are "hard to hit" based on speed/stealth; defaults feel good:
    // base 14, +speedFactor, +stealthFactor, -bigSignature
    const base = clampInt(defender.interceptAR ?? defender.AR ?? 14, 5, 30);

    const speed = clampInt(defender.speedHexPerTick ?? defender.speed ?? 0, 0, 20);
    const stealth = clamp01(defender.stealth ?? defender.signatureStealth ?? 0); // 0..1
    const sig = clamp01(defender.signature?.radar ?? defender.signature?.ir ?? defender.signature ?? 0.7);

    // Higher signature should make it easier (lower AR)
    const speedAdj = speed >= 6 ? 4 : speed >= 4 ? 2 : speed >= 2 ? 1 : 0;
    const stealthAdj = stealth >= 0.8 ? 4 : stealth >= 0.5 ? 2 : stealth >= 0.3 ? 1 : 0;
    const sigAdj = sig >= 0.9 ? -2 : sig >= 0.7 ? -1 : sig <= 0.3 ? +2 : 0;

    return clampInt(base + speedAdj + stealthAdj + sigAdj, 5, 30);
  };

  // --- Strike bonus (intercept guidance + fire control quality) ---
  // hitEngine asks ruleset.getStrikeBonus(attacker, kind)
  r.getStrikeBonus = (attacker, kind) => {
    const k = normType(kind);
    if (!attacker) return 0;

    // Default: a defender's guidance quality (0..1) becomes +0..+6
    const guidance = clamp01(attacker.guidanceQuality ?? attacker.fireControlQuality ?? attacker.quality ?? 0.6);
    const base = Math.floor(guidance * 6);

    // Weapon-specific aim can be passed via attacker.activeWeaponMeta if you store it;
    // otherwise keep it generic.
    const weaponBonus = clampInt(attacker.weaponBonus ?? 0, -10, 10);

    // Intercept shots get a little extra compared to normal ranged.
    if (k === "intercept") return base + weaponBonus + 2;
    if (k === "laser") return base + weaponBonus + 1;
    return base + weaponBonus;
  };

  // --- Saves model (countermeasures / ECM "defense save") ---
  // saveEngine asks ruleset.getSaveBonus(target, saveType)
  r.getSaveBonus = (target, saveType) => {
    const st = normType(saveType);
    if (!target) return 0;

    // We treat ECM as a "save bonus" against certain effects.
    const { jamming, decoys } = getECM(target);

    // jamming 0..1 => +0..+6, decoys => +0..+3
    const jamBonus = Math.floor(jamming * 6);
    const decoyBonus = Math.min(3, decoys);

    if (st === "intercept" || st === "radar" || st === "ecm") return jamBonus + decoyBonus;

    // Default generic defense
    return clampInt(target.save ?? target.defenseSave ?? 0, -10, 20);
  };

  // --- Damage type normalization ---
  r.normalizeDamageType = (t) => {
    const s = normType(t);
    const map = {
      kinetic: "kinetic",
      intercept: "kinetic",
      laser: "laser",
      beam: "laser",
      explosive: "explosive",
      frag: "explosive",
      emp: "emp",
    };
    return map[s] || s;
  };

  // --- Crit/fumble policies for SDI ---
  // You can keep nat20/nat1 semantics; SDI often uses probability instead.
  // This keeps compatibility with your hitEngine.
  r.isCrit = (d20) => d20 === 20;
  r.isFumble = (d20) => d20 === 1;
  r.critMultiplier = ({ kind }) => (normType(kind) === "intercept" ? 2 : 2);

  // --- Status rules (mostly reusable defaults) ---
  r.getStatusRule = (key) => {
    const k = String(key || "");
    if (k === "Tracked") return { unique: true, stacking: "refresh", maxStacks: 1 };
    if (k === "Jammed") return { unique: true, stacking: "refresh", maxStacks: 1 };
    if (k === "Disabled")
      return { unique: true, stacking: "refresh", maxStacks: 1, blocks: { move: true, act: true } };
    return { unique: true, stacking: "refresh", maxStacks: 1 };
  };

  // --- Reactions (anti-air "evasion" + countermeasures) ---
  // reactionEngine asks ruleset.getReactionProfile(fighter)
  r.getReactionProfile = (fighter) => {
    if (!fighter) {
      return {
        capacity: { dodge: 0, parry: 0, autoDodge: 0, mindBlock: 0 },
        bonus: { dodge: 0, parry: 0, mindBlock: 0 },
      };
    }

    // Threats "react" via evasive maneuvers and ECM bursts.
    // We map those to dodge/mindBlock to reuse reactionEngine cleanly.
    if (isThreat(fighter)) {
      const evasion = clamp01(fighter.evasion ?? fighter.maneuverability ?? 0.5); // 0..1
      const { jamming, decoys } = getECM(fighter);

      return {
        capacity: {
          dodge: clampInt(fighter.reactions?.evades ?? fighter.evades ?? 1, 0, 10),
          parry: 0,
          autoDodge: 0,
          mindBlock: clampInt(fighter.reactions?.ecmBursts ?? fighter.ecmBursts ?? 1, 0, 10),
        },
        bonus: {
          // evasion 0..1 => +0..+6
          dodge: Math.floor(evasion * 6),
          parry: 0,
          // ECM burst bonus from jamming/decoys
          mindBlock: Math.floor(jamming * 6) + Math.min(3, decoys),
        },
      };
    }

    // Defenders rarely "react" in this sense (unless you model point-defense).
    return {
      capacity: {
        dodge: clampInt(fighter.dodges ?? 0, 0, 10),
        parry: clampInt(fighter.parries ?? 0, 0, 10),
        autoDodge: 0,
        mindBlock: 0,
      },
      bonus: {
        dodge: clampInt(fighter.bonuses?.dodge ?? 0, -10, 20),
        parry: clampInt(fighter.bonuses?.parry ?? 0, -10, 20),
        mindBlock: 0,
      },
    };
  };

  // --- Altitude bounds ---
  r.maxAltitude = (fighter) => {
    if (!fighter) return 12;
    if (isDefender(fighter)) return clampInt(fighter.maxAltitude ?? 20, 0, 99);
    if (isThreat(fighter)) return clampInt(fighter.maxAltitude ?? 12, 0, 99);
    return clampInt(fighter.maxAltitude ?? 12, 0, 99);
  };

  // --- Attack lifecycle hooks (ties intercept semantics to your START/IMPACT commands) ---

  // Can this unit fire/intercept now?
  r.canAttack = ({ attacker, weapon, state }) => {
    if (!attacker) return false;

    // basic lock/cooldown gates (you can refine)
    if (attacker.cooldownUntilTurn != null && state.turnCounter < attacker.cooldownUntilTurn) return false;

    // ammo gate
    if (weapon?.ammoKey) {
      const have = clampInt(attacker.ammo?.[weapon.ammoKey] ?? 0, 0, 999);
      if (have <= 0) return false;
    }

    return true;
  };

  // Called in START phase by resolveAttack (you added this hook)
  r.onAttackStart = ({ attacker, weapon, attackKind, state, events }) => {
    const k = normType(attackKind);

    // spend ammo
    if (weapon?.ammoKey) {
      const have = clampInt(attacker.ammo?.[weapon.ammoKey] ?? 0, 0, 999);
      attacker.ammo = attacker.ammo || {};
      attacker.ammo[weapon.ammoKey] = Math.max(0, have - 1);

      events.push({
        type: "AMMO_SPENT",
        eid: attacker.id,
        ammoKey: weapon.ammoKey,
        amount: 1,
        remaining: attacker.ammo[weapon.ammoKey],
      });
    }

    // simple cooldown: intercept launches often have a short recycle
    const cd = clampInt(weapon?.cooldownTicks ?? attacker.weaponCooldownTicks ?? 0, 0, 999);
    if (cd > 0) {
      attacker.cooldownUntilTurn = (state.turnCounter ?? 0) + cd;
      events.push({
        type: "COOLDOWN_SET",
        eid: attacker.id,
        untilTurn: attacker.cooldownUntilTurn,
        ticks: cd,
      });
    }

    // optional log
    if (k === "intercept") {
      events.push({
        type: "LOG",
        level: "combat",
        message: `🛰️ ${attacker.name || attacker.id} launches interceptor.`,
      });
    }
  };

  // Called in IMPACT phase after damage is applied (optional)
  r.onAttackImpact = ({ attacker, target, weapon, state, events }) => {
    if (!target) return;

    // If kill vehicle hits 0 HP, emit a semantic event for SDI UI layers
    const hp = target.hp ?? target.HP;
    if (hp != null && hp <= 0) {
      if (isThreat(target)) {
        events.push({
          type: "THREAT_DESTROYED",
          targetId: target.id,
          by: attacker?.id ?? null,
          weapon: weapon?.name ?? null,
        });
      }
    }
  };

  // --- SDI-specific intercept effectiveness (optional helper for your attackImpact code) ---
  // If you want to keep hitEngine d20 mechanics, you can still weight them by confidence/ECM using meta bonuses.
  r.getInterceptMeta = ({ state, attacker, target, weapon }) => {
    const conf = getTrackConfidence(state, target.id);
    const { jamming, decoys } = getECM(target);

    // Convert confidence/ECM into a to-hit bonus/penalty that hitEngine can apply.
    // confidence 0..1 => -4..+2
    const confAdj = Math.round((conf - 0.6) * 10); // conf 0.6 => 0, conf 1.0 => +4, conf 0.2 => -4
    const ecmAdj = -Math.round(jamming * 6) - Math.min(2, decoys);

    // Weapon basePk influences bonus: higher pk => +0..+3
    const pk = clamp01(weapon?.pk ?? weapon?.basePk ?? 0.65);
    const pkAdj = Math.round((pk - 0.5) * 6); // pk 0.5 => 0, pk 1.0 => +3

    return {
      bonusOverride: null,
      aimBonus: confAdj + pkAdj,
      concealPenalty: 0,
      coverPenalty: 0,
      calledShotPenalty: 0,
      // Apply ECM as "concealment" penalty; keeps all penalties in one channel.
      ecmPenalty: -ecmAdj, // positive number means penalty
      _debug: { conf, jamming, decoys, confAdj, ecmAdj, pkAdj },
    };
  };

  return r;
}

module.exports = { makeRulesetSdi };
