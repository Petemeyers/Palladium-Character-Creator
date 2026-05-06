// src/engine/reactionEngine.cjs

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

/**
 * Normalize reaction types.
 */
function normalizeReactionType(t) {
  const s = String(t || "").toLowerCase().trim();
  if (["dodge", "auto-dodge", "autododge"].includes(s)) return "dodge";
  if (["parry"].includes(s)) return "parry";
  if (["mind block", "mindblock"].includes(s)) return "mindBlock";
  return s || "none";
}

/**
 * Pull reaction bonuses & capacity from fighter.
 * Uses ruleset if provided, otherwise falls back to hardcoded logic.
 */
function getReactionProfile(f, ruleset) {
  if (ruleset?.getReactionProfile) {
    return ruleset.getReactionProfile(f);
  }
  // Fallback to hardcoded logic
  const b = f?.bonuses || {};
  const r = f?.reactions || f?.abilities?.reactions || {};

  // capacity per melee
  const dodges = clampInt(r.dodges ?? b.dodges ?? f?.dodges ?? 0);
  const parries = clampInt(r.parries ?? b.parries ?? f?.parries ?? 0);
  const autoDodges = clampInt(r.autoDodges ?? b.autoDodges ?? f?.autoDodges ?? 0);
  const mindBlocks = clampInt(r.mindBlocks ?? b.mindBlocks ?? f?.mindBlocks ?? 0);

  // bonuses
  const dodgeBonus = clampInt(r.dodgeBonus ?? b.dodge ?? b.dodgeBonus ?? 0);
  const parryBonus = clampInt(r.parryBonus ?? b.parry ?? b.parryBonus ?? 0);
  const mindBlockBonus = clampInt(r.mindBlockBonus ?? b.mindBlock ?? b.mindBlockBonus ?? 0);

  return {
    capacity: { dodge: dodges, parry: parries, autoDodge: autoDodges, mindBlock: mindBlocks },
    bonus: { dodge: dodgeBonus, parry: parryBonus, mindBlock: mindBlockBonus },
  };
}

/**
 * Track reaction usage in state in an engine-authoritative way.
 * Store per fighter per melee:
 *   fighter.reactionState = { turnStamp: number, dodgeUsed: 0, parryUsed: 0, ... }
 */
function ensureReactionState(f, now) {
  if (!f.reactionState || f.reactionState.turnStamp !== now) {
    f.reactionState = { turnStamp: now, dodgeUsed: 0, parryUsed: 0, autoDodgeUsed: 0, mindBlockUsed: 0 };
  }
  return f.reactionState;
}

/**
 * Decide what reaction to attempt.
 * meta can include:
 *  - preferred: "dodge"|"parry"|"mindBlock"
 *  - allow: { dodge:true, parry:true, mindBlock:true }
 *  - forcedRoll: number (deterministic)
 */
function chooseReaction(defender, context, meta = {}, ruleset) {
  const allow = meta.allow || { dodge: true, parry: true, mindBlock: true };
  const preferred = normalizeReactionType(meta.preferred);

  const prof = getReactionProfile(defender, ruleset);
  const rs = ensureReactionState(defender, context.now);

  function has(type) {
    if (type === "dodge") return allow.dodge && rs.dodgeUsed < prof.capacity.dodge;
    if (type === "parry") return allow.parry && rs.parryUsed < prof.capacity.parry;
    if (type === "mindBlock") return allow.mindBlock && rs.mindBlockUsed < prof.capacity.mindBlock;
    return false;
  }

  // Prefer a requested one if available
  if (preferred !== "none" && has(preferred)) return preferred;

  // Default heuristics:
  // - melee: parry first, then dodge
  // - ranged: dodge first
  // - psionic mental: mindBlock first
  const kind = String(context.kind || "").toLowerCase();

  if (kind === "psionic" && has("mindBlock")) return "mindBlock";
  if (kind === "melee") {
    if (has("parry")) return "parry";
    if (has("dodge")) return "dodge";
  } else {
    if (has("dodge")) return "dodge";
    if (has("parry")) return "parry";
  }

  return "none";
}

/**
 * Resolve a reaction attempt.
 *
 * Inputs:
 *  - attackerRollTotal: the attack total that hit AR (e.g. strikeTotal)
 *  - attackerD20, attackerBonus (optional for logs)
 *  - kind: melee|ranged|psionic|magic
 *  - meta: can force choice or roll
 *  - ruleset: optional ruleset object (for getReactionProfile)
 *
 * Returns:
 *  { outcome: "hit"|"dodged"|"parried"|"blocked",
 *    reactionType, d20, bonus, total, usedKey }
 */
function resolveReaction({ defender, attackerRollTotal, context, meta, ruleset }) {
  const events = [];
  const prof = getReactionProfile(defender, ruleset);
  const rs = ensureReactionState(defender, context.now);

  const reactionType = chooseReaction(defender, context, meta, ruleset);

  if (reactionType === "none") {
    return { ok: true, events, result: { outcome: "hit", reactionType: "none" } };
  }

  const d20 = Number.isFinite(meta?.forcedRoll) ? clampInt(meta.forcedRoll) : rollD20();

  let bonus = 0;
  let usedKey = null;

  if (reactionType === "dodge") {
    bonus = prof.bonus.dodge;
    rs.dodgeUsed += 1;
    usedKey = "dodgeUsed";
  } else if (reactionType === "parry") {
    bonus = prof.bonus.parry;
    rs.parryUsed += 1;
    usedKey = "parryUsed";
  } else if (reactionType === "mindBlock") {
    bonus = prof.bonus.mindBlock;
    rs.mindBlockUsed += 1;
    usedKey = "mindBlockUsed";
  }

  const total = d20 + bonus;

  // Palladium-ish rule of thumb:
  // Reaction succeeds if reaction total >= attacker total.
  const success = total >= attackerRollTotal;

  let outcome = "hit";
  if (success) {
    if (reactionType === "parry") outcome = "parried";
    else if (reactionType === "dodge") outcome = "dodged";
    else if (reactionType === "mindBlock") outcome = "blocked";
  }

  events.push({
    type: "REACTION_ROLL",
    defenderId: defender.id,
    reactionType,
    d20,
    bonus,
    total,
    vs: attackerRollTotal,
    success,
    outcome,
  });

  events.push({
    type: "REACTION_SPENT",
    defenderId: defender.id,
    reactionType,
    usedKey,
    now: context.now,
  });

  return {
    ok: true,
    events,
    result: { outcome, reactionType, d20, bonus, total, usedKey },
  };
}

module.exports = {
  resolveReaction,
};

