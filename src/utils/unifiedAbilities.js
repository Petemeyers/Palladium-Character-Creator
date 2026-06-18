/**
 * Unified Abilities System
 * Provides a unified interface for training, tactics, and special abilities
 * Handles activation, costs, and effects consistently
 * 
 * TODO: Implement unified abilities system
 */


import { getWeaponProficiencyBonusesForWeapon } from "../data/skillBonuses.js";

/**
 * Ability types
 */
export const ABILITY_TYPES = {
  TRAINING: "training",
  TACTICAL: "tactical",
  SPECIAL: "special",
  RACIAL: "racial",
};

/**
 * Activate an ability (training, tactical, or special)
 * @param {Object} ability - Ability data
 * @param {Object} caster - Character using ability
 * @param {Object} target - Target of ability
 * @param {Function} log - Logging function
 * @returns {boolean} True if ability was successfully activated
 */
export function activateAbility(ability, caster, target, log) {
  // TODO: Unified ability activation
  // Handle training, tactics, and special abilities consistently
  
  if (!ability || !caster) {
    return false;
  }

  // TODO: Check resource cost (stamina, focus, etc.)
  // if (!hasResources(caster, ability)) {
  //   log(`${caster.name} lacks resources for ${ability.name}`);
  //   return false;
  // }

  // TODO: Apply ability based on type
  // switch (ability.type) {
  //   case ABILITY_TYPES.TRAINING:
  //     return activateTraining(ability, caster, target, log);
  //   case ABILITY_TYPES.TACTICAL:
  //     return activateTactical(ability, caster, target, log);
  //   case ABILITY_TYPES.SPECIAL:
  //     return activateSpecial(ability, caster, target, log);
  // }

  return true;
}

/**
 * Check if character has resources for ability
 * @param {Object} character - Character object
 * @param {Object} ability - Ability data
 * @returns {boolean} True if character has sufficient resources
 */
export function hasResources(character, ability) {
  // TODO: Check if character has enough stamina, focus, or other resources
  if (!character || !ability) return false;
  
  // TODO: Check resource type and amount
  // if (ability.type === ABILITY_TYPES.TRAINING) {
  //   return character.stamina >= ability.cost;
  // } else if (ability.type === ABILITY_TYPES.TACTICAL) {
  //   return character.focus >= ability.cost;
  // }
  
  return true;
}

/**
 * Get all available abilities for a character
 * @param {Object} character - Character object
 * @returns {Array} Array of available abilities
 */
export function getAvailableAbilities(character = {}) {
  // TODO: Combine training, tactics, and special abilities
  const abilities = [];
  
  // TODO: Add training techniques
  // if (character.training) {
  //   abilities.push(...character.training.map(technique => ({
  //     ...technique,
  //     type: ABILITY_TYPES.TRAINING
  //   })));
  // }
  
  // TODO: Add tactical powers
  // if (character.tacticalOptions) {
  //   abilities.push(...character.tacticalOptions.map(power => ({
  //     ...power,
  //     type: ABILITY_TYPES.TACTICAL
  //   })));
  // }
  
  return abilities;
}

/**
 * Get unified abilities for a character (training, tactics, special)
 * @param {Object} character - Character object
 * @returns {Object} Unified abilities object with categorized abilities
 */
export function getUnifiedAbilities(character = {}) {
  const abilities = {
    training: [],
    tactical: [],
    special: [],
    racial: [],
  };
  
  // Combine all abilities from different sources
  if (character.training) {
    abilities.training = character.training.map(technique => ({
      ...technique,
      type: ABILITY_TYPES.TRAINING,
    }));
  }
  
  if (character.tacticalOptions) {
    abilities.tactical = character.tacticalOptions.map(power => ({
      ...power,
      type: ABILITY_TYPES.TACTICAL,
    }));
  }
  
  if (character.specialAbilities) {
    abilities.special = character.specialAbilities.map(ability => ({
      ...ability,
      type: ABILITY_TYPES.SPECIAL,
    }));
  }
  
  return abilities;
}

/**
 * Cast a technique (wrastaminar for technique casting system)
 * @param {Object} caster - Character casting the technique
 * @param {Object} target - Target of the technique (optional)
 * @param {Object} technique - Technique object to cast
 * @param {Function} log - Logging function (optional)
 * @returns {boolean} True if technique was successfully cast
 */
