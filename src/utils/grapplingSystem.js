/**
 * Palladium Fantasy RPG - Grappling System
 *
 * Comprehensive grappling and wrestling mechanics for close combat.
 * Integrates with Combat Fatigue System (grappling costs 2x stamina).
 *
 * Grapple States:
 * - neutral: Default standing combat
 * - grapple_clinch: Fighters entangled at close range
 * - grapple_ground: Fighters wrestling on the ground
 * - grappled: Character is being held/pinned
 */

import { drainStamina, STAMINA_COSTS } from "./combatFatigueSystem.js";
import {
  getCombinedGrappleModifiers,
  getSizeCategory,
  canLiftAndThrow,
  getLeveragePenalty,
} from "./sizeStrengthModifiers.js";

/**
 * Grapple states
 */
export const GRAPPLE_STATES = {
  NEUTRAL: "neutral",
  CLINCH: "grapple_clinch",
  GROUND: "grapple_ground",
  GRAPPLED: "grappled",
};

/**
 * Initialize grapple state for a character
 * @param {Object} character - Character object
 * @returns {Object} Grapple state object
 */
export function initializeGrappleState(character) {
  return {
    state: GRAPPLE_STATES.NEUTRAL,
    opponent: null, // ID of opponent being grappled with
    penalties: {
      strike: 0,
      parry: 0,
      dodge: 0,
    },
    canUseLongWeapons: true, // Long weapons unusable when grappled
    roundsInGrapple: 0, // Consecutive rounds in grapple
  };
}

/**
 * Attempt to grapple an opponent (standing clinch)
 * @param {Object} attacker - Attacking character
 * @param {Object} defender - Defending character
 * @param {Function} rollDice - Dice rolling function (defaults to Math.random)
 * @returns {Object} Result object with success status and message
 */
export function attemptGrapple(attacker, defender, rollDice = null) {
  if (!attacker.grappleState) {
    attacker.grappleState = initializeGrappleState(attacker);
  }
  if (!defender.grappleState) {
    defender.grappleState = initializeGrappleState(defender);
  }

  // Check if already in a grapple
  if (attacker.grappleState.state !== GRAPPLE_STATES.NEUTRAL) {
    return {
      success: false,
      reason: `${attacker.name} is already in a grapple!`,
    };
  }

  // Get P.P. bonuses for finesse
  const attackerPP = attacker.attributes?.PP || attacker.PP || 10;
  const defenderPP = defender.attributes?.PP || defender.PP || 10;

  const attackerPPBonus = Math.floor((attackerPP - 10) / 2);
  const defenderPPBonus = Math.floor((defenderPP - 10) / 2);

  // Get hand-to-hand bonuses
  const attackerStrikeBonus =
    attacker.bonuses?.strike || attacker.handToHand?.strikeBonus || 0;
  const defenderParryBonus =
    defender.bonuses?.parry || defender.handToHand?.parryBonus || 0;

  // Get size/strength modifiers
  const sizeModifiers = getCombinedGrappleModifiers(attacker, defender);

  // Check for automatic grapple (if PS difference is 10+)
  if (sizeModifiers.autoGrapple) {
    // Defender can only avoid with natural 20
    const rollFn = rollDice || (() => Math.floor(Math.random() * 20) + 1);
    const defenderRoll = rollFn();

    if (defenderRoll === 20) {
      // Defender escapes with natural 20
      drainStamina(attacker, STAMINA_COSTS.NORMAL_COMBAT, 1);
      return {
        success: false,
        reason: `${defender.name} miraculously avoids grapple with natural 20!`,
        attackRoll: null,
        defendRoll: 20,
      };
    } else {
      // Automatic grapple success
      attacker.grappleState.state = GRAPPLE_STATES.CLINCH;
      attacker.grappleState.opponent = defender.id;
      defender.grappleState.state = GRAPPLE_STATES.GRAPPLED;
      defender.grappleState.opponent = attacker.id;

      defender.grappleState.penalties = {
        strike: 0,
        parry: -3,
        dodge: -2,
      };
      defender.grappleState.canUseLongWeapons = false;

      drainStamina(attacker, STAMINA_COSTS.GRAPPLING, 1);
      drainStamina(defender, STAMINA_COSTS.GRAPPLING, 1);

      return {
        success: true,
        message: `${attacker.name} automatically grapples ${defender.name} (strength advantage too great)!`,
        attackRoll: null,
        defendRoll: defenderRoll,
        autoGrapple: true,
        attackerState: attacker.grappleState,
        defenderState: defender.grappleState,
      };
    }
  }

  // Roll opposed strike vs parry with size/strength modifiers
  const rollFn = rollDice || (() => Math.floor(Math.random() * 20) + 1);
  const attackRoll =
    rollFn() +
    attackerPPBonus +
    attackerStrikeBonus +
    sizeModifiers.attackerStrikeBonus;
  const defendRoll =
    rollFn() +
    defenderPPBonus +
    defenderParryBonus +
    sizeModifiers.defenderParryPenalty;

  if (attackRoll > defendRoll) {
    // Successfully grappled
    attacker.grappleState.state = GRAPPLE_STATES.CLINCH;
    attacker.grappleState.opponent = defender.id;
    defender.grappleState.state = GRAPPLE_STATES.GRAPPLED;
    defender.grappleState.opponent = attacker.id;

    // Apply penalties
    defender.grappleState.penalties = {
      strike: 0,
      parry: -3,
      dodge: -2,
    };
    defender.grappleState.canUseLongWeapons = false;

    // Drain stamina (grappling costs 2x)
    drainStamina(attacker, STAMINA_COSTS.GRAPPLING, 1);
    drainStamina(defender, STAMINA_COSTS.GRAPPLING, 1);

    return {
      success: true,
      message: `${attacker.name} successfully grapples ${defender.name}!`,
      attackRoll,
      defendRoll,
      attackerState: attacker.grappleState,
      defenderState: defender.grappleState,
    };
  } else {
    // Failed to grapple
    drainStamina(attacker, STAMINA_COSTS.NORMAL_COMBAT, 1);

    return {
      success: false,
      reason: `${attacker.name} fails to grapple ${defender.name} (${attackRoll} vs ${defendRoll})`,
      attackRoll,
      defendRoll,
    };
  }
}

