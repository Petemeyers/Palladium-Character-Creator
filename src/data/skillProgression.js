/**
 * Skill progression by level for Medieval Combat Simulator
 * All bonuses scale with character level
 */

export const handToHandProgression = {
  // Hand to Hand (Soldier)
  "Hand to Hand (Soldier)": {
    attacks: { 2: 2, 5: 3, 9: 4, 14: 5 },
    bonuses: {
      1: { attack: 0, block: 0, evade: 0, damage: 1 },
      3: { attack: 0, block: 3, evade: 3, damage: 0 },
      4: { attack: 0, block: 0, evade: 0, damage: 2 },
      6: { attack: 0, block: 0, evade: 0, damage: 3 },
      8: { attack: 0, block: 0, evade: 0, damage: 4 },
      10: { attack: 0, block: 0, evade: 0, damage: 5 },
      12: { attack: 0, block: 4, evade: 4, damage: 0 },
      13: { attack: 0, block: 0, evade: 0, damage: 6 },
      15: { attack: 0, block: 5, evade: 5, damage: 0 },
    },
    specials: {
      7: { criticalAttack: "18-20" },
      11: { stun: "18-20" },
    },
  },

  // Hand to Hand (Mercenary)
  "Hand to Hand (Mercenary)": {
    attacks: { 3: 2, 6: 3, 9: 4, 12: 4, 15: 5 },
    bonuses: {
      1: { attack: 0, block: 0, evade: 0, damage: 1 },
      2: { attack: 0, block: 2, evade: 2, damage: 0 },
      4: { attack: 0, block: 0, evade: 0, damage: 2 },
      5: { attack: 0, block: 3, evade: 3, damage: 0 },
      8: { attack: 0, block: 0, evade: 0, damage: 3 },
      10: { attack: 0, block: 0, evade: 0, damage: 0 }, // Stun replaces damage
      11: { attack: 0, block: 0, evade: 0, damage: 4 },
      13: { attack: 0, block: 0, evade: 0, damage: 5 },
      14: { attack: 0, block: 4, evade: 4, damage: 0 },
    },
    specials: {
      7: { criticalAttack: "19-20" },
      9: { kickDamage: "1D6" },
      10: { stun: "18-20" },
    },
  },

  // Hand to Hand: Basic (Non-Men of Arms)
  "Hand to Hand: Basic": {
    attacks: { 4: 2, 9: 3, 14: 4 },
    bonuses: {
      1: { attack: 0, block: 0, evade: 2, damage: 0 },
      2: { attack: 0, block: 1, evade: 0, damage: 0 },
      3: { attack: 0, block: 0, evade: 0, damage: 2 },
      7: { attack: 0, block: 2, evade: 0, damage: 0 },
      8: { attack: 0, block: 3, evade: 3, damage: 0 },
      10: { attack: 0, block: 0, evade: 0, damage: 3 },
      11: { attack: 0, block: 0, evade: 0, damage: 0 }, // Crit replaces damage
      12: { attack: 0, block: 4, evade: 4, damage: 0 },
      13: { attack: 0, block: 0, evade: 0, damage: 4 },
      15: { attack: 0, block: 5, evade: 5, damage: 0 },
    },
    specials: {
      5: { kickDamage: "1D6" },
      6: { criticalAttack: "from behind" },
      11: { criticalAttack: "19-20" },
    },
  },

  // Hand to Hand (Knight)
  "Hand to Hand (Knight)": {
    attacks: { 2: 2, 5: 3, 9: 4, 13: 5 },
    bonuses: {
      1: { attack: 0, block: 0, evade: 0, damage: 2 },
      3: { attack: 0, block: 0, evade: 0, damage: 3 },
      4: { attack: 0, block: 3, evade: 3, damage: 0 },
      8: { attack: 0, block: 0, evade: 0, damage: 4 },
      10: { attack: 0, block: 0, evade: 0, damage: 0 }, // Stun replaces damage
      11: { attack: 0, block: 4, evade: 4, damage: 0 },
      12: { attack: 0, block: 0, evade: 0, damage: 5 },
      13: { attack: 2, block: 0, evade: 0, damage: 0 },
      15: { attack: 0, block: 5, evade: 5, damage: 0 },
    },
    specials: {
      5: { kickDamage: "1D6" },
      7: { criticalAttack: "18-20" },
      10: { stun: "18-20" },
    },
  },

  // Hand to Hand (Paladin)
  "Hand to Hand (Paladin)": {
    attacks: { 2: 2, 5: 3, 9: 4, 13: 5 },
    bonuses: {
      1: { attack: 0, block: 0, evade: 0, damage: 2 },
      3: { attack: 0, block: 2, evade: 2, damage: 0 },
      4: { attack: 0, block: 0, evade: 0, damage: 4 },
      7: { attack: 0, block: 0, evade: 0, damage: 0 }, // Kick replaces damage
      8: { attack: 0, block: 0, evade: 0, damage: 0 }, // Stun replaces damage
      10: { attack: 0, block: 0, evade: 0, damage: 5 },
      11: { attack: 0, block: 3, evade: 3, damage: 0 },
      12: { attack: 2, block: 0, evade: 0, damage: 0 },
      13: { attack: 0, block: 0, evade: 0, damage: 6 },
      15: { attack: 0, block: 4, evade: 4, damage: 0 },
    },
    specials: {
      6: { criticalAttack: "17-20" },
      7: { kickDamage: "1D6" },
      8: { stun: "18-20" },
    },
  },

  // Hand to Hand (Long Bowman)
  "Hand to Hand (Long Bowman)": {
    attacks: { 3: 2, 7: 3, 11: 4, 15: 5 },
    bonuses: {
      1: { attack: 0, block: 0, evade: 2, damage: 0 },
      2: { attack: 0, block: 0, evade: 0, damage: 1 },
      4: { attack: 0, block: 2, evade: 0, damage: 0 },
      6: { attack: 0, block: 0, evade: 0, damage: 0 }, // Crit replaces damage
      8: { attack: 0, block: 0, evade: 0, damage: 3 },
      9: { attack: 0, block: 3, evade: 3, damage: 0 },
      10: { attack: 0, block: 0, evade: 0, damage: 4 },
      12: { attack: 0, block: 4, evade: 4, damage: 0 },
      13: { attack: 0, block: 0, evade: 0, damage: 4 },
      14: { attack: 2, block: 0, evade: 0, damage: 0 },
    },
    specials: {
      5: { kickDamage: "1D6" },
      6: { criticalAttack: "18-20 (with bow)" },
    },
  },

  // Hand to Hand (Assassin)
  "Hand to Hand (Assassin)": {
    attacks: { 3: 2, 7: 3, 9: 4 },
    bonuses: {
      1: { attack: 0, block: 0, evade: 0, damage: 2 },
      2: { attack: 0, block: 1, evade: 0, damage: 0 },
      4: { attack: 0, block: 3, evade: 3, damage: 0 },
      5: { attack: 0, block: 0, evade: 0, damage: 3 },
      7: { attack: 0, block: 0, evade: 0, damage: 0 }, // Kick replaces damage
      8: { attack: 0, block: 0, evade: 0, damage: 3 },
      10: { attack: 0, block: 0, evade: 0, damage: 4 },
      11: { attack: 0, block: 4, evade: 4, damage: 0 },
      12: { attack: 0, block: 0, evade: 0, damage: 4 },
      13: { attack: 0, block: 0, evade: 0, damage: 4 },
      14: { attack: 0, block: 5, evade: 5, damage: 0 },
      15: { attack: 0, block: 0, evade: 0, damage: 5 },
    },
    specials: {
      6: { criticalAttack: "18-20" },
      7: { kickDamage: "1D6" },
    },
  },

  // Hand to Hand (Ranger)
  "Hand to Hand (Ranger)": {
    attacks: { 2: 2, 4: 3, 9: 4, 14: 5 },
    bonuses: {
      1: { attack: 0, block: 0, evade: 0, damage: 1 },
      3: { attack: 0, block: 0, evade: 0, damage: 2 },
      4: { attack: 0, block: 0, evade: 0, damage: 3 },
      6: { attack: 0, block: 2, evade: 0, damage: 0 },
      8: { attack: 0, block: 0, evade: 0, damage: 4 },
      10: { attack: 0, block: 0, evade: 0, damage: 0 }, // Stun replaces damage
      11: { attack: 0, block: 3, evade: 3, damage: 0 },
      12: { attack: 0, block: 4, evade: 4, damage: 0 },
      13: { attack: 2, block: 0, evade: 0, damage: 0 },
      15: { attack: 0, block: 5, evade: 5, damage: 0 },
    },
    specials: {
      7: { criticalAttack: "19-20" },
      10: { stun: "18-20" },
    },
  },

  // Hand to Hand (Thief)
  "Hand to Hand (Thief)": {
    attacks: { 4: 2, 9: 3, 14: 4 },
    bonuses: {
      1: { attack: 0, block: 0, evade: 2, damage: 0 },
      2: { attack: 0, block: 1, evade: 0, damage: 0 },
      3: { attack: 0, block: 0, evade: 0, damage: 2 },
      6: { attack: 0, block: 0, evade: 0, damage: 0 }, // Crit replaces damage
      7: { attack: 0, block: 2, evade: 0, damage: 0 },
      8: { attack: 0, block: 0, evade: 0, damage: 3 },
      10: { attack: 0, block: 0, evade: 0, damage: 3 },
      11: { attack: 0, block: 0, evade: 0, damage: 0 }, // Crit replaces damage
      12: { attack: 0, block: 4, evade: 4, damage: 0 },
      13: { attack: 0, block: 0, evade: 0, damage: 4 },
      14: { attack: 0, block: 5, evade: 5, damage: 0 },
      15: { attack: 0, block: 0, evade: 0, damage: 5 },
    },
    specials: {
      6: { criticalAttack: "from behind" },
      11: { criticalAttack: "19-20" },
    },
  },

  // Legacy support - map old names to new ones
  "Hand to Hand: Expert": {
    attacks: { 1: 3, 3: 4, 6: 5, 9: 6, 12: 7, 15: 8 },
    bonuses: {
      1: { attack: 1, block: 3, evade: 3, damage: 1 },
      2: { attack: 0, block: 0, evade: 1, damage: 0 },
      4: { attack: 1, block: 0, evade: 0, damage: 0 },
      6: { attack: 0, block: 1, evade: 1, damage: 1 },
      8: { attack: 1, block: 0, evade: 1, damage: 0 },
      10: { attack: 0, block: 1, evade: 0, damage: 1 },
      12: { attack: 1, block: 0, evade: 1, damage: 0 },
      14: { attack: 0, block: 1, evade: 1, damage: 0 },
    },
  },
  "Hand to Hand: Martial Arts": {
    attacks: { 1: 4, 2: 5, 4: 6, 7: 7, 10: 8, 13: 9, 15: 10 },
    bonuses: {
      1: { attack: 2, block: 3, evade: 3, damage: 2 },
      2: { attack: 0, block: 0, evade: 1, damage: 0 },
      3: { attack: 1, block: 1, evade: 0, damage: 0 },
      5: { attack: 0, block: 0, evade: 1, damage: 1 },
      7: { attack: 1, block: 1, evade: 1, damage: 0 },
      9: { attack: 0, block: 0, evade: 1, damage: 1 },
      11: { attack: 1, block: 1, evade: 0, damage: 0 },
      13: { attack: 0, block: 0, evade: 1, damage: 1 },
      15: { attack: 1, block: 1, evade: 1, damage: 0 },
    },
  },
  "Hand to Hand: Assassin": {
    attacks: { 1: 4, 3: 5, 6: 6, 9: 7, 12: 8, 15: 9 },
    bonuses: {
      1: { attack: 2, block: 2, evade: 2, damage: 3 },
      3: { attack: 1, block: 0, evade: 1, damage: 0 },
      5: { attack: 0, block: 1, evade: 0, damage: 1 },
      7: { attack: 1, block: 0, evade: 1, damage: 0 },
      9: { attack: 0, block: 1, evade: 1, damage: 1 },
      11: { attack: 1, block: 0, evade: 0, damage: 1 },
      13: { attack: 0, block: 1, evade: 1, damage: 0 },
      15: { attack: 1, block: 0, evade: 1, damage: 1 },
    },
  },
  "Hand to Hand: Mercenary": {
    attacks: { 1: 3, 3: 4, 6: 5, 9: 6, 12: 7, 15: 8 },
    bonuses: {
      1: { attack: 1, block: 2, evade: 2, damage: 1 },
      3: { attack: 1, block: 0, evade: 1, damage: 0 },
      6: { attack: 0, block: 1, evade: 0, damage: 1 },
      9: { attack: 1, block: 1, evade: 1, damage: 0 },
      12: { attack: 0, block: 0, evade: 1, damage: 1 },
      15: { attack: 1, block: 1, evade: 0, damage: 0 },
    },
  },
  "Hand to Hand: Knight": {
    attacks: { 1: 3, 3: 4, 6: 5, 9: 6, 12: 7, 15: 8 },
    bonuses: {
      1: { attack: 1, block: 3, evade: 2, damage: 1 },
      3: { attack: 0, block: 1, evade: 1, damage: 0 },
      5: { attack: 1, block: 0, evade: 0, damage: 1 },
      7: { attack: 0, block: 1, evade: 1, damage: 0 },
      9: { attack: 1, block: 0, evade: 1, damage: 1 },
      11: { attack: 0, block: 1, evade: 0, damage: 0 },
      13: { attack: 1, block: 1, evade: 1, damage: 0 },
      15: { attack: 0, block: 0, evade: 1, damage: 1 },
    },
  },
};