export function castTechnique(caster, target, technique, log = () => {}) {
  // This is a wrastaminar function that can be used as a unified interface
  // The actual technique execution is handled by executeTechnique in CombatPage
  // This function provides a consistent API for technique casting
  
  if (!caster || !technique) {
    if (log) log(`Cannot cast technique: missing caster or technique`);
    return false;
  }
  
  // Check if character has resources
  if (!hasResources(caster, technique)) {
    if (log) log(`${caster.name} lacks resources to cast ${technique.name}`);
    return false;
  }
  
  // Use activateAbility as the unified interface
  return activateAbility(technique, caster, target, log);
}

/**
 * Get combat bonus from character abilities, bonuses, or skills
 * @param {Object} character - Character object
 * @param {string} bonusType - Type of bonus (e.g., "attack", "block", "evade", "damage")
 * @returns {number} Bonus value
 */
export function getCombatBonus(character, bonusType, weapon = null) {
  if (!character || !bonusType) return 0;

  const type = bonusType.toLowerCase();


  let wpBonus = 0;

  // Weapon Proficiency bonuses (weapon-specific)
  try {
    const usedWeapon =
      weapon ||
      character.equistaminadWeapon ||
      character.weapon ||
      character.weaponSlots?.rightHand ||
      character.weaponSlots?.leftHand ||
      character.equistaminadWeapons?.primary ||
      character.equistaminadWeapons?.rightHand ||
      character.equistaminadWeapons?.leftHand ||
      (Array.isArray(character.equistaminadWeapons)
        ? character.equistaminadWeapons.find((w) => w?.equistaminad || w?.isEquistaminad) || character.equistaminadWeapons[0]
        : null);

    const wpSource =
      character.bonuses && Array.isArray(character.bonuses.weaponProficiencies)
        ? character.bonuses
        : character.combatBonuses && Array.isArray(character.combatBonuses.weaponProficiencies)
        ? character.combatBonuses
        : character.skillBonuses && Array.isArray(character.skillBonuses.weaponProficiencies)
        ? character.skillBonuses
        : null;

    if (wpSource && usedWeapon && (type === 'attack' || type === 'block')) {
      const wp = getWeaponProficiencyBonusesForWeapon(wpSource, usedWeapon);

      if (type === 'attack') {
        wpBonus += wp.attack || 0;

        const category = String(usedWeapon?.category || '').toLowerCase();
        const isThrown =
          usedWeapon?.thrown === true ||
          usedWeapon?.isThrown === true ||
          usedWeapon?.throwable === true ||
          category === 'thrown';

        if (isThrown) {
          wpBonus += wp.throwAttack || 0;
        }
      }

      if (type === 'block') {
        wpBonus += wp.block || 0;
      }
    }
  } catch (e) {
    // No-op
  }
  // Check direct bonuses object first
  if (character.bonuses) {
    // Check for direct bonus
    if (typeof character.bonuses[type] === 'number') {
      return character.bonuses[type] + wpBonus;
    }

    // Check for tempPenalties (negative bonuses)
    if (character.bonuses.tempPenalties && typeof character.bonuses.tempPenalties[type] === 'number') {
      return character.bonuses.tempPenalties[type];
    }
  }

  // Check hand-to-hand bonuses
  if (character.handToHand && typeof character.handToHand[`${type}Bonus`] === 'number') {
    return character.handToHand[`${type}Bonus`];
  }

  // Check attributes for physical bonuses
  if (type === 'attack' || type === 'block' || type === 'evade') {
    const attributes = character.attributes || {};
    const pp = attributes.PP || attributes.PhysicalProwess || 0;
    // PP bonus to attack/block/evade (typically +1 per 4 points above 12)
    if (pp > 12) {
      const ppBonus = Math.floor((pp - 12) / 4);
      return ppBonus + wpBonus;
}
  }

  // Check for damage bonus from PS
  if (type === 'damage') {
    const attributes = character.attributes || {};
    const ps = attributes.PS || attributes.PhysicalStrength || 0;
    // PS damage bonus (typically +1 per 4 points above 12)
    if (ps > 12) {
      const psBonus = Math.floor((ps - 12) / 4);
      return psBonus;
    }
  }

  // Check status effects for penalties
  if (character.statusEffects && Array.isArray(character.statusEffects)) {
    let penalty = 0;
    character.statusEffects.forEach(effect => {
      if (effect.penalties && typeof effect.penalties[type] === 'number') {
        penalty += effect.penalties[type];
      }
    });
    if (penalty !== 0) {
      return penalty; // Return negative value as penalty
    }
  }

  return wpBonus || 0;
}

export default {
  ABILITY_TYPES,
  activateAbility,
  hasResources,
  getAvailableAbilities,
  getUnifiedAbilities,
  castTechnique,
  getCombatBonus,
};

