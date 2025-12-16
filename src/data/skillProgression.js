/**
 * Skill progression by level for Palladium Fantasy RPG
 * All bonuses scale with character level
 */

export const handToHandProgression = {
  // Hand to Hand (Soldier)
  "Hand to Hand (Soldier)": {
    attacks: { 2: 2, 5: 3, 9: 4, 14: 5 },
    bonuses: {
      1: { strike: 0, parry: 0, dodge: 0, damage: 1 },
      3: { strike: 0, parry: 3, dodge: 3, damage: 0 },
      4: { strike: 0, parry: 0, dodge: 0, damage: 2 },
      6: { strike: 0, parry: 0, dodge: 0, damage: 3 },
      8: { strike: 0, parry: 0, dodge: 0, damage: 4 },
      10: { strike: 0, parry: 0, dodge: 0, damage: 5 },
      12: { strike: 0, parry: 4, dodge: 4, damage: 0 },
      13: { strike: 0, parry: 0, dodge: 0, damage: 6 },
      15: { strike: 0, parry: 5, dodge: 5, damage: 0 },
    },
    specials: {
      7: { criticalStrike: "18-20" },
      11: { stun: "18-20" },
    },
  },

  // Hand to Hand (Mercenary)
  "Hand to Hand (Mercenary)": {
    attacks: { 3: 2, 6: 3, 9: 4, 12: 4, 15: 5 },
    bonuses: {
      1: { strike: 0, parry: 0, dodge: 0, damage: 1 },
      2: { strike: 0, parry: 2, dodge: 2, damage: 0 },
      4: { strike: 0, parry: 0, dodge: 0, damage: 2 },
      5: { strike: 0, parry: 3, dodge: 3, damage: 0 },
      8: { strike: 0, parry: 0, dodge: 0, damage: 3 },
      10: { strike: 0, parry: 0, dodge: 0, damage: 0 }, // Stun replaces damage
      11: { strike: 0, parry: 0, dodge: 0, damage: 4 },
      13: { strike: 0, parry: 0, dodge: 0, damage: 5 },
      14: { strike: 0, parry: 4, dodge: 4, damage: 0 },
    },
    specials: {
      7: { criticalStrike: "19-20" },
      9: { kickDamage: "1D6" },
      10: { stun: "18-20" },
    },
  },

  // Hand to Hand: Basic (Non-Men of Arms)
  "Hand to Hand: Basic": {
    attacks: { 4: 2, 9: 3, 14: 4 },
    bonuses: {
      1: { strike: 0, parry: 0, dodge: 2, damage: 0 },
      2: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      3: { strike: 0, parry: 0, dodge: 0, damage: 2 },
      7: { strike: 0, parry: 2, dodge: 0, damage: 0 },
      8: { strike: 0, parry: 3, dodge: 3, damage: 0 },
      10: { strike: 0, parry: 0, dodge: 0, damage: 3 },
      11: { strike: 0, parry: 0, dodge: 0, damage: 0 }, // Crit replaces damage
      12: { strike: 0, parry: 4, dodge: 4, damage: 0 },
      13: { strike: 0, parry: 0, dodge: 0, damage: 4 },
      15: { strike: 0, parry: 5, dodge: 5, damage: 0 },
    },
    specials: {
      5: { kickDamage: "1D6" },
      6: { criticalStrike: "from behind" },
      11: { criticalStrike: "19-20" },
    },
  },

  // Hand to Hand (Knight)
  "Hand to Hand (Knight)": {
    attacks: { 2: 2, 5: 3, 9: 4, 13: 5 },
    bonuses: {
      1: { strike: 0, parry: 0, dodge: 0, damage: 2 },
      3: { strike: 0, parry: 0, dodge: 0, damage: 3 },
      4: { strike: 0, parry: 3, dodge: 3, damage: 0 },
      8: { strike: 0, parry: 0, dodge: 0, damage: 4 },
      10: { strike: 0, parry: 0, dodge: 0, damage: 0 }, // Stun replaces damage
      11: { strike: 0, parry: 4, dodge: 4, damage: 0 },
      12: { strike: 0, parry: 0, dodge: 0, damage: 5 },
      13: { strike: 2, parry: 0, dodge: 0, damage: 0 },
      15: { strike: 0, parry: 5, dodge: 5, damage: 0 },
    },
    specials: {
      5: { kickDamage: "1D6" },
      7: { criticalStrike: "18-20" },
      10: { stun: "18-20" },
    },
  },

  // Hand to Hand (Paladin)
  "Hand to Hand (Paladin)": {
    attacks: { 2: 2, 5: 3, 9: 4, 13: 5 },
    bonuses: {
      1: { strike: 0, parry: 0, dodge: 0, damage: 2 },
      3: { strike: 0, parry: 2, dodge: 2, damage: 0 },
      4: { strike: 0, parry: 0, dodge: 0, damage: 4 },
      7: { strike: 0, parry: 0, dodge: 0, damage: 0 }, // Kick replaces damage
      8: { strike: 0, parry: 0, dodge: 0, damage: 0 }, // Stun replaces damage
      10: { strike: 0, parry: 0, dodge: 0, damage: 5 },
      11: { strike: 0, parry: 3, dodge: 3, damage: 0 },
      12: { strike: 2, parry: 0, dodge: 0, damage: 0 },
      13: { strike: 0, parry: 0, dodge: 0, damage: 6 },
      15: { strike: 0, parry: 4, dodge: 4, damage: 0 },
    },
    specials: {
      6: { criticalStrike: "17-20" },
      7: { kickDamage: "1D6" },
      8: { stun: "18-20" },
    },
  },

  // Hand to Hand (Long Bowman)
  "Hand to Hand (Long Bowman)": {
    attacks: { 3: 2, 7: 3, 11: 4, 15: 5 },
    bonuses: {
      1: { strike: 0, parry: 0, dodge: 2, damage: 0 },
      2: { strike: 0, parry: 0, dodge: 0, damage: 1 },
      4: { strike: 0, parry: 2, dodge: 0, damage: 0 },
      6: { strike: 0, parry: 0, dodge: 0, damage: 0 }, // Crit replaces damage
      8: { strike: 0, parry: 0, dodge: 0, damage: 3 },
      9: { strike: 0, parry: 3, dodge: 3, damage: 0 },
      10: { strike: 0, parry: 0, dodge: 0, damage: 4 },
      12: { strike: 0, parry: 4, dodge: 4, damage: 0 },
      13: { strike: 0, parry: 0, dodge: 0, damage: 4 },
      14: { strike: 2, parry: 0, dodge: 0, damage: 0 },
    },
    specials: {
      5: { kickDamage: "1D6" },
      6: { criticalStrike: "18-20 (with bow)" },
    },
  },

  // Hand to Hand (Assassin)
  "Hand to Hand (Assassin)": {
    attacks: { 3: 2, 7: 3, 9: 4 },
    bonuses: {
      1: { strike: 0, parry: 0, dodge: 0, damage: 2 },
      2: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      4: { strike: 0, parry: 3, dodge: 3, damage: 0 },
      5: { strike: 0, parry: 0, dodge: 0, damage: 3 },
      7: { strike: 0, parry: 0, dodge: 0, damage: 0 }, // Kick replaces damage
      8: { strike: 0, parry: 0, dodge: 0, damage: 3 },
      10: { strike: 0, parry: 0, dodge: 0, damage: 4 },
      11: { strike: 0, parry: 4, dodge: 4, damage: 0 },
      12: { strike: 0, parry: 0, dodge: 0, damage: 4 },
      13: { strike: 0, parry: 0, dodge: 0, damage: 4 },
      14: { strike: 0, parry: 5, dodge: 5, damage: 0 },
      15: { strike: 0, parry: 0, dodge: 0, damage: 5 },
    },
    specials: {
      6: { criticalStrike: "18-20" },
      7: { kickDamage: "1D6" },
    },
  },

  // Hand to Hand (Ranger)
  "Hand to Hand (Ranger)": {
    attacks: { 2: 2, 4: 3, 9: 4, 14: 5 },
    bonuses: {
      1: { strike: 0, parry: 0, dodge: 0, damage: 1 },
      3: { strike: 0, parry: 0, dodge: 0, damage: 2 },
      4: { strike: 0, parry: 0, dodge: 0, damage: 3 },
      6: { strike: 0, parry: 2, dodge: 0, damage: 0 },
      8: { strike: 0, parry: 0, dodge: 0, damage: 4 },
      10: { strike: 0, parry: 0, dodge: 0, damage: 0 }, // Stun replaces damage
      11: { strike: 0, parry: 3, dodge: 3, damage: 0 },
      12: { strike: 0, parry: 4, dodge: 4, damage: 0 },
      13: { strike: 2, parry: 0, dodge: 0, damage: 0 },
      15: { strike: 0, parry: 5, dodge: 5, damage: 0 },
    },
    specials: {
      7: { criticalStrike: "19-20" },
      10: { stun: "18-20" },
    },
  },

  // Hand to Hand (Thief)
  "Hand to Hand (Thief)": {
    attacks: { 4: 2, 9: 3, 14: 4 },
    bonuses: {
      1: { strike: 0, parry: 0, dodge: 2, damage: 0 },
      2: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      3: { strike: 0, parry: 0, dodge: 0, damage: 2 },
      6: { strike: 0, parry: 0, dodge: 0, damage: 0 }, // Crit replaces damage
      7: { strike: 0, parry: 2, dodge: 0, damage: 0 },
      8: { strike: 0, parry: 0, dodge: 0, damage: 3 },
      10: { strike: 0, parry: 0, dodge: 0, damage: 3 },
      11: { strike: 0, parry: 0, dodge: 0, damage: 0 }, // Crit replaces damage
      12: { strike: 0, parry: 4, dodge: 4, damage: 0 },
      13: { strike: 0, parry: 0, dodge: 0, damage: 4 },
      14: { strike: 0, parry: 5, dodge: 5, damage: 0 },
      15: { strike: 0, parry: 0, dodge: 0, damage: 5 },
    },
    specials: {
      6: { criticalStrike: "from behind" },
      11: { criticalStrike: "19-20" },
    },
  },

  // Legacy support - map old names to new ones
  "Hand to Hand: Expert": {
    attacks: { 1: 3, 3: 4, 6: 5, 9: 6, 12: 7, 15: 8 },
    bonuses: {
      1: { strike: 1, parry: 3, dodge: 3, damage: 1 },
      2: { strike: 0, parry: 0, dodge: 1, damage: 0 },
      4: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      6: { strike: 0, parry: 1, dodge: 1, damage: 1 },
      8: { strike: 1, parry: 0, dodge: 1, damage: 0 },
      10: { strike: 0, parry: 1, dodge: 0, damage: 1 },
      12: { strike: 1, parry: 0, dodge: 1, damage: 0 },
      14: { strike: 0, parry: 1, dodge: 1, damage: 0 },
    },
  },
  "Hand to Hand: Martial Arts": {
    attacks: { 1: 4, 2: 5, 4: 6, 7: 7, 10: 8, 13: 9, 15: 10 },
    bonuses: {
      1: { strike: 2, parry: 3, dodge: 3, damage: 2 },
      2: { strike: 0, parry: 0, dodge: 1, damage: 0 },
      3: { strike: 1, parry: 1, dodge: 0, damage: 0 },
      5: { strike: 0, parry: 0, dodge: 1, damage: 1 },
      7: { strike: 1, parry: 1, dodge: 1, damage: 0 },
      9: { strike: 0, parry: 0, dodge: 1, damage: 1 },
      11: { strike: 1, parry: 1, dodge: 0, damage: 0 },
      13: { strike: 0, parry: 0, dodge: 1, damage: 1 },
      15: { strike: 1, parry: 1, dodge: 1, damage: 0 },
    },
  },
  "Hand to Hand: Assassin": {
    attacks: { 1: 4, 3: 5, 6: 6, 9: 7, 12: 8, 15: 9 },
    bonuses: {
      1: { strike: 2, parry: 2, dodge: 2, damage: 3 },
      3: { strike: 1, parry: 0, dodge: 1, damage: 0 },
      5: { strike: 0, parry: 1, dodge: 0, damage: 1 },
      7: { strike: 1, parry: 0, dodge: 1, damage: 0 },
      9: { strike: 0, parry: 1, dodge: 1, damage: 1 },
      11: { strike: 1, parry: 0, dodge: 0, damage: 1 },
      13: { strike: 0, parry: 1, dodge: 1, damage: 0 },
      15: { strike: 1, parry: 0, dodge: 1, damage: 1 },
    },
  },
  "Hand to Hand: Mercenary": {
    attacks: { 1: 3, 3: 4, 6: 5, 9: 6, 12: 7, 15: 8 },
    bonuses: {
      1: { strike: 1, parry: 2, dodge: 2, damage: 1 },
      3: { strike: 1, parry: 0, dodge: 1, damage: 0 },
      6: { strike: 0, parry: 1, dodge: 0, damage: 1 },
      9: { strike: 1, parry: 1, dodge: 1, damage: 0 },
      12: { strike: 0, parry: 0, dodge: 1, damage: 1 },
      15: { strike: 1, parry: 1, dodge: 0, damage: 0 },
    },
  },
  "Hand to Hand: Knight": {
    attacks: { 1: 3, 3: 4, 6: 5, 9: 6, 12: 7, 15: 8 },
    bonuses: {
      1: { strike: 1, parry: 3, dodge: 2, damage: 1 },
      3: { strike: 0, parry: 1, dodge: 1, damage: 0 },
      5: { strike: 1, parry: 0, dodge: 0, damage: 1 },
      7: { strike: 0, parry: 1, dodge: 1, damage: 0 },
      9: { strike: 1, parry: 0, dodge: 1, damage: 1 },
      11: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      13: { strike: 1, parry: 1, dodge: 1, damage: 0 },
      15: { strike: 0, parry: 0, dodge: 1, damage: 1 },
    },
  },
};

