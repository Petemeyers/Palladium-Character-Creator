/**
 * Unified Abilities System
 * Provides a unified interface for magic, psionics, and special abilities
 * Handles activation, costs, and effects consistently
 * 
 * TODO: Implement unified abilities system
 */


import { getWeaponProficiencyBonusesForWeapon } from "../data/skillBonuses.js";

/**
 * Ability types
 */
export const ABILITY_TYPES = {
  MAGIC: "magic",
  PSIONIC: "psionic",
  SPECIAL: "special",
  RACIAL: "racial",
};

/**
 * Activate an ability (magic, psionic, or special)
 * @param {Object} ability - Ability data
 * @param {Object} caster - Character using ability
 * @param {Object} target - Target of ability
 * @param {Function} log - Logging function
 * @returns {boolean} True if ability was successfully activated
 */
export function activateAbility(ability, caster, target, log) {
  // TODO: Unified ability activation
  // Handle magic, psionics, and special abilities consistently
  
  if (!ability || !caster) {
    return false;
  }

  // TODO: Check resource cost (PPE, ISP, etc.)
  // if (!hasResources(caster, ability)) {
  //   log(`${caster.name} lacks resources for ${ability.name}`);
  //   return false;
  // }

  // TODO: Apply ability based on type
  // switch (ability.type) {
  //   case ABILITY_TYPES.MAGIC:
  //     return activateMagic(ability, caster, target, log);
  //   case ABILITY_TYPES.PSIONIC:
  //     return activatePsionic(ability, caster, target, log);
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
  // TODO: Check if character has enough PPE, ISP, or other resources
  if (!character || !ability) return false;
  
  // TODO: Check resource type and amount
  // if (ability.type === ABILITY_TYPES.MAGIC) {
  //   return character.PPE >= ability.cost;
  // } else if (ability.type === ABILITY_TYPES.PSIONIC) {
  //   return character.ISP >= ability.cost;
  // }
  
  return true;
}

/**
 * Get all available abilities for a character
 * @param {Object} character - Character object
 * @returns {Array} Array of available abilities
 */
export function getAvailableAbilities(character = {}) {
  // TODO: Combine magic, psionics, and special abilities
  const abilities = [];
  
  // TODO: Add magic spells
  // if (character.magic) {
  //   abilities.push(...character.magic.map(spell => ({
  //     ...spell,
  //     type: ABILITY_TYPES.MAGIC
  //   })));
  // }
  
  // TODO: Add psionic powers
  // if (character.psionicPowers) {
  //   abilities.push(...character.psionicPowers.map(power => ({
  //     ...power,
  //     type: ABILITY_TYPES.PSIONIC
  //   })));
  // }
  
  return abilities;
}

/**
 * Get unified abilities for a character (magic, psionics, special)
 * @param {Object} character - Character object
 * @returns {Object} Unified abilities object with categorized abilities
 */
export function getUnifiedAbilities(character = {}) {
  const abilities = {
    magic: [],
    psionic: [],
    special: [],
    racial: [],
  };
  
  // Combine all abilities from different sources
  if (character.magic) {
    abilities.magic = character.magic.map(spell => ({
      ...spell,
      type: ABILITY_TYPES.MAGIC,
    }));
  }
  
  if (character.psionicPowers) {
    abilities.psionic = character.psionicPowers.map(power => ({
      ...power,
      type: ABILITY_TYPES.PSIONIC,
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
 * Cast a spell (wrapper for spell casting system)
 * @param {Object} caster - Character casting the spell
 * @param {Object} target - Target of the spell (optional)
 * @param {Object} spell - Spell object to cast
 * @param {Function} log - Logging function (optional)
 * @returns {boolean} True if spell was successfully cast
 */
export function castSpell(caster, target, spell, log = () => {}) {
  // This is a wrapper function that can be used as a unified interface
  // The actual spell execution is handled by executeSpell in CombatPage
  // This function provides a consistent API for spell casting
  
  if (!caster || !spell) {
    if (log) log(`Cannot cast spell: missing caster or spell`);
    return false;
  }
  
  // Check if character has resources
  if (!hasResources(caster, spell)) {
    if (log) log(`${caster.name} lacks resources to cast ${spell.name}`);
    return false;
  }
  
  // Use activateAbility as the unified interface
  return activateAbility(spell, caster, target, log);
}

/**
 * Get combat bonus from character abilities, bonuses, or skills
 * @param {Object} character - Character object
 * @param {string} bonusType - Type of bonus (e.g., "strike", "parry", "dodge", "damage")
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
      character.equippedWeapon ||
      character.weapon ||
      character.weaponSlots?.rightHand ||
      character.weaponSlots?.leftHand ||
      character.equippedWeapons?.primary ||
      character.equippedWeapons?.rightHand ||
      character.equippedWeapons?.leftHand ||
      (Array.isArray(character.equippedWeapons)
        ? character.equippedWeapons.find((w) => w?.equipped || w?.isEquipped) || character.equippedWeapons[0]
        : null);

    const wpSource =
      character.bonuses && Array.isArray(character.bonuses.weaponProficiencies)
        ? character.bonuses
        : character.combatBonuses && Array.isArray(character.combatBonuses.weaponProficiencies)
        ? character.combatBonuses
        : character.skillBonuses && Array.isArray(character.skillBonuses.weaponProficiencies)
        ? character.skillBonuses
        : null;

    if (wpSource && usedWeapon && (type === 'strike' || type === 'parry')) {
      const wp = getWeaponProficiencyBonusesForWeapon(wpSource, usedWeapon);

      if (type === 'strike') {
        wpBonus += wp.strike || 0;

        const category = String(usedWeapon?.category || '').toLowerCase();
        const isThrown =
          usedWeapon?.thrown === true ||
          usedWeapon?.isThrown === true ||
          usedWeapon?.throwable === true ||
          category === 'thrown';

        if (isThrown) {
          wpBonus += wp.throwStrike || 0;
        }
      }

      if (type === 'parry') {
        wpBonus += wp.parry || 0;
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
  if (type === 'strike' || type === 'parry' || type === 'dodge') {
    const attributes = character.attributes || {};
    const pp = attributes.PP || attributes.PhysicalProwess || 0;
    // PP bonus to strike/parry/dodge (typically +1 per 4 points above 12)
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
  castSpell,
  getCombatBonus,
};

