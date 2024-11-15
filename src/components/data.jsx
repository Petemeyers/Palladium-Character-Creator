// data.jsx

// Define an object to store the attribute bonuses based on the attribute value
export const attributeBonuses = {
  IQ: {
    16: { bonus: '+2%', description: 'Add +2% to all skills' },
    17: { bonus: '+3%', description: 'Add +3% to all skills' },
    18: { bonus: '+4%', description: 'Add +4% to all skills' },
    19: { bonus: '+5%', description: 'Add +5% to all skills' },
    20: { bonus: '+6%', description: 'Add +6% to all skills' },
    21: { bonus: '+7%', description: 'Add +7% to all skills' },
    22: { bonus: '+8%', description: 'Add +8% to all skills' },
    23: { bonus: '+9%', description: 'Add +9% to all skills' },
    24: { bonus: '+10%', description: 'Add +10% to all skills' },
    25: { bonus: '+11%', description: 'Add +11% to all skills' },
    26: { bonus: '+12%', description: 'Add +12% to all skills' },
    27: { bonus: '+13%', description: 'Add +13% to all skills' },
    28: { bonus: '+14%', description: 'Add +14% to all skills' },
    29: { bonus: '+15%', description: 'Add +15% to all skills' },
  },
  ME: {
    16: {
      bonus: { psionic: '+1', insanity: '+1' },
      description: 'Save vs Psionics +1, Save vs Insanity +1',
    },
    17: {
      bonus: { psionic: '+1', insanity: '+1' },
      description: 'Save vs Psionics +1, Save vs Insanity +1',
    },
    18: {
      bonus: { psionic: '+2', insanity: '+2' },
      description: 'Save vs Psionics +2, Save vs Insanity +2',
    },
    19: {
      bonus: { psionic: '+2', insanity: '+2' },
      description: 'Save vs Psionics +2, Save vs Insanity +2',
    },
    20: {
      bonus: { psionic: '+3', insanity: '+3' },
      description: 'Save vs Psionics +3, Save vs Insanity +3',
    },
    21: {
      bonus: { psionic: '+4', insanity: '+6' },
      description: 'Save vs Psionics +4, Save vs Insanity +6',
    },
    22: {
      bonus: { psionic: '+5', insanity: '+7' },
      description: 'Save vs Psionics +5, Save vs Insanity +7',
    },
    23: {
      bonus: { psionic: '+5', insanity: '+8' },
      description: 'Save vs Psionics +5, Save vs Insanity +8',
    },
    24: {
      bonus: { psionic: '+6', insanity: '+9' },
      description: 'Save vs Psionics +6, Save vs Insanity +9',
    },
    25: {
      bonus: { psionic: '+6', insanity: '+10' },
      description: 'Save vs Psionics +6, Save vs Insanity +10',
    },
    26: {
      bonus: { psionic: '+7', insanity: '+11' },
      description: 'Save vs Psionics +7, Save vs Insanity +11',
    },
    27: {
      bonus: { psionic: '+7', insanity: '+12' },
      description: 'Save vs Psionics +7, Save vs Insanity +12',
    },
    28: {
      bonus: { psionic: '+8', insanity: '+13' },
      description: 'Save vs Psionics +8, Save vs Insanity +13',
    },
  },
  MA: {
    16: { bonus: '40%', description: 'Trust/Intimidate 40%' },
    17: { bonus: '45%', description: 'Trust/Intimidate 45%' },
    18: { bonus: '50%', description: 'Trust/Intimidate 50%' },
    19: { bonus: '55%', description: 'Trust/Intimidate 55%' },
    20: { bonus: '60%', description: 'Trust/Intimidate 60%' },
    21: { bonus: '65%', description: 'Trust/Intimidate 65%' },
    22: { bonus: '70%', description: 'Trust/Intimidate 70%' },
    23: { bonus: '75%', description: 'Trust/Intimidate 75%' },
    24: { bonus: '80%', description: 'Trust/Intimidate 80%' },
    25: { bonus: '85%', description: 'Trust/Intimidate 85%' },
    26: { bonus: '88%', description: 'Trust/Intimidate 88%' },
    27: { bonus: '92%', description: 'Trust/Intimidate 92%' },
    28: { bonus: '94%', description: 'Trust/Intimidate 94%' },
    29: { bonus: '96%', description: 'Trust/Intimidate 96%' },
  },
  PS: {
    16: { bonus: '+1', description: 'Add +1 to damage' },
    17: { bonus: '+2', description: 'Add +2 to damage' },
    18: { bonus: '+3', description: 'Add +3 to damage' },
    19: { bonus: '+4', description: 'Add +4 to damage' },
    20: { bonus: '+5', description: 'Add +5 to damage' },
    21: { bonus: '+6', description: 'Add +6 to damage' },
    22: { bonus: '+7', description: 'Add +7 to damage' },
    23: { bonus: '+8', description: 'Add +8 to damage' },
    24: { bonus: '+9', description: 'Add +9 to damage' },
    25: { bonus: '+10', description: 'Add +10 to damage' },
    26: { bonus: '+11', description: 'Add +11 to damage' },
    27: { bonus: '+12', description: 'Add +12 to damage' },
    28: { bonus: '+13', description: 'Add +13 to damage' },
    29: { bonus: '+14', description: 'Add +14 to damage' },
  },
  PP: {
    16: {
      bonus: { parryDodge: '+1', strike: '+1' },
      description: 'Parry/Dodge +1, Strike +1',
    },
    17: {
      bonus: { parryDodge: '+1', strike: '+1' },
      description: 'Parry/Dodge +1, Strike +1',
    },
    18: {
      bonus: { parryDodge: '+2', strike: '+2' },
      description: 'Parry/Dodge +2, Strike +2',
    },
    19: {
      bonus: { parryDodge: '+2', strike: '+2' },
      description: 'Parry/Dodge +2, Strike +2',
    },
    20: {
      bonus: { parryDodge: '+3', strike: '+3' },
      description: 'Parry/Dodge +3, Strike +3',
    },
    21: {
      bonus: { parryDodge: '+3', strike: '+3' },
      description: 'Parry/Dodge +3, Strike +3',
    },
    22: {
      bonus: { parryDodge: '+4', strike: '+4' },
      description: 'Parry/Dodge +4, Strike +4',
    },
    23: {
      bonus: { parryDodge: '+4', strike: '+4' },
      description: 'Parry/Dodge +4, Strike +4',
    },
    24: {
      bonus: { parryDodge: '+5', strike: '+5' },
      description: 'Parry/Dodge +5, Strike +5',
    },
    25: {
      bonus: { parryDodge: '+5', strike: '+5' },
      description: 'Parry/Dodge +5, Strike +5',
    },
    26: {
      bonus: { parryDodge: '+6', strike: '+6' },
      description: 'Parry/Dodge +6, Strike +6',
    },
    27: {
      bonus: { parryDodge: '+6', strike: '+6' },
      description: 'Parry/Dodge +6, Strike +6',
    },
    28: {
      bonus: { parryDodge: '+7', strike: '+7' },
      description: 'Parry/Dodge +7, Strike +7',
    },
    29: {
      bonus: { parryDodge: '+7', strike: '+7' },
      description: 'Parry/Dodge +7, Strike +7',
    },
  },
  PE: {
    16: {
      bonus: { comaDeath: '+4%', magicPoison: '+1' },
      description: 'Coma/Death +4%, Save vs Magic/Poison +1',
    },
    17: {
      bonus: { comaDeath: '+5%', magicPoison: '+1' },
      description: 'Coma/Death +5%, Save vs Magic/Poison +1',
    },
    18: {
      bonus: { comaDeath: '+6%', magicPoison: '+2' },
      description: 'Coma/Death +6%, Save vs Magic/Poison +2',
    },
    19: {
      bonus: { comaDeath: '+8%', magicPoison: '+2' },
      description: 'Coma/Death +8%, Save vs Magic/Poison +2',
    },
    20: {
      bonus: { comaDeath: '+10%', magicPoison: '+3' },
      description: 'Coma/Death +10%, Save vs Magic/Poison +3',
    },
    21: {
      bonus: { comaDeath: '+12%', magicPoison: '+3' },
      description: 'Coma/Death +12%, Save vs Magic/Poison +3',
    },
    22: {
      bonus: { comaDeath: '+14%', magicPoison: '+4' },
      description: 'Coma/Death +14%, Save vs Magic/Poison +4',
    },
    23: {
      bonus: { comaDeath: '+16%', magicPoison: '+4' },
      description: 'Coma/Death +16%, Save vs Magic/Poison +4',
    },
    24: {
      bonus: { comaDeath: '+18%', magicPoison: '+5' },
      description: 'Coma/Death +18%, Save vs Magic/Poison +5',
    },
    25: {
      bonus: { comaDeath: '+20%', magicPoison: '+5' },
      description: 'Coma/Death +20%, Save vs Magic/Poison +5',
    },
    26: {
      bonus: { comaDeath: '+22%', magicPoison: '+6' },
      description: 'Coma/Death +22%, Save vs Magic/Poison +6',
    },
    27: {
      bonus: { comaDeath: '+24%', magicPoison: '+6' },
      description: 'Coma/Death +24%, Save vs Magic/Poison +6',
    },
    28: {
      bonus: { comaDeath: '+26%', magicPoison: '+7' },
      description: 'Coma/Death +26%, Save vs Magic/Poison +7',
    },
    29: {
      bonus: { comaDeath: '+28%', magicPoison: '+7' },
      description: 'Coma/Death +28%, Save vs Magic/Poison +7',
    },
  },
  PB: {
    16: { bonus: '30%', description: 'Charm/Impress 30%' },
    17: { bonus: '35%', description: 'Charm/Impress 35%' },
    18: { bonus: '40%', description: 'Charm/Impress 40%' },
    19: { bonus: '45%', description: 'Charm/Impress 45%' },
    20: { bonus: '50%', description: 'Charm/Impress 50%' },
    21: { bonus: '55%', description: 'Charm/Impress 55%' },
    22: { bonus: '60%', description: 'Charm/Impress 60%' },
    23: { bonus: '65%', description: 'Charm/Impress 65%' },
    24: { bonus: '70%', description: 'Charm/Impress 70%' },
    25: { bonus: '75%', description: 'Charm/Impress 75%' },
    26: { bonus: '80%', description: 'Charm/Impress 80%' },
    27: { bonus: '83%', description: 'Charm/Impress 83%' },
    28: { bonus: '86%', description: 'Charm/Impress 86%' },
    29: { bonus: '90%', description: 'Charm/Impress 90%' },
  },
  Spd: {
    description: 'No special bonuses other than natural ability to run',
  },
};

