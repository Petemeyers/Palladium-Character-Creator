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
  if (["melee", "hand", "strike"].includes(s)) return "melee";
  if (["ranged", "shoot", "projectile", "throw"].includes(s)) return "ranged";
  if (["magic", "spell"].includes(s)) return "magic";
  if (["psionic", "psi"].includes(s)) return "psionic";
  return s;
}

/**
 * Pull strike bonuses from fighter schema(s).
 * Uses ruleset if provided, otherwise falls back to hardcoded logic.
 */
function getStrikeBonus(attacker, kind, ruleset) {
  if (ruleset?.getStrikeBonus) {
    return ruleset.getStrikeBonus(attacker, kind);
  }
  // Fallback to hardcoded logic
  const k = normalizeAttackKind(kind);
  const b = attacker?.bonuses || attacker?.stats?.bonuses || {};

  // common
  if (k === "melee") return b.strikeMelee ?? b.meleeStrike ?? b.strike ?? 0;
  if (k === "ranged") return b.strikeRanged ?? b.rangedStrike ?? b.strike ?? 0;

  // fallback
  return b.strike ?? 0;
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
 * AR target number (Armor Rating). Higher strike must meet/exceed AR.
 * Uses ruleset if provided, otherwise falls back to hardcoded logic.
 */
function getAR(defender, ruleset) {
  if (ruleset?.getAR) {
    return ruleset.getAR(defender);
  }
  // Fallback to hardcoded logic
  return clampInt(defender?.AR ?? defender?.armorRating ?? defender?.defense?.AR ?? 10);
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
 *  meta: { aimBonus, coverPenalty, concealPenalty, calledShotPenalty, forcedRoll, bonusOverride }
 *  ruleset: optional ruleset object (for getAR, getStrikeBonus, isCrit, isFumble)
 *
 * Returns:
 * {
 *   d20, bonus, total,
 *   targetAR,
 *   hit, crit, fumble,
 *   breakdown: { ... }
 * }
 */
function resolveHit({ attacker, defender, kind, meta, ruleset }) {
  const k = normalizeAttackKind(kind);

  const d20 = Number.isFinite(meta?.forcedRoll) ? clampInt(meta.forcedRoll) : rollD20();
  const nat20 = d20 === 20;
  const nat1 = d20 === 1;

  // Use ruleset for crit/fumble if available
  const isCritCheck = ruleset?.isCrit ? ruleset.isCrit(d20) : nat20;
  const isFumbleCheck = ruleset?.isFumble ? ruleset.isFumble(d20) : nat1;

  const baseStrike = Number.isFinite(meta?.bonusOverride)
    ? clampInt(meta.bonusOverride)
    : getStrikeBonus(attacker, k, ruleset);

  const aim = getAimBonus(meta);
  const cover = getCoverPenalty(meta);
  const conceal = getConcealPenalty(meta);
  const called = getCalledShotPenalty(meta);

  // NOTE: cover/conceal/called are penalties, so subtract them.
  const bonus = baseStrike + aim - cover - conceal + called; // called likely negative
  const total = d20 + bonus;

  const targetAR = getAR(defender, ruleset);

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
    hit = total >= targetAR;
  }

  return {
    d20,
    bonus,
    total,
    targetAR,
    hit,
    crit,
    fumble,
    breakdown: {
      kind: k,
      baseStrike,
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