export const physicalSkillProgression = {
  Boxing: {
    attacks: { 1: 1, 5: 0, 10: 1 }, // +1 attack at L1, +1 more at L10
    bonuses: {
      1: { attack: 1, block: 2, evade: 2, damage: 0 },
      3: { attack: 0, block: 1, evade: 0, damage: 0 },
      6: { attack: 1, block: 0, evade: 1, damage: 0 },
      9: { attack: 0, block: 1, evade: 1, damage: 0 },
      12: { attack: 1, block: 0, evade: 0, damage: 0 },
    },
  },
  Wrestling: {
    attacks: { 1: 1, 7: 0, 13: 1 }, // +1 attack at L1, +1 more at L13
    bonuses: {
      1: { attack: 0, block: 0, evade: 1, damage: 0 },
      4: { attack: 0, block: 0, evade: 1, damage: 0 },
      8: { attack: 0, block: 1, evade: 0, damage: 0 },
      12: { attack: 0, block: 0, evade: 1, damage: 0 },
    },
  },
  // "Body Building": {  // Removed - not in 1994 rulebook, can add back later
  //   attacks: {},
  //   bonuses: {
  //     1: { attack: 0, block: 0, evade: 0, damage: 2 },
  //     5: { attack: 0, block: 0, evade: 0, damage: 1 },
  //     10: { attack: 0, block: 0, evade: 0, damage: 1 },
  //     15: { attack: 0, block: 0, evade: 0, damage: 1 },
  //   },
  // },
  Acrobatics: {
    attacks: {},
    bonuses: {
      1: { attack: 0, block: 1, evade: 2, damage: 0 },
      3: { attack: 0, block: 0, evade: 1, damage: 0 },
      6: { attack: 0, block: 1, evade: 0, damage: 0 },
      9: { attack: 0, block: 0, evade: 1, damage: 0 },
      12: { attack: 0, block: 1, evade: 1, damage: 0 },
    },
  },
  Gymnastics: {
    attacks: {},
    bonuses: {
      1: { attack: 0, block: 1, evade: 1, damage: 0 },
      4: { attack: 0, block: 0, evade: 1, damage: 0 },
      8: { attack: 0, block: 1, evade: 0, damage: 0 },
      12: { attack: 0, block: 0, evade: 1, damage: 0 },
    },
  },
};