// Function to get the bonus for a given attribute and value
export function getBonus(attribute, value) {
  const bonuses = attributeBonuses[attribute];
  if (!bonuses) {
    return null;
  }

  if (attribute === 'Spd') {
    return bonuses.description;
  }

  const sortedValues = Object.keys(bonuses)
    .map(Number)
    .sort((a, b) => a - b);

  let applicableBonus = null;
  for (let bonusValue of sortedValues) {
    if (value >= bonusValue) {
      applicableBonus = bonuses[bonusValue];
    }
  }
  return applicableBonus;
}

// Rest of your data (speciesData, socialBackgrounds, ageTable, etc.) remains the same


// Species data with attribute dice rolls
export const speciesData = {
  HUMAN: {
    IQ: '3d6',
    ME: '3d6',
    MA: '3d6',
    PS: '3d6',
    PP: '3d6',
    PE: '3d6',
    PB: '3d6',
    Spd: '3d6',
  },
  WOLFEN: {
    IQ: '3d6',
    ME: '3d6',
    MA: '2d6',
    PS: '4d6',
    PP: '3d6',
    PE: '3d6',
    PB: '3d6',
    Spd: '4d6',
  },
  HOB_GOBLIN: {
    IQ: '2d6',
    ME: '4d6',
    MA: '3d6',
    PS: '3d6',
    PP: '3d6',
    PE: '3d6',
    PB: '2d6',
    Spd: '3d6',
  },
  GOBLIN: {
    IQ: '2d6',
    ME: '3d6',
    MA: '3d6',
    PS: '3d6',
    PP: '4d6',
    PE: '3d6',
    PB: '2d6',
    Spd: '3d6',
  },
  ORC: {
    IQ: '2d6',
    ME: '2d6',
    MA: '3d6',
    PS: '4d6',
    PP: '3d6',
    PE: '3d6',
    PB: '3d6',
    Spd: '3d6',
  },
  OGRE: {
    IQ: '3d6',
    ME: '3d6',
    MA: '2d6',
    PS: '4d6',
    PP: '3d6',
    PE: '4d6',
    PB: '2d6',
    Spd: '3d6',
  },
  TROLL: {
    IQ: '3d6',
    ME: '2d6',
    MA: '2d6',
    PS: '5d6',
    PP: '4d6',
    PE: '4d6',
    PB: '2d6',
    Spd: '2d6',
  },
  TROGLODYTE: {
    IQ: '2d6',
    ME: '2d6',
    MA: '3d6',
    PS: '4d6',
    PP: '4d6',
    PE: '3d6',
    PB: '2d6',
    Spd: '5d6',
  },
  DWARF: {
    IQ: '3d6',
    ME: '3d6',
    MA: '2d6',
    PS: '4d6',
    PP: '3d6',
    PE: '4d6',
    PB: '2d6',
    Spd: '2d6',
  },
  KOBOLD: {
    IQ: '3d6',
    ME: '2d6',
    MA: '3d6',
    PS: '3d6',
    PP: '4d6',
    PE: '4d6',
    PB: '2d6',
    Spd: '3d6',
  },
  ELF: {
    IQ: '3d6',
    ME: '3d6',
    MA: '2d6',
    PS: '3d6',
    PP: '4d6',
    PE: '3d6',
    PB: '5d6',
    Spd: '3d6',
  },
  GNOME: {
    IQ: '3d6',
    ME: '2d6',
    MA: '3d6',
    PS: '2d6',
    PP: '4d6',
    PE: '4d6',
    PB: '4d6',
    Spd: '2d6',
  },
  CHANGELING: {
    IQ: '2d6',
    ME: '5d6',
    MA: '4d6',
    PS: '3d6',
    PP: '3d6',
    PE: '2d6',
    PB: '2d6',
    Spd: '2d6',
  },
};

