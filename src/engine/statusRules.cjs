// src/engine/statusRules.cjs

const STATUS_RULES = {
  Stunned: {
    unique: true,
    stacking: "refresh", // refresh | stack | replace | ignore
    maxStacks: 1,
    blocks: { move: true, act: true },
  },
  Paralyzed: {
    unique: true,
    stacking: "refresh",
    maxStacks: 1,
    blocks: { move: true, act: true },
  },
  Asleep: {
    unique: true,
    stacking: "refresh",
    maxStacks: 1,
    blocks: { move: true, act: true },
  },
  Prone: {
    unique: true,
    stacking: "ignore",
    maxStacks: 1,
    modifiers: { dodge: -2, strike: -2 },
  },
  Poisoned: {
    unique: true,
    stacking: "stack",
    maxStacks: 5,
    // optional: per-tick damage can be handled in advanceStatuses
    tickDamage: "1d6",
    tickEvery: 1, // every melee
  },
  Hasted: {
    unique: true,
    stacking: "refresh",
    maxStacks: 1,
    modifiers: { ap: +1 },
  },
};

// Fallback rule if key not found
const DEFAULT_RULE = {
  unique: true,
  stacking: "refresh",
  maxStacks: 1,
};

function getStatusRule(key) {
  return STATUS_RULES[key] || DEFAULT_RULE;
}

module.exports = { STATUS_RULES, getStatusRule };