// ---- RULEBOOK-CORRECTED HAND TO HAND TABLE (Medieval Combat Simulator 2nd ed 1994) ----
Object.assign(handToHandProgression, {
  "Hand to Hand (Soldier)": {
    "mode": "state",
    "attacks": {
      2: 2,
      5: 3,
      9: 4,
      14: 5
    },
    "bonuses": {
      1: {
        "damage": 1
      },
      3: {
        "block": 3,
        "evade": 3
      },
      4: {
        "damage": 2
      },
      6: {
        "damage": 3
      },
      8: {
        "damage": 4
      },
      10: {
        "damage": 5
      },
      12: {
        "block": 4,
        "evade": 4
      },
      13: {
        "damage": 6
      },
      15: {
        "block": 5,
        "evade": 5
      }
    },
    "specials": {
      7: {
        "criticalAttack": "18-20"
      },
      11: {
        "stun": "18-20"
      }
    }
  },
  "Hand to Hand (Mercenary)": {
    "mode": "state",
    "attacks": {
      3: 2,
      6: 3,
      12: 4,
      15: 5
    },
    "bonuses": {
      1: {
        "damage": 1
      },
      2: {
        "block": 2,
        "evade": 2
      },
      4: {
        "damage": 2
      },
      5: {
        "block": 3,
        "evade": 3
      },
      8: {
        "damage": 3
      },
      11: {
        "damage": 4
      },
      13: {
        "damage": 5
      },
      14: {
        "block": 4,
        "evade": 4
      }
    },
    "specials": {
      7: {
        "criticalAttack": "19-20"
      },
      9: {
        "kickDamage": "1-6"
      },
      10: {
        "stun": "18-20"
      }
    }
  },
  "Hand to Hand (Non-Men of Arms)": {
    "mode": "state",
    "attacks": {
      4: 2,
      9: 3,
      14: 4
    },
    "bonuses": {
      1: {
        "evade": 2
      },
      2: {
        "block": 1
      },
      3: {
        "damage": 2
      },
      8: {
        "block": 3,
        "evade": 3
      },
      10: {
        "damage": 3
      },
      12: {
        "block": 4,
        "evade": 4
      },
      13: {
        "damage": 4
      },
      15: {
        "block": 5,
        "evade": 5
      },
      7: {
        "block": 2
      }
    },
    "specials": {
      5: {
        "kickDamage": "1-6"
      },
      6: {
        "criticalAttack": "from behind"
      },
      11: {
        "criticalAttack": "19-20"
      }
    }
  }
});
export const weaponProficiencyProgression = {
  // Melee Weapon Training
  // Chart shows cumulative totals - converting to incremental bonuses
  "Weapon Training: Axe": {
    bonuses: {
      1: { attack: 1, block: 0, evade: 0, damage: 0 }, // Level 1: +1 attack (total +1)
      2: { attack: 1, block: 0, evade: 0, damage: 0 }, // Level 2: +2 attack total (+1 more)
      3: { attack: 0, block: 2, evade: 0, damage: 0 }, // Level 3: +2 block (+2 new)
      4: { attack: 1, block: 0, evade: 0, damage: 0 }, // Level 4: +3 attack total (+1 more)
      5: { attack: 0, block: 1, evade: 0, damage: 0 }, // Level 5: +3 block total (+1 more)
      6: { attack: 1, block: 0, evade: 0, damage: 0 }, // Level 6: +4 attack total (+1 more)
      7: { attack: 0, block: 1, evade: 0, damage: 0 }, // Level 7: +4 block total (+1 more)
      8: { attack: 1, block: 0, evade: 0, damage: 0 }, // Level 8: +5 attack total (+1 more)
      9: { attack: 0, block: 1, evade: 0, damage: 0 }, // Level 9: +5 block total (+1 more)
      10: { attack: 1, block: 0, evade: 0, damage: 0 }, // Level 10+: +6 attack total (+1 more)
    },
  },
  "Weapon Training: Blunt Weapons": {
    bonuses: {
      1: { attack: 1, block: 0, evade: 0, damage: 0 },
      2: { attack: 0, block: 1, evade: 0, damage: 0 },
      3: { attack: 2, block: 0, evade: 0, damage: 0 },
      4: { attack: 0, block: 2, evade: 0, damage: 0 },
      5: { attack: 3, block: 0, evade: 0, damage: 0 },
      6: { attack: 0, block: 3, evade: 0, damage: 0 },
      7: { attack: 4, block: 0, evade: 0, damage: 0 },
      8: { attack: 0, block: 4, evade: 0, damage: 0 },
      9: { attack: 5, block: 0, evade: 0, damage: 0 },
      10: { attack: 0, block: 5, evade: 0, damage: 0 },
    },
  },
  "Weapon Training: Chain Weapons": {
    bonuses: {
      1: { attack: 1, block: 0, evade: 0, damage: 0 },
      2: { attack: 0, block: 1, evade: 0, damage: 0 },
      3: { attack: 2, block: 0, evade: 0, damage: 0 },
      4: { attack: 0, block: 2, evade: 0, damage: 0 },
      5: { attack: 3, block: 0, evade: 0, damage: 0 },
      6: { attack: 0, block: 3, evade: 0, damage: 0 },
      7: { attack: 4, block: 0, evade: 0, damage: 0 },
      8: { attack: 0, block: 4, evade: 0, damage: 0 },
      9: { attack: 5, block: 0, evade: 0, damage: 0 },
      10: { attack: 0, block: 5, evade: 0, damage: 0 },
    },
  },
  "Weapon Training: Knife": {
    bonuses: {
      1: { attack: 1, block: 0, evade: 0, damage: 0 },
      2: { attack: 2, block: 0, evade: 0, damage: 0 },
      3: { attack: 0, block: 2, evade: 0, damage: 0 },
      4: { attack: 3, block: 0, evade: 0, damage: 0 },
      5: { attack: 0, block: 3, evade: 0, damage: 0 },
      6: { attack: 4, block: 0, evade: 0, damage: 0 },
      7: { attack: 0, block: 4, evade: 0, damage: 0 },
      8: { attack: 5, block: 0, evade: 0, damage: 0 },
      9: { attack: 0, block: 5, evade: 0, damage: 0 },
      10: { attack: 6, block: 0, evade: 0, damage: 0 },
    },
  },
  "Weapon Training: Polearms": {
    bonuses: {
      1: { attack: 1, block: 0, evade: 0, damage: 0 },
      2: { attack: 2, block: 0, evade: 0, damage: 0 },
      3: { attack: 0, block: 2, evade: 0, damage: 0 },
      4: { attack: 3, block: 0, evade: 0, damage: 0 },
      5: { attack: 0, block: 3, evade: 0, damage: 0 },
      6: { attack: 4, block: 0, evade: 0, damage: 0 },
      7: { attack: 0, block: 4, evade: 0, damage: 0 },
      8: { attack: 5, block: 0, evade: 0, damage: 0 },
      9: { attack: 0, block: 5, evade: 0, damage: 0 },
      10: { attack: 6, block: 0, evade: 0, damage: 0 },
    },
  },
  "Weapon Training: Spear": {
    bonuses: {
      1: { attack: 1, block: 0, evade: 0, damage: 0 },
      2: { attack: 2, block: 0, evade: 0, damage: 0 },
      3: { attack: 0, block: 2, evade: 0, damage: 0 },
      4: { attack: 3, block: 0, evade: 0, damage: 0 },
      5: { attack: 0, block: 3, evade: 0, damage: 0 },
      6: { attack: 4, block: 0, evade: 0, damage: 0 },
      7: { attack: 0, block: 4, evade: 0, damage: 0 },
      8: { attack: 5, block: 0, evade: 0, damage: 0 },
      9: { attack: 0, block: 5, evade: 0, damage: 0 },
      10: { attack: 6, block: 0, evade: 0, damage: 0 },
    },
  },
  "Weapon Training: Short Sword": {
    bonuses: {
      1: { attack: 1, block: 0, evade: 0, damage: 0 },
      2: { attack: 0, block: 1, evade: 0, damage: 0 },
      3: { attack: 2, block: 0, evade: 0, damage: 0 },
      4: { attack: 0, block: 2, evade: 0, damage: 0 },
      5: { attack: 3, block: 0, evade: 0, damage: 0 },
      6: { attack: 0, block: 3, evade: 0, damage: 0 },
      7: { attack: 4, block: 0, evade: 0, damage: 0 },
      8: { attack: 0, block: 4, evade: 0, damage: 0 },
      9: { attack: 5, block: 0, evade: 0, damage: 0 },
      10: { attack: 0, block: 5, evade: 0, damage: 0 },
    },
  },
  "Weapon Training: Sword": {
    bonuses: {
      1: { attack: 1, block: 0, evade: 0, damage: 0 },
      2: { attack: 0, block: 1, evade: 0, damage: 0 },
      3: { attack: 2, block: 0, evade: 0, damage: 0 },
      4: { attack: 0, block: 2, evade: 0, damage: 0 },
      5: { attack: 3, block: 0, evade: 0, damage: 0 },
      6: { attack: 0, block: 3, evade: 0, damage: 0 },
      7: { attack: 4, block: 0, evade: 0, damage: 0 },
      8: { attack: 0, block: 4, evade: 0, damage: 0 },
      9: { attack: 5, block: 0, evade: 0, damage: 0 },
      10: { attack: 0, block: 5, evade: 0, damage: 0 },
    },
  },
  "Weapon Training: Staff": {
    bonuses: {
      1: { attack: 1, block: 0, evade: 0, damage: 0 },
      2: { attack: 0, block: 2, evade: 0, damage: 0 },
      3: { attack: 2, block: 0, evade: 0, damage: 0 },
      4: { attack: 0, block: 3, evade: 0, damage: 0 },
      5: { attack: 3, block: 0, evade: 0, damage: 0 },
      6: { attack: 0, block: 4, evade: 0, damage: 0 },
      7: { attack: 4, block: 0, evade: 0, damage: 0 },
      8: { attack: 0, block: 5, evade: 0, damage: 0 },
      9: { attack: 5, block: 0, evade: 0, damage: 0 },
      10: { attack: 0, block: 5, evade: 0, damage: 0 },
    },
  },
  "Weapon Training: Small Shield": {
    bonuses: {
      1: { attack: 0, block: 1, evade: 0, damage: 0 },
      2: { attack: 0, block: 2, evade: 0, damage: 0 },
      3: { attack: 0, block: 3, evade: 0, damage: 0 },
      4: { attack: 0, block: 4, evade: 0, damage: 0 },
      5: { attack: 0, block: 5, evade: 0, damage: 0 },
      6: { attack: 0, block: 5, evade: 0, damage: 0 },
      7: { attack: 0, block: 6, evade: 0, damage: 0 },
      8: { attack: 0, block: 6, evade: 0, damage: 0 },
      9: { attack: 0, block: 7, evade: 0, damage: 0 },
      10: { attack: 0, block: 7, evade: 0, damage: 0 },
    },
  },
  "Weapon Training: Large Shield": {
    bonuses: {
      1: { attack: 0, block: 1, evade: 0, damage: 0 },
      2: { attack: 0, block: 2, evade: 0, damage: 0 },
      3: { attack: 0, block: 3, evade: 0, damage: 0 },
      4: { attack: 0, block: 4, evade: 0, damage: 0 },
      5: { attack: 0, block: 5, evade: 0, damage: 0 },
      6: { attack: 0, block: 5, evade: 0, damage: 0 },
      7: { attack: 0, block: 6, evade: 0, damage: 0 },
      8: { attack: 0, block: 6, evade: 0, damage: 0 },
      9: { attack: 0, block: 7, evade: 0, damage: 0 },
      10: { attack: 0, block: 7, evade: 0, damage: 0 },
    },
  },
  "Weapon Training: Shield": {
    bonuses: {
      1: { attack: 0, block: 1, evade: 0, damage: 0 },
      2: { attack: 0, block: 2, evade: 0, damage: 0 },
      3: { attack: 0, block: 3, evade: 0, damage: 0 },
      4: { attack: 0, block: 4, evade: 0, damage: 0 },
      5: { attack: 0, block: 5, evade: 0, damage: 0 },
      6: { attack: 0, block: 5, evade: 0, damage: 0 },
      7: { attack: 0, block: 6, evade: 0, damage: 0 },
      8: { attack: 0, block: 6, evade: 0, damage: 0 },
      9: { attack: 0, block: 7, evade: 0, damage: 0 },
      10: { attack: 0, block: 7, evade: 0, damage: 0 },
    },
  },
  "Weapon Training: Lance": {
    bonuses: {
      1: { attack: 1, block: 0, evade: 0, damage: 0 },
      2: { attack: 2, block: 0, evade: 0, damage: 0 },
      3: { attack: 3, block: 0, evade: 0, damage: 0 },
      4: { attack: 4, block: 0, evade: 0, damage: 0 },
      5: { attack: 5, block: 0, evade: 0, damage: 0 },
      6: { attack: 5, block: 0, evade: 0, damage: 0 },
      7: { attack: 6, block: 0, evade: 0, damage: 0 },
      8: { attack: 6, block: 0, evade: 0, damage: 0 },
      9: { attack: 7, block: 0, evade: 0, damage: 0 },
      10: { attack: 7, block: 0, evade: 0, damage: 0 },
    },
    note: "Mounted use only (Knights & Paladins)",
  },

  // Missile Weapon Training
  "Weapon Training: Sling": {
    bonuses: {
      1: { attack: 0, block: 0, evade: 0, damage: 0 },
      2: { attack: 1, block: 0, evade: 0, damage: 0 },
      3: { attack: 0, block: 0, evade: 0, damage: 0 },
      4: { attack: 2, block: 0, evade: 0, damage: 0 },
      6: { attack: 3, block: 0, evade: 0, damage: 0 },
      8: { attack: 4, block: 0, evade: 0, damage: 0 },
      10: { attack: 5, block: 0, evade: 0, damage: 0 },
      12: { attack: 6, block: 0, evade: 0, damage: 0 },
      14: { attack: 7, block: 0, evade: 0, damage: 0 },
    },
    rateOfFire: {
      1: 2,
      3: 3,
      4: 4,
      5: 5,
      6: 6,
      7: 7,
      9: 8,
      10: 8,
      11: 9,
      12: 9,
      13: 10,
      14: 10,
      15: 10,
    },
    maxRange: 300, // feet
  },
  "Weapon Training: Short Bow": {
    bonuses: {
      1: { attack: 0, block: 0, evade: 0, damage: 0 },
      2: { attack: 1, block: 0, evade: 0, damage: 0 },
      4: { attack: 2, block: 0, evade: 0, damage: 0 },
      6: { attack: 3, block: 0, evade: 0, damage: 0 },
      8: { attack: 4, block: 0, evade: 0, damage: 0 },
      10: { attack: 5, block: 0, evade: 0, damage: 0 },
      13: { attack: 6, block: 0, evade: 0, damage: 0 },
      15: { attack: 7, block: 0, evade: 0, damage: 0 },
    },
    rateOfFire: {
      1: 1,
      2: 2,
      4: 3,
      5: 4,
      7: 5,
      9: 6,
      11: 7,
      13: 8,
      15: 9,
    },
    maxRange: 480, // feet
  },
  "Weapon Training: Crossbow": {
    bonuses: {
      1: { attack: 0, block: 0, evade: 0, damage: 0 },
      2: { attack: 1, block: 0, evade: 0, damage: 0 },
      4: { attack: 2, block: 0, evade: 0, damage: 0 },
      6: { attack: 3, block: 0, evade: 0, damage: 0 },
      8: { attack: 4, block: 0, evade: 0, damage: 0 },
      11: { attack: 5, block: 0, evade: 0, damage: 0 },
      14: { attack: 6, block: 0, evade: 0, damage: 0 },
    },
    rateOfFire: {
      1: 1,
      2: 2,
      4: 3,
      6: 4,
      9: 5,
      12: 6,
      15: 7,
    },
    maxRange: 700, // feet
  },
  "Weapon Training: Long Bow": {
    bonuses: {
      1: { attack: 0, block: 0, evade: 0, damage: 0 },
      2: { attack: 1, block: 0, evade: 0, damage: 0 },
      3: { attack: 2, block: 0, evade: 0, damage: 0 },
      4: { attack: 3, block: 0, evade: 0, damage: 0 },
      6: { attack: 4, block: 0, evade: 0, damage: 0 },
      8: { attack: 5, block: 0, evade: 0, damage: 0 },
      11: { attack: 6, block: 0, evade: 0, damage: 0 },
      14: { attack: 7, block: 0, evade: 0, damage: 0 },
    },
    rateOfFire: {
      1: 2,
      2: 3,
      4: 4,
      5: 5,
      6: 6,
      7: 7,
      8: 8,
      11: 8,
      14: 9,
      15: 9,
    },
    maxRange: 800, // feet (restricted to Long Bowman & Ranger profession)
  },
  "Weapon Training: Bow": {
    bonuses: {
      1: { attack: 0, block: 0, evade: 0, damage: 0 },
      2: { attack: 1, block: 0, evade: 0, damage: 0 },
      4: { attack: 2, block: 0, evade: 0, damage: 0 },
      6: { attack: 3, block: 0, evade: 0, damage: 0 },
      8: { attack: 4, block: 0, evade: 0, damage: 0 },
      10: { attack: 5, block: 0, evade: 0, damage: 0 },
      13: { attack: 6, block: 0, evade: 0, damage: 0 },
      15: { attack: 7, block: 0, evade: 0, damage: 0 },
    },
    rateOfFire: {
      1: 1,
      2: 2,
      4: 3,
      5: 4,
      7: 5,
      9: 6,
      11: 7,
      13: 8,
      15: 9,
    },
    maxRange: 480, // feet (defaults to Short Bow range)
  },
  "Weapon Training: Garrote": {
    bonuses: {
      1: { attack: 1, block: 0, evade: 0, damage: 0 },
      5: { attack: 1, block: 0, evade: 0, damage: 1 },
      10: { attack: 1, block: 0, evade: 0, damage: 1 },
    },
  },
  "Weapon Training: Net": {
    bonuses: {
      1: { attack: 1, block: 0, evade: 0, damage: 0 },
      4: { attack: 1, block: 0, evade: 0, damage: 0 },
      8: { attack: 1, block: 0, evade: 0, damage: 0 },
    },
  },
  "Weapon Training: Cutlass": {
    bonuses: {
      1: { attack: 1, block: 1, evade: 0, damage: 0 },
      3: { attack: 1, block: 0, evade: 0, damage: 0 },
      6: { attack: 0, block: 1, evade: 0, damage: 0 },
      9: { attack: 1, block: 1, evade: 0, damage: 0 },
    },
  },
  "Weapon Training: Harpoon": {
    bonuses: {
      1: { attack: 1, block: 0, evade: 0, damage: 0 },
      5: { attack: 1, block: 0, evade: 0, damage: 0 },
      10: { attack: 1, block: 0, evade: 0, damage: 1 },
    },
  },
  "Weapon Training: Pistol Crossbow": {
    bonuses: {
      1: { attack: 1, block: 0, evade: 0, damage: 0 },
      5: { attack: 1, block: 0, evade: 0, damage: 0 },
      10: { attack: 1, block: 0, evade: 0, damage: 0 },
    },
  },
  "Weapon Training: Club": {
    bonuses: {
      1: { attack: 1, block: 1, evade: 0, damage: 0 },
      4: { attack: 1, block: 0, evade: 0, damage: 0 },
      8: { attack: 0, block: 1, evade: 0, damage: 0 },
      12: { attack: 1, block: 1, evade: 0, damage: 0 },
    },
  },
};

