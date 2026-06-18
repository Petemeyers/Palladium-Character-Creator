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
  // Import ageTable dynamically to avoid circular dependency
  const ageTable = {
    HUMAN: [16, 19, 22, 24, 26, 28, 30, 34],
    BRIGAND: [16, 19, 22, 24, 26, 28, 30, 34],
    RAIDER: [16, 19, 22, 24, 26, 28, 30, 34],
    HEAVY_FIGHTER: [18, 22, 26, 28, 30, 34, 38, 42],
    CHAMPION: [18, 22, 26, 28, 30, 34, 38, 42],
    CAVE_FIGHTER: [18, 22, 26, 28, 30, 34, 38, 42],
    DUELIST: [20, 24, 28, 30, 50, 80, 100, 200],
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

// Day/night cycle utility
export function getDayNightSymbol(date) {
  if (!date) return "";
  const hour = date.getHours();
  if (hour >= 6 && hour < 18) return "Ã°Å¸Å’Å¾ Daytime";
  return "Ã°Å¸Å’â„¢ Nighttime";
};

// Utility function for saving throws
export function savingThrow(char, type) {
  const roll = rollDice(20, 1);
  let target = 20;
  
  if (type === "training") target = char.saves?.vsTraining || 12;
  if (type === "tactics") target = char.saves?.vsTactics || 15;
  if (type === "poison") target = char.saves?.vsPoison || 14;

  const success = roll >= target;
  return { roll, target, success };
}

// Parse expressions like "2d6+12", "1d6", "+2"
export function evaluateDice(expression) {
  if (!expression) return 0;

  let total = 0;
  let match;

  // e.g. "2d6+12"
  match = expression.match(/(\d+)d(\d+)([+-]\d+)?/i);
  if (match) {
    const [, diceCount, diceSides, modifier] = match;
    total = rollDice(parseInt(diceSides), parseInt(diceCount));
    if (modifier) total += parseInt(modifier);
    return total;
  }

  // e.g. "+2" or "-1"
  match = expression.match(/([+-]\d+)/);
  if (match) {
    return parseInt(match[1]);
  }

  // fallback: just a number
  return parseInt(expression) || 0;
}

// Apply bonus to existing attribute value
export function applyBonus(current, bonusExpr) {
  if (!bonusExpr) return current;
  const bonus = evaluateDice(bonusExpr);
  return current + bonus;
}

// Combat system expansions
export function attackRoll(attacker, target, weapon = { damage: "1d6" }) {
  const roll = rollDice(20, 1);
  
  if (roll === 20) {
    // Critical Hit - double damage
    let dmg = evaluateDice(weapon.damage) * 2;
    return { roll, result: "critical", dmg, message: "CRITICAL HIT!" };
  } else if (roll === 1) {
    // Fumble - various negative effects
    const fumbleEffects = [
      "Drops weapon in the mud",
      "Hits an ally instead",
      "Loses balance and falls prone",
      "Weapon breaks",
      "Stumbles and loses next turn"
    ];
    const effect = fumbleEffects[Math.floor(Math.random() * fumbleEffects.length)];
    return { roll, result: "fumble", dmg: 0, message: `FUMBLE! ${effect}` };
  } else {
    // Normal attack
    let dmg = evaluateDice(weapon.damage);
    return { roll, result: "hit", dmg, message: "Hit" };
  }
}

// Morale check for NPCs/enemies
export function moraleCheck(enemy) {
  const roll = rollDice(20, 1);
  const target = enemy.morale || 12; // Default morale of 12
  const success = roll >= target;
  
  return { 
    roll, 
    target, 
    success, 
    message: success ? "Holds ground" : "Panics and flees!" 
  };
}

// Travel system
export function travel(party, destination, encounterChance = 25) {
  // Move party to new location
  party.location = destination.name;
  
  // Random encounter chance
  const encounterRoll = rollDice(100, 1);
  if (encounterRoll <= encounterChance) {
    return { 
      event: "encounter", 
      location: destination,
      encounterRoll 
    };
  }
  return { 
    event: "arrived", 
    location: destination,
    encounterRoll 
  };
}

// Get random encounter based on location type
export function getRandomEncounter(locationType, encounterTables) {
  const table = encounterTables[locationType] || encounterTables.forest;
  const roll = rollDice(100, 1);
  
  let cumulativeChance = 0;
  for (const encounter of table) {
    cumulativeChance += encounter.chance;
    if (roll <= cumulativeChance) {
      return encounter;
    }
  }
  
  // Fallback to first encounter
  return table[0];
}

// Level up character with PROFESSION progression
export function levelUp(character, professionData, trainingTechniques, tacticalOptions) {
  if (!professionData) return character;

  character.level += 1;

  // stamina / focus growth
  if (professionData.levelProgression?.stamina) {
    character.stamina = (character.stamina || 0) + professionData.levelProgression.stamina;
  }
  if (professionData.levelProgression?.focus) {
    character.focus = (character.focus || 0) + professionData.levelProgression.focus;
  }

  // Technique unlocks
  if (professionData.techniqueUnlocks?.[character.level]) {
    const newTechniques = professionData.techniqueUnlocks[character.level].map((techniqueName) => {
      const techniqueData = trainingTechniques?.find(s => s.name === techniqueName);
      return techniqueData || { name: techniqueName, cost: 5, effect: "Unknown technique" };
    });
    
    character.training = [
      ...(character.training || []),
      ...newTechniques,
    ];
  }

  // Tactical unlocks
  if (professionData.tacticalUnlocks?.[character.level]) {
    const newTactics = professionData.tacticalUnlocks[character.level].map((powerName) => {
      const powerData = tacticalOptions?.find(p => p.name === powerName);
      return powerData || { name: powerName, cost: 4, effect: "Unknown tactical power" };
    });
    
    character.tactics = [
      ...(character.tactics || []),
      ...newTactics,
    ];
  }

  // Save progression
  if (professionData.saveProgression) {
    if (professionData.saveProgression.vsTraining) {
      character.saves = character.saves || {};
      character.saves.vsTraining = Math.max(
        2,
        (character.saves.vsTraining || 12) + professionData.saveProgression.vsTraining
      );
    }
    if (professionData.saveProgression.vsTactics) {
      character.saves = character.saves || {};
      character.saves.vsTactics = Math.max(
        2,
        (character.saves.vsTactics || 15) + professionData.saveProgression.vsTactics
      );
    }
  }

  return character;
}

// Random encounter generation by time
export function getRandomEncounterByTime(date) {
  if (!date) return null;
  const hour = date.getHours();
  // Import encounters dynamically to avoid circular dependency
  const encounters = {
    day: [
      { name: "Merchant Caravan", type: "NPC", description: "Travelers selling wares." },
      { name: "Village Patrol", type: "NPC", description: "Local guards questioning strangers." },
      { name: "Wild Animals", type: "Opponent", description: "A pack of wolves hunting." },
      { name: "Traveling Bard", type: "NPC", description: "A minstrel sharing news and songs." },
      { name: "Farmer with Cart", type: "NPC", description: "A peasant transporting goods to market." },
      { name: "Ranger Scout", type: "NPC", description: "A wilderness guide offering directions." },
    ],
    night: [
      { name: "Bandits", type: "Enemy", description: "Ambushers looking for loot." },
      { name: "Owlbear", type: "Opponent", description: "A terrifying beast stalks the camp." },
      { name: "Vampire", type: "Fallen", description: "A shadowy figure emerges from the darkness." },
      { name: "Wolves", type: "Opponent", description: "A hungry pack circles the camp." },
      { name: "Ghost", type: "Fallen", description: "A spectral figure wails in the night." },
      { name: "Thieves", type: "Enemy", description: "Sneaky criminals attempt to steal supplies." },
    ],
  };
  const pool = hour >= 6 && hour < 18 ? encounters.day : encounters.night;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Loot generation utility
export function rollLoot(table = "common") {
  // Import loot tables dynamically to avoid circular dependency
  const lootTables = {
    common: [
      { name: "Gold Coins", quantity: "2d6", type: "misc", weight: 0.1 },
      { name: "Dagger", damage: "1d4", type: "weapon", weight: 2 },
      { name: "Healing Potion", effect: "heal-2d6", type: "consumable", weight: 1 },
      { name: "Rope (50ft)", type: "misc", weight: 10 },
      { name: "Traiderh", type: "misc", weight: 1 },
      { name: "Rations (1 day)", type: "consumable", weight: 2 },
    ],
    rare: [
      { name: "Long Sword", damage: "2d8", type: "weapon", weight: 10 },
      { name: "Chainmail", defense: 4, type: "armor", weight: 35 },
      { name: "Elixir of Strength", effect: "buff-attack+2", type: "consumable", weight: 1 },
      { name: "Silver Coins", quantity: "1d10", type: "misc", weight: 0.1 },
      { name: "Training Scroll", effect: "technique-cast", type: "consumable", weight: 0.5 },
      { name: "Leather Armor", defense: 2, type: "armor", weight: 15 },
    ],
    boss: [
      { name: "Training Staff", damage: "3d6", type: "weapon", weight: 8 },
      { name: "Plate Armor", defense: 6, type: "armor", weight: 50 },
      { name: "Bag of Gems", quantity: "3d10", type: "misc", weight: 1 },
      { name: "Potion of Greater Healing", effect: "heal-4d6", type: "consumable", weight: 1 },
      { name: "Training Ring", effect: "buff-all+1", type: "misc", weight: 0.1 },
      { name: "Ancient Tome", effect: "knowledge", type: "misc", weight: 5 },
    ],
  };

  const pool = lootTables[table] || lootTables.common;
  const item = pool[Math.floor(Math.random() * pool.length)];

  let quantity = 1;
  if (item.quantity) {
    const [num, sides] = item.quantity.split("d").map(Number);
    quantity = 0;
    for (let i = 0; i < num; i++) {
      quantity += Math.floor(Math.random() * sides) + 1;
    }
  }

  return { ...item, quantity };
}