/**
 * Maintain grapple hold (opposed strength check)
 * @param {Object} attacker - Character maintaining hold
 * @param {Object} defender - Character being held
 * @param {Function} rollDice - Dice rolling function
 * @returns {Object} Result object
 */
export function maintainGrapple(attacker, defender, rollDice = null) {
  if (
    !attacker.grappleState ||
    attacker.grappleState.state === GRAPPLE_STATES.NEUTRAL
  ) {
    return {
      success: false,
      reason: `${attacker.name} is not in a grapple!`,
    };
  }

  if (attacker.grappleState.opponent !== defender.id) {
    return {
      success: false,
      reason: `${attacker.name} is not grappling ${defender.name}!`,
    };
  }

  // Get Physical Strength bonuses
  const attackerPS = attacker.attributes?.PS || attacker.PS || 10;
  const defenderPS = defender.attributes?.PS || defender.PS || 10;

  const attackerPSBonus = Math.floor((attackerPS - 10) / 2);
  const defenderPSBonus = Math.floor((defenderPS - 10) / 2);

  // Get leverage penalty for smaller character
  const leverageMod = getLeveragePenalty(defender, attacker);

  // Opposed strength roll with leverage modifier
  const rollFn = rollDice || (() => Math.floor(Math.random() * 20) + 1);
  const attackerRoll = rollFn() + attackerPSBonus;
  const defenderRoll = rollFn() + defenderPSBonus + leverageMod.escapePenalty;

  attacker.grappleState.roundsInGrapple += 1;
  defender.grappleState.roundsInGrapple += 1;

  // Drain stamina for both (grappling costs 2x)
  drainStamina(attacker, STAMINA_COSTS.GRAPPLING, 1);
  drainStamina(defender, STAMINA_COSTS.GRAPPLING, 1);

  if (attackerRoll > defenderRoll) {
    // Maintains hold
    return {
      success: true,
      message: `${attacker.name} maintains the hold on ${defender.name}!`,
      attackerRoll,
      defenderRoll,
    };
  } else {
    // Defender breaks free
    attacker.grappleState.state = GRAPPLE_STATES.NEUTRAL;
    attacker.grappleState.opponent = null;
    attacker.grappleState.roundsInGrapple = 0;
    defender.grappleState.state = GRAPPLE_STATES.NEUTRAL;
    defender.grappleState.opponent = null;
    defender.grappleState.roundsInGrapple = 0;
    defender.grappleState.penalties = { strike: 0, parry: 0, dodge: 0 };
    defender.grappleState.canUseLongWeapons = true;

    return {
      success: false,
      message: `${defender.name} breaks free from ${attacker.name}'s hold!`,
      attackerRoll,
      defenderRoll,
    };
  }
}