// ========== ELECTIVE SKILL PERCENTAGE PRHEAVY_FIGHTERSSIONS ==========

export const electiveSkillPercentages = {
  "Pick Locks": {
    percentages: {
      1: 12,
      2: 20,
      3: 25,
      4: 30,
      5: 40,
      6: 50,
      7: 55,
      8: 60,
      9: 65,
      10: 70,
      11: 75,
      12: 80,
      13: 83,
      14: 86,
      15: 89,
    },
  },
  "Pick Pockets": {
    percentages: {
      1: 10,
      2: 15,
      3: 20,
      4: 25,
      5: 30,
      6: 35,
      7: 42,
      8: 50,
      9: 55,
      10: 60,
      11: 65,
      12: 70,
      13: 75,
      14: 80,
      15: 85,
    },
  },
  Prowl: {
    percentages: {
      1: 18,
      2: 24,
      3: 30,
      4: 36,
      5: 42,
      6: 48,
      7: 54,
      8: 60,
      9: 66,
      10: 72,
      11: 78,
      12: 84,
      13: 90,
      14: 92,
      15: 94,
    },
  },
  "Read/Write": {
    percentages: {
      1: 20,
      2: 26,
      3: 32,
      4: 38,
      5: 44,
      6: 50,
      7: 56,
      8: 62,
      9: 68,
      10: 74,
      11: 80,
      12: 86,
      13: 88,
      14: 90,
      15: 92,
    },
    iqBonus: { threshold: 12, bonus: 10 }, // +10% if IQ >= 12
  },
  "Read/Write (Native Language)": {
    percentages: {
      1: 20,
      2: 26,
      3: 32,
      4: 38,
      5: 44,
      6: 50,
      7: 56,
      8: 62,
      9: 68,
      10: 74,
      11: 80,
      12: 86,
      13: 88,
      14: 90,
      15: 92,
    },
    iqBonus: { threshold: 12, bonus: 10 },
  },
};

