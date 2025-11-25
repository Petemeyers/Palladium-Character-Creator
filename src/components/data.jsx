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
  // Faerie Folk
  FAERIE: {
    IQ: '3d6',
    ME: '2d6',
    MA: '2d6',
    PS: '1d6',
    PP: '4d6',
    PE: '2d6',
    PB: '5d6',
    Spd: '4d6',
  },
  SILVER_BELL: {
    IQ: '3d6',
    ME: '2d6',
    MA: '2d6',
    PS: '1d6',
    PP: '3d6',
    PE: '2d6',
    PB: '5d6',
    Spd: '4d6',
  },
  GREEN_WOOD: {
    IQ: '3d6',
    ME: '2d6',
    MA: '2d6',
    PS: '1d6',
    PP: '4d6',
    PE: '2d6',
    PB: '4d6',
    Spd: '4d6',
  },
  NIGHT_ELF: {
    IQ: '3d6',
    ME: '2d6',
    MA: '2d6',
    PS: '1d6',
    PP: '4d6',
    PE: '2d6',
    PB: '4d6',
    Spd: '4d6',
  },
  PIXIE: {
    IQ: '3d6',
    ME: '2d6',
    MA: '2d6',
    PS: '1d6',
    PP: '4d6',
    PE: '2d6',
    PB: '3d6',
    Spd: '3d6',
  },
  FROST_PIXIE: {
    IQ: '3d6',
    ME: '2d6',
    MA: '2d6',
    PS: '1d6',
    PP: '4d6',
    PE: '2d6',
    PB: '4d6',
    Spd: '4d6',
  },
  LEPRECHAUN: {
    IQ: '3d6',
    ME: '2d6',
    MA: '2d6',
    PS: '2d6',
    PP: '4d6',
    PE: '3d6',
    PB: '3d6',
    Spd: '4d6',
  },
  BROWNIE: {
    IQ: '2d6',
    ME: '2d6',
    MA: '3d6',
    PS: '2d6',
    PP: '3d6',
    PE: '2d6',
    PB: '3d6',
    Spd: '4d6',
  },
  TREE_SPRITE: {
    IQ: '2d6',
    ME: '2d6',
    MA: '2d6',
    PS: '1d6',
    PP: '4d6',
    PE: '2d6',
    PB: '4d6',
    Spd: '4d6',
  },
  WATER_SPRITE: {
    IQ: '2d6',
    ME: '2d6',
    MA: '2d6',
    PS: '1d6',
    PP: '4d6',
    PE: '2d6',
    PB: '4d6',
    Spd: '4d6',
  },
  WIND_PUFF: {
    IQ: '2d6',
    ME: '2d6',
    MA: '2d6',
    PS: '1d6',
    PP: '4d6',
    PE: '2d6',
    PB: '4d6',
    Spd: '4d6',
  },
  SPRIGGAN: {
    IQ: '2d6',
    ME: '2d6',
    MA: '2d6',
    PS: '5d6',
    PP: '3d6',
    PE: '4d6',
    PB: '2d6',
    Spd: '2d6',
  },
  NYMPH: {
    IQ: '3d6',
    ME: '2d6',
    MA: '2d6',
    PS: '2d6',
    PP: '3d6',
    PE: '3d6',
    PB: '4d6',
    Spd: '3d6',
  },
  BOGIE: {
    IQ: '2d6',
    ME: '2d6',
    MA: '2d6',
    PS: '1d6',
    PP: '4d6',
    PE: '3d6',
    PB: '1d6',
    Spd: '4d6',
  },
  TOAD_STOOL: {
    IQ: '2d6',
    ME: '2d6',
    MA: '2d6',
    PS: '1d6',
    PP: '3d6',
    PE: '3d6',
    PB: '1d6',
    Spd: '3d6',
  },
  PUCK: {
    IQ: '2d6',
    ME: '2d6',
    MA: '2d6',
    PS: '2d6',
    PP: '4d6',
    PE: '3d6',
    PB: '2d6',
    Spd: '4d6',
  },
  SATYR: {
    IQ: '2d6',
    ME: '2d6',
    MA: '2d6',
    PS: '3d6',
    PP: '3d6',
    PE: '3d6',
    PB: '2d6',
    Spd: '4d6',
  },
  WILL_O_WISP: {
    IQ: '2d6',
    ME: '4d6',
    MA: '2d6',
    PS: '4d6',
    PP: '2d6',
    PE: '4d6',
    PB: '3d6',
    Spd: '1d6',
  },
  MERMAID: {
    IQ: '2d6',
    ME: '3d6',
    MA: '4d6',
    PS: '2d6',
    PP: '2d6',
    PE: '3d6',
    PB: '5d6',
    Spd: '5d6',
  },
  MERROW: {
    IQ: '2d6',
    ME: '3d6',
    MA: '3d6',
    PS: '4d6',
    PP: '2d6',
    PE: '3d6',
    PB: '4d6',
    Spd: '5d6',
  },
  // Giants
  ALGOR: {
    IQ: '3d6',
    ME: '2d6',
    MA: '3d6',
    PS: '5d6',
    PP: '3d6',
    PE: '4d6',
    PB: '3d6',
    Spd: '2d6',
  },
  CYCLOPS: {
    IQ: '3d6',
    ME: '2d6',
    MA: '4d6',
    PS: '5d6',
    PP: '4d6',
    PE: '4d6',
    PB: '2d6',
    Spd: '2d6',
  },
  JOTAN: {
    IQ: '2d6',
    ME: '3d6',
    MA: '2d6',
    PS: '5d6',
    PP: '5d6',
    PE: '2d6',
    PB: '3d6',
    Spd: '3d6',
  },
  GIGANTES: {
    IQ: '2d6',
    ME: '1d6',
    MA: '2d6',
    PS: '5d6',
    PP: '4d6',
    PE: '5d6',
    PB: '2d6',
    Spd: '4d6',
  },
  NIMRO: {
    IQ: '3d6',
    ME: '4d6',
    MA: '3d6',
    PS: '4d6',
    PP: '4d6',
    PE: '3d6',
    PB: '2d6',
    Spd: '4d6',
  },
  TITAN: {
    IQ: '3d6',
    ME: '2d6',
    MA: '3d6',
    PS: '4d6',
    PP: '5d6',
    PE: '4d6',
    PB: '5d6',
    Spd: '4d6',
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
  // Faerie Folk (very long-lived)
  FAERIE: [50, 100, 200, 300, 500, 800, 1000, 1500],
  SILVER_BELL: [50, 100, 200, 300, 500, 800, 1000, 1500],
  GREEN_WOOD: [50, 100, 200, 300, 500, 800, 1000, 1500],
  NIGHT_ELF: [50, 100, 200, 300, 500, 800, 1000, 1500],
  PIXIE: [50, 100, 200, 300, 500, 800, 1000, 1500],
  FROST_PIXIE: [50, 100, 200, 300, 500, 800, 1000, 1500],
  LEPRECHAUN: [50, 100, 200, 300, 500, 800, 1000, 1500],
  BROWNIE: [50, 100, 200, 300, 500, 800, 1000, 1500],
  TREE_SPRITE: [50, 100, 200, 300, 500, 800, 1000, 1500],
  WATER_SPRITE: [50, 100, 200, 300, 500, 800, 1000, 1500],
  WIND_PUFF: [50, 100, 200, 300, 500, 800, 1000, 1500],
  SPRIGGAN: [50, 100, 200, 300, 500, 800, 1000, 1500],
  NYMPH: [50, 100, 200, 300, 500, 800, 1000, 1500],
  BOGIE: [50, 100, 200, 300, 500, 800, 1000, 1500],
  TOAD_STOOL: [50, 100, 200, 300, 500, 800, 1000, 1500],
  PUCK: [50, 100, 200, 300, 500, 800, 1000, 1500],
  SATYR: [50, 100, 200, 300, 500, 800, 1000, 1500],
  WILL_O_WISP: [50, 100, 200, 300, 500, 800, 1000, 1500],
  MERMAID: [50, 100, 200, 300, 500, 800, 1000, 1500],
  MERROW: [50, 100, 200, 300, 500, 800, 1000, 1500],
  // Giants (long-lived)
  ALGOR: [30, 50, 80, 120, 180, 250, 300, 400],
  CYCLOPS: [30, 50, 80, 120, 180, 250, 300, 400],
  JOTAN: [30, 50, 80, 120, 180, 250, 300, 400],
  GIGANTES: [30, 50, 80, 120, 180, 250, 300, 400],
  NIMRO: [30, 50, 80, 120, 180, 250, 300, 400],
  TITAN: [50, 100, 200, 300, 500, 800, 1000, 1200],
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
  { range: [61, 70], text: 'Tough, impudent, self-reliant, confident' },
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
    psionics: '30 ft.',
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
  },
  // Faerie Folk
  FAERIE: {
    heightRange: '6 inches',
    psionics: 'None',
    occLimitations: 'None (but never wear armour)'
  },
  SILVER_BELL: {
    heightRange: '6 inches',
    psionics: 'None',
    occLimitations: 'None (but never wear armour)'
  },
  GREEN_WOOD: {
    heightRange: '6 inches',
    psionics: 'None',
    occLimitations: 'None (but never wear armour)'
  },
  NIGHT_ELF: {
    heightRange: '6 inches',
    psionics: 'None',
    occLimitations: 'None (but never wear armour)'
  },
  PIXIE: {
    heightRange: '12 inches',
    psionics: 'None',
    occLimitations: 'None (may wear soft leather armour)'
  },
  FROST_PIXIE: {
    heightRange: '12 inches',
    psionics: 'None',
    occLimitations: 'None (but never wear armour)'
  },
  LEPRECHAUN: {
    heightRange: '3 ft.',
    psionics: 'None',
    occLimitations: 'None (faerie shoemaker/tailor)'
  },
  BROWNIE: {
    heightRange: '2 ft.',
    psionics: 'None',
    occLimitations: 'None (but never wear armour or use weapons)'
  },
  TREE_SPRITE: {
    heightRange: '6 inches',
    psionics: 'None',
    occLimitations: 'None (but never wear clothes or armour)'
  },
  WATER_SPRITE: {
    heightRange: '6 inches',
    psionics: 'None',
    occLimitations: 'None (but never wear clothes or armour)'
  },
  WIND_PUFF: {
    heightRange: '6 inches',
    psionics: 'None',
    occLimitations: 'None (but never wear clothes or armour)'
  },
  SPRIGGAN: {
    heightRange: '4 ft.',
    psionics: 'None',
    occLimitations: 'None (builders)'
  },
  NYMPH: {
    heightRange: '6 ft.',
    psionics: 'None',
    occLimitations: 'None (protector of nature)'
  },
  BOGIE: {
    heightRange: '3 ft.',
    psionics: 'None',
    occLimitations: 'None (but may use weapons)'
  },
  TOAD_STOOL: {
    heightRange: '2 ft.',
    psionics: 'None',
    occLimitations: 'None'
  },
  PUCK: {
    heightRange: '3 ft.',
    psionics: 'None',
    occLimitations: 'None (thief)'
  },
  SATYR: {
    heightRange: '5 ft.',
    psionics: 'None',
    occLimitations: 'None'
  },
  WILL_O_WISP: {
    heightRange: 'Variable',
    psionics: 'None',
    occLimitations: 'None'
  },
  MERMAID: {
    heightRange: '6 ft.',
    psionics: 'None',
    occLimitations: 'None'
  },
  MERROW: {
    heightRange: '6 ft.',
    psionics: 'None',
    occLimitations: 'None'
  },
  // Giants
  ALGOR: {
    heightRange: '14 - 16 ft.',
    psionics: 'Standard',
    occLimitations: 'No Thief, Paladin, or Long Bowman'
  },
  CYCLOPS: {
    heightRange: '14 ft.',
    psionics: 'Standard',
    occLimitations: 'None (tend toward men of arms)'
  },
  JOTAN: {
    heightRange: '18 - 20 ft.',
    psionics: 'Standard',
    occLimitations: 'Limited to Men of Arms, Clergy, Witch, or Warlock'
  },
  GIGANTES: {
    heightRange: '10 - 16 ft.',
    psionics: 'Standard',
    occLimitations: 'Limited to Men of Arms, Clergy, or Witch'
  },
  NIMRO: {
    heightRange: '14 - 16 ft.',
    psionics: 'Standard',
    occLimitations: 'No Knight, Paladin, or Long Bowman'
  },
  TITAN: {
    heightRange: '12 - 14 ft.',
    psionics: 'Standard',
    occLimitations: 'Limited to Men of Arms, Healer, Wizard, and Warlock'
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

// O.C.C. Abilities - Machine-readable bonuses for combat integration
export const occAbilities = {
  "Mercenary Fighter": [
    { 
      name: "Weapon Proficiency: Sword", 
      type: "combat", 
      bonusType: "attack", 
      value: 2, 
      weapon: "Sword",
      bonus: "+2 attack rolls with swords"
    },
    { 
      name: "Endurance", 
      type: "skill", 
      bonus: "+5% to physical skills"
    },
  ],
  "Soldier": [
    { 
      name: "Weapon Proficiency: Sword", 
      type: "combat", 
      bonusType: "attack", 
      value: 2, 
      weapon: "Sword",
      bonus: "+2 attack rolls with swords"
    },
    { 
      name: "Military Training", 
      type: "combat", 
      bonusType: "attack", 
      value: 1,
      bonus: "+1 to all attack rolls"
    },
    { 
      name: "Endurance", 
      type: "skill", 
      bonus: "+5% to physical skills"
    },
  ],
  "Knight": [
    { 
      name: "Weapon Proficiency: Sword", 
      type: "combat", 
      bonusType: "attack", 
      value: 3, 
      weapon: "Sword",
      bonus: "+3 attack rolls with swords"
    },
    { 
      name: "Chivalry", 
      type: "skill", 
      bonus: "+10% to Charm/Impress"
    },
    { 
      name: "Honor", 
      type: "combat", 
      bonusType: "damage", 
      value: 1,
      condition: "defending_others",
      bonus: "+1 damage when defending others"
    },
  ],
  "Paladin": [
    { 
      name: "Weapon Proficiency: Sword", 
      type: "combat", 
      bonusType: "attack", 
      value: 3, 
      weapon: "Sword",
      bonus: "+3 attack rolls with swords"
    },
    { 
      name: "Divine Smite", 
      type: "combat", 
      bonusType: "damage", 
      value: 3,
      condition: "evil_target",
      bonus: "+3 damage against evil creatures"
    },
    { 
      name: "Lay on Hands", 
      type: "magic", 
      effect: "Heal 2d6+2 HP", 
      uses: 3,
      bonus: "Heal 2d6+2 HP, 3 uses/day"
    },
  ],
  "Long Bowman": [
    { 
      name: "Weapon Proficiency: Bow", 
      type: "combat", 
      bonusType: "attack", 
      value: 3, 
      weapon: "Bow",
      bonus: "+3 attack rolls with bows"
    },
    { 
      name: "Precise Shot", 
      type: "combat", 
      bonusType: "damage", 
      value: 2,
      condition: "long_range",
      bonus: "+2 damage at long range"
    },
  ],
  "Ranger": [
    { 
      name: "Weapon Proficiency: Bow", 
      type: "combat", 
      bonusType: "attack", 
      value: 2, 
      weapon: "Bow",
      bonus: "+2 attack rolls with bows"
    },
    { 
      name: "Tracking", 
      type: "skill", 
      bonus: "+15% to Tracking skill"
    },
    { 
      name: "Wilderness Survival", 
      type: "skill", 
      bonus: "+10% to Wilderness Survival"
    },
  ],
  "Thief": [
    { 
      name: "Pick Locks", 
      type: "skill", 
      bonus: "+10% to Pick Locks"
    },
    { 
      name: "Backstab", 
      type: "combat", 
      bonusType: "damage", 
      value: 2, 
      condition: "unaware",
      bonus: "+2 damage when attacking unaware target"
    },
    { 
      name: "Sneak Attack", 
      type: "combat", 
      bonusType: "attack", 
      value: 2,
      condition: "stealth",
      bonus: "+2 attack when attacking from stealth"
    },
  ],
  "Assassin": [
    { 
      name: "Pick Locks", 
      type: "skill", 
      bonus: "+15% to Pick Locks"
    },
    { 
      name: "Backstab", 
      type: "combat", 
      bonusType: "damage", 
      value: 4, 
      condition: "unaware",
      bonus: "+4 damage when attacking unaware target"
    },
    { 
      name: "Poison Use", 
      type: "skill", 
      bonus: "+10% to poison-related skills"
    },
  ],
  "Wizard": [
    { 
      name: "Spell: Fireball", 
      type: "magic", 
      damage: "4d6", 
      uses: 3,
      bonus: "4d6 damage, 3 uses/day"
    },
    { 
      name: "Spell: Detect Magic", 
      type: "magic", 
      effect: "Sense magical auras", 
      uses: 5,
      bonus: "Sense magical auras, 5 uses/day"
    },
    { 
      name: "Spell: Magic Missile", 
      type: "magic", 
      damage: "1d4+1", 
      uses: 5,
      bonus: "1d4+1 damage, 5 uses/day"
    },
  ],
  "Witch": [
    { 
      name: "Spell: Curse", 
      type: "magic", 
      effect: "Target suffers -2 to all rolls", 
      uses: 2,
      bonus: "Curse target, 2 uses/day"
    },
    { 
      name: "Spell: Hex", 
      type: "magic", 
      effect: "Target takes 1d6 damage per round", 
      uses: 3,
      bonus: "Hex target, 3 uses/day"
    },
  ],
  "Warlock": [
    { 
      name: "Spell: Eldritch Blast", 
      type: "magic", 
      damage: "2d6", 
      uses: 4,
      bonus: "2d6 damage, 4 uses/day"
    },
    { 
      name: "Spell: Summon Demon", 
      type: "magic", 
      effect: "Summon minor demon for 1 hour", 
      uses: 1,
      bonus: "Summon demon, 1 use/day"
    },
  ],
  "Priest": [
    { 
      name: "Spell: Heal", 
      type: "magic", 
      effect: "Heal 3d6+3 HP", 
      uses: 4,
      bonus: "Heal 3d6+3 HP, 4 uses/day"
    },
    { 
      name: "Spell: Turn Undead", 
      type: "magic", 
      effect: "Force undead to flee", 
      uses: 3,
      bonus: "Turn undead, 3 uses/day"
    },
    { 
      name: "Divine Protection", 
      type: "combat", 
      bonusType: "defense", 
      value: 2,
      bonus: "+2 to all defense rolls"
    },
  ],
  "Druid": [
    { 
      name: "Spell: Entangle", 
      type: "magic", 
      effect: "Roots entangle target", 
      uses: 3,
      bonus: "Entangle target, 3 uses/day"
    },
    { 
      name: "Spell: Animal Friendship", 
      type: "magic", 
      effect: "Befriend animal", 
      uses: 2,
      bonus: "Befriend animal, 2 uses/day"
    },
    { 
      name: "Wild Shape", 
      type: "magic", 
      effect: "Transform into animal", 
      uses: 1,
      bonus: "Transform into animal, 1 use/day"
    },
  ],
  "Shaman": [
    { 
      name: "Spell: Spirit Guide", 
      type: "magic", 
      effect: "Summon spirit for guidance", 
      uses: 2,
      bonus: "Summon spirit guide, 2 uses/day"
    },
    { 
      name: "Spell: Healing Touch", 
      type: "magic", 
      effect: "Heal 2d4+2 HP", 
      uses: 5,
      bonus: "Heal 2d4+2 HP, 5 uses/day"
    },
  ],
  "Healer": [
    { 
      name: "Spell: Cure Wounds", 
      type: "magic", 
      effect: "Heal 1d8+2 HP", 
      uses: 6,
      bonus: "Heal 1d8+2 HP, 6 uses/day"
    },
    { 
      name: "Spell: Remove Disease", 
      type: "magic", 
      effect: "Cure disease or poison", 
      uses: 2,
      bonus: "Remove disease, 2 uses/day"
    },
    { 
      name: "Medical Knowledge", 
      type: "skill", 
      bonus: "+15% to healing-related skills"
    },
  ],
};

// Encounter tables for day/night cycle
export const encounters = {
  day: [
    { 
      name: "Merchant Caravan", 
      type: "NPC", 
      description: "Travelers selling wares.",
      enemies: [] // peaceful
    },
    { 
      name: "Village Patrol", 
      type: "NPC", 
      description: "Local guards questioning strangers.",
      enemies: [{ name: "Guard", hp: 20, weapon: "Long Sword" }]
    },
    { 
      name: "Wild Animals", 
      type: "Monster", 
      description: "A pack of wolves hunting.",
      enemies: [
        { name: "Wolf", hp: 10, weapon: "Bite (1d6)" },
        { name: "Wolf", hp: 10, weapon: "Bite (1d6)" },
        { name: "Wolf", hp: 10, weapon: "Bite (1d6)" }
      ]
    },
    { 
      name: "Traveling Bard", 
      type: "NPC", 
      description: "A minstrel sharing news and songs.",
      enemies: [] // peaceful
    },
    { 
      name: "Farmer with Cart", 
      type: "NPC", 
      description: "A peasant transporting goods to market.",
      enemies: [] // peaceful
    },
    { 
      name: "Ranger Scout", 
      type: "NPC", 
      description: "A wilderness guide offering directions.",
      enemies: [] // peaceful
    },
  ],
  night: [
    { 
      name: "Bandits", 
      type: "Enemy", 
      description: "Ambushers looking for loot.",
      enemies: [
        { name: "Bandit", hp: 15, weapon: "Short Sword" },
        { name: "Bandit", hp: 15, weapon: "Dagger" }
      ]
    },
    { 
      name: "Owlbear", 
      type: "Monster", 
      description: "A terrifying beast stalks the camp.",
      enemies: [{ name: "Owlbear", hp: 50, weapon: "Claws (2d6)" }]
    },
    { 
      name: "Vampire", 
      type: "Undead", 
      description: "A shadowy figure emerges from the darkness.",
      enemies: [{ name: "Vampire", hp: 80, weapon: "Bite (1d8)" }]
    },
    { 
      name: "Wolves", 
      type: "Monster", 
      description: "A hungry pack circles the camp.",
      enemies: [
        { name: "Wolf", hp: 10, weapon: "Bite (1d6)" },
        { name: "Wolf", hp: 10, weapon: "Bite (1d6)" }
      ]
    },
    { 
      name: "Ghost", 
      type: "Undead", 
      description: "A spectral figure wails in the night.",
      enemies: [{ name: "Ghost", hp: 30, weapon: "Touch (1d8)" }]
    },
    { 
      name: "Thieves", 
      type: "Enemy", 
      description: "Sneaky criminals attempt to steal supplies.",
      enemies: [
        { name: "Thief", hp: 12, weapon: "Dagger" },
        { name: "Thief", hp: 12, weapon: "Short Sword" }
      ]
    },
    { 
      name: "Skeletons", 
      type: "Undead", 
      description: "Bones rise from the grave.",
      enemies: [
        { name: "Skeleton", hp: 10, weapon: "Rusty Sword" },
        { name: "Skeleton", hp: 10, weapon: "Rusty Sword" },
        { name: "Skeleton", hp: 10, weapon: "Rusty Sword" }
      ]
    },
    { 
      name: "Necromancer", 
      type: "Boss", 
      description: "Dark spellcaster with undead minions.",
      enemies: [
        { name: "Necromancer", hp: 60, weapon: "Dark Staff (2d6)" },
        { name: "Skeleton", hp: 10, weapon: "Rusty Sword" },
        { name: "Skeleton", hp: 10, weapon: "Rusty Sword" }
      ]
    },
  ],
};

// Loot tables for treasure generation
export const lootTables = {
  common: [
    { name: "Gold Coins", quantity: "2d6", type: "misc", weight: 0.1 },
    { name: "Dagger", damage: "1d4", type: "weapon", weight: 2 },
    { name: "Healing Potion", effect: "heal-2d6", type: "consumable", weight: 1 },
    { name: "Rope (50ft)", type: "misc", weight: 10 },
    { name: "Torch", type: "misc", weight: 1 },
    { name: "Rations (1 day)", type: "consumable", weight: 2 },
  ],
  rare: [
    { name: "Long Sword", damage: "2d8", type: "weapon", weight: 10 },
    { name: "Chainmail", defense: 4, type: "armor", weight: 35 },
    { name: "Elixir of Strength", effect: "buff-attack+2", type: "consumable", weight: 1 },
    { name: "Silver Coins", quantity: "1d10", type: "misc", weight: 0.1 },
    { name: "Magic Scroll", effect: "spell-cast", type: "consumable", weight: 0.5 },
    { name: "Leather Armor", defense: 2, type: "armor", weight: 15 },
  ],
  boss: [
    { name: "Magic Staff", damage: "3d6", type: "weapon", weight: 8 },
    { name: "Plate Armor", defense: 6, type: "armor", weight: 50 },
    { name: "Bag of Gems", quantity: "3d10", type: "misc", weight: 1 },
    { name: "Potion of Greater Healing", effect: "heal-4d6", type: "consumable", weight: 1 },
    { name: "Magic Ring", effect: "buff-all+1", type: "misc", weight: 0.1 },
    { name: "Ancient Tome", effect: "knowledge", type: "misc", weight: 5 },
  ],
};

// Racial merchant stock pools following Palladium lore
export const racialStocks = {
  Human: {
    weapons: ["Short Sword", "Long Sword", "Bow", "Dagger", "Spear", "Mace", "Staff"],
    armors: ["Leather Armor", "Chainmail", "Shield"],
    consumables: ["Healing Potion", "Rations", "Torch"],
    misc: ["Rope (50ft)", "Lockpicks"]
  },
  Dwarf: {
    weapons: ["Warhammer", "Battle Axe", "Mace", "Crossbow"],
    armors: ["Chainmail", "Plate Armor", "Shield"],
    consumables: ["Ale of Endurance", "Healing Potion"],
    misc: ["Mining Pick", "Dwarven Tools"]
  },
  Elf: {
    weapons: ["Elven Longbow", "Elven Rapier", "Elven Short Sword", "Elven Dagger"],
    armors: ["Elven Chain", "Elven Leather"],
    consumables: ["Elixir of Grace", "Healing Potion", "Moonwater"],
    misc: ["Elven Rope", "Elven Cloak"]
  },
  Orc: {
    weapons: ["Crude Sword", "Rusty Axe", "Spiked Club", "Orcish Spear"],
    armors: ["Hide Armor", "Orcish Shield"],
    consumables: ["Orcish Brew", "Raw Meat"],
    misc: ["Orcish Totem", "Bone Tools"]
  },
  Goblin: {
    weapons: ["Daggers", "Short Spears", "Goblin Slingshot", "Rusty Dagger"],
    armors: ["Padded Armor", "Goblin Hide"],
    consumables: ["Cheap Healing Draught", "Moldy Bread"],
    misc: ["Goblin Trinkets", "Stolen Goods"]
  },
  Wolfen: {
    weapons: ["Wolfen Claws", "Hunting Spear", "Wolfen Bow", "Fang Dagger"],
    armors: ["Wolfen Hide", "Bone Armor"],
    consumables: ["Wolfen Mead", "Hunters' Rations"],
    misc: ["Wolfen Totem", "Tracking Kit"]
  },
  Gnome: {
    weapons: ["Gnome Crossbow", "Gnome Dagger", "Gnome Sling"],
    armors: ["Gnome Leather", "Gnome Shield"],
    consumables: ["Gnome Ale", "Healing Potion"],
    misc: ["Gnome Goggles", "Tinkering Tools"]
  },
  Kobold: {
    weapons: ["Kobold Pick", "Kobold Dagger", "Kobold Sling"],
    armors: ["Kobold Hide", "Kobold Shield"],
    consumables: ["Kobold Brew", "Cave Mushrooms"],
    misc: ["Kobold Totem", "Mining Tools"]
  }
};

// Default merchants with personalities and racial hostilities
export const defaultMerchants = [
  {
    name: "Gruk",
    race: "Orc",
    personality: { 
      attitude: "gruff", 
      markup: 20, 
      markdown: 5, 
      haggleChance: 0.1 
    },
    racialBias: [
      { race: "Elf", penalty: 100 }, // refuses service
      { race: "Dwarf", penalty: 50 }, // markup 50%
      { race: "Human", penalty: 25 }, // slight markup
      { race: "Titan", penalty: 100 }, // refuses service to champions of good
    ],
    specialties: ["weapons", "armor"],
    stock: racialStocks.Orc,
  },
  {
    name: "Thalindra",
    race: "Elf",
    personality: { 
      attitude: "aloof", 
      markup: 10, 
      markdown: 15, 
      haggleChance: 0.3 
    },
    racialBias: [
      { race: "Orc", penalty: 100 }, // refuses service
      { race: "Goblin", penalty: 50 }, // markup 50%
      { race: "Wolfen", penalty: 25 }, // slight markup
      { race: "Troll", penalty: 75 }, // high markup
      { race: "Gigantes", penalty: 100 }, // refuses service to evil giants
    ],
    specialties: ["magic", "consumables"],
    stock: racialStocks.Elf,
  },
  {
    name: "Borin",
    race: "Dwarf",
    personality: { 
      attitude: "practical", 
      markup: 5, 
      markdown: 10, 
      haggleChance: 0.25 
    },
    racialBias: [
      { race: "Elf", penalty: 10 }, // slight markup
      { race: "Gnome", penalty: 5 }, // very slight markup
      { race: "Faerie", penalty: 25 }, // markup for faerie folk
      { race: "Pixie", penalty: 25 }, // markup for faerie folk
    ],
    specialties: ["weapons", "armor", "misc"],
    stock: racialStocks.Dwarf,
  },
  {
    name: "Marcus",
    race: "Human",
    personality: { 
      attitude: "friendly", 
      markup: 0, 
      markdown: 5, 
      haggleChance: 0.4 
    },
    racialBias: [
      { race: "Titan", penalty: -10 }, // slight discount for champions of good
      { race: "Nymph", penalty: -5 }, // slight discount for nature protectors
    ],
    specialties: ["weapons", "armor", "consumables", "misc"],
  },
  {
    name: "Grimble",
    race: "Goblin",
    personality: { 
      attitude: "hostile", 
      markup: 30, 
      markdown: 0, 
      haggleChance: 0.05 
    },
    racialBias: [
      { race: "Elf", penalty: 100 }, // refuses service
      { race: "Dwarf", penalty: 75 }, // high markup
      { race: "Human", penalty: 25 }, // moderate markup
      { race: "Titan", penalty: 100 }, // refuses service to champions of good
      { race: "Nymph", penalty: 100 }, // refuses service to nature protectors
      { race: "Brownie", penalty: 50 }, // high markup for good faerie folk
    ],
    specialties: ["misc", "consumables"],
    stock: racialStocks.Human,
  },
];

// Shop items with base costs

export const shopItems = [
  // Weapons
  { name: "Dagger", type: "weapon", damage: "1d4", weight: 2, cost: 25, sellPrice: 12 },
  { name: "Short Sword", type: "weapon", damage: "1d6", weight: 3, cost: 50, sellPrice: 25 },
  { name: "Long Sword", type: "weapon", damage: "2d8", weight: 10, cost: 100, sellPrice: 50 },
  { name: "Battle Axe", type: "weapon", damage: "2d6", weight: 8, cost: 80, sellPrice: 40 },
  { name: "Mace", type: "weapon", damage: "1d8", weight: 6, cost: 60, sellPrice: 30 },
  { name: "Bow", type: "weapon", damage: "1d6", weight: 2, cost: 80, sellPrice: 40 },
  { name: "Crossbow", type: "weapon", damage: "1d8", weight: 5, cost: 120, sellPrice: 60 },
  { name: "Spear", type: "weapon", damage: "1d6", weight: 3, cost: 30, sellPrice: 15 },
  { name: "Staff", type: "weapon", damage: "1d6", weight: 4, cost: 25, sellPrice: 12 },
  { name: "Warhammer", type: "weapon", damage: "1d8", weight: 5, cost: 60, sellPrice: 30 },
  
  // Racial Weapons
  { name: "Elven Longbow", type: "weapon", damage: "1d8", weight: 2, cost: 150, sellPrice: 75 },
  { name: "Elven Rapier", type: "weapon", damage: "1d6", weight: 2, cost: 120, sellPrice: 60 },
  { name: "Elven Short Sword", type: "weapon", damage: "1d6", weight: 2, cost: 80, sellPrice: 40 },
  { name: "Elven Dagger", type: "weapon", damage: "1d4", weight: 1, cost: 35, sellPrice: 17 },
  { name: "Crude Sword", type: "weapon", damage: "1d6", weight: 4, cost: 30, sellPrice: 15 },
  { name: "Rusty Axe", type: "weapon", damage: "1d6", weight: 5, cost: 25, sellPrice: 12 },
  { name: "Spiked Club", type: "weapon", damage: "1d6", weight: 4, cost: 20, sellPrice: 10 },
  { name: "Orcish Spear", type: "weapon", damage: "1d6", weight: 3, cost: 25, sellPrice: 12 },
  { name: "Short Spears", type: "weapon", damage: "1d4", weight: 2, cost: 15, sellPrice: 7 },
  { name: "Goblin Slingshot", type: "weapon", damage: "1d3", weight: 1, cost: 10, sellPrice: 5 },
  { name: "Rusty Dagger", type: "weapon", damage: "1d3", weight: 1, cost: 8, sellPrice: 4 },
  { name: "Wolfen Claws", type: "weapon", damage: "1d6", weight: 2, cost: 40, sellPrice: 20 },
  { name: "Hunting Spear", type: "weapon", damage: "1d6", weight: 3, cost: 35, sellPrice: 17 },
  { name: "Wolfen Bow", type: "weapon", damage: "1d6", weight: 2, cost: 90, sellPrice: 45 },
  { name: "Fang Dagger", type: "weapon", damage: "1d4", weight: 1, cost: 30, sellPrice: 15 },
  { name: "Gnome Crossbow", type: "weapon", damage: "1d6", weight: 3, cost: 100, sellPrice: 50 },
  { name: "Gnome Dagger", type: "weapon", damage: "1d4", weight: 1, cost: 25, sellPrice: 12 },
  { name: "Gnome Sling", type: "weapon", damage: "1d3", weight: 1, cost: 15, sellPrice: 7 },
  { name: "Kobold Pick", type: "weapon", damage: "1d6", weight: 4, cost: 35, sellPrice: 17 },
  { name: "Kobold Dagger", type: "weapon", damage: "1d4", weight: 1, cost: 20, sellPrice: 10 },
  { name: "Kobold Sling", type: "weapon", damage: "1d3", weight: 1, cost: 12, sellPrice: 6 },
  
  // Armor
  { name: "Leather Armor", type: "armor", defense: 2, weight: 15, cost: 75, sellPrice: 37 },
  { name: "Chainmail", type: "armor", defense: 4, weight: 35, cost: 150, sellPrice: 75 },
  { name: "Plate Armor", type: "armor", defense: 6, weight: 50, cost: 300, sellPrice: 150 },
  { name: "Shield", type: "armor", defense: 1, weight: 8, cost: 40, sellPrice: 20 },
  
  // Racial Armor
  { name: "Elven Chain", type: "armor", defense: 4, weight: 20, cost: 200, sellPrice: 100 },
  { name: "Elven Leather", type: "armor", defense: 2, weight: 8, cost: 120, sellPrice: 60 },
  { name: "Hide Armor", type: "armor", defense: 3, weight: 15, cost: 60, sellPrice: 30 },
  { name: "Orcish Shield", type: "armor", defense: 1, weight: 10, cost: 30, sellPrice: 15 },
  { name: "Padded Armor", type: "armor", defense: 1, weight: 8, cost: 40, sellPrice: 20 },
  { name: "Goblin Hide", type: "armor", defense: 1, weight: 5, cost: 25, sellPrice: 12 },
  { name: "Wolfen Hide", type: "armor", defense: 3, weight: 12, cost: 70, sellPrice: 35 },
  { name: "Bone Armor", type: "armor", defense: 3, weight: 18, cost: 50, sellPrice: 25 },
  { name: "Gnome Leather", type: "armor", defense: 2, weight: 6, cost: 60, sellPrice: 30 },
  { name: "Gnome Shield", type: "armor", defense: 1, weight: 4, cost: 25, sellPrice: 12 },
  { name: "Kobold Hide", type: "armor", defense: 2, weight: 8, cost: 30, sellPrice: 15 },
  { name: "Kobold Shield", type: "armor", defense: 1, weight: 6, cost: 20, sellPrice: 10 },
  
  // Consumables
  { name: "Healing Potion", type: "consumable", effect: "heal-2d6", weight: 1, cost: 30, sellPrice: 15 },
  { name: "Potion of Greater Healing", type: "consumable", effect: "heal-4d6", weight: 1, cost: 60, sellPrice: 30 },
  { name: "Elixir of Strength", type: "consumable", effect: "buff-attack+2", weight: 1, cost: 40, sellPrice: 20 },
  { name: "Magic Scroll", type: "consumable", effect: "spell-cast", weight: 0.5, cost: 50, sellPrice: 25 },
  { name: "Rations", type: "consumable", effect: "1 day food", weight: 1, cost: 5, sellPrice: 2 },
  { name: "Torch", type: "consumable", effect: "Light source", weight: 1, cost: 2, sellPrice: 1 },
  
  // Racial Consumables
  { name: "Ale of Endurance", type: "consumable", effect: "+2 PE for 1 hour", weight: 1, cost: 40, sellPrice: 20 },
  { name: "Elixir of Grace", type: "consumable", effect: "+2 PP for 1 hour", weight: 0.5, cost: 80, sellPrice: 40 },
  { name: "Moonwater", type: "consumable", effect: "Heal 1d6+1 HP", weight: 0.5, cost: 60, sellPrice: 30 },
  { name: "Orcish Brew", type: "consumable", effect: "+1 PS for 30 min", weight: 1, cost: 20, sellPrice: 10 },
  { name: "Raw Meat", type: "consumable", effect: "1 day food", weight: 2, cost: 8, sellPrice: 4 },
  { name: "Cheap Healing Draught", type: "consumable", effect: "Heal 1d4 HP", weight: 0.5, cost: 25, sellPrice: 12 },
  { name: "Moldy Bread", type: "consumable", effect: "1 day food", weight: 1, cost: 2, sellPrice: 1 },
  { name: "Wolfen Mead", type: "consumable", effect: "+1 ME for 1 hour", weight: 1, cost: 35, sellPrice: 17 },
  { name: "Hunters' Rations", type: "consumable", effect: "2 days food", weight: 2, cost: 8, sellPrice: 4 },
  { name: "Gnome Ale", type: "consumable", effect: "+1 IQ for 1 hour", weight: 1, cost: 30, sellPrice: 15 },
  { name: "Kobold Brew", type: "consumable", effect: "+1 PP for 30 min", weight: 1, cost: 15, sellPrice: 7 },
  { name: "Cave Mushrooms", type: "consumable", effect: "Heal 1d3 HP", weight: 0.5, cost: 10, sellPrice: 5 },
  
  // Misc
  { name: "Rope (50ft)", type: "misc", weight: 10, cost: 15, sellPrice: 7 },
  { name: "Lockpicks", type: "misc", weight: 0.1, cost: 25, sellPrice: 12 },
  { name: "Thieves' Tools", type: "misc", weight: 2, cost: 50, sellPrice: 25 },
  
  // Racial Misc
  { name: "Mining Pick", type: "misc", weight: 4, cost: 30, sellPrice: 15 },
  { name: "Dwarven Tools", type: "misc", weight: 8, cost: 60, sellPrice: 30 },
  { name: "Elven Rope", type: "misc", weight: 3, cost: 20, sellPrice: 10 },
  { name: "Elven Cloak", type: "misc", weight: 2, cost: 40, sellPrice: 20 },
  { name: "Orcish Totem", type: "misc", weight: 1, cost: 25, sellPrice: 12 },
  { name: "Bone Tools", type: "misc", weight: 3, cost: 15, sellPrice: 7 },
  { name: "Goblin Trinkets", type: "misc", weight: 0.5, cost: 5, sellPrice: 2 },
  { name: "Stolen Goods", type: "misc", weight: 1, cost: 20, sellPrice: 10 },
  { name: "Wolfen Totem", type: "misc", weight: 1, cost: 30, sellPrice: 15 },
  { name: "Tracking Kit", type: "misc", weight: 3, cost: 45, sellPrice: 22 },
  { name: "Gnome Goggles", type: "misc", weight: 0.5, cost: 35, sellPrice: 17 },
  { name: "Tinkering Tools", type: "misc", weight: 4, cost: 50, sellPrice: 25 },
  { name: "Kobold Totem", type: "misc", weight: 1, cost: 20, sellPrice: 10 },
  { name: "Mining Tools", type: "misc", weight: 6, cost: 40, sellPrice: 20 },
  { name: "Gold Coins", type: "misc", weight: 0.1, cost: 1, sellPrice: 1 },
];

// Magic spells with PPE costs and effects
export const magicSpells = [
  { name: "Fireball", cost: 10, damage: "4d6", effect: "Explosive fire damage" },
  { name: "Lightning Bolt", cost: 12, damage: "5d6", effect: "Electrical damage" },
  { name: "Magic Armor", cost: 8, effect: "Gain +5 Armor for 1 hour" },
  { name: "Heal", cost: 6, effect: "Heal 2d6+2 HP" },
  { name: "Cure Light Wounds", cost: 4, effect: "Heal 1d8+1 HP" },
  { name: "Magic Missile", cost: 3, damage: "1d4+1", effect: "Unavoidable magical damage" },
  { name: "Sleep", cost: 5, effect: "Target falls asleep for 1d4 hours" },
  { name: "Charm Person", cost: 7, effect: "Target becomes friendly for 1 hour" },
  { name: "Invisibility", cost: 9, effect: "Become invisible for 10 minutes" },
  { name: "Teleport", cost: 15, effect: "Instantly move to known location" },
  { name: "Wall of Fire", cost: 14, damage: "2d6", effect: "Creates burning barrier" },
  { name: "Ice Storm", cost: 13, damage: "3d6", effect: "Blizzard of ice shards" },
  { name: "Polymorph", cost: 16, effect: "Transform into another creature" },
  { name: "Wish", cost: 50, effect: "Grant any reasonable request" },
  { name: "Time Stop", cost: 20, effect: "Stop time for 1d4+1 rounds" },
];

// Psionic powers with ISP costs and effects
export const psionicPowers = [
  { name: "Mind Bolt", cost: 6, damage: "2d6", effect: "Mental attack" },
  { name: "Telepathy", cost: 4, effect: "Read surface thoughts" },
  { name: "Telekinesis", cost: 8, effect: "Move object up to 60 lbs" },
  { name: "Mind Control", cost: 10, effect: "Control target's actions" },
  { name: "Psychic Surgery", cost: 12, effect: "Heal 3d6 HP or cure disease" },
  { name: "Levitation", cost: 5, effect: "Float up to 20 feet high" },
  { name: "Pyrokinesis", cost: 7, damage: "1d8", effect: "Create and control fire" },
  { name: "Cryokinesis", cost: 7, damage: "1d8", effect: "Create and control ice" },
  { name: "Electrokinesis", cost: 7, damage: "1d8", effect: "Create and control electricity" },
  { name: "Teleportation", cost: 15, effect: "Instantly move to known location" },
  { name: "Astral Projection", cost: 20, effect: "Leave body and travel astrally" },
  { name: "Empathy", cost: 3, effect: "Sense emotions of others" },
  { name: "Presence Sense", cost: 2, effect: "Detect nearby life forms" },
  { name: "See Aura", cost: 1, effect: "See life force and alignment" },
  { name: "Bio-Regeneration", cost: 8, effect: "Heal 1d6 HP per round for 1 minute" },
];

// Racial special abilities and natural attacks
export const racialAbilities = {
  HUMAN: {
    specialAbilities: [
      "Adaptive and resourceful",
      "No special abilities"
    ],
    naturalAttacks: [],
    notes: "Most advanced of the races, aggressive, explore all areas of knowledge"
  },
  WOLFEN: {
    specialAbilities: [
      "Night vision up to 40 feet",
      "Superior sense of smell and hearing",
      "+80% bonus to tracking"
    ],
    naturalAttacks: [
      { name: "Claws", damage: "1d6 + PS bonus" },
      { name: "Bite", damage: "1d8 (no PS bonus)" }
    ],
    notes: "Serve as superior foot soldiers, provide aid and protection"
  },
  ELF: {
    specialAbilities: [
      "Night vision up to 90 feet"
    ],
    naturalAttacks: [],
    notes: "Handsome, distinguished features, long-lived (600 years average)"
  },
  DWARF: {
    specialAbilities: [
      "Night vision up to 90 feet",
      "+6 bonus to recognize weapon quality",
      "+4 bonus to recognize precious metals/stones"
    ],
    naturalAttacks: [],
    notes: "Excellent men of arms, forsaken magic (except mind mages and witches)"
  },
  GNOME: {
    specialAbilities: [
      "Night vision up to 90 feet",
      "+10% bonus to prowl",
      "Extremely agile"
    ],
    naturalAttacks: [],
    notes: "Weapons deal less damage due to small size (1d4 instead of 1d6, etc.)"
  },
  TROGLODYTE: {
    specialAbilities: [
      "Night vision up to 120 feet",
      "Day vision limited to 30 feet",
      "Great speed and agility"
    ],
    naturalAttacks: [
      { name: "Claws", damage: "6 + PS bonus" },
      { name: "Bite", damage: "1d6 (no PS bonus)" }
    ],
    notes: "Compassionate, shy, mild-mannered, wear little or no clothing"
  },
  KOBOLD: {
    specialAbilities: [
      "Night vision up to 90 feet",
      "+10% bonus to recognize weapon quality"
    ],
    naturalAttacks: [],
    notes: "Worship demons, sometimes sell services as mercenaries"
  },
  GOBLIN: {
    specialAbilities: [
      "Night vision up to 90 feet",
      "+10% bonus to recognize weapon quality",
      "Possible natural magic abilities (in Cobblers)"
    ],
    naturalAttacks: [],
    notes: "Poor craftsmen, lazy, cruel, vindictive dispositions"
  },
  HOB_GOBLIN: {
    specialAbilities: [
      "Night vision up to 40 feet",
      "Natural resistance to psionic attacks (due to high M.E.)"
    ],
    naturalAttacks: [],
    notes: "Poor craftsmen, lazy, cruel, greedy, vindictive"
  },
  ORC: {
    specialAbilities: [
      "Night vision up to 40 feet",
      "Great physical strength"
    ],
    naturalAttacks: [
      { name: "Claws", damage: "1d6 + PS bonus" },
      { name: "Fangs/Bite", damage: "1d6 (no PS bonus)" }
    ],
    notes: "Poor craftsmen, greedy, cruel, hot-tempered"
  },
  OGRE: {
    specialAbilities: [
      "Night vision up to 40 feet",
      "High physical endurance and strength"
    ],
    naturalAttacks: [
      { name: "Claws", damage: "1d8 + PS bonus" },
      { name: "Fangs/Bite", damage: "1d6 (no PS bonus)" }
    ],
    notes: "Poor craftsmen, vengeful, greedy, paranoid"
  },
  TROLL: {
    specialAbilities: [
      "Night vision up to 60 feet",
      "Great strength, agility, and endurance"
    ],
    naturalAttacks: [
      { name: "Claws", damage: "2d12 + PS bonus" },
      { name: "Fangs/Bite", damage: "2d12 (no PS bonus)" }
    ],
    notes: "Clever, cunning, treacherous, wickedly friendly temperament"
  },
  CHANGELING: {
    specialAbilities: [
      "Can alter shape and size to assume appearance of any humanoid",
      "Cannot change into animals or objects",
      "Process takes one full melee round (one minute)",
      "Limited to human forms 3-10 feet tall",
      "Weight can vary by about 30 pounds",
      "Clothes do not automatically adjust",
      "Asexual - no fixed gender"
    ],
    naturalAttacks: [],
    notes: "Suspicious of others, fair craftsmen and metalworkers"
  },
  // Faerie Folk
  FAERIE: {
    specialAbilities: [
      "Flying",
      "Night vision up to 90 feet",
      "See the invisible",
      "Identify plants/fruits 50%",
      "Locate water 40%",
      "Prowl 76%",
      "+4 to dodge"
    ],
    naturalAttacks: [],
    notes: "Never wear armour, disliked by most races/people"
  },
  SILVER_BELL: {
    specialAbilities: [
      "Flying",
      "Night vision up to 90 feet",
      "See the invisible",
      "Identify plants/fruits 60%",
      "Prowl 75%",
      "Locate secret compartments/doors 54%",
      "+4 to dodge"
    ],
    naturalAttacks: [],
    notes: "Never wear armour, disliked by most people, seen at dawn"
  },
  GREEN_WOOD: {
    specialAbilities: [
      "Flying",
      "Night vision up to 90 feet",
      "See the invisible",
      "Identify plants/fruits 80%",
      "Prowl 80%",
      "Locate water 70%",
      "Pick pockets 50%",
      "+3 to dodge",
      "Magic: charm, grow plants, animate plants, circle of rain, circle of flame, faeries' dance"
    ],
    naturalAttacks: [],
    notes: "Never wear armour, mischievous in the extreme"
  },
  NIGHT_ELF: {
    specialAbilities: [
      "Flying",
      "Night vision up to 90 feet",
      "See the invisible",
      "Identify plants/fruits 80%",
      "Prowl 80%",
      "Locate water 70%",
      "Pick pockets 50%",
      "+3 to dodge",
      "Magic: mesmerism, mend wood/clay, ventriloquism, turn self into mist, faeries' dance"
    ],
    naturalAttacks: [],
    notes: "Never wear armour, mischievous"
  },
  PIXIE: {
    specialAbilities: [
      "Flight ability (cannot run fast on ground)",
      "Night vision up to 60 feet",
      "Turn self invisible (at will)",
      "Prowl 60%",
      "Pick pockets 50%",
      "Pick locks 40%",
      "Locate secret compartments/doors 48%",
      "+2 to dodge",
      "Magic: charm, cloud of slumber, wind rush, sphere of light, mend wood/clay, tongue, circle of rain"
    ],
    naturalAttacks: [],
    notes: "May wear soft leather armour (S.D.C. 10, A.R. 8), disliked by most people"
  },
  FROST_PIXIE: {
    specialAbilities: [
      "Flight ability (cannot run fast on ground)",
      "Night vision up to 60 feet",
      "Turn self invisible",
      "Finger of frost (touch, 2 damage, stuns 1d6 rounds if save fails)",
      "Frost breath (4 ft range, 1d6 damage, blinds 1d6 rounds if save fails)",
      "Can pass through ice",
      "Magic: wind rush, north wind, freeze water, hail, snow storm, wall of ice"
    ],
    naturalAttacks: [],
    notes: "Never wear armour, disliked by most people, responsible for frosts and hail"
  },
  LEPRECHAUN: {
    specialAbilities: [
      "Night vision up to 60 feet",
      "Turn self invisible",
      "Ventriloquism",
      "Speaks all tongues",
      "Prowl 44%",
      "Pick pockets 82%",
      "Pick locks 55%",
      "Locate secret compartments/doors 64%",
      "Recognize precious metals/stones 96%"
    ],
    naturalAttacks: [],
    notes: "Thief, con-man, super greedy, extremely mischievous, always loyal to faerie folk"
  },
  BROWNIE: {
    specialAbilities: [
      "Night vision up to 90 feet",
      "Turn self invisible",
      "Prowl 75%",
      "Pick pockets 50%",
      "Pick locks 40%",
      "Locate secret compartments/doors 40%",
      "Cannot fly",
      "Magic: mend wood/clay, cloud of slumber, animate objects"
    ],
    naturalAttacks: [],
    notes: "Most liked of faerie folk, never wear armour, never use weapons, shy but mischievous"
  },
  TREE_SPRITE: {
    specialAbilities: [
      "Flight ability (cannot run fast on ground)",
      "Night vision up to 60 feet",
      "Identify plants/fruits 80%",
      "Prowl 80%",
      "+4 to dodge",
      "Magic: animate plants, charm, faeries' dance"
    ],
    naturalAttacks: [],
    notes: "Never wear clothes or armour, never use weapons, travel in groups of 8-48"
  },
  WATER_SPRITE: {
    specialAbilities: [
      "Flight ability (cannot run fast on ground)",
      "Night vision up to 60 feet",
      "Swim",
      "Prowl 60%",
      "+4 to dodge",
      "Magic: circle of rain, create fog, purple mist"
    ],
    naturalAttacks: [],
    notes: "Never wear clothes or armour, never use weapons, travel in groups of 6-36"
  },
  WIND_PUFF: {
    specialAbilities: [
      "Flight ability (cannot run fast on ground)",
      "Night vision up to 60 feet",
      "Identify plants/fruits 80%",
      "Prowl 60%",
      "+4 to dodge",
      "Magic: charm, mend wood/clay, faeries' dance"
    ],
    naturalAttacks: [],
    notes: "Never wear clothes or armour, never use weapons, travel in groups of 6-36"
  },
  SPRIGGAN: {
    specialAbilities: [
      "Night vision up to 40 feet",
      "Can pass through stone, rock, or clay as if it were air",
      "Magic: dust storm, mend stone, crumble stone, rock to mud"
    ],
    naturalAttacks: [],
    notes: "Loners, seldom work in groups of more than 2, rarely wear armour, disliked by most people"
  },
  NYMPH: {
    specialAbilities: [
      "Night vision up to 90 feet",
      "Flight ability (cannot run fast on ground)",
      "Turn invisible",
      "Swim",
      "Speak all languages",
      "Know all plants, herbs, poisons",
      "Only magic can harm or affect them",
      "Magic: cloud of slumber, dust storm, create fog, purple mist, call lightning, grow plants, animate plants, extinguish fires, wind rush, part waters, calm waters, wall of thorns, breath of life"
    ],
    naturalAttacks: [],
    notes: "Loners, secretive, good, liked by most people, protector of nature"
  },
  BOGIE: {
    specialAbilities: [
      "Night vision up to 90 feet",
      "Can polymorph into larger spider, scorpion, or centipede",
      "Superb climber/scale walls 92%",
      "Prowl 77%",
      "Magic: wind rush, fog of fear, wisps of confusion, purple mist, sphere of light, mesmerism, ventriloquism, animate objects"
    ],
    naturalAttacks: [],
    notes: "Tricks or hurts those not of faerie descent, loves to scare people, disliked by non-faerie folk, may use weapons"
  },
  TOAD_STOOL: {
    specialAbilities: [
      "Night vision up to 90 feet",
      "Day vision 40 feet",
      "Swim",
      "Recognize poison 98%",
      "Can polymorph into true toad at will",
      "Speaks all faerie folk languages",
      "Magic: create fog, animate plants"
    ],
    naturalAttacks: [],
    notes: "Cruel, malicious, spiteful, hated by most people"
  },
  PUCK: {
    specialAbilities: [
      "Night vision up to 60 feet",
      "Polymorph into goat, dog, pony, or wild boar",
      "Prowl 50%",
      "Pick pockets 55%",
      "Pick locks 45%",
      "Recognize poison 72%"
    ],
    naturalAttacks: [
      { name: "Bite", damage: "1d6" },
      { name: "Claws", damage: "1d6" }
    ],
    notes: "Cruel, evil, depraved, travels in pairs but rarely in packs larger than eight"
  },
  SATYR: {
    specialAbilities: [
      "Night vision up to 40 feet",
      "Speaks all tongues of faerie folk",
      "Magic: change direction of wind, create mild wind, howling wind"
    ],
    naturalAttacks: [],
    notes: "Malicious, mischievous, run in packs, use crude tools and weapons"
  },
  WILL_O_WISP: {
    specialAbilities: [
      "See for 100 ft radius day and night",
      "Animate/control tree, using branches like hands (4 attacks per melee, 1d6 or 2d6 damage)",
      "Magic: circle of rain, call lightning, extinguish fires, mend wood/clay, sphere of light, wind rush, create fog, purple mist"
    ],
    naturalAttacks: [],
    notes: "Often inhabit trees with human features, no need for precious metals or gems"
  },
  MERMAID: {
    specialAbilities: [
      "Swim",
      "Breathe underwater",
      "Night vision up to 120 feet",
      "Singing",
      "Song of the damned (charm magic with faerie limitations)",
      "Magic: charm, love charm, mesmerism, create fog, part waters, summon storm"
    ],
    naturalAttacks: [],
    notes: "Often keep undersea treasures, ride dolphins and whales, evil, deadly, dangerous sea witches"
  },
  MERROW: {
    specialAbilities: [
      "Swim",
      "Breathe underwater",
      "Night vision up to 120 feet",
      "Singing (non-magical)",
      "Magic: calm storm, summon storm, part waters, create fog, wind rush, charm"
    ],
    naturalAttacks: [],
    notes: "Love to play and chase, friendly, fond of dolphins, whales, seals, walruses as playmates"
  },
  // Giants
  ALGOR: {
    specialAbilities: [
      "Night vision up to 60 feet",
      "Impervious to cold (no damage)",
      "Frost Breath: 30 ft range, 6 ft wide, 4d6 damage, counts as additional attack"
    ],
    naturalAttacks: [],
    notes: "Giant, pale white or blue skin, golden or silver hair, dark eyes"
  },
  CYCLOPS: {
    specialAbilities: [
      "Night vision up to 90 feet",
      "See the invisible",
      "Great natural strength",
      "Can create Lightning Shafts (magic javelins and arrows)"
    ],
    naturalAttacks: [],
    notes: "Olive skin, one large eye, long dark hair, very greedy, frequently worshipped by kobolds"
  },
  JOTAN: {
    specialAbilities: [
      "Great strength and endurance"
    ],
    naturalAttacks: [],
    notes: "Huge, bronze-skinned, powerful builds, dark eyes, brown hair, extremely hostile"
  },
  GIGANTES: {
    specialAbilities: [
      "Roll four times for random abilities: night vision, see invisible, turn invisible, impervious to fire, psionic bite (3d6), single large horn (1d8), additional arm, scaly skin (A.R. 12), thick lumpy skin (A.R. 10), leather wings (50% can fly), additional eye, large heavy tail, large fangs (2d12), short body fur, feather wings (50% can fly), claws (2d12), large flat teeth, breath fire (3d6), spit acid (4d6), additional leg",
      "Roll once for insanity: no insanity, phobia, psychosis, or affective disorder"
    ],
    naturalAttacks: [],
    notes: "Humanoid, varies greatly in appearance, extremely hostile, aggressive, cruel, worship gods of darkness"
  },
  NIMRO: {
    specialAbilities: [
      "Night vision up to 60 feet",
      "Impervious to fire (no damage)",
      "Fire Breath: 30 ft range, 6 ft wide, 4d6 damage, counts as additional special attack"
    ],
    naturalAttacks: [],
    notes: "Giant, copper or red skin, black or red-brown hair, yellow eyes, aggressive and hostile, cunning, tricky, greedy"
  },
  TITAN: {
    specialAbilities: [
      "Night vision up to 90 feet",
      "See the invisible",
      "Turn the dead",
      "Great physical strength and beauty"
    ],
    naturalAttacks: [],
    notes: "Majestic giant men and women, powerful of limb, golden/silver/brown hair, warm eyes, champions of justice and goodness"
  }
};

