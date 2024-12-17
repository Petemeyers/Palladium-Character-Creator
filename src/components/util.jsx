export const rollDice = (sides, count, useCryptoRandom = false) => {
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (useCryptoRandom) {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      total += (array[0] % sides) + 1;
    } else {
      total += Math.floor(Math.random() * sides) + 1;
    }
  }
  return total;
};

export const calculateAttributeRolls = (diceRolls, useCryptoRandom) => {
  const results = {};
  Object.entries(diceRolls).forEach(([attr, dice]) => {
    const [numDice, sides] = dice.split('d').map(Number);
    results[attr] = rollDice(sides, numDice, useCryptoRandom);
  });
  return results;
};

export const determineCharacterAge = (species, roll) => {
  const ageTable = {
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

  const speciesAges = ageTable[species];
  if (!speciesAges) {
    return 'Unknown';
  }

  // Map roll (1-100) to age ranges
  const index = Math.floor(roll / 12.5); // 100/8 = 12.5 to split into 8 ranges
  return speciesAges[Math.min(index, speciesAges.length - 1)];
};

export const rollFromTable = (roll, table) => {
  // Convert string ranges like '1-20' to array entries if needed
  const entries = Array.isArray(table) ? table : 
    Object.entries(table).map(([range, result]) => {
      const [min, max] = range.split('-').map(Number);
      return { range: [min, max], text: result };
    });

  for (const entry of entries) {
    if (Array.isArray(entry.range)) {
      const [min, max] = entry.range;
      if (roll >= min && roll <= max) {
        // Check for either text or background property
        return entry.text || entry.background;
      }
    }
  }
  return 'Unknown';
};