// data.jsx

export const alignments = [
  { value: "Good: Principled", label: "Good: Principled" },
  { value: "Good: Scrupulous", label: "Good: Scrupulous" },
  { value: "Selfish: Unprincipled", label: "Selfish: Unprincipled" },
  { value: "Selfish: Anarchist", label: "Selfish: Anarchist" },
  { value: "Evil: Miscreant", label: "Evil: Miscreant" },
  { value: "Evil: Aberrant", label: "Evil: Aberrant" },
  { value: "Evil: Diabolic", label: "Evil: Diabolic" }
];


// Social backgrounds with corresponding roll ranges
export const socialBackgrounds = [
  { range: [1, 10], background: 'Sailor/Fisherman' },
  { range: [11, 17], background: 'Craftsman' },
  { range: [18, 24], background: 'Serf' },
  { range: [25, 30], background: 'Peasant Farmer' },
  { range: [31, 36], background: 'Farmer' },
  { range: [37, 54], background: 'Men at Arms' },
  { range: [55, 70], background: 'Clergy' },
  { range: [71, 80], background: 'Merchant' },
  { range: [81, 90], background: 'Scholar/Magician' },
  { range: [91, 100], background: 'Noble' },
];

// Age table for different species
export const ageTable = {
  HUMAN: [16, 19, 22, 24, 26, 28, 30, 34],
  WOLFEN: [16, 19, 22, 24, 26, 28, 30, 34],
  GOBLIN: [16, 19, 22, 24, 26, 28, 30, 34],
  HOB_GOBLIN: [16, 19, 22, 24, 26, 28, 30, 34],
  ORC: [16, 19, 22, 24, 26, 28, 30, 34],
  OGRE: [18, 22, 26, 28, 30, 34, 38, 42],
  TROLL: [18, 22, 26, 28, 30, 34, 38, 42],
  TROGLODYTE: [18, 22, 26, 28, 30, 34, 38, 42],
  DWARF: [20, 25, 30, 35, 40, 50, 60, 70],
  KOBOLD: [20, 25, 30, 35, 40, 50, 60, 70],
  GNOME: [20, 25, 30, 35, 40, 50, 60, 70],
  ELF: [20, 24, 28, 30, 50, 80, 100, 200],
  CHANGELING: [20, 24, 28, 30, 50, 80, 100, 200],
};