/**
 * Perform takedown/throw (bring opponent to ground)
 * @param {Object} attacker - Character performing takedown
 * @param {Object} defender - Character being thrown
 * @param {Function} rollDice - Dice rolling function
 * @returns {Object} Result object
 */
export function performTakedown(attacker, defender, rollDice = null) {
  if (
    !attacker.grappleState ||
    attacker.grappleState.state !== GRAPPLE_STATES.CLINCH
  ) {
    return {
      success: false,
      reason: `${attacker.name} must be in a clinch to perform a takedown!`,
    };
  }

  if (attacker.grappleState.opponent !== defender.id) {
    return {
      success: false,
      reason: `${attacker.name} is not grappling ${defender.name}!`,
    };
  }

  // Get Physical Strength bonus
  const attackerPS = attacker.attributes?.PS || attacker.PS || 10;
  const attackerPSBonus = Math.floor((attackerPS - 10) / 2);

  // Get size/strength modifiers for takedown
  const sizeModifiers = getCombinedGrappleModifiers(attacker, defender);

  // Check if attacker can lift defender
  const liftCheck = canLiftAndThrow(attacker, defender);
  if (!liftCheck.canThrow) {
    return {
      success: false,
      reason: liftCheck.reason,
    };
  }

  // Roll for takedown (target 15+) with size modifiers
  const rollFn = rollDice || (() => Math.floor(Math.random() * 20) + 1);
  const takedownRoll =
    rollFn() + attackerPSBonus + sizeModifiers.attackerStrikeBonus;

  // Drain stamina
  drainStamina(attacker, STAMINA_COSTS.GRAPPLING, 1);
  drainStamina(defender, STAMINA_COSTS.GRAPPLING, 1);

  if (takedownRoll >= 15) {
    // Successful takedown
    attacker.grappleState.state = GRAPPLE_STATES.GROUND;
    defender.grappleState.state = GRAPPLE_STATES.GRAPPLED;

    // Enhanced penalties for ground position
    defender.grappleState.penalties = {
      strike: -2,
      parry: -3,
      dodge: -3,
    };
    defender.grappleState.canUseLongWeapons = false;

    // Use calculated throw damage from lift check
    const throwDamage = liftCheck.throwDamage;

    return {
      success: true,
      message: `${attacker.name} throws ${defender.name} to the ground!`,
      damage: throwDamage,
      takedownRoll,
      attackerState: attacker.grappleState,
      defenderState: defender.grappleState,
    };
  } else {
    return {
      success: false,
      reason: `${attacker.name} fails to complete the takedown (Roll: ${takedownRoll}, need 15+)`,
      takedownRoll,
    };
  }
}

/**
 * Ground strike (dagger or unarmed attack while grappling)
 * @param {Object} attacker - Character attacking
 * @param {Object} defender - Character being attacked
 * @param {Object} weapon - Weapon being used (null for unarmed)
 * @param {Function} rollDice - Dice rolling function
 * @returns {Object} Result object with hit status and damage
 */
