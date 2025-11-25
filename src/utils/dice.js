/**
 * Dice rolling utilities for Palladium Fantasy RPG
 */

import CryptoSecureDice from "./cryptoDice.js";

function parseDiceExpression(notation) {
  if (typeof notation !== "string") return null;
  const trimmed = notation.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) return null;

  const count = parseInt(match[1] || "1", 10);
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  if (
    !Number.isFinite(count) ||
    !Number.isFinite(sides) ||
    count <= 0 ||
    sides <= 0
  ) {
    return null;
  }

  return { count, sides, modifier };
}

/**
 * Roll dice based on notation like "2d6", "1d8+2", "3d4-1"
 * @param {string|number} notation - Dice notation or single number
 * @returns {number} - Total result
 */
export function rollDice(notation) {
  if (typeof notation === "number") return notation;
  if (!notation || notation === "variable") return 1;

  const expr = notation.toString().trim();
  const parsed = parseDiceExpression(expr);

  if (parsed) {
    const { total } = CryptoSecureDice.rollDice(parsed.count, parsed.sides);
    return total + parsed.modifier;
  }

  // Fallback to numeric conversion if parsing fails
  const numeric = Number(expr);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }

  return 1;
}

/**
 * Roll HP for creatures with HP ranges
 * @param {string|number} hpRange - HP range like "7-56" or "6d8" or single number
 * @returns {number} - Rolled HP value
 */
export function rollHP(hpRange) {
  if (typeof hpRange === "number") return hpRange;
  if (!hpRange || hpRange === "Variable") return 20; // default

  const parts = hpRange.split("-");
  if (parts.length === 2) {
    const min = parseInt(parts[0]);
    const max = parseInt(parts[1]);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Handle dice notation like "6d8"
  const diceMatch = hpRange.match(/(\d+)d(\d+)/);
  if (diceMatch) {
    return rollDice(diceMatch[0]);
  }

  return 20; // fallback
}

/**
 * Roll initiative (Speed + d20)
 * @param {number} speed - Creature's speed
 * @returns {number} - Initiative value
 */
export function rollInitiative(speed = 10) {
  return speed + rollDice("1d20");
}

/**
 * Roll to hit (d20 + strike bonus)
 * @param {number} strikeBonus - Strike bonus from bonuses
 * @returns {number} - To-hit roll result
 */
export function rollToHit(strikeBonus = 0) {
  return rollDice("1d20") + strikeBonus;
}

/**
 * Check if attack is a critical hit (natural 20)
 * @param {number} roll - The raw d20 roll (before bonuses)
 * @returns {boolean} - True if critical hit
 */
export function isCriticalHit(roll) {
  return roll === 20;
}

/**
 * Check if attack is a fumble (natural 1)
 * @param {number} roll - The raw d20 roll (before bonuses)
 * @returns {boolean} - True if fumble
 */
export function isFumble(roll) {
  return roll === 1;
}

/**
 * Roll saving throw (d20 vs target number)
 * @param {number} targetNumber - Target number to beat
 * @param {number} modifier - Bonus/penalty to the roll
 * @returns {object} - { roll: number, success: boolean, target: number }
 */
export function rollSavingThrow(targetNumber, modifier = 0) {
  const roll = rollDice("1d20") + modifier;
  return {
    roll,
    success: roll >= targetNumber,
    target: targetNumber,
  };
}

/**
 * Roll damage for an attack
 * @param {string} damageNotation - Damage dice notation like "2d6"
 * @param {number} damageBonus - Bonus damage from bonuses
 * @returns {number} - Total damage dealt
 */
export function rollDamage(damageNotation, damageBonus = 0) {
  return Math.max(1, rollDice(damageNotation) + damageBonus);
}

/**
 * Roll multiple dice and return individual results
 * @param {string} notation - Dice notation like "3d6"
 * @returns {object} - { total: number, rolls: number[], notation: string }
 */
export function rollDiceDetailed(notation) {
  if (typeof notation === "number") {
    return {
      total: notation,
      rolls: [notation],
      notation: notation.toString(),
    };
  }

  const expr = notation.toString().trim();
  const parsed = parseDiceExpression(expr);

  if (!parsed) {
    const numeric = Number(expr);
    return {
      total: Number.isNaN(numeric) ? 0 : numeric,
      rolls: [Number.isNaN(numeric) ? 0 : numeric],
      notation: expr,
    };
  }

  const result = CryptoSecureDice.rollDice(parsed.count, parsed.sides);
  const total = result.total + parsed.modifier;

  return {
    total,
    rolls: result.individualRolls,
    notation: expr,
  };
}

export default {
  rollDice,
  rollHP,
  rollInitiative,
  rollToHit,
  isCriticalHit,
  isFumble,
  rollSavingThrow,
  rollDamage,
  rollDiceDetailed,
};