// Dispositions with corresponding roll ranges
export const dispositions = [
  { range: [1, 6], text: 'Mean, suspicious, vengeful' },
  { range: [7, 10], text: 'Paternal, overbearing, overprotective' },
  { range: [11, 19], text: 'Quick-tempered, grumpy, easily aggravated' },
  { range: [20, 28], text: 'Shy, timid, reserved, not sure of oneself' },
  { range: [29, 37], text: 'Braggart, cocky, exaggerates, usually cheerful but annoying' },
  { range: [38, 46], text: 'Schemer, gambler, takes chances, looking for the best deal' },
  { range: [47, 56], text: 'Friendly, talkative' },
  { range: [57, 60], text: 'Courteous, hospitable' },
  { range: [61, 70], text: 'Tough guy, impudent, self-reliant, confident' },
  { range: [71, 78], text: 'Complainer, constantly aggravated about something or somebody' },
  { range: [79, 88], text: 'Arrogant, snobbish, feels superior' },
  { range: [89, 95], text: 'Easy-going, laid back, trusts almost anyone until proven unworthy' },
  { range: [96, 100], text: 'Paranoid, trusts no one' },
];

// Personal hostilities with corresponding roll ranges
export const hostilities = [
  { range: [1, 8], text: 'None' },
  { range: [9, 14], text: 'Knights/Paladins' },
  { range: [15, 24], text: 'Magic/Men of magic' },
  { range: [25, 32], text: 'Dwarves' },
  { range: [33, 41], text: 'Elves' },
  { range: [42, 48], text: 'Wolfen' },
  { range: [49, 56], text: 'Non-human races' },
  { range: [57, 68], text: 'Clergy' },
  { range: [69, 73], text: 'Merchants' },
  { range: [74, 82], text: 'Soldiers/Military' },
  { range: [83, 90], text: 'Thieves' },
  { range: [91, 100], text: 'The supernatural (Gods, ghosts, demons, etc.)' },
];