export function groundStrike(
  attacker,
  defender,
  weapon = null,
  rollDice = null
) {
  if (
    !attacker.grappleState ||
    (attacker.grappleState.state !== GRAPPLE_STATES.CLINCH &&
      attacker.grappleState.state !== GRAPPLE_STATES.GROUND)
  ) {
    return {
      success: false,
      reason: `${attacker.name} must be in a grapple to perform a ground strike!`,
    };
  }

  if (attacker.grappleState.opponent !== defender.id) {
    return {
      success: false,
      reason: `${attacker.name} is not grappling ${defender.name}!`,
    };
  }

  // Check if weapon is valid for grappling (short weapons only)
  if (weapon) {
    const weaponLength = weapon.length || weapon.range || 0;
    if (weaponLength > 2) {
      // Long weapons (>2 feet) unusable in grapple
      return {
        success: false,
        reason: `${weapon.name} is too long to use in a grapple! Use a dagger or unarmed attack.`,
      };
    }
  }

  // Get Physical Prowess bonus
  const attackerPP = attacker.attributes?.PP || attacker.PP || 10;
  const attackerPPBonus = Math.floor((attackerPP - 10) / 2);

  // Get strike bonus
  const strikeBonus =
    attacker.bonuses?.strike || attacker.handToHand?.strikeBonus || 0;

  // Dagger gets +1 bonus in grapple, crit on 18-20
  const grappleBonus = weapon && weapon.type === "dagger" ? 1 : 0;
  const critRange = weapon && weapon.type === "dagger" ? 18 : 20;

  // Roll attack
  const rollFn = rollDice || (() => Math.floor(Math.random() * 20) + 1);
  const attackRoll = rollFn() + attackerPPBonus + strikeBonus + grappleBonus;

  // Drain stamina
  drainStamina(attacker, STAMINA_COSTS.GRAPPLING, 1);

  // Check for critical (natural 20 or expanded range for daggers)
  const naturalRoll = attackRoll - attackerPPBonus - strikeBonus - grappleBonus;
  const isCritical = naturalRoll >= critRange;

  if (isCritical && naturalRoll === 20) {
    // Death Blow (natural 20) - instant kill
    return {
      success: true,
      hit: true,
      critical: true,
      deathBlow: true,
      message: `💀 CRITICAL DEATH BLOW! ${attacker.name} delivers a killing strike to ${defender.name}!`,
      damage: defender.currentHP || defender.hp || 999, // Instant kill
      attackRoll,
    };
  } else if (isCritical) {
    // Critical hit (double damage)
    const baseDamage = weapon ? weapon.damage || "1d6" : "1d4";
    const damageRoll = rollDamage(baseDamage);
    const psBonus = Math.floor(
      ((attacker.attributes?.PS || attacker.PS || 10) - 10) / 2
    );
    const totalDamage = damageRoll * 2 + psBonus;

    return {
      success: true,
      hit: true,
      critical: true,
      message: `💥 CRITICAL STRIKE! ${attacker.name} stabs ${defender.name} for ${totalDamage} damage!`,
      damage: totalDamage,
      attackRoll,
    };
  } else if (attackRoll >= 12) {
    // Normal hit
    const baseDamage = weapon ? weapon.damage || "1d6" : "1d4";
    const damageRoll = rollDamage(baseDamage);
    const psBonus = Math.floor(
      ((attacker.attributes?.PS || attacker.PS || 10) - 10) / 2
    );
    const totalDamage = damageRoll + psBonus;

    return {
      success: true,
      hit: true,
      message: `${attacker.name} stabs ${defender.name} for ${totalDamage} damage!`,
      damage: totalDamage,
      attackRoll,
    };
  } else {
    // Miss
    return {
      success: false,
      hit: false,
      reason: `${attacker.name}'s strike misses in the grapple (Roll: ${attackRoll}, need 12+)`,
      attackRoll,
    };
  }
}

/**
 * Break free from grapple
 * @param {Object} character - Character attempting to break free
 * @param {Object} opponent - Opponent holding the character
 * @param {Function} rollDice - Dice rolling function
 * @returns {Object} Result object
 */
export function breakFree(character, opponent, rollDice = null) {
  if (
    !character.grappleState ||
    character.grappleState.state !== GRAPPLE_STATES.GRAPPLED
  ) {
    return {
      success: false,
      reason: `${character.name} is not being grappled!`,
    };
  }

  if (character.grappleState.opponent !== opponent.id) {
    return {
      success: false,
      reason: `${character.name} is not being grappled by ${opponent.name}!`,
    };
  }

  // Get Physical Strength bonuses
  const characterPS = character.attributes?.PS || character.PS || 10;
  const opponentPS = opponent.attributes?.PS || opponent.PS || 10;

  const characterPSBonus = Math.floor((characterPS - 10) / 2);
  const opponentPSBonus = Math.floor((opponentPS - 10) / 2);

  // Get leverage penalty for smaller character
  const leverageMod = getLeveragePenalty(character, opponent);

  // Opposed strength roll with leverage modifier
  const rollFn = rollDice || (() => Math.floor(Math.random() * 20) + 1);
  const characterRoll = rollFn() + characterPSBonus + leverageMod.escapePenalty;
  const opponentRoll = rollFn() + opponentPSBonus;

  // Drain stamina (attempting to break free costs stamina)
  drainStamina(character, STAMINA_COSTS.GRAPPLING, 1);

  if (characterRoll > opponentRoll) {
    // Successfully breaks free
    character.grappleState.state = GRAPPLE_STATES.NEUTRAL;
    character.grappleState.opponent = null;
    character.grappleState.penalties = { strike: 0, parry: 0, dodge: 0 };
    character.grappleState.canUseLongWeapons = true;
    character.grappleState.roundsInGrapple = 0;

    opponent.grappleState.state = GRAPPLE_STATES.NEUTRAL;
    opponent.grappleState.opponent = null;
    opponent.grappleState.roundsInGrapple = 0;

    return {
      success: true,
      message: `${character.name} breaks free from ${opponent.name}'s hold!`,
      characterRoll,
      opponentRoll,
    };
  } else {
    return {
      success: false,
      reason: `${character.name} fails to break free (${characterRoll} vs ${opponentRoll})`,
      characterRoll,
      opponentRoll,
    };
  }
}

