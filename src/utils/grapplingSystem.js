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
import { calculateArmorDamage } from "./equipmentManager.js";

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
    // Positional tracking for grapple
    sharedHex: null, // hex where the clinch is happening
    attackerOriginHex: null, // where the grappler came from
    isAttacker: false, // true for the one who initiated the grapple
    hasGrappleAdvantage: false, // one-time bonus flag for reversal
  };
}

/**
 * Attempt to grapple an opponent (standing clinch)
 * @param {Object} attacker - Attacking character
 * @param {Object} defender - Defending character
 * @param {Function} rollDice - Dice rolling function (defaults to Math.random)
 * @returns {Object} Result object with success status and message
 */
export function attemptGrapple(attacker, defender, rollDice = null, attackerPos = null, defenderPos = null) {
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
      // Automatic grapple success - use initiateGrapple to pull into same hex
      // Pass current positions if provided (from positions state)
      const grappleResult = initiateGrapple({ attacker, defender, attackerPos, defenderPos });
      
      if (grappleResult.success) {
        // Apply penalties to defender
        grappleResult.defender.grappleState.penalties = {
          strike: 0,
          parry: -3,
          dodge: -2,
        };
        grappleResult.defender.grappleState.canUseLongWeapons = false;

        drainStamina(grappleResult.attacker, STAMINA_COSTS.GRAPPLING, 1);
        drainStamina(grappleResult.defender, STAMINA_COSTS.GRAPPLING, 1);

        return {
          success: true,
          message: `${attacker.name} automatically grapples ${defender.name} (strength advantage too great)!`,
          attackRoll: null,
          defendRoll: defenderRoll,
          autoGrapple: true,
          attacker: grappleResult.attacker,
          defender: grappleResult.defender,
          attackerState: grappleResult.attacker.grappleState,
          defenderState: grappleResult.defender.grappleState,
        };
      } else {
        // Failed to initiate grapple (distance issue)
        drainStamina(attacker, STAMINA_COSTS.NORMAL_COMBAT, 1);
        return {
          success: false,
          reason: grappleResult.reason,
          attackRoll: null,
          defendRoll: defenderRoll,
        };
      }
    }
  }

  // Roll opposed strike vs parry with size/strength modifiers
  const rollFn = rollDice || (() => Math.floor(Math.random() * 20) + 1);
  const attackRoll =
    rollFn() +
    attackerPPBonus +
    attackerStrikeBonus +
    (sizeModifiers.strikeBonus || 0);
  const defendRoll =
    rollFn() +
    defenderPPBonus +
    defenderParryBonus +
    (sizeModifiers.defenderParryPenalty || 0);

  if (attackRoll > defendRoll) {
    // Successfully grappled - use initiateGrapple to pull into same hex
    // Pass current positions if provided (from positions state)
    const grappleResult = initiateGrapple({ attacker, defender, attackerPos, defenderPos });
    
    if (grappleResult.success) {
      // Apply penalties to defender
      grappleResult.defender.grappleState.penalties = {
        strike: 0,
        parry: -3,
        dodge: -2,
      };
      grappleResult.defender.grappleState.canUseLongWeapons = false;

      // Drain stamina (grappling costs 2x)
      drainStamina(grappleResult.attacker, STAMINA_COSTS.GRAPPLING, 1);
      drainStamina(grappleResult.defender, STAMINA_COSTS.GRAPPLING, 1);

      return {
        success: true,
        message: grappleResult.message, // Use message from initiateGrapple (no duplicate)
        attackRoll,
        defendRoll,
        attacker: grappleResult.attacker,
        defender: grappleResult.defender,
        attackerState: grappleResult.attacker.grappleState,
        defenderState: grappleResult.defender.grappleState,
      };
    } else {
      // Failed to initiate grapple (distance issue)
      drainStamina(attacker, STAMINA_COSTS.NORMAL_COMBAT, 1);
      return {
        success: false,
        reason: grappleResult.reason,
        attackRoll,
        defendRoll,
      };
    }
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
 * Check if attacker has Death Blow ability
 * @param {Object} attacker - Character to check
 * @returns {boolean} True if attacker has Death Blow ability
 */
export function hasDeathBlow(attacker) {
  // Check hand-to-hand style for Death Blow
  if (attacker?.handToHand?.hasDeathBlow) {
    return true;
  }
  
  // Check abilities array (from Character model)
  if (attacker?.abilities && Array.isArray(attacker.abilities)) {
    const hasAbility = attacker.abilities.some(
      ability => 
        (typeof ability === 'string' && ability.toLowerCase().includes('death blow')) ||
        (typeof ability === 'object' && ability.name && ability.name.toLowerCase().includes('death blow'))
    );
    if (hasAbility) return true;
  }
  
  // Check special_abilities array (from autoRoll)
  if (attacker?.special_abilities && Array.isArray(attacker.special_abilities)) {
    const hasAbility = attacker.special_abilities.some(
      ability => 
        (typeof ability === 'string' && ability.toLowerCase().includes('death blow')) ||
        (typeof ability === 'object' && ability.name && ability.name.toLowerCase().includes('death blow'))
    );
    if (hasAbility) return true;
  }
  
  return false;
}

/**
 * Ground strike (dagger or unarmed attack while grappling)
 * Improved version with safer crit ranges and armor weak-point logic
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
  if (!attacker || !defender) {
    return {
      success: false,
      hit: false,
      reason: "Attacker or defender missing for ground strike.",
    };
  }

  const attackerGrapple = attacker.grappleState;
  const defenderGrapple = defender.grappleState;

  if (
    !attackerGrapple ||
    !defenderGrapple ||
    attackerGrapple.opponent !== defender.id
  ) {
    return {
      success: false,
      hit: false,
      reason: `${attacker.name} is not currently grappling ${defender.name}.`,
    };
  }

  if (
    attackerGrapple.state !== GRAPPLE_STATES.CLINCH &&
    attackerGrapple.state !== GRAPPLE_STATES.GROUND
  ) {
    return {
      success: false,
      hit: false,
      reason: `${attacker.name} must be in a clinch or on the ground with ${defender.name} to attempt a ground strike.`,
    };
  }

  // Only short weapons (or unarmed) in a grapple
  if (weapon) {
    const weaponLength = weapon.length || weapon.range || 0;
    if (weaponLength > 2) {
      return {
        success: false,
        hit: false,
        reason: `${weapon.name} is too long to use in a grapple! Use a dagger or unarmed attack.`,
      };
    }
  }

  const attackerPP = attacker.attributes?.PP || attacker.PP || 10;
  const attackerPPBonus = Math.floor((attackerPP - 10) / 2);

  const strikeBonus =
    attacker.bonuses?.strike || attacker.handToHand?.strikeBonus || 0;

  // Dagger is slightly better in a grapple, but not insane
  const daggerBonus = weapon && weapon.type === "dagger" ? 1 : 0;
  const rollFn = rollDice || (() => Math.floor(Math.random() * 20) + 1);
  const naturalRoll = rollFn();

  const attackRoll = naturalRoll + attackerPPBonus + strikeBonus + daggerBonus;

  // Grappling is tiring, especially in armor
  drainStamina(attacker, STAMINA_COSTS.GRAPPLING, 1);
  // Defender also struggles and loses a bit of stamina
  drainStamina(defender, STAMINA_COSTS.GRAPPLING, 0.5);

  // Dagger crit range: 19–20, otherwise 20
  const daggerCritRange = weapon && weapon.type === "dagger" ? 19 : 20;
  const isCritical = naturalRoll >= daggerCritRange;
  const attackerHasDeathBlow = hasDeathBlow(attacker);

  const baseDamageFormula = weapon ? weapon.damage || "1d6" : "1d4";
  const ps = attacker.attributes?.PS || attacker.PS || 10;
  const psBonus = Math.floor((ps - 10) / 2);

  // 1) Death Blow: ONLY if attacker actually has it
  if (naturalRoll === 20 && attackerHasDeathBlow) {
    return {
      success: true,
      hit: true,
      critical: true,
      deathBlow: true,
      message: `💀 DEATH BLOW! ${attacker.name} finds a fatal opening in ${defender.name}'s defenses!`,
      damage: defender.currentHP || defender.hp || 999,
      attackRoll,
      naturalRoll,
      ignoresArmor: true, // treat as chink-in-armor kill
    };
  }

  // 2) Critical hit = "weak point in armor" strike
  if (isCritical) {
    const damageRoll = rollDamage(baseDamageFormula);
    const totalDamage = damageRoll * 2 + psBonus;

    return {
      success: true,
      hit: true,
      critical: true,
      deathBlow: false,
      message: `💥 CRITICAL STRIKE! ${attacker.name} drives a blow into a weak point in ${defender.name}'s armor for ${totalDamage} damage!`,
      damage: totalDamage,
      attackRoll,
      naturalRoll,
      ignoresArmor: true, // this is your armor-gap mechanic
    };
  }

  // 3) Normal hit (armor still works normally)
  // You can later change the "12+" into your normal to-hit vs AR check if you want.
  if (attackRoll >= 12) {
    const damageRoll = rollDamage(baseDamageFormula);
    const totalDamage = damageRoll + psBonus;

    return {
      success: true,
      hit: true,
      critical: false,
      deathBlow: false,
      message: `${attacker.name} lands a solid strike on ${defender.name} in the grapple for ${totalDamage} damage!`,
      damage: totalDamage,
      attackRoll,
      naturalRoll,
      ignoresArmor: false, // armor still applies
    };
  }

  // 4) Miss
  return {
    success: true,
    hit: false,
    critical: false,
    deathBlow: false,
    message: `${attacker.name} struggles to land a telling blow on ${defender.name} in the grapple. (Roll: ${attackRoll}, need 12+)`,
    damage: 0,
    attackRoll,
    naturalRoll,
    ignoresArmor: false,
  };
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

/**
 * Apply damage with armor consideration for grapple strikes
 * Handles ignoresArmor flag for critical hits and death blows (weak points in armor)
 * @param {Object} result - Result object from groundStrike with ignoresArmor flag
 * @param {Object} attacker - Attacking character
 * @param {Object} defender - Defending character
 * @returns {Object} Updated defender object with damage applied
 */
export function applyDamageWithArmor(result, attacker, defender) {
  const damage = result.damage || 0;
  if (damage <= 0) return defender;

  const defenderCopy = { ...defender };

  // 1) If this is a "weak point" hit (crit/Death Blow in grapple)
  if (result.ignoresArmor) {
    // Skip AR and armor S.D.C.; go straight to body (chink in armor)
    // Apply to SDC first, then overflow to HP
    const currentSDC = defenderCopy.currentSDC ?? defenderCopy.sdc ?? 0;
    const newSDC = Math.max(0, currentSDC - damage);

    defenderCopy.currentSDC = newSDC;
    defenderCopy.sdc = newSDC;

    if (damage > currentSDC) {
      const overflow = damage - currentSDC;
      const currentHP = defenderCopy.currentHP ?? defenderCopy.hp ?? defenderCopy.HP ?? 0;
      const newHP = Math.max(0, currentHP - overflow);
      
      defenderCopy.currentHP = newHP;
      defenderCopy.hp = newHP;
      if (defenderCopy.HP !== undefined) {
        defenderCopy.HP = newHP;
      }
    }

    return defenderCopy;
  }

  // 2) Normal hit: apply armor logic using existing calculateArmorDamage function
  try {
    const armorResult = calculateArmorDamage(
      defenderCopy,
      result.attackRoll || result.naturalRoll || 12,
      damage,
      null // No specific slot targeted in grapple
    );

    if (armorResult.armorHit) {
      // Armor absorbed the hit - update armor SDC
      // The calculateArmorDamage function already modifies the armor object
      // We just need to ensure the defender's equipped armor is updated
      if (armorResult.brokenArmor && armorResult.brokenArmor.length > 0) {
        // Armor pieces were broken - this is already handled in calculateArmorDamage
        // but we can add logging here if needed
      }
      // Damage was absorbed by armor, no character damage
      return defenderCopy;
    } else {
      // Armor didn't block, damage goes to character SDC/HP
      const damageToCharacter = armorResult.damageToCharacter || damage;
      const currentSDC = defenderCopy.currentSDC ?? defenderCopy.sdc ?? 0;
      const newSDC = Math.max(0, currentSDC - damageToCharacter);

      defenderCopy.currentSDC = newSDC;
      defenderCopy.sdc = newSDC;

      if (damageToCharacter > currentSDC) {
        const overflow = damageToCharacter - currentSDC;
        const currentHP = defenderCopy.currentHP ?? defenderCopy.hp ?? defenderCopy.HP ?? 0;
        const newHP = Math.max(0, currentHP - overflow);
        
        defenderCopy.currentHP = newHP;
        defenderCopy.hp = newHP;
        if (defenderCopy.HP !== undefined) {
          defenderCopy.HP = newHP;
        }
      }
    }
  } catch (error) {
    // Armor system not available, apply damage directly to HP
    console.warn("Armor damage calculation failed, applying direct damage:", error);
    const currentHP = defenderCopy.currentHP ?? defenderCopy.hp ?? defenderCopy.HP ?? 0;
    const newHP = Math.max(0, currentHP - damage);
    
    defenderCopy.currentHP = newHP;
    defenderCopy.hp = newHP;
    if (defenderCopy.HP !== undefined) {
      defenderCopy.HP = newHP;
    }
  }

  return defenderCopy;
}

/**
 * Calculate hex distance between two positions
 * @param {Object} pos1 - First position {x, y} or {q, r}
 * @param {Object} pos2 - Second position {x, y} or {q, r}
 * @returns {number} Distance in hexes
 */
function hexDistance(pos1, pos2) {
  // Handle both {x, y} and {q, r} coordinate systems
  const x1 = pos1.x ?? pos1.q ?? 0;
  const y1 = pos1.y ?? pos1.r ?? 0;
  const x2 = pos2.x ?? pos2.q ?? 0;
  const y2 = pos2.y ?? pos2.r ?? 0;
  
  // Simple Euclidean distance (can be enhanced for hex grid later)
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Initiate grapple - pulls both fighters into the same hex
 * @param {Object} attacker - Attacking character
 * @param {Object} defender - Defending character
 * @param {Function} hexDistanceFn - Optional hex distance function
 * @returns {Object} Result with updated attacker and defender
 */
export function initiateGrapple({ attacker, defender, attackerPos = null, defenderPos = null, hexDistanceFn = hexDistance }) {
  // Get positions - use provided positions if available, otherwise fall back to fighter's stored positions
  const attackerHex = attackerPos || attacker.hex || attacker.position || { x: 0, y: 0 };
  const defenderHex = defenderPos || defender.hex || defender.position || { x: 0, y: 0 };
  
  // Check if adjacent (grappling range) - for hex grids, adjacent means 1 hex (about 5 feet)
  const distance = hexDistanceFn(attackerHex, defenderHex);
  // For hex grid, adjacent hexes are ~5 feet apart, so allow up to 5.5 feet for melee range
  if (distance > 5.5) {
    return {
      success: false,
      reason: `${attacker.name} is too far to grapple ${defender.name} (${Math.round(distance)}ft away, need to be adjacent).`,
    };
  }

  const attackerOriginHex = { ...attackerHex };
  const sharedHex = { ...defenderHex }; // Pull attacker into defender's hex

  // Initialize grapple states if needed
  if (!attacker.grappleState) {
    attacker.grappleState = initializeGrappleState(attacker);
  }
  if (!defender.grappleState) {
    defender.grappleState = initializeGrappleState(defender);
  }

  const updatedAttacker = {
    ...attacker,
    hex: sharedHex,
    position: sharedHex, // Also update position for compatibility
    grappleState: {
      ...attacker.grappleState,
      state: GRAPPLE_STATES.CLINCH,
      opponent: defender.id,
      sharedHex,
      attackerOriginHex,
      isAttacker: true,
    },
  };

  const updatedDefender = {
    ...defender,
    hex: sharedHex, // Defender stays in shared hex (both fighters are in same hex)
    position: sharedHex, // Also update position for compatibility
    grappleState: {
      ...defender.grappleState,
      state: GRAPPLE_STATES.CLINCH,
      opponent: attacker.id,
      sharedHex,
      attackerOriginHex,
      isAttacker: false,
    },
  };

  return {
    success: true,
    attacker: updatedAttacker,
    defender: updatedDefender,
    message: `${attacker.name} tackles ${defender.name} and they grapple in the same hex!`,
  };
}

/**
 * Break grapple with push - moves grappler back to origin hex
 * @param {Object} defender - Character pushing (the one being grappled)
 * @param {Object} attacker - Original grappler (the one being pushed back)
 * @returns {Object} Result with updated fighters
 */
export function breakGrappleWithPush({ defender, attacker }) {
  const defGrapple = defender.grappleState;
  const attGrapple = attacker.grappleState;

  if (
    !defGrapple ||
    !attGrapple ||
    defGrapple.opponent !== attacker.id ||
    attGrapple.opponent !== defender.id ||
    defGrapple.state !== GRAPPLE_STATES.CLINCH ||
    attGrapple.state !== GRAPPLE_STATES.CLINCH
  ) {
    return {
      success: false,
      reason: `${defender.name} is not currently in a standing clinch with ${attacker.name}.`,
    };
  }

  const originHex = attGrapple.attackerOriginHex || attacker.hex || attacker.position || { x: 0, y: 0 };

  const updatedAttacker = {
    ...attacker,
    hex: originHex,
    position: originHex,
    grappleState: initializeGrappleState(attacker),
  };

  const updatedDefender = {
    ...defender,
    grappleState: initializeGrappleState(defender),
  };

  return {
    success: true,
    attacker: updatedAttacker,
    defender: updatedDefender,
    message: `${defender.name} pushes ${attacker.name} back to their original hex, breaking the grapple!`,
  };
}

/**
 * Break grapple with trip - ends grapple and knocks target prone
 * @param {Object} defender - Character performing trip
 * @param {Object} attacker - Character being tripped
 * @returns {Object} Result with updated fighters
 */
export function breakGrappleWithTrip({ defender, attacker }) {
  const defGrapple = defender.grappleState;
  const attGrapple = attacker.grappleState;

  if (
    !defGrapple ||
    !attGrapple ||
    defGrapple.opponent !== attacker.id ||
    attGrapple.opponent !== defender.id ||
    defGrapple.state !== GRAPPLE_STATES.CLINCH ||
    attGrapple.state !== GRAPPLE_STATES.CLINCH
  ) {
    return {
      success: false,
      reason: `${defender.name} is not currently in a standing clinch with ${attacker.name}.`,
    };
  }

  const sharedHex = defGrapple.sharedHex || defender.hex || defender.position || { x: 0, y: 0 };

  const updatedAttacker = {
    ...attacker,
    hex: sharedHex,
    position: sharedHex,
    isProne: true, // Mark as prone
    grappleState: initializeGrappleState(attacker),
  };

  const updatedDefender = {
    ...defender,
    grappleState: initializeGrappleState(defender),
  };

  return {
    success: true,
    attacker: updatedAttacker,
    defender: updatedDefender,
    message: `${defender.name} trips ${attacker.name}, sending them to the ground and breaking the grapple!`,
  };
}

/**
 * Grappler Push Off - grappler voluntarily breaks clinch and pushes defender away
 * @param {Object} grappler - Character who initiated the grapple
 * @param {Object} defender - Character being grappled
 * @param {Function} findSafeHex - Optional function to find a safe hex for pushing
 * @returns {Object} Result with updated fighters
 */
export function grapplerPushOff({ grappler, defender, findSafeHex }) {
  const gState = grappler.grappleState;
  const dState = defender.grappleState;

  if (
    !gState ||
    !dState ||
    gState.state !== GRAPPLE_STATES.CLINCH ||
    dState.state !== GRAPPLE_STATES.CLINCH ||
    gState.opponent !== defender.id ||
    dState.opponent !== grappler.id ||
    !gState.isAttacker
  ) {
    return {
      success: false,
      reason: `${grappler.name} is not currently the grappler in a standing clinch with ${defender.name}.`,
    };
  }

  const sharedHex = gState.sharedHex || grappler.hex || grappler.position || { x: 0, y: 0 };
  // Where do we push the defender to?
  const fallbackHex = gState.attackerOriginHex || grappler.hex || grappler.position || { x: 0, y: 0 };
  const pushHex =
    (typeof findSafeHex === "function"
      ? findSafeHex(sharedHex, fallbackHex, defender)
      : fallbackHex) || fallbackHex;

  const updatedGrappler = {
    ...grappler,
    hex: sharedHex,
    position: sharedHex,
    grappleState: initializeGrappleState(grappler),
  };

  const updatedDefender = {
    ...defender,
    hex: pushHex,
    position: pushHex,
    grappleState: initializeGrappleState(defender),
  };

  return {
    success: true,
    attacker: updatedGrappler,
    defender: updatedDefender,
    message: `${grappler.name} shoves ${defender.name} away and breaks the grapple!`,
  };
}

/**
 * Defender Push Break - defender breaks clinch and shoves grappler back
 * @param {Object} defender - Character being grappled
 * @param {Object} grappler - Character who initiated the grapple
 * @param {Function} findSafeHex - Optional function to find a safe hex for pushing
 * @returns {Object} Result with updated fighters
 */
export function defenderPushBreak({ defender, grappler, findSafeHex }) {
  const dState = defender.grappleState;
  const gState = grappler.grappleState;

  if (
    !dState ||
    !gState ||
    dState.state !== GRAPPLE_STATES.CLINCH ||
    gState.state !== GRAPPLE_STATES.CLINCH ||
    dState.opponent !== grappler.id ||
    gState.opponent !== defender.id ||
    gState.isAttacker !== true // grappler must be the original initiator
  ) {
    return {
      success: false,
      reason: `${defender.name} is not currently being grappled by ${grappler.name} in a standing clinch.`,
    };
  }

  const sharedHex = dState.sharedHex || defender.hex || defender.position || { x: 0, y: 0 };
  const originHex = gState.attackerOriginHex || grappler.hex || grappler.position || { x: 0, y: 0 };

  const pushHex =
    (typeof findSafeHex === "function"
      ? findSafeHex(sharedHex, originHex, grappler)
      : originHex) || originHex;

  const updatedGrappler = {
    ...grappler,
    hex: pushHex, // gets shoved back to origin
    position: pushHex,
    grappleState: initializeGrappleState(grappler),
  };

  const updatedDefender = {
    ...defender,
    hex: sharedHex, // holds ground
    position: sharedHex,
    grappleState: initializeGrappleState(defender),
  };

  return {
    success: true,
    attacker: updatedGrappler,
    defender: updatedDefender,
    message: `${defender.name} shoves ${grappler.name} back and breaks the grapple!`,
  };
}

/**
 * Defender Reversal - defender takes control of the clinch
 * @param {Object} defender - Character being grappled
 * @param {Object} grappler - Character who initiated the grapple
 * @returns {Object} Result with updated fighters
 */
export function defenderReversal({ defender, grappler }) {
  const dState = defender.grappleState;
  const gState = grappler.grappleState;

  if (
    !dState ||
    !gState ||
    dState.state !== GRAPPLE_STATES.CLINCH ||
    gState.state !== GRAPPLE_STATES.CLINCH ||
    dState.opponent !== grappler.id ||
    gState.opponent !== defender.id ||
    gState.isAttacker !== true // must be reversing the original grappler
  ) {
    return {
      success: false,
      reason: `${defender.name} can't reverse a grapple that isn't currently controlled by ${grappler.name}.`,
    };
  }

  const sharedHex = dState.sharedHex || defender.hex || defender.position || { x: 0, y: 0 };

  // Defender becomes the new "attacker" in the clinch
  const newDefenderState = {
    ...initializeGrappleState(defender),
    state: GRAPPLE_STATES.CLINCH,
    opponent: grappler.id,
    sharedHex,
    attackerOriginHex: defender.hex || defender.position || sharedHex, // where *new* grappler originally stood
    isAttacker: true,
    hasGrappleAdvantage: true, // optional: one-time bonus flag
    penalties: {
      strike: 0,
      parry: 0,
      dodge: 0,
    },
    canUseLongWeapons: false,
  };

  const newGrapplerState = {
    ...initializeGrappleState(grappler),
    state: GRAPPLE_STATES.CLINCH,
    opponent: defender.id,
    sharedHex,
    attackerOriginHex: gState.attackerOriginHex, // keep old for future pushes
    isAttacker: false,
    hasGrappleAdvantage: false,
    penalties: {
      strike: 0,
      parry: -3,
      dodge: -2,
    },
    canUseLongWeapons: false,
  };

  const updatedDefender = {
    ...defender,
    hex: sharedHex,
    position: sharedHex,
    grappleState: newDefenderState,
  };

  const updatedGrappler = {
    ...grappler,
    hex: sharedHex,
    position: sharedHex,
    grappleState: newGrapplerState,
  };

  return {
    success: true,
    attacker: updatedDefender, // defender is now the grappler
    defender: updatedGrappler,
    message: `${defender.name} reverses the clinch and gains the upper hand on ${grappler.name}!`,
  };
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
  hasDeathBlow,
  applyDamageWithArmor,
  initiateGrapple,
  breakGrappleWithPush,
  breakGrappleWithTrip,
  grapplerPushOff,
  defenderPushBreak,
  defenderReversal,
};