// Export the `hostilities` array as `hostilityLevels`
export const hostilityLevels = hostilities;


// Lands of origin with corresponding roll ranges
export const landsOfOrigin = [
  { range: [1, 5], text: 'Ophids Grasslands (North)' },
  { range: [6, 7], text: 'Northern Mountains (North)' },
  { range: [8, 12], text: 'Kingdom of Bizantium (North)' },
  { range: [13, 14], text: 'Phi Island (East)' },
  { range: [15, 17], text: 'Lopan (East)' },
  { range: [18, 20], text: 'Timiro Kingdom (East)' },
  { range: [21, 38], text: 'Eastern Territory (East)' },
  { range: [39, 54], text: 'The Old Kingdom (West)' },
  { range: [55, 68], text: 'The Western Empire (West)' },
  { range: [69, 79], text: 'The Great Northern Wilderness (North)' },
  { range: [80, 82], text: 'Baalgor Wastelands (South)' },
  { range: [83, 89], text: 'Unknown' },
  { range: [90, 90], text: 'Mt. Nimro (South)' },
  { range: [91, 100], text: 'Yin-Sloth Jungles (South)' },
];

// Utility function to roll from a table based on a roll value
export function rollFromTable(roll, table) {
  for (let entry of table) {
    const [min, max] = entry.range;
    if (roll >= min && roll <= max) {
      return entry.text || entry.background;
    }
  }
  return 'Unknown';
}