export const physicalSkillProgression = {
  Boxing: {
    attacks: { 1: 1, 5: 0, 10: 1 }, // +1 attack at L1, +1 more at L10
    bonuses: {
      1: { strike: 1, parry: 2, dodge: 2, damage: 0 },
      3: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      6: { strike: 1, parry: 0, dodge: 1, damage: 0 },
      9: { strike: 0, parry: 1, dodge: 1, damage: 0 },
      12: { strike: 1, parry: 0, dodge: 0, damage: 0 },
    },
  },
  Wrestling: {
    attacks: { 1: 1, 7: 0, 13: 1 }, // +1 attack at L1, +1 more at L13
    bonuses: {
      1: { strike: 0, parry: 0, dodge: 1, damage: 0 },
      4: { strike: 0, parry: 0, dodge: 1, damage: 0 },
      8: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      12: { strike: 0, parry: 0, dodge: 1, damage: 0 },
    },
  },
  // "Body Building": {  // Removed - not in 1994 rulebook, can add back later
  //   attacks: {},
  //   bonuses: {
  //     1: { strike: 0, parry: 0, dodge: 0, damage: 2 },
  //     5: { strike: 0, parry: 0, dodge: 0, damage: 1 },
  //     10: { strike: 0, parry: 0, dodge: 0, damage: 1 },
  //     15: { strike: 0, parry: 0, dodge: 0, damage: 1 },
  //   },
  // },
  Acrobatics: {
    attacks: {},
    bonuses: {
      1: { strike: 0, parry: 1, dodge: 2, damage: 0 },
      3: { strike: 0, parry: 0, dodge: 1, damage: 0 },
      6: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      9: { strike: 0, parry: 0, dodge: 1, damage: 0 },
      12: { strike: 0, parry: 1, dodge: 1, damage: 0 },
    },
  },
  Gymnastics: {
    attacks: {},
    bonuses: {
      1: { strike: 0, parry: 1, dodge: 1, damage: 0 },
      4: { strike: 0, parry: 0, dodge: 1, damage: 0 },
      8: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      12: { strike: 0, parry: 0, dodge: 1, damage: 0 },
    },
  },
};