// ---- Original weapon training progression tables ----
Object.assign(weaponProficiencyProgression, {
  "Weapon Training: Short Sword": {
    "mode": "state",
    "bonuses": {
      1: {
        "attack": 1,
        "block": 1
      },
      2: {
        "throwAttack": 1
      },
      3: {
        "attack": 2
      },
      4: {
        "block": 2
      },
      6: {
        "attack": 3,
        "throwAttack": 2
      },
      7: {
        "block": 3
      },
      9: {
        "attack": 4
      },
      10: {
        "throwAttack": 3
      },
      11: {
        "block": 4
      },
      12: {
        "attack": 5
      },
      13: {
        "throwAttack": 4
      },
      14: {
        "block": 5
      },
      15: {
        "attack": 6
      }
    }
  },
  "Weapon Training: Long Sword": {
    "mode": "state",
    "bonuses": {
      1: {
        "attack": 1
      },
      2: {
        "block": 1
      },
      3: {
        "attack": 2,
        "block": 2
      },
      5: {
        "block": 3,
        "throwAttack": 1
      },
      6: {
        "attack": 3
      },
      7: {
        "block": 4
      },
      9: {
        "attack": 4,
        "block": 5
      },
      10: {
        "throwAttack": 2
      },
      11: {
        "block": 6
      },
      12: {
        "attack": 5
      },
      13: {
        "throwAttack": 3
      },
      14: {
        "block": 7
      },
      15: {
        "attack": 6
      }
    }
  },
  "Weapon Training: Knives": {
    "mode": "state",
    "bonuses": {
      1: {
        "throwAttack": 1
      },
      2: {
        "attack": 1
      },
      3: {
        "block": 1,
        "throwAttack": 2
      },
      4: {
        "attack": 2
      },
      5: {
        "throwAttack": 3
      },
      6: {
        "block": 2
      },
      7: {
        "attack": 3,
        "throwAttack": 4
      },
      9: {
        "block": 3,
        "throwAttack": 5
      },
      10: {
        "attack": 4
      },
      11: {
        "throwAttack": 6
      },
      12: {
        "block": 4
      },
      13: {
        "attack": 5,
        "throwAttack": 7
      },
      15: {
        "block": 5,
        "throwAttack": 8
      }
    }
  },
  "Weapon Training: Throwing Axe": {
    "mode": "state",
    "bonuses": {
      1: {
        "throwAttack": 1
      },
      2: {
        "attack": 1
      },
      3: {
        "throwAttack": 2
      },
      4: {
        "attack": 2,
        "block": 1
      },
      5: {
        "throwAttack": 3
      },
      6: {
        "block": 2
      },
      7: {
        "attack": 3,
        "throwAttack": 4
      },
      9: {
        "block": 3
      },
      10: {
        "attack": 4,
        "throwAttack": 5
      },
      12: {
        "block": 4
      },
      13: {
        "attack": 5,
        "throwAttack": 6
      },
      15: {
        "block": 5
      }
    }
  },
  "Weapon Training: Battle Axe": {
    "mode": "state",
    "bonuses": {
      1: {
        "attack": 1
      },
      2: {
        "throwAttack": 1
      },
      3: {
        "attack": 2,
        "block": 1
      },
      4: {
        "throwAttack": 2
      },
      5: {
        "attack": 3
      },
      6: {
        "block": 2
      },
      7: {
        "throwAttack": 3
      },
      8: {
        "attack": 4
      },
      9: {
        "block": 3
      },
      10: {
        "throwAttack": 4
      },
      11: {
        "attack": 5
      },
      12: {
        "block": 4
      },
      13: {
        "throwAttack": 5
      },
      14: {
        "attack": 6
      },
      15: {
        "block": 5
      }
    }
  },
  "Weapon Training: Lance": {
    "mode": "state",
    "bonuses": {
      1: {
        "attack": 1
      },
      2: {
        "attack": 2
      },
      3: {
        "block": 1
      },
      4: {
        "attack": 3,
        "throwAttack": 1
      },
      6: {
        "attack": 4,
        "block": 2
      },
      7: {
        "throwAttack": 2
      },
      8: {
        "attack": 5
      },
      9: {
        "block": 3
      },
      10: {
        "attack": 6,
        "throwAttack": 3
      },
      12: {
        "attack": 7,
        "block": 4
      },
      13: {
        "throwAttack": 4
      },
      14: {
        "attack": 8
      },
      15: {
        "block": 5
      }
    }
  },
  "Weapon Training: Small Shield": {
    "mode": "state",
    "bonuses": {
      1: {
        "block": 1
      },
      2: {
        "block": 2
      },
      3: {
        "attack": 1,
        "block": 3,
        "throwAttack": 1
      },
      5: {
        "attack": 2,
        "block": 4,
        "throwAttack": 2
      },
      7: {
        "attack": 3,
        "block": 5,
        "throwAttack": 3
      },
      9: {
        "attack": 4,
        "block": 6,
        "throwAttack": 4
      },
      11: {
        "attack": 5,
        "block": 7,
        "throwAttack": 5
      },
      13: {
        "attack": 6,
        "block": 8,
        "throwAttack": 6
      },
      15: {
        "attack": 7,
        "block": 9,
        "throwAttack": 7
      }
    }
  },
  "Weapon Training: Large Shield": {
    "mode": "state",
    "bonuses": {
      1: {
        "block": 2
      },
      3: {
        "attack": 1,
        "block": 3
      },
      4: {
        "block": 4,
        "throwAttack": 1
      },
      5: {
        "attack": 2,
        "block": 5
      },
      7: {
        "attack": 3,
        "block": 6,
        "throwAttack": 3
      },
      9: {
        "attack": 4,
        "block": 7
      },
      10: {
        "throwAttack": 3
      },
      11: {
        "attack": 5,
        "block": 8
      },
      13: {
        "attack": 6,
        "throwAttack": 4
      },
      14: {
        "block": 9
      },
      15: {
        "attack": 7
      }
    }
  },
  "Weapon Training: Sling": {
    "mode": "state",
    "bonuses": {
      2: {
        "attack": 1
      },
      4: {
        "attack": 2
      },
      6: {
        "attack": 3
      },
      8: {
        "attack": 4
      },
      10: {
        "attack": 5
      },
      12: {
        "attack": 6
      },
      14: {
        "attack": 7
      }
    },
    "specials": {
      1: {
        "rateOfFire": 2
      },
      3: {
        "rateOfFire": 3
      },
      4: {
        "rateOfFire": 4
      },
      6: {
        "rateOfFire": 5
      },
      7: {
        "rateOfFire": 6
      },
      9: {
        "rateOfFire": 7
      },
      11: {
        "rateOfFire": 8
      },
      13: {
        "rateOfFire": 9
      },
      15: {
        "rateOfFire": 10
      }
    }
  },
  "Weapon Training: Short Bow": {
    "mode": "state",
    "bonuses": {
      2: {
        "attack": 1
      },
      4: {
        "attack": 2
      },
      6: {
        "attack": 3
      },
      8: {
        "attack": 4
      },
      10: {
        "attack": 5
      },
      13: {
        "attack": 6
      },
      15: {
        "attack": 7
      }
    },
    "specials": {
      1: {
        "rateOfFire": 1
      },
      2: {
        "rateOfFire": 2
      },
      4: {
        "rateOfFire": 3
      },
      5: {
        "rateOfFire": 4
      },
      7: {
        "rateOfFire": 5
      },
      9: {
        "rateOfFire": 6
      },
      11: {
        "rateOfFire": 7
      },
      13: {
        "rateOfFire": 8
      },
      15: {
        "rateOfFire": 9
      }
    }
  },
  "Weapon Training: Crossbow": {
    "mode": "state",
    "bonuses": {
      2: {
        "attack": 1
      },
      4: {
        "attack": 2
      },
      6: {
        "attack": 3
      },
      8: {
        "attack": 4
      },
      11: {
        "attack": 5
      },
      14: {
        "attack": 6
      }
    },
    "specials": {
      1: {
        "rateOfFire": 1
      },
      2: {
        "rateOfFire": 2
      },
      4: {
        "rateOfFire": 3
      },
      6: {
        "rateOfFire": 4
      },
      9: {
        "rateOfFire": 5
      },
      12: {
        "rateOfFire": 6
      },
      15: {
        "rateOfFire": 7
      }
    }
  },
  "Weapon Training: Long Bow": {
    "mode": "state",
    "bonuses": {
      2: {
        "attack": 1
      },
      3: {
        "attack": 2
      },
      4: {
        "attack": 3
      },
      6: {
        "attack": 4
      },
      8: {
        "attack": 5
      },
      11: {
        "attack": 6
      },
      14: {
        "attack": 7
      }
    },
    "specials": {
      1: {
        "rateOfFire": 2
      },
      2: {
        "rateOfFire": 3
      },
      4: {
        "rateOfFire": 4
      },
      5: {
        "rateOfFire": 5
      },
      7: {
        "rateOfFire": 6
      },
      9: {
        "rateOfFire": 7
      },
      11: {
        "rateOfFire": 8
      },
      14: {
        "rateOfFire": 9
      }
    }
  }
});

