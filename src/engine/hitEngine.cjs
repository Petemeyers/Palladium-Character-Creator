// src/engine/hitEngine.cjs

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

function clampInt(n) {
  n = Math.floor(Number(n) || 0);
  return n;
}

function normalizeAttackKind(kind) {
  const s = String(kind || "melee").toLowerCase().trim();
  if (["melee", "hand", "attack"].includes(s)) return "melee";
  if (["ranged", "shoot", "projectile", "throw"].includes(s)) return "ranged";
  if (["training", "technique"].includes(s)) return "training";
  if (["tactical", "psi"].includes(s)) return "tactical";
  return s;
}

/**
 * Pull attack bonuses from fighter schema(s).
 * Uses ruleset if provided, otherwise falls back to hardcoded logic.
 */
function getAttackBonus(attacker, kind, ruleset) {
  if (ruleset?.getAttackBonus) {
    return ruleset.getAttackBonus(attacker, kind);
  }
  // Fallback to hardcoded logic
  const k = normalizeAttackKind(kind);
  const b = attacker?.bonuses || attacker?.stats?.bonuses || {};

  // common
  if (k === "melee") return b.attackMelee ?? b.meleeAttack ?? b.attack ?? 0;
  if (k === "ranged") return b.attackRanged ?? b.rangedAttack ?? b.attack ?? 0;

  // fallback
  return b.attack ?? 0;
}

function getAimBonus(meta) {
  // meta.aim turns or meta.aimBonus can contribute.
  if (!meta) return 0;
  if (Number.isFinite(meta.aimBonus)) return clampInt(meta.aimBonus);
  if (Number.isFinite(meta.aimTurns)) return clampInt(meta.aimTurns); // simple: +1 per aim turn
  return 0;
}

function getCoverPenalty(meta) {
  // represent cover as a penalty to hit (positive number reduces hit chance)
  if (!meta) return 0;
  if (Number.isFinite(meta.coverPenalty)) return clampInt(meta.coverPenalty);
  // optionally: meta.cover = "light"|"medium"|"heavy"
  const c = String(meta.cover || "").toLowerCase();
  if (c === "light") return 1;
  if (c === "medium") return 2;
  if (c === "heavy") return 4;
  return 0;
}

function getConcealPenalty(meta) {
  if (!meta) return 0;
  if (Number.isFinite(meta.concealPenalty)) return clampInt(meta.concealPenalty);
  const c = String(meta.conceal || "").toLowerCase();
  if (c === "light") return 1;
  if (c === "medium") return 2;
  if (c === "heavy") return 4;
  return 0;
}

/**
 * guardRating target number (Armor Rating). Higher attack must meet/exceed guardRating.
 * Uses ruleset if provided, otherwise falls back to hardcoded logic.
 */
function getAR(defender, ruleset) {
  if (ruleset?.getAR) {
    return ruleset.getAR(defender);
  }
  // Fallback to hardcoded logic
  return clampInt(defender?.guardRating ?? defender?.guardRating ?? defender?.defense?.guardRating ?? 10);
}

/**
 * Called shot / difficult shot modifiers:
 * meta.calledShotPenalty can be -4 etc (negative decreases to-hit)
 */
function getCalledShotPenalty(meta) {
  if (!meta) return 0;
  if (Number.isFinite(meta.calledShotPenalty)) return clampInt(meta.calledShotPenalty);
  return 0;
}

/**
 * Resolve hit chance.
 *
 * Inputs:
 *  attacker, defender
 *  kind: "melee"|"ranged"|...
 *  meta: { aimBonus, coverPenalty, concealPenalty, calledShotPenalty, fraideredRoll, bonusOverride }
 *  ruleset: optional ruleset object (for getAR, getAttackBonus, isCrit, isFumble)
 *
 * Returns:
 * {
 *   d20, bonus, total,
 *   targetGuardRating,
 *   hit, crit, fumble,
 *   breakdown: { ... }
 * }
 */
function resolveHit({ attacker, defender, kind, meta, ruleset }) {
  const k = normalizeAttackKind(kind);

  const d20 = Number.isFinite(meta?.fraideredRoll) ? clampInt(meta.fraideredRoll) : rollD20();
  const nat20 = d20 === 20;
  const nat1 = d20 === 1;

  // Use ruleset for crit/fumble if available
  const isCritCheck = ruleset?.isCrit ? ruleset.isCrit(d20) : nat20;
  const isFumbleCheck = ruleset?.isFumble ? ruleset.isFumble(d20) : nat1;

  const baseAttack = Number.isFinite(meta?.bonusOverride)
    ? clampInt(meta.bonusOverride)
    : getAttackBonus(attacker, k, ruleset);

  const aim = getAimBonus(meta);
  const cover = getCoverPenalty(meta);
  const conceal = getConcealPenalty(meta);
  const called = getCalledShotPenalty(meta);

  // NOTE: cover/conceal/called are penalties, so subtract them.
  const bonus = baseAttack + aim - cover - conceal + called; // called likely negative
  const total = d20 + bonus;

  const targetGuardRating = getAR(defender, ruleset);

  // Use ruleset for crit/fumble logic if available
  let hit = false;
  let crit = false;
  let fumble = false;

  if (isCritCheck) {
    hit = true;
    crit = true;
  } else if (isFumbleCheck) {
    hit = false;
    fumble = true;
  } else {
    hit = total >= targetGuardRating;
  }

  return {
    d20,
    bonus,
    total,
    targetGuardRating,
    hit,
    crit,
    fumble,
    breakdown: {
      kind: k,
      baseAttack,
      aim,
      coverPenalty: cover,
      concealPenalty: conceal,
      calledShotPenalty: called,
      nat20,
      nat1,
    },
  };
}

module.exports = {
  resolveHit,
};