// Species characteristics data
export const speciesCharacteristics = {
  HUMAN: {
    heightRange: '4 - 6.10 ft.',
    psionics: 'None',
    occLimitations: 'None'
  },
  ELF: {
    heightRange: '6 - 6.10 ft.',
    psionics: '60 ft.',
    occLimitations: 'None'
  },
  DWARF: {
    heightRange: '3 - 4 ft.',
    psionics: '90 ft.',
    occLimitations: 'No magic (except Mind Mage), No Long Bowman'
  },
  GOBLIN: {
    heightRange: '3 - 4 ft.',
    psionics: '90 ft.',
    occLimitations: 'No magic O.C.C. (except Witch and Warlock), No Long Bowman, Knight, or Paladin'
  },
  HOB_GOBLIN: {
    heightRange: '4 - 5 ft.',
    psionics: '40 ft.',
    occLimitations: 'No magic O.C.C. (except Witch), No Long Bowman, Knight, or Paladin'
  },
  KOBOLD: {
    heightRange: '3 - 4 ft.',
    psionics: '90 ft.',
    occLimitations: 'No Long Bowman, Knight, or Paladin'
  },
  ORC: {
    heightRange: '5 - 6.8 ft.',
    psionics: '40 ft.',
    occLimitations: 'No magic O.C.C. (except Witch and Warlock), No Knight or Paladin'
  },
  OGRE: {
    heightRange: '6 - 8 ft.',
    psionics: '40 ft.',
    occLimitations: 'None'
  },
  TROLL: {
    heightRange: '10 - 12 ft.',
    psionics: '60 ft.',
    occLimitations: 'None (though they tend toward Mercenary Fighter, Thief, and Assassin)'
  },
  TROGLODYTE: {
    heightRange: '4 - 5 ft.',
    psionics: '120 ft.',
    occLimitations: 'Limited to Mercenary Fighter, Thief, Assassin, Priest, Shaman, and Healer ONLY'
  },
  CHANGELING: {
    heightRange: '3 - 10 ft.',
    psionics: 'None',
    occLimitations: 'None'
  },
  GNOME: {
    heightRange: '2 - 2.6 ft.',
    psionics: '90 ft.',
    occLimitations: 'Limited to Mercenary Fighter, Ranger, Thief, Assassin, Clergy, and Magic O.C.C. (except Mind Mage)'
  },
  WOLFEN: {
    heightRange: '7 - 9 ft.',
    psionics: '40 ft.',
    occLimitations: 'None'
  }
};