export const disguiseForgeryDowsingPercentages = {
  Disguise: {
    create: {
      1: 20,
      2: 25,
      3: 30,
      4: 35,
      5: 40,
      6: 45,
      7: 50,
      8: 55,
      9: 60,
    },
    recognize: {
      1: 20,
      2: 40,
      3: 60,
      4: 80,
      5: 100,
      6: 140,
      7: 180,
      8: 220,
      9: 260,
    },
  },
  Forgery: {
    create: {
      1: 12,
      2: 20,
      3: 28,
      4: 36,
      5: 44,
      6: 52,
      7: 60,
      8: 68,
    },
    recognize: {
      1: 30,
      2: 60,
      3: 90,
      4: 120,
      5: 150,
      6: 200,
      7: 250,
      8: 300,
    },
  },
  Dowsing: {
    percentages: {
      1: 20,
      2: 30,
      3: 40,
      4: 50,
      5: 60,
      6: 70,
      7: 80,
      8: 84,
    },
  },
};

export const identifyLocateMedicalPercentages = {
  "Identify Plants/Fruit": {
    percentages: {
      first: {
        1: 8,
        2: 16,
        3: 24,
        4: 32,
        5: 40,
        6: 48,
        7: 56,
        8: 64,
        9: 72,
        10: 76,
        11: 80,
        12: 84,
        13: 88,
        14: 90,
        15: 94,
      },
      second: {
        1: 19,
        2: 18,
        3: 26,
        4: 34,
        5: 42,
        6: 50,
        7: 58,
        8: 66,
        9: 74,
        10: 78,
        11: 82,
        12: 86,
        13: 90,
        14: 92,
        15: 96,
      },
    },
  },
  "Identify Plants/Fruits": {
    percentages: {
      first: {
        1: 8,
        2: 16,
        3: 24,
        4: 32,
        5: 40,
        6: 48,
        7: 56,
        8: 64,
        9: 72,
        10: 76,
        11: 80,
        12: 84,
        13: 88,
        14: 90,
        15: 94,
      },
      second: {
        1: 19,
        2: 18,
        3: 26,
        4: 34,
        5: 42,
        6: 50,
        7: 58,
        8: 66,
        9: 74,
        10: 78,
        11: 82,
        12: 86,
        13: 90,
        14: 92,
        15: 96,
      },
    },
  },
  "Identify Tracks": {
    percentages: {
      first: {
        1: 20,
        2: 25,
        3: 30,
        4: 36,
        5: 42,
        6: 48,
        7: 54,
        8: 60,
        9: 66,
        10: 72,
        11: 78,
        12: 84,
        13: 90,
        14: 92,
        15: 94,
      },
      second: {
        1: 50,
        2: 10,
        3: 15,
        4: 20,
        5: 25,
        6: 30,
        7: 35,
        8: 40,
        9: 45,
        10: 50,
        11: 55,
        12: 60,
        13: 65,
        14: 70,
        15: 75,
      },
    },
  },
  "Locate Secret Compartments/Doors": {
    percentages: {
      1: 6,
      2: 12,
      3: 18,
      4: 24,
      5: 30,
      6: 36,
      7: 42,
      8: 48,
      9: 54,
      10: 60,
      11: 66,
      12: 72,
      13: 78,
      14: 84,
      15: 90,
    },
  },
  Medical: {
    percentages: {
      first: {
        1: 28,
        2: 36,
        3: 44,
        4: 52,
        5: 60,
        6: 68,
        7: 76,
        8: 84,
        9: 88,
        10: 90,
        11: 92,
        12: 94,
        13: 95,
        14: 96,
        15: 97,
      },
      second: {
        1: 32,
        2: 40,
        3: 48,
        4: 56,
        5: 64,
        6: 72,
        7: 80,
        8: 88,
        9: 90,
        10: 92,
        11: 94,
        12: 95,
        13: 96,
        14: 97,
        15: 98,
      },
    },
  },
};

