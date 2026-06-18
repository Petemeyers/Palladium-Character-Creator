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
  if (["evade", "auto-evade", "autoevade"].includes(s)) return "evade";
  if (["block"].includes(s)) return "block";
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
  const evades = clampInt(r.evades ?? b.evades ?? f?.evades ?? 0);
  const parries = clampInt(r.parries ?? b.parries ?? f?.parries ?? 0);
  const autoEvades = clampInt(r.autoEvades ?? b.autoEvades ?? f?.autoEvades ?? 0);
  const mindBlocks = clampInt(r.mindBlocks ?? b.mindBlocks ?? f?.mindBlocks ?? 0);

  // bonuses
  const evadeBonus = clampInt(r.evadeBonus ?? b.evade ?? b.evadeBonus ?? 0);
  const blockBonus = clampInt(r.blockBonus ?? b.block ?? b.blockBonus ?? 0);
  const mindBlockBonus = clampInt(r.mindBlockBonus ?? b.mindBlock ?? b.mindBlockBonus ?? 0);

  return {
    capacity: { evade: evades, block: parries, autoEvade: autoEvades, mindBlock: mindBlocks },
    bonus: { evade: evadeBonus, block: blockBonus, mindBlock: mindBlockBonus },
  };
}

/**
 * Track reaction usage in state in an engine-authoritative way.
 * Store per fighter per melee:
 *   fighter.reactionState = { turnStamp: number, evadeUsed: 0, blockUsed: 0, ... }
 */
function ensureReactionState(f, now) {
  if (!f.reactionState || f.reactionState.turnStamp !== now) {
    f.reactionState = { turnStamp: now, evadeUsed: 0, blockUsed: 0, autoEvadeUsed: 0, mindBlockUsed: 0 };
  }
  return f.reactionState;
}

/**
 * Decide what reaction to attempt.
 * meta can include:
 *  - preferred: "evade"|"block"|"mindBlock"
 *  - allow: { evade:true, block:true, mindBlock:true }
 *  - fraideredRoll: number (deterministic)
 */
function chooseReaction(defender, context, meta = {}, ruleset) {
  const allow = meta.allow || { evade: true, block: true, mindBlock: true };
  const preferred = normalizeReactionType(meta.preferred);

  const prof = getReactionProfile(defender, ruleset);
  const rs = ensureReactionState(defender, context.now);

  function has(type) {
    if (type === "evade") return allow.evade && rs.evadeUsed < prof.capacity.evade;
    if (type === "block") return allow.block && rs.blockUsed < prof.capacity.block;
    if (type === "mindBlock") return allow.mindBlock && rs.mindBlockUsed < prof.capacity.mindBlock;
    return false;
  }

  // Prefer a requested one if available
  if (preferred !== "none" && has(preferred)) return preferred;

  // Default heuristics:
  // - melee: block first, then evade
  // - ranged: evade first
  // - tactical mental: mindBlock first
  const kind = String(context.kind || "").toLowerCase();

  if (kind === "tactical" && has("mindBlock")) return "mindBlock";
  if (kind === "melee") {
    if (has("block")) return "block";
    if (has("evade")) return "evade";
  } else {
    if (has("evade")) return "evade";
    if (has("block")) return "block";
  }

  return "none";
}

/**
 * Resolve a reaction attempt.
 *
 * Inputs:
 *  - attackerRollTotal: the attack total that hit guardRating (e.g. attackTotal)
 *  - attackerD20, attackerBonus (optional for logs)
 *  - kind: melee|ranged|tactical|training
 *  - meta: can fraidere choice or roll
 *  - ruleset: optional ruleset object (for getReactionProfile)
 *
 * Returns:
 *  { outcome: "hit"|"evaded"|"parried"|"blocked",
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

  const d20 = Number.isFinite(meta?.fraideredRoll) ? clampInt(meta.fraideredRoll) : rollD20();

  let bonus = 0;
  let usedKey = null;

  if (reactionType === "evade") {
    bonus = prof.bonus.evade;
    rs.evadeUsed += 1;
    usedKey = "evadeUsed";
  } else if (reactionType === "block") {
    bonus = prof.bonus.block;
    rs.blockUsed += 1;
    usedKey = "blockUsed";
  } else if (reactionType === "mindBlock") {
    bonus = prof.bonus.mindBlock;
    rs.mindBlockUsed += 1;
    usedKey = "mindBlockUsed";
  }

  const total = d20 + bonus;

  // Medieval Combat Simulator-ish rule of thumb:
  // Reaction succeeds if reaction total >= attacker total.
  const success = total >= attackerRollTotal;

  let outcome = "hit";
  if (success) {
    if (reactionType === "block") outcome = "parried";
    else if (reactionType === "evade") outcome = "evaded";
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