// ---- RULEBOOK-CORRECTED HAND TO HAND TABLE (Palladium 2nd ed 1994) ----
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
        "parry": 3,
        "dodge": 3
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
        "parry": 4,
        "dodge": 4
      },
      13: {
        "damage": 6
      },
      15: {
        "parry": 5,
        "dodge": 5
      }
    },
    "specials": {
      7: {
        "criticalStrike": "18-20"
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
        "parry": 2,
        "dodge": 2
      },
      4: {
        "damage": 2
      },
      5: {
        "parry": 3,
        "dodge": 3
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
        "parry": 4,
        "dodge": 4
      }
    },
    "specials": {
      7: {
        "criticalStrike": "19-20"
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
        "dodge": 2
      },
      2: {
        "parry": 1
      },
      3: {
        "damage": 2
      },
      8: {
        "parry": 3,
        "dodge": 3
      },
      10: {
        "damage": 3
      },
      12: {
        "parry": 4,
        "dodge": 4
      },
      13: {
        "damage": 4
      },
      15: {
        "parry": 5,
        "dodge": 5
      },
      7: {
        "parry": 2
      }
    },
    "specials": {
      5: {
        "kickDamage": "1-6"
      },
      6: {
        "criticalStrike": "from behind"
      },
      11: {
        "criticalStrike": "19-20"
      }
    }
  }
});
export const weaponProficiencyProgression = {
  // Melee Weapon Proficiencies
  // Chart shows cumulative totals - converting to incremental bonuses
  "W.P. Axe": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 }, // Level 1: +1 strike (total +1)
      2: { strike: 1, parry: 0, dodge: 0, damage: 0 }, // Level 2: +2 strike total (+1 more)
      3: { strike: 0, parry: 2, dodge: 0, damage: 0 }, // Level 3: +2 parry (+2 new)
      4: { strike: 1, parry: 0, dodge: 0, damage: 0 }, // Level 4: +3 strike total (+1 more)
      5: { strike: 0, parry: 1, dodge: 0, damage: 0 }, // Level 5: +3 parry total (+1 more)
      6: { strike: 1, parry: 0, dodge: 0, damage: 0 }, // Level 6: +4 strike total (+1 more)
      7: { strike: 0, parry: 1, dodge: 0, damage: 0 }, // Level 7: +4 parry total (+1 more)
      8: { strike: 1, parry: 0, dodge: 0, damage: 0 }, // Level 8: +5 strike total (+1 more)
      9: { strike: 0, parry: 1, dodge: 0, damage: 0 }, // Level 9: +5 parry total (+1 more)
      10: { strike: 1, parry: 0, dodge: 0, damage: 0 }, // Level 10+: +6 strike total (+1 more)
    },
  },
  "W.P. Blunt": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      2: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      3: { strike: 2, parry: 0, dodge: 0, damage: 0 },
      4: { strike: 0, parry: 2, dodge: 0, damage: 0 },
      5: { strike: 3, parry: 0, dodge: 0, damage: 0 },
      6: { strike: 0, parry: 3, dodge: 0, damage: 0 },
      7: { strike: 4, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 0, parry: 4, dodge: 0, damage: 0 },
      9: { strike: 5, parry: 0, dodge: 0, damage: 0 },
      10: { strike: 0, parry: 5, dodge: 0, damage: 0 },
    },
  },
  "W.P. Ball and Chain": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      2: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      3: { strike: 2, parry: 0, dodge: 0, damage: 0 },
      4: { strike: 0, parry: 2, dodge: 0, damage: 0 },
      5: { strike: 3, parry: 0, dodge: 0, damage: 0 },
      6: { strike: 0, parry: 3, dodge: 0, damage: 0 },
      7: { strike: 4, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 0, parry: 4, dodge: 0, damage: 0 },
      9: { strike: 5, parry: 0, dodge: 0, damage: 0 },
      10: { strike: 0, parry: 5, dodge: 0, damage: 0 },
    },
  },
  "W.P. Knife": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      2: { strike: 2, parry: 0, dodge: 0, damage: 0 },
      3: { strike: 0, parry: 2, dodge: 0, damage: 0 },
      4: { strike: 3, parry: 0, dodge: 0, damage: 0 },
      5: { strike: 0, parry: 3, dodge: 0, damage: 0 },
      6: { strike: 4, parry: 0, dodge: 0, damage: 0 },
      7: { strike: 0, parry: 4, dodge: 0, damage: 0 },
      8: { strike: 5, parry: 0, dodge: 0, damage: 0 },
      9: { strike: 0, parry: 5, dodge: 0, damage: 0 },
      10: { strike: 6, parry: 0, dodge: 0, damage: 0 },
    },
  },
  "W.P. Pole Arms": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      2: { strike: 2, parry: 0, dodge: 0, damage: 0 },
      3: { strike: 0, parry: 2, dodge: 0, damage: 0 },
      4: { strike: 3, parry: 0, dodge: 0, damage: 0 },
      5: { strike: 0, parry: 3, dodge: 0, damage: 0 },
      6: { strike: 4, parry: 0, dodge: 0, damage: 0 },
      7: { strike: 0, parry: 4, dodge: 0, damage: 0 },
      8: { strike: 5, parry: 0, dodge: 0, damage: 0 },
      9: { strike: 0, parry: 5, dodge: 0, damage: 0 },
      10: { strike: 6, parry: 0, dodge: 0, damage: 0 },
    },
  },
  "W.P. Spear": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      2: { strike: 2, parry: 0, dodge: 0, damage: 0 },
      3: { strike: 0, parry: 2, dodge: 0, damage: 0 },
      4: { strike: 3, parry: 0, dodge: 0, damage: 0 },
      5: { strike: 0, parry: 3, dodge: 0, damage: 0 },
      6: { strike: 4, parry: 0, dodge: 0, damage: 0 },
      7: { strike: 0, parry: 4, dodge: 0, damage: 0 },
      8: { strike: 5, parry: 0, dodge: 0, damage: 0 },
      9: { strike: 0, parry: 5, dodge: 0, damage: 0 },
      10: { strike: 6, parry: 0, dodge: 0, damage: 0 },
    },
  },
  "W.P. Short Sword": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      2: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      3: { strike: 2, parry: 0, dodge: 0, damage: 0 },
      4: { strike: 0, parry: 2, dodge: 0, damage: 0 },
      5: { strike: 3, parry: 0, dodge: 0, damage: 0 },
      6: { strike: 0, parry: 3, dodge: 0, damage: 0 },
      7: { strike: 4, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 0, parry: 4, dodge: 0, damage: 0 },
      9: { strike: 5, parry: 0, dodge: 0, damage: 0 },
      10: { strike: 0, parry: 5, dodge: 0, damage: 0 },
    },
  },
  "W.P. Sword": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      2: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      3: { strike: 2, parry: 0, dodge: 0, damage: 0 },
      4: { strike: 0, parry: 2, dodge: 0, damage: 0 },
      5: { strike: 3, parry: 0, dodge: 0, damage: 0 },
      6: { strike: 0, parry: 3, dodge: 0, damage: 0 },
      7: { strike: 4, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 0, parry: 4, dodge: 0, damage: 0 },
      9: { strike: 5, parry: 0, dodge: 0, damage: 0 },
      10: { strike: 0, parry: 5, dodge: 0, damage: 0 },
    },
  },
  "W.P. Staff": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      2: { strike: 0, parry: 2, dodge: 0, damage: 0 },
      3: { strike: 2, parry: 0, dodge: 0, damage: 0 },
      4: { strike: 0, parry: 3, dodge: 0, damage: 0 },
      5: { strike: 3, parry: 0, dodge: 0, damage: 0 },
      6: { strike: 0, parry: 4, dodge: 0, damage: 0 },
      7: { strike: 4, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 0, parry: 5, dodge: 0, damage: 0 },
      9: { strike: 5, parry: 0, dodge: 0, damage: 0 },
      10: { strike: 0, parry: 5, dodge: 0, damage: 0 },
    },
  },
  "W.P. Small Shield": {
    bonuses: {
      1: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      2: { strike: 0, parry: 2, dodge: 0, damage: 0 },
      3: { strike: 0, parry: 3, dodge: 0, damage: 0 },
      4: { strike: 0, parry: 4, dodge: 0, damage: 0 },
      5: { strike: 0, parry: 5, dodge: 0, damage: 0 },
      6: { strike: 0, parry: 5, dodge: 0, damage: 0 },
      7: { strike: 0, parry: 6, dodge: 0, damage: 0 },
      8: { strike: 0, parry: 6, dodge: 0, damage: 0 },
      9: { strike: 0, parry: 7, dodge: 0, damage: 0 },
      10: { strike: 0, parry: 7, dodge: 0, damage: 0 },
    },
  },
  "W.P. Large Shield": {
    bonuses: {
      1: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      2: { strike: 0, parry: 2, dodge: 0, damage: 0 },
      3: { strike: 0, parry: 3, dodge: 0, damage: 0 },
      4: { strike: 0, parry: 4, dodge: 0, damage: 0 },
      5: { strike: 0, parry: 5, dodge: 0, damage: 0 },
      6: { strike: 0, parry: 5, dodge: 0, damage: 0 },
      7: { strike: 0, parry: 6, dodge: 0, damage: 0 },
      8: { strike: 0, parry: 6, dodge: 0, damage: 0 },
      9: { strike: 0, parry: 7, dodge: 0, damage: 0 },
      10: { strike: 0, parry: 7, dodge: 0, damage: 0 },
    },
  },
  "W.P. Shield": {
    bonuses: {
      1: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      2: { strike: 0, parry: 2, dodge: 0, damage: 0 },
      3: { strike: 0, parry: 3, dodge: 0, damage: 0 },
      4: { strike: 0, parry: 4, dodge: 0, damage: 0 },
      5: { strike: 0, parry: 5, dodge: 0, damage: 0 },
      6: { strike: 0, parry: 5, dodge: 0, damage: 0 },
      7: { strike: 0, parry: 6, dodge: 0, damage: 0 },
      8: { strike: 0, parry: 6, dodge: 0, damage: 0 },
      9: { strike: 0, parry: 7, dodge: 0, damage: 0 },
      10: { strike: 0, parry: 7, dodge: 0, damage: 0 },
    },
  },
  "W.P. Lance": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      2: { strike: 2, parry: 0, dodge: 0, damage: 0 },
      3: { strike: 3, parry: 0, dodge: 0, damage: 0 },
      4: { strike: 4, parry: 0, dodge: 0, damage: 0 },
      5: { strike: 5, parry: 0, dodge: 0, damage: 0 },
      6: { strike: 5, parry: 0, dodge: 0, damage: 0 },
      7: { strike: 6, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 6, parry: 0, dodge: 0, damage: 0 },
      9: { strike: 7, parry: 0, dodge: 0, damage: 0 },
      10: { strike: 7, parry: 0, dodge: 0, damage: 0 },
    },
    note: "Mounted use only (Knights & Paladins)",
  },

  // Missile Weapon Proficiencies
  "W.P. Sling": {
    bonuses: {
      1: { strike: 0, parry: 0, dodge: 0, damage: 0 },
      2: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      3: { strike: 0, parry: 0, dodge: 0, damage: 0 },
      4: { strike: 2, parry: 0, dodge: 0, damage: 0 },
      6: { strike: 3, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 4, parry: 0, dodge: 0, damage: 0 },
      10: { strike: 5, parry: 0, dodge: 0, damage: 0 },
      12: { strike: 6, parry: 0, dodge: 0, damage: 0 },
      14: { strike: 7, parry: 0, dodge: 0, damage: 0 },
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
  "W.P. Short Bow": {
    bonuses: {
      1: { strike: 0, parry: 0, dodge: 0, damage: 0 },
      2: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      4: { strike: 2, parry: 0, dodge: 0, damage: 0 },
      6: { strike: 3, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 4, parry: 0, dodge: 0, damage: 0 },
      10: { strike: 5, parry: 0, dodge: 0, damage: 0 },
      13: { strike: 6, parry: 0, dodge: 0, damage: 0 },
      15: { strike: 7, parry: 0, dodge: 0, damage: 0 },
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
  "W.P. Crossbow": {
    bonuses: {
      1: { strike: 0, parry: 0, dodge: 0, damage: 0 },
      2: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      4: { strike: 2, parry: 0, dodge: 0, damage: 0 },
      6: { strike: 3, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 4, parry: 0, dodge: 0, damage: 0 },
      11: { strike: 5, parry: 0, dodge: 0, damage: 0 },
      14: { strike: 6, parry: 0, dodge: 0, damage: 0 },
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
  "W.P. Long Bow": {
    bonuses: {
      1: { strike: 0, parry: 0, dodge: 0, damage: 0 },
      2: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      3: { strike: 2, parry: 0, dodge: 0, damage: 0 },
      4: { strike: 3, parry: 0, dodge: 0, damage: 0 },
      6: { strike: 4, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 5, parry: 0, dodge: 0, damage: 0 },
      11: { strike: 6, parry: 0, dodge: 0, damage: 0 },
      14: { strike: 7, parry: 0, dodge: 0, damage: 0 },
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
    maxRange: 800, // feet (restricted to Long Bowman & Ranger O.C.C.)
  },
  "W.P. Bow": {
    bonuses: {
      1: { strike: 0, parry: 0, dodge: 0, damage: 0 },
      2: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      4: { strike: 2, parry: 0, dodge: 0, damage: 0 },
      6: { strike: 3, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 4, parry: 0, dodge: 0, damage: 0 },
      10: { strike: 5, parry: 0, dodge: 0, damage: 0 },
      13: { strike: 6, parry: 0, dodge: 0, damage: 0 },
      15: { strike: 7, parry: 0, dodge: 0, damage: 0 },
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
  "W.P. Garrote": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      5: { strike: 1, parry: 0, dodge: 0, damage: 1 },
      10: { strike: 1, parry: 0, dodge: 0, damage: 1 },
    },
  },
  "W.P. Net": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      4: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 1, parry: 0, dodge: 0, damage: 0 },
    },
  },
  "W.P. Cutlass": {
    bonuses: {
      1: { strike: 1, parry: 1, dodge: 0, damage: 0 },
      3: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      6: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      9: { strike: 1, parry: 1, dodge: 0, damage: 0 },
    },
  },
  "W.P. Harpoon": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      5: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      10: { strike: 1, parry: 0, dodge: 0, damage: 1 },
    },
  },
  "W.P. Pistol Crossbow": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      5: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      10: { strike: 1, parry: 0, dodge: 0, damage: 0 },
    },
  },
  "W.P. Club": {
    bonuses: {
      1: { strike: 1, parry: 1, dodge: 0, damage: 0 },
      4: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      12: { strike: 1, parry: 1, dodge: 0, damage: 0 },
    },
  },
};