// ========== SECONDARY SKILL profession BONUSES ==========
// These bonuses apply when skills are chosen as Secondary Skills

export const secondarySkillBonuses = {
  Carpentry: 10,
  "Scout Lore": 10,
  "Plant/Farm Lore": 12,
  "Preserve Food": 10,
  "Sense of Direction": 5,
  Sing: 5,
  Swim: 8,
  "Speak Additional Language": 20,
  "Imitate Voices": 10,
  "Recognize Poison": 15,
  "Recognize Precious Metals/Stones": 15,
  "Recognize Weapon Quality": 12,
  "Religious Doctrine": 15,
  Tailor: 10,
  Ventriloquism: 6,
};

/**
 * Calculate cumulative skill bonuses up to a given level
 * @param {Object} progression - Skill progression object (bonuses by level)
 * @param {number} level - Current character level
 * @returns {Object} - Cumulative bonuses { attack, block, evade, damage }
 */
function getCumulativeSkillBonuses(progression, level) {
  // "Cumulative" mode = treat each listed bonus as an increment and sum all thresholds <= level.
  if (!progression || !progression.bonuses) {
    return { attack: 0, block: 0, evade: 0, damage: 0, throwAttack: 0 };
  }

  const cumulative = {
    attack: 0,
    block: 0,
    evade: 0,
    damage: 0,
    throwAttack: 0,
  };

  Object.keys(progression.bonuses).forEach((threshold) => {
    const thresholdLevel = Number(threshold);
    if (level >= thresholdLevel) {
      const bonusEntry = progression.bonuses[threshold];

      cumulative.attack += bonusEntry.attack || 0;
      cumulative.block += bonusEntry.block || 0;
      cumulative.evade += bonusEntry.evade || 0;
      cumulative.damage += bonusEntry.damage || 0;
      cumulative.throwAttack += bonusEntry.throwAttack || 0;
    }
  });

  return cumulative;
}

function getStateSkillBonuses(progression, level) {
  // "State" mode = tables list the *current total* at specific levels.
  // A 0 in a column means "no change" (carry forward previous total).
  if (!progression || !progression.bonuses) {
    return { attack: 0, block: 0, evade: 0, damage: 0, throwAttack: 0 };
  }

  const totals = {
    attack: 0,
    block: 0,
    evade: 0,
    damage: 0,
    throwAttack: 0,
  };

  const levels = Object.keys(progression.bonuses)
    .map(Number)
    .filter((threshold) => level >= threshold)
    .sort((a, b) => a - b);

  for (const lvl of levels) {
    const entry = progression.bonuses[lvl];
    if (!entry) continue;

    for (const k of Object.keys(entry)) {
      const v = entry[k];
      // In Medieval Combat Simulator tables, 0 means "unchanged", so we only update on non-zero.
      if (typeof v === 'number' && v !== 0) totals[k] = v;
    }
  }

  return totals;
}

function getCumulativeAttackBonus(progression, level, defaultAttacks = 1) {
  if (!progression || !progression.attacks) {
    return defaultAttacks;
  }

  // Actions-per-round tables in Medieval Combat Simulator are "state" tables:
  // you use the highest threshold <= current level (not a sum).
  const applicableLevels = Object.keys(progression.attacks)
    .map(Number)
    .filter((threshold) => level >= threshold)
    .sort((a, b) => b - a);

  if (applicableLevels.length === 0) {
    return defaultAttacks;
  }

  const highestLevel = applicableLevels[0];
  return progression.attacks[highestLevel] ?? defaultAttacks;
}

/**
 * Get special abilities for a skill at a specific level
 * @param {Object} progression - Skill progression object
 * @param {number} level - Current character level
 * @returns {Object} - Special abilities { criticalAttack, stun, kickDamage }
 */
function getSpecialAbilities(progression, level) {
  if (!progression || !progression.specials) {
    return {};
  }

  const specials = {};

  // Get the most recent special ability up to current level
  Object.keys(progression.specials).forEach((threshold) => {
    if (level >= parseInt(threshold)) {
      Object.assign(specials, progression.specials[threshold]);
    }
  });

  return specials;
}

/**
 * Get skill percentage at a specific level
 * @param {string} skillName - Name of the skill
 * @param {number} level - Character level
 * @param {number} iq - Character IQ (for Read/Write bonus)
 * @returns {number|Object|null} - Skill percentage or object with first/second percentages, or null if not found
 */
