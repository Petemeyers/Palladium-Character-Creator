/**
 * Dice Rolling Tool
 * Utility for rolling dice in the game
 */

/**
 * Roll dice
 * @param {number} sides - Number of sides on the die
 * @param {number} count - Number of dice to roll
 * @returns {number} Total of all dice rolls
 */
export function roll(sides = 20, count = 1) {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total;
}

/**
 * Roll a d20
 * @returns {number} Result of d20 roll
 */
export function rollD20() {
  return roll(20, 1);
}

/**
 * Roll a d100
 * @returns {number} Result of d100 roll
 */
export function rollD100() {
  return roll(100, 1);
}

export default { roll, rollD20, rollD100 };