// ========== ELECTIVE SKILL PERCENTAGE PROGRESSIONS ==========

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

// ---- RULEBOOK-CORRECTED W.P. TABLES (Palladium 2nd ed 1994) ----
Object.assign(weaponProficiencyProgression, {
  "W.P. Short Sword": {
    "mode": "state",
    "bonuses": {
      1: {
        "strike": 1,
        "parry": 1
      },
      2: {
        "throwStrike": 1
      },
      3: {
        "strike": 2
      },
      4: {
        "parry": 2
      },
      6: {
        "strike": 3,
        "throwStrike": 2
      },
      7: {
        "parry": 3
      },
      9: {
        "strike": 4
      },
      10: {
        "throwStrike": 3
      },
      11: {
        "parry": 4
      },
      12: {
        "strike": 5
      },
      13: {
        "throwStrike": 4
      },
      14: {
        "parry": 5
      },
      15: {
        "strike": 6
      }
    }
  },
  "W.P. Large Sword": {
    "mode": "state",
    "bonuses": {
      1: {
        "strike": 1
      },
      2: {
        "parry": 1
      },
      3: {
        "strike": 2,
        "parry": 2
      },
      5: {
        "parry": 3,
        "throwStrike": 1
      },
      6: {
        "strike": 3
      },
      7: {
        "parry": 4
      },
      9: {
        "strike": 4,
        "parry": 5
      },
      10: {
        "throwStrike": 2
      },
      11: {
        "parry": 6
      },
      12: {
        "strike": 5
      },
      13: {
        "throwStrike": 3
      },
      14: {
        "parry": 7
      },
      15: {
        "strike": 6
      }
    }
  },
  "W.P. Knives": {
    "mode": "state",
    "bonuses": {
      1: {
        "throwStrike": 1
      },
      2: {
        "strike": 1
      },
      3: {
        "parry": 1,
        "throwStrike": 2
      },
      4: {
        "strike": 2
      },
      5: {
        "throwStrike": 3
      },
      6: {
        "parry": 2
      },
      7: {
        "strike": 3,
        "throwStrike": 4
      },
      9: {
        "parry": 3,
        "throwStrike": 5
      },
      10: {
        "strike": 4
      },
      11: {
        "throwStrike": 6
      },
      12: {
        "parry": 4
      },
      13: {
        "strike": 5,
        "throwStrike": 7
      },
      15: {
        "parry": 5,
        "throwStrike": 8
      }
    }
  },
  "W.P. Throwing Axe": {
    "mode": "state",
    "bonuses": {
      1: {
        "throwStrike": 1
      },
      2: {
        "strike": 1
      },
      3: {
        "throwStrike": 2
      },
      4: {
        "strike": 2,
        "parry": 1
      },
      5: {
        "throwStrike": 3
      },
      6: {
        "parry": 2
      },
      7: {
        "strike": 3,
        "throwStrike": 4
      },
      9: {
        "parry": 3
      },
      10: {
        "strike": 4,
        "throwStrike": 5
      },
      12: {
        "parry": 4
      },
      13: {
        "strike": 5,
        "throwStrike": 6
      },
      15: {
        "parry": 5
      }
    }
  },
  "W.P. Battle Axe": {
    "mode": "state",
    "bonuses": {
      1: {
        "strike": 1
      },
      2: {
        "throwStrike": 1
      },
      3: {
        "strike": 2,
        "parry": 1
      },
      4: {
        "throwStrike": 2
      },
      5: {
        "strike": 3
      },
      6: {
        "parry": 2
      },
      7: {
        "throwStrike": 3
      },
      8: {
        "strike": 4
      },
      9: {
        "parry": 3
      },
      10: {
        "throwStrike": 4
      },
      11: {
        "strike": 5
      },
      12: {
        "parry": 4
      },
      13: {
        "throwStrike": 5
      },
      14: {
        "strike": 6
      },
      15: {
        "parry": 5
      }
    }
  },
  "W.P. Lance": {
    "mode": "state",
    "bonuses": {
      1: {
        "strike": 1
      },
      2: {
        "strike": 2
      },
      3: {
        "parry": 1
      },
      4: {
        "strike": 3,
        "throwStrike": 1
      },
      6: {
        "strike": 4,
        "parry": 2
      },
      7: {
        "throwStrike": 2
      },
      8: {
        "strike": 5
      },
      9: {
        "parry": 3
      },
      10: {
        "strike": 6,
        "throwStrike": 3
      },
      12: {
        "strike": 7,
        "parry": 4
      },
      13: {
        "throwStrike": 4
      },
      14: {
        "strike": 8
      },
      15: {
        "parry": 5
      }
    }
  },
  "W.P. Small Shield": {
    "mode": "state",
    "bonuses": {
      1: {
        "parry": 1
      },
      2: {
        "parry": 2
      },
      3: {
        "strike": 1,
        "parry": 3,
        "throwStrike": 1
      },
      5: {
        "strike": 2,
        "parry": 4,
        "throwStrike": 2
      },
      7: {
        "strike": 3,
        "parry": 5,
        "throwStrike": 3
      },
      9: {
        "strike": 4,
        "parry": 6,
        "throwStrike": 4
      },
      11: {
        "strike": 5,
        "parry": 7,
        "throwStrike": 5
      },
      13: {
        "strike": 6,
        "parry": 8,
        "throwStrike": 6
      },
      15: {
        "strike": 7,
        "parry": 9,
        "throwStrike": 7
      }
    }
  },
  "W.P. Large Shield": {
    "mode": "state",
    "bonuses": {
      1: {
        "parry": 2
      },
      3: {
        "strike": 1,
        "parry": 3
      },
      4: {
        "parry": 4,
        "throwStrike": 1
      },
      5: {
        "strike": 2,
        "parry": 5
      },
      7: {
        "strike": 3,
        "parry": 6,
        "throwStrike": 3
      },
      9: {
        "strike": 4,
        "parry": 7
      },
      10: {
        "throwStrike": 3
      },
      11: {
        "strike": 5,
        "parry": 8
      },
      13: {
        "strike": 6,
        "throwStrike": 4
      },
      14: {
        "parry": 9
      },
      15: {
        "strike": 7
      }
    }
  },
  "W.P. Sling": {
    "mode": "state",
    "bonuses": {
      2: {
        "strike": 1
      },
      4: {
        "strike": 2
      },
      6: {
        "strike": 3
      },
      8: {
        "strike": 4
      },
      10: {
        "strike": 5
      },
      12: {
        "strike": 6
      },
      14: {
        "strike": 7
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
  "W.P. Short Bow": {
    "mode": "state",
    "bonuses": {
      2: {
        "strike": 1
      },
      4: {
        "strike": 2
      },
      6: {
        "strike": 3
      },
      8: {
        "strike": 4
      },
      10: {
        "strike": 5
      },
      13: {
        "strike": 6
      },
      15: {
        "strike": 7
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
  "W.P. Crossbow": {
    "mode": "state",
    "bonuses": {
      2: {
        "strike": 1
      },
      4: {
        "strike": 2
      },
      6: {
        "strike": 3
      },
      8: {
        "strike": 4
      },
      11: {
        "strike": 5
      },
      14: {
        "strike": 6
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
  "W.P. Long Bow": {
    "mode": "state",
    "bonuses": {
      2: {
        "strike": 1
      },
      3: {
        "strike": 2
      },
      4: {
        "strike": 3
      },
      6: {
        "strike": 4
      },
      8: {
        "strike": 5
      },
      11: {
        "strike": 6
      },
      14: {
        "strike": 7
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

// ========== SECONDARY SKILL O.C.C. BONUSES ==========
// These bonuses apply when skills are chosen as Secondary Skills

export const secondarySkillBonuses = {
  Carpentry: 10,
  "Faerie Lore": 10,
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
 * @returns {Object} - Cumulative bonuses { strike, parry, dodge, damage }
 */
function getCumulativeSkillBonuses(progression, level) {
  // "Cumulative" mode = treat each listed bonus as an increment and sum all thresholds <= level.
  if (!progression || !progression.bonuses) {
    return { strike: 0, parry: 0, dodge: 0, damage: 0, throwStrike: 0 };
  }

  const cumulative = {
    strike: 0,
    parry: 0,
    dodge: 0,
    damage: 0,
    throwStrike: 0,
  };

  Object.keys(progression.bonuses).forEach((threshold) => {
    const thresholdLevel = Number(threshold);
    if (level >= thresholdLevel) {
      const bonusEntry = progression.bonuses[threshold];

      cumulative.strike += bonusEntry.strike || 0;
      cumulative.parry += bonusEntry.parry || 0;
      cumulative.dodge += bonusEntry.dodge || 0;
      cumulative.damage += bonusEntry.damage || 0;
      cumulative.throwStrike += bonusEntry.throwStrike || 0;
    }
  });

  return cumulative;
}

function getStateSkillBonuses(progression, level) {
  // "State" mode = tables list the *current total* at specific levels.
  // A 0 in a column means "no change" (carry forward previous total).
  if (!progression || !progression.bonuses) {
    return { strike: 0, parry: 0, dodge: 0, damage: 0, throwStrike: 0 };
  }

  const totals = {
    strike: 0,
    parry: 0,
    dodge: 0,
    damage: 0,
    throwStrike: 0,
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
      // In Palladium tables, 0 means "unchanged", so we only update on non-zero.
      if (typeof v === 'number' && v !== 0) totals[k] = v;
    }
  }

  return totals;
}

function getCumulativeAttackBonus(progression, level, defaultAttacks = 1) {
  if (!progression || !progression.attacks) {
    return defaultAttacks;
  }

  // Attacks-per-melee tables in Palladium are "state" tables:
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
 * @returns {Object} - Special abilities { criticalStrike, stun, kickDamage }
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
 * @returns {number} - Rate of fire (attacks per melee)
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
 * @returns {Object} - { bonuses: {strike, parry, dodge, damage}, attacks: number, specials: {} }
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
    "W.P. Knife": "W.P. Knives",
    "W.P. Knives": "W.P. Knives",
    "W.P. Dagger": "W.P. Knives",

    "W.P. Staff": "W.P. Staves",
    "W.P. Stave": "W.P. Staves",
    "W.P. Staves": "W.P. Staves",

    "W.P. Spear": "W.P. Spears/Forks",
    "W.P. Spear/Fork": "W.P. Spears/Forks",
    "W.P. Spears": "W.P. Spears/Forks",
    "W.P. Spears/Forks": "W.P. Spears/Forks",

    "W.P. Short Swords": "W.P. Short Sword",
    "W.P. Short Sword": "W.P. Short Sword",

    "W.P. Large Swords": "W.P. Large Sword",
    "W.P. Large Sword": "W.P. Large Sword",
    "W.P. Sword": "W.P. Large Sword",
    "W.P. Swords": "W.P. Large Sword",

    // If your OCC data uses the generic "W.P. Axe", treat it like a Battle Axe by default.
    // (We still keep "W.P. Throwing Axe" separate because the book gives different throw bonuses.)
    "W.P. Axe": "W.P. Battle Axe",
    "W.P. Battle Axe": "W.P. Battle Axe",
    "W.P. Throwing Axe": "W.P. Throwing Axe",

    // Some OCCs list just "W.P. Bow"; we default it to Short Bow for progression lookups,
    // but weapon resolution should still allow it to count for both short/long bows.
    "W.P. Bow": "W.P. Short Bow",
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
    skillName === "W.P. Dagger" ||
    canonicalSkillName === "W.P. Dagger"
  ) {
    // W.P. Dagger uses the same progression as W.P. Knife
    progression = weaponProficiencyProgression["W.P. Knife"];
  }

  if (!progression) {
    return {
      bonuses: { strike: 0, parry: 0, dodge: 0, damage: 0, throwStrike: 0 },
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