export function getSkillPercentageAtLevel(skillName, level, iq = 0) {
  // Check elective skill percentages
  if (electiveSkillPercentages[skillName]) {
    const skill = electiveSkillPercentages[skillName];
    const percentage = skill.percentages[level] || skill.percentages[15] || 0;

    // Apply IQ bonus for Read/Write if applicable
    if (skill.iqBonus && iq >= skill.iqBonus.threshold) {
      return Math.min(98, percentage + skill.iqBonus.bonus);
    }

    return percentage;
  }

  // Check disguise/forgery/dowsing
  if (disguiseForgeryDowsingPercentages[skillName]) {
    const skill = disguiseForgeryDowsingPercentages[skillName];
    if (skill.percentages) {
      // Single percentage skill (Dowsing)
      return skill.percentages[level] || skill.percentages[8] || 0;
    }
    // Dual percentage skills (Disguise, Forgery) - return object
    return {
      create:
        skill.create[level] ||
        skill.create[Object.keys(skill.create).pop()] ||
        0,
      recognize:
        skill.recognize[level] ||
        skill.recognize[Object.keys(skill.recognize).pop()] ||
        0,
    };
  }

  // Check identify/locate/medical
  if (identifyLocateMedicalPercentages[skillName]) {
    const skill = identifyLocateMedicalPercentages[skillName];
    if (skill.percentages) {
      // Single percentage skill (Locate Secret Compartments/Doors)
      return skill.percentages[level] || skill.percentages[15] || 0;
    }
    // Dual percentage skills (Identify Plants/Fruit, Identify Tracks, Medical)
    return {
      first: skill.percentages.first[level] || skill.percentages.first[15] || 0,
      second:
        skill.percentages.second[level] || skill.percentages.second[15] || 0,
    };
  }

  return null;
}

/**
 * Get secondary skill bonus
 * @param {string} skillName - Name of the skill
 * @returns {number} - Bonus percentage (0 if not a secondary skill with bonus)
 */
export function getSecondarySkillBonus(skillName) {
  return secondarySkillBonuses[skillName] || 0;
}

/**
 * Get weapon proficiency rate of fire at a specific level
 * @param {string} skillName - Name of the weapon proficiency
 * @param {number} level - Character level
 * @returns {number} - Rate of fire (actions per round)
 */
export function getWeaponRateOfFire(skillName, level) {
  const progression = weaponProficiencyProgression[skillName];
  if (!progression || !progression.rateOfFire) {
    return 0;
  }

  // Get the highest rate of fire up to current level
  let maxRate = 0;
  Object.keys(progression.rateOfFire).forEach((threshold) => {
    if (level >= parseInt(threshold)) {
      maxRate = Math.max(maxRate, progression.rateOfFire[threshold] || 0);
    }
  });

  return maxRate;
}

/**
 * Get weapon proficiency maximum range
 * @param {string} skillName - Name of the weapon proficiency
 * @returns {number} - Maximum range in feet (0 if not a ranged weapon)
 */
export function getWeaponMaxRange(skillName) {
  const progression = weaponProficiencyProgression[skillName];
  return progression?.maxRange || 0;
}

/**
 * Get skill bonuses for a character at a specific level
 * @param {string} skillName - Name of the skill
 * @param {number} level - Character level
 * @returns {Object} - { bonuses: {attack, block, evade, damage}, attacks: number, specials: {} }
 */
export function getSkillBonusesAtLevel(skillName, level) {
  let progression = null;

  // Map common variations to standard names
  const skillMappings = {
    "Hand to Hand (Soldier)": "Hand to Hand (Soldier)",
    "Hand to Hand (Mercenary)": "Hand to Hand (Mercenary)",
    "Hand to Hand (Knight)": "Hand to Hand (Knight)",
    "Hand to Hand (Paladin)": "Hand to Hand (Paladin)",
    "Hand to Hand (Ranger)": "Hand to Hand (Ranger)",
    "Hand to Hand (Thief)": "Hand to Hand (Thief)",
    "Hand to Hand (Assassin)": "Hand to Hand (Assassin)",
    "Hand to Hand (Long Bowman)": "Hand to Hand (Long Bowman)",
    "Hand to Hand: Basic": "Hand to Hand: Basic",
  };

  const mappedName = skillMappings[skillName] || skillName;

  // Map weapon proficiency aliases to canonical names
  const wpAliases = {
    // plural/singular/typos
    "Weapon Training: Knife": "Weapon Training: Knives",
    "Weapon Training: Knives": "Weapon Training: Knives",
    "Weapon Training: Dagger": "Weapon Training: Knives",

    "Weapon Training: Staff": "Weapon Training: Staves",
    "Weapon Training: Stave": "Weapon Training: Staves",
    "Weapon Training: Staves": "Weapon Training: Staves",

    "Weapon Training: Spear": "Weapon Training: Spears",
    "Weapon Training: Spear": "Weapon Training: Spears",
    "Weapon Training: Spears": "Weapon Training: Spears",
    "Weapon Training: Spears": "Weapon Training: Spears",

    "Weapon Training: Short Swords": "Weapon Training: Short Sword",
    "Weapon Training: Short Sword": "Weapon Training: Short Sword",

    "Weapon Training: Long Swords": "Weapon Training: Long Sword",
    "Weapon Training: Long Sword": "Weapon Training: Long Sword",
    "Weapon Training: Sword": "Weapon Training: Long Sword",
    "Weapon Training: Swords": "Weapon Training: Long Sword",

    // If your profession data uses the generic "Weapon Training: Axe", treat it like a Battle Axe by default.
    // (We still keep "Weapon Training: Throwing Axe" separate because the throwing weapons use different bonuses.)
    "Weapon Training: Axe": "Weapon Training: Battle Axe",
    "Weapon Training: Battle Axe": "Weapon Training: Battle Axe",
    "Weapon Training: Throwing Axe": "Weapon Training: Throwing Axe",

    // Some professions list just "Weapon Training: Bow"; we default it to Short Bow for progression lookups,
    // but weapon resolution should still allow it to count for both short/long bows.
    "Weapon Training: Bow": "Weapon Training: Short Bow",
  };

  const canonicalSkillName = wpAliases[skillName] || skillName;

  // Check which category this skill belongs to
  if (handToHandProgression[mappedName]) {
    progression = handToHandProgression[mappedName];
  } else if (handToHandProgression[skillName]) {
    progression = handToHandProgression[skillName];
  } else if (physicalSkillProgression[skillName]) {
    progression = physicalSkillProgression[skillName];
  } else if (weaponProficiencyProgression[canonicalSkillName]) {
    progression = weaponProficiencyProgression[canonicalSkillName];
  } else if (
    skillName === "Weapon Training: Dagger" ||
    canonicalSkillName === "Weapon Training: Dagger"
  ) {
    // Weapon Training: Dagger uses the same progression as Weapon Training: Knife
    progression = weaponProficiencyProgression["Weapon Training: Knife"];
  }

  if (!progression) {
    return {
      bonuses: { attack: 0, block: 0, evade: 0, damage: 0, throwAttack: 0 },
      attacks: 0,
      specials: {},
    };
  }

  return {
    bonuses: (progression.mode === 'state' ? getStateSkillBonuses : getCumulativeSkillBonuses)(progression, level),
    attacks: getCumulativeAttackBonus(progression, level),
    specials: getSpecialAbilities(progression, level),
  };
}

export default {
  handToHandProgression,
  physicalSkillProgression,
  weaponProficiencyProgression,
  electiveSkillPercentages,
  disguiseForgeryDowsingPercentages,
  identifyLocateMedicalPercentages,
  secondarySkillBonuses,
  getSkillBonusesAtLevel,
  getSkillPercentageAtLevel,
  getSecondarySkillBonus,
  getWeaponRateOfFire,
  getWeaponMaxRange,
};


