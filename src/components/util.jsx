// Stronger random number generator using Web Crypto API
export function getCryptoRandomInt(min, max) {
  if (min < 0 || max < 0) {
    throw new Error("min and max must be non-negative integers.");
  }
  if (min > max) {
    throw new Error("Max must be greater than min");
  }

  const range = max - min + 1;
  const maxRange = 0xffffffff;
  const biasLimit = maxRange - (maxRange % range);
  let randomValue;

  do {
    const randomValues = new Uint32Array(1);
    window.crypto.getRandomValues(randomValues);
    randomValue = randomValues[0];
  } while (randomValue >= biasLimit);

  return min + (randomValue % range);
}

// Roll dice function with an option for strong randomness
export function rollDice(sides, number, useCryptoRandom = false) {
  if (sides <= 0 || number <= 0) {
    throw new Error("Number of sides and number of dice must be positive integers.");
  }

  let total = 0;

  for (let i = 0; i < number; i++) {
    if (useCryptoRandom) {
      // Use stronger randomness with Web Crypto API
      total += getCryptoRandomInt(1, sides);
    } else {
      // Use standard pseudo-randomness
      total += Math.floor(Math.random() * sides) + 1;
    }
  }

  return total;
}

// Function to calculate the result of multiple dice rolls based on attribute definitions
export function calculateAttributeRolls(diceRolls, useCryptoRandom = false) {
  const results = {};
  for (const [attribute, dice] of Object.entries(diceRolls)) {
    const diceMatch = dice.match(/^(\d+)d(\d+)$/);
    if (!diceMatch) {
      throw new Error(`Invalid dice notation for attribute ${attribute}: expected format 'NdX' (e.g., 2d6).`);
    }
    const [, numDice, sides] = diceMatch.map(Number);
    results[attribute] = rollDice(sides, numDice, useCryptoRandom);
  }
  return results;
}

// Function to determine character age based on species and dice roll
import { ageTable } from './data';

export function determineCharacterAge(species, ageRoll) {
  const ageValues = ageTable[species];
  if (!ageValues) {
    throw new Error(`No age data found for species: ${species}`);
  }

  let characterAge;

  if (ageRoll <= 17) {
    characterAge = ageValues[0];
  } else if (ageRoll <= 28) {
    characterAge = ageValues[1];
  } else if (ageRoll <= 35) {
    characterAge = ageValues[2];
  } else if (ageRoll <= 49) {
    characterAge = ageValues[3];
  } else if (ageRoll <= 59) {
    characterAge = ageValues[4];
  } else if (ageRoll <= 73) {
    characterAge = ageValues[5];
  } else if (ageRoll <= 89) {
    characterAge = ageValues[6];
  } else {
    characterAge = ageValues[7];
  }

  return characterAge;
}

// Generalized function to roll from any table based on a percentile roll
export function rollFromTable(roll, table) {
  const foundItem = table.find(
    (item) => roll >= item.range[0] && roll <= item.range[1]
  );

  if (!foundItem) {
    throw new Error(`No match found for roll: ${roll}`);
  }

  return foundItem.description || foundItem.text || foundItem.background || "Unknown";
}

// Example usage:
// Import different tables and use the same function to get the result
import { socialBackgrounds, dispositions, hostilities, landsOfOrigin } from './data';

const rollValue = rollDice(100, 1, true);
const socialBackground = rollFromTable(rollValue, socialBackgrounds);
const disposition = rollFromTable(rollValue, dispositions);
const hostility = rollFromTable(rollValue, hostilities);
const landOfOrigin = rollFromTable(rollValue, landsOfOrigin);

console.log("Social Background:", socialBackground);
console.log("Disposition:", disposition);
console.log("Hostility:", hostility);
console.log("Land of Origin:", landOfOrigin);
