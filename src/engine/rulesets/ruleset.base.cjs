// src/engine/rulesets/ruleset.base.cjs

function makeRulesetBase() {
  return {
    id: "base",

    // Scale & time
    feetPerHex: 5,
    meleesPerMinute: 10,

    // --- Combat math adapters (core calls these) ---
    getAR: (defender) => defender?.AR ?? 10,
    getStrikeBonus: (attacker, kind) => (attacker?.bonuses?.strike ?? 0),
    getSaveBonus: (target, saveType) => (target?.bonuses?.save ?? 0),

    // Crit/fumble policies
    isCrit: (d20) => d20 === 20,
    isFumble: (d20) => d20 === 1,
    critMultiplier: (ctx) => 2,

    // Damage type normalization
    normalizeDamageType: (t) => (t ? String(t).toLowerCase() : "generic"),

    // Status rules table hook
    getStatusRule: (key) => ({
      unique: true,
      stacking: "refresh",
      maxStacks: 1,
    }),

    // Reactions
    getReactionProfile: (fighter) => ({
      capacity: {
        dodge: fighter?.dodges ?? 0,
        parry: fighter?.parries ?? 0,
        mindBlock: fighter?.mindBlocks ?? 0,
      },
      bonus: {
        dodge: fighter?.bonuses?.dodge ?? 0,
        parry: fighter?.bonuses?.parry ?? 0,
        mindBlock: fighter?.bonuses?.mindBlock ?? 0,
      },
    }),

    // Flight bounds
    maxAltitude: (fighter) => fighter?.maxAltitude ?? 6,

    // SDI sensor model (optional)
    detectChance: ({ sensorQuality, signature, jamming }) => {
      const p = sensorQuality * signature - jamming;
      return Math.max(0, Math.min(1, p));
    },
  };
}

module.exports = { makeRulesetBase };

