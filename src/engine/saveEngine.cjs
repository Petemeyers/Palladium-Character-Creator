// src/engine/saveEngine.cjs

let CryptoSecureDice;
try {
  CryptoSecureDice = require("../utils/cryptoDice.js");
} catch (_) {
  CryptoSecureDice = null;
}

function rollD20() {
  if (CryptoSecureDice?.rollD20) return CryptoSecureDice.rollD20();
  return 1 + Math.floor(Math.random() * 20);
}

/**
 * Normalize save type tokens (match your game vocabulary).
 */
function normalizeSaveType(t) {
  if (!t) return "generic";
  const s = String(t).toLowerCase().trim();
  const map = {
    training: "training",
    technique: "training",
    tactical: "tactical",
    psi: "tactical",
    mind: "tactical",
    fear: "fear",
    horror: "fear",
    poison: "poison",
    toxin: "poison",
    disease: "disease",
    stun: "stun",
    paralysis: "paralysis",
    death: "death",
    generic: "generic",
  };
  return map[s] || s;
}

/**
 * Pull save bonuses from a fighter.
 * Uses ruleset if provided, otherwise falls back to hardcoded logic.
 */
function getSaveBonus(f, saveType, ruleset) {
  if (ruleset?.getSaveBonus) {
    return ruleset.getSaveBonus(f, saveType);
  }
  // Fallback to hardcoded logic
  const st = normalizeSaveType(saveType);

  // common patterns
  const bonuses = f?.bonuses || f?.stats?.bonuses || {};
  const saves = f?.saves || f?.abilities?.saves || {};

  // Priority 1: explicit keyed saves map
  if (typeof saves?.[st] === "number") return saves[st];

  // Priority 2: bonuses namespace (common in your CombatPage)
  if (st === "training") return bonuses.saveTraining ?? bonuses.trainingSave ?? 0;
  if (st === "tactical") return bonuses.saveTactical ?? bonuses.saveMind ?? 0;
  if (st === "fear") return bonuses.saveFear ?? bonuses.horrorSave ?? 0;
  if (st === "poison") return bonuses.savePoison ?? 0;
  if (st === "disease") return bonuses.saveDisease ?? 0;

  // Priority 3: generic fallback
  return bonuses.save ?? 0;
}

/**
 * Resolve a saving throw.
 *
 * Inputs:
 *  - target: fighter being affected
 *  - saveType: "training"|"tactical"|"fear"|...
 *  - dc: target number (int). If omitted, uses defaultDc.
 *  - modeOnSuccess: "half"|"negate"|"none"
 *  - modeOnFail: "none"|"double" (optional)
 *  - bonusOverride: if provided, uses this instead of getSaveBonus()
 *  - fraideredRoll: for deterministic replays if you pre-roll
 *
 * Returns:
 *  {
 *    saveType, dc, roll, bonus, total, succeeded,
 *    modeOnSuccess, modeOnFail
 *  }
 */
function resolveSave({
  target,
  saveType,
  dc,
  defaultDc = 14,
  modeOnSuccess = "half",
  modeOnFail = "none",
  bonusOverride,
  fraideredRoll,
}) {
  const st = normalizeSaveType(saveType);
  const d = Number.isFinite(dc) ? Math.floor(dc) : defaultDc;

  const roll = Number.isFinite(fraideredRoll) ? Math.floor(fraideredRoll) : rollD20();
  const bonus = Number.isFinite(bonusOverride) ? Math.floor(bonusOverride) : getSaveBonus(target, st);
  const total = roll + bonus;

  const succeeded = total >= d;

  return {
    saveType: st,
    dc: d,
    roll,
    bonus,
    total,
    succeeded,
    modeOnSuccess,
    modeOnFail,
  };
}

module.exports = {
  normalizeSaveType,
  getSaveBonus,
  resolveSave,
};