// Character class requirements
export const characterClasses = {
  // Men of Arms
  'Mercenary Fighter': {
    category: 'Men of Arms',
    requirements: {
      PS: 7
    }
  },
  'Soldier': {
    category: 'Men of Arms',
    requirements: {
      PS: 10,
      PE: 8
    }
  },
  'Knight': {
    category: 'Men of Arms',
    requirements: {
      IQ: 7,
      PE: 10,
      PP: 12,
      PS: 10
    }
  },
  'Paladin': {
    category: 'Men of Arms',
    requirements: {
      IQ: 10,
      PE: 10,
      PP: 12,
      PS: 12
    }
  },
  'Long Bowman': {
    category: 'Men of Arms',
    requirements: {
      PS: 10,
      PP: 12
    }
  },
  'Ranger': {
    category: 'Men of Arms',
    requirements: {
      IQ: 9,
      PE: 13,
      PS: 10
    }
  },
  'Thief': {
    category: 'Men of Arms',
    requirements: {
      PP: 9
    }
  },
  'Assassin': {
    category: 'Men of Arms',
    requirements: {
      IQ: 9,
      PP: 14
    }
  },
  // Men of Magic
  'Wizard': {
    category: 'Men of Magic',
    requirements: {
      IQ: 10
    }
  },
  'Witch': {
    category: 'Men of Magic',
    requirements: {
      IQ: 5,
      alignment: 'evil'
    }
  },
  'Warlock': {
    category: 'Men of Magic',
    requirements: {
      IQ: 6,
      ME: 10
    }
  },
  'Diabolist': {
    category: 'Men of Magic',
    requirements: {
      IQ: 12
    }
  },
  'Summoner': {
    category: 'Men of Magic',
    requirements: {
      IQ: 10,
      ME: 14
    }
  },
  'Mind Mage': {
    category: 'Men of Magic',
    requirements: {
      IQ: 9,
      psionics: true
    }
  },
  // Clergy
  'Priest': {
    category: 'Clergy',
    requirements: {
      IQ: 9,
      PE: 12
    }
  },
  'Druid': {
    category: 'Clergy',
    requirements: {
      IQ: 9,
      PE: 9
    }
  },
  'Shaman': {
    category: 'Clergy',
    requirements: {
      PE: 15
    }
  },
  'Healer': {
    category: 'Clergy',
    requirements: {
      PP: 7
    }
  },
  // Optional O.C.C.'s
  'Peasant': {
    category: 'Optional',
    requirements: {
      PS: 7
    }
  },
  'Squire': {
    category: 'Optional',
    requirements: {
      IQ: 7,
      PS: 6
    }
  },
  'Scholar': {
    category: 'Optional',
    requirements: {
      IQ: 14
    }
  },
  'Merchant': {
    category: 'Optional',
    requirements: {
      IQ: 10
    }
  },
  'Noble': {
    category: 'Optional',
    requirements: {
      IQ: 7
    }
  }
};

// Function to check if a character can be a specific class
export function canBeClass(character, className) {
  const classData = characterClasses[className];
  if (!classData) return false;

  // Check species limitations
  const speciesLimits = speciesCharacteristics[character.species].occLimitations;
  if (speciesLimits !== 'None') {
    // Check for specific class restrictions
    if (speciesLimits.includes(`No ${className}`)) return false;
    
    // Check for category restrictions
    if (speciesLimits.includes('No magic O.C.C.') && classData.category === 'Men of Magic') {
      // Check for exceptions
      if (!speciesLimits.includes(`except ${className.toLowerCase()}`)) return false;
    }
    
    // Check for "Limited to" restrictions
    if (speciesLimits.includes('Limited to') && 
        !speciesLimits.toLowerCase().includes(className.toLowerCase())) {
      return false;
    }
  }

  // Check attribute requirements
  const requirements = classData.requirements;
  for (const [attr, value] of Object.entries(requirements)) {
    if (attr === 'alignment') {
      if (value === 'evil' && !character.alignment.toLowerCase().includes('evil')) return false;
    } else if (attr === 'psionics') {
      const speciesPsionics = speciesCharacteristics[character.species].psionics;
      if (value && speciesPsionics === 'None') return false;
    } else {
      if (character.attributes[attr] < value) return false;
    }
  }

  return true;
}

// Function to get available classes for a character
export function getAvailableClasses(character) {
  return Object.keys(characterClasses).filter(className => 
    canBeClass(character, className)
  );
}