/**
 * Helper function to roll damage dice
 * @param {string} damageFormula - Dice formula (e.g., "1d6", "2d4")
 * @returns {number} Total damage
 */
function rollDamage(damageFormula) {
  // Simple dice parser for common formats
  const match = damageFormula.match(/(\d+)d(\d+)/);
  if (!match) {
    return parseInt(damageFormula) || 1;
  }

  const numDice = parseInt(match[1]);
  const diceSides = parseInt(match[2]);
  let total = 0;

  for (let i = 0; i < numDice; i++) {
    total += Math.floor(Math.random() * diceSides) + 1;
  }

  return total;
}

/**
 * Get grapple status for a character
 * @param {Object} character - Character object
 * @returns {Object} Status object
 */
export function getGrappleStatus(character) {
  if (!character.grappleState) {
    return {
      state: GRAPPLE_STATES.NEUTRAL,
      description: "Not grappling",
      penalties: { strike: 0, parry: 0, dodge: 0 },
      canUseLongWeapons: true,
    };
  }

  const state = character.grappleState.state;
  let description = "Not grappling";

  switch (state) {
    case GRAPPLE_STATES.CLINCH:
      description = "In clinch";
      break;
    case GRAPPLE_STATES.GROUND:
      description = "Ground grappling";
      break;
    case GRAPPLE_STATES.GRAPPLED:
      description = "Being held";
      break;
    default:
      description = "Not grappling";
  }

  return {
    state,
    description,
    penalties: character.grappleState.penalties || {
      strike: 0,
      parry: 0,
      dodge: 0,
    },
    canUseLongWeapons: character.grappleState.canUseLongWeapons !== false,
    opponent: character.grappleState.opponent,
    roundsInGrapple: character.grappleState.roundsInGrapple || 0,
  };
}

/**
 * Reset grapple state (end of combat or when grappled character is defeated)
 * @param {Object} character - Character to reset
 */
export function resetGrapple(character) {
  if (character.grappleState) {
    character.grappleState.state = GRAPPLE_STATES.NEUTRAL;
    character.grappleState.opponent = null;
    character.grappleState.penalties = { strike: 0, parry: 0, dodge: 0 };
    character.grappleState.canUseLongWeapons = true;
    character.grappleState.roundsInGrapple = 0;
  }
}

/**
 * Check if character can use a weapon while grappled
 * @param {Object} character - Character to check
 * @param {Object} weapon - Weapon to check
 * @returns {boolean} True if weapon can be used
 */
export function canUseWeaponInGrapple(character, weapon) {
  const grappleStatus = getGrappleStatus(character);

  if (grappleStatus.state === GRAPPLE_STATES.NEUTRAL) {
    return true; // Not grappling, can use any weapon
  }

  if (!grappleStatus.canUseLongWeapons) {
    // Only short weapons (daggers, knives) can be used
    const weaponLength = weapon.length || weapon.range || 0;
    return weaponLength <= 2; // 2 feet or less
  }

  return true;
}

export default {
  GRAPPLE_STATES,
  initializeGrappleState,
  attemptGrapple,
  maintainGrapple,
  performTakedown,
  groundStrike,
  breakFree,
  getGrappleStatus,
  resetGrapple,
  canUseWeaponInGrapple,
};
