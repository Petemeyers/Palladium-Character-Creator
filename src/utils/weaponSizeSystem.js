/**
 * Weapon Size System for Palladium Fantasy RPG (1994 rules)
 * 
 * Implements the official weapon size rules:
 * - Giant weapons: +1 extra die of damage (Troll, Ogre, Wolfen, Giants)
 * - Gnome weapons: Reduced damage (special tables)
 * - Normal weapons: Standard damage (Human, Elf, Dwarf, etc.)
 * - Faerie weapons: Use damage from creature stats (no universal rule)
 */

export const WEAPON_SIZE = {
  SMALL: "SMALL",      // Gnome weapons (reduced damage)
  NORMAL: "NORMAL",    // Standard human-sized weapons
  GIANT: "GIANT",     // Giant weapons (+1 die of damage)
  FAERIE: "FAERIE",   // Faerie/tiny beings (use creature-specific damage)
};

/**
 * Race to weapon size mapping (1994 Palladium Fantasy rules)
 */
export const RACE_WEAPON_SIZE = {
  // Giant-weapon races (+1 die of damage)
  "Ogre": WEAPON_SIZE.GIANT,
  "Troll": WEAPON_SIZE.GIANT,
  "Wolfen": WEAPON_SIZE.GIANT,
  "Algor Giant": WEAPON_SIZE.GIANT,
  "Cyclops Giant": WEAPON_SIZE.GIANT,
  "Jotan Giant": WEAPON_SIZE.GIANT,
  "Gigantes Giant": WEAPON_SIZE.GIANT,
  "Nimro Giant": WEAPON_SIZE.GIANT,
  "Titan Giant": WEAPON_SIZE.GIANT,
  "Giant": WEAPON_SIZE.GIANT,
  "Sea Giant": WEAPON_SIZE.GIANT,
  "Titan": WEAPON_SIZE.GIANT,

  // Small/gnome-weapon race
  "Gnome": WEAPON_SIZE.SMALL,

  // Standard human-sized weapons
  "Human": WEAPON_SIZE.NORMAL,
  "Elf": WEAPON_SIZE.NORMAL,
  "Dwarf": WEAPON_SIZE.NORMAL,
  "Goblin": WEAPON_SIZE.NORMAL,
  "Hob-Goblin": WEAPON_SIZE.NORMAL,
  "Kobold": WEAPON_SIZE.NORMAL,
  "Orc": WEAPON_SIZE.NORMAL,
  "Troglodyte": WEAPON_SIZE.NORMAL,
  "Changeling": WEAPON_SIZE.NORMAL,
  "Coyle": WEAPON_SIZE.NORMAL,
  "Kankoran": WEAPON_SIZE.NORMAL,
  "Bearman of the North": WEAPON_SIZE.NORMAL,

  // Faerie/tiny beings (use creature-specific damage from stats)
  "Faerie": WEAPON_SIZE.FAERIE,
  "Faerie (Common)": WEAPON_SIZE.FAERIE,
  "Faerie (Silver Bells)": WEAPON_SIZE.FAERIE,
  "Faerie (Green Wood)": WEAPON_SIZE.FAERIE,
  "Faerie (Night-Elves)": WEAPON_SIZE.FAERIE,
  "Pixie": WEAPON_SIZE.FAERIE,
  "Frost-Pixie": WEAPON_SIZE.FAERIE,
  "Leprechaun": WEAPON_SIZE.FAERIE,
  "Brownie": WEAPON_SIZE.FAERIE,
  "Sprite": WEAPON_SIZE.FAERIE,
  "Sprite (Tree Sprite)": WEAPON_SIZE.FAERIE,
  "Sprite (Water Sprite)": WEAPON_SIZE.FAERIE,
  "Sprite (Wind-Puff)": WEAPON_SIZE.FAERIE,
  "Spriggan": WEAPON_SIZE.FAERIE,
  "Nymph": WEAPON_SIZE.FAERIE,
  "Bogies": WEAPON_SIZE.FAERIE,
  "Toad Stools": WEAPON_SIZE.FAERIE,
  "Puck": WEAPON_SIZE.FAERIE,
  "Satyr": WEAPON_SIZE.FAERIE,
  "Satyr (Satyr)": WEAPON_SIZE.FAERIE,
  "Will-o-the-Wisp": WEAPON_SIZE.FAERIE,
  "Mermaid": WEAPON_SIZE.FAERIE,
  "Merrow": WEAPON_SIZE.FAERIE,
};

/**
 * Get weapon size category for a race/species
 * @param {string} race - Race or species name
 * @returns {string} Weapon size category (WEAPON_SIZE constant)
 */
export function getWeaponSizeForRace(race) {
  if (!race) return WEAPON_SIZE.NORMAL;
  
  // Try exact match first
  if (RACE_WEAPON_SIZE[race]) {
    return RACE_WEAPON_SIZE[race];
  }
  
  // Try case-insensitive match
  const raceLower = race.toLowerCase();
  const matchingKey = Object.keys(RACE_WEAPON_SIZE).find(
    key => key.toLowerCase() === raceLower
  );
  if (matchingKey) {
    return RACE_WEAPON_SIZE[matchingKey];
  }
  
  // Try partial match for compound names
  for (const [key, size] of Object.entries(RACE_WEAPON_SIZE)) {
    if (raceLower.includes(key.toLowerCase()) || key.toLowerCase().includes(raceLower)) {
      return size;
    }
  }
  
  // Default to normal size
  return WEAPON_SIZE.NORMAL;
}

/**
 * Gnome weapon damage reduction table (1994 rules)
 * Maps normal weapon damage to gnome-sized weapon damage
 */
const GNOME_WEAPON_DAMAGE = {
  // Small weapons: 1d4
  "1d4": "1d4",      // Already small, no change
  "1d3": "1d3",      // Already small, no change
  
  // Medium weapons: 1d4 (reduced from 1d6)
  "1d6": "1d4",
  "1d8": "1d4",
  "1d10": "1d4",
  "2d4": "1d4",
  
  // Large swords, pole arms: 1d6 (reduced from 2d6+)
  "2d6": "1d6",
  "2d6+1": "1d6",
  "2d6+2": "1d6",
  "2d6+3": "1d6",
  "3d6": "1d6",
  "3d6+1": "1d6",
  "3d6+2": "1d6",
  "4d6": "1d6",
  
  // Ranged weapons
  "1d4": "1d4",      // Short bow, sling
  "1d6": "1d4",      // Regular bow
  "1d8": "1d4",      // Crossbow
  "2d4": "1d4",      // Heavy crossbow
  
  // Special: Gnome crossbow does 1d6
  "crossbow": "1d6",
};

/**
 * Apply gnome weapon damage reduction
 * @param {string} baseDamage - Base damage dice formula (e.g., "2d6", "1d8+2")
 * @returns {string} Reduced damage for gnome-sized weapon
 */
export function getGnomeWeaponDamage(baseDamage) {
  if (!baseDamage) return "1d4";
  
  // Normalize the damage string
  const normalized = baseDamage.trim().toLowerCase();
  
  // Check exact match first
  if (GNOME_WEAPON_DAMAGE[normalized]) {
    return GNOME_WEAPON_DAMAGE[normalized];
  }
  
  // Check if it's a crossbow (special case: gnome crossbow does 1d6)
  if (normalized.includes("crossbow") || normalized.includes("bolt")) {
    return "1d6";
  }
  
  // Parse dice formula and apply reduction
  const diceMatch = normalized.match(/(\d+)d(\d+)(?:\+(\d+))?/);
  if (diceMatch) {
    const count = parseInt(diceMatch[1]);
    const sides = parseInt(diceMatch[2]);
    const bonus = diceMatch[3] ? parseInt(diceMatch[3]) : 0;
    
    // Apply gnome reduction rules
    if (count >= 2 || sides >= 6) {
      // Large weapons (2d6, 1d8, etc.) -> 1d6
      if (count >= 2 && sides >= 6) {
        return "1d6";
      }
      // Medium weapons (1d6, 1d8, etc.) -> 1d4
      return "1d4";
    }
    // Already small (1d4, 1d3) -> no change
    return baseDamage;
  }
  
  // Fallback: default to 1d4 for unknown weapons
  return "1d4";
}

/**
 * Apply giant weapon damage bonus (+1 extra die)
 * @param {string} baseDamage - Base damage dice formula (e.g., "2d6", "1d8+2")
 * @returns {string} Increased damage for giant-sized weapon
 */
export function getGiantWeaponDamage(baseDamage) {
  if (!baseDamage) return "1d6";
  
  const normalized = baseDamage.trim().toLowerCase();
  
  // Parse dice formula
  const diceMatch = normalized.match(/(\d+)d(\d+)(?:\+(\d+))?/);
  if (diceMatch) {
    const count = parseInt(diceMatch[1]);
    const sides = parseInt(diceMatch[2]);
    const bonus = diceMatch[3] ? parseInt(diceMatch[3]) : 0;
    
    // Add one extra die of the same type
    const newCount = count + 1;
    const bonusStr = bonus > 0 ? `+${bonus}` : "";
    return `${newCount}d${sides}${bonusStr}`;
  }
  
  // If we can't parse it, try to add a die
  // Default: add 1d6
  if (normalized.includes("d")) {
    return `${baseDamage} + 1d6`;
  }
  
  // Fallback: return base with +1d6
  return `${baseDamage} + 1d6`;
}

/**
 * Get adjusted weapon damage based on race weapon size
 * @param {string} baseDamage - Base weapon damage (e.g., "2d6", "1d8+2")
 * @param {string} race - Character's race/species
 * @returns {string} Adjusted damage dice formula
 */
export function getAdjustedWeaponDamage(baseDamage, race) {
  if (!baseDamage || !race) return baseDamage;
  
  const weaponSize = getWeaponSizeForRace(race);
  
  switch (weaponSize) {
    case WEAPON_SIZE.SMALL:
      // Gnome weapons: reduced damage
      return getGnomeWeaponDamage(baseDamage);
    
    case WEAPON_SIZE.GIANT:
      // Giant weapons: +1 extra die
      return getGiantWeaponDamage(baseDamage);
    
    case WEAPON_SIZE.FAERIE:
      // Faerie weapons: use creature-specific damage (no universal rule)
      // Return base damage, but note that faerie creatures should use
      // their natural attack damage from creature stats
      return baseDamage;
    
    case WEAPON_SIZE.NORMAL:
    default:
      // Normal weapons: no change
      return baseDamage;
  }
}

/**
 * Get weapon weight multiplier based on weapon size
 * @param {string} race - Character's race/species
 * @returns {number} Weight multiplier (1.0 for normal, 2.0-3.0 for giant, 0.5-0.75 for small)
 */
export function getWeaponWeightMultiplier(race) {
  const weaponSize = getWeaponSizeForRace(race);
  
  switch (weaponSize) {
    case WEAPON_SIZE.GIANT:
      // Giant weapons are 2-3x heavier (use 2.5x average)
      return 2.5;
    
    case WEAPON_SIZE.SMALL:
      // Gnome weapons are lighter (use 0.6x average)
      return 0.6;
    
    case WEAPON_SIZE.NORMAL:
    case WEAPON_SIZE.FAERIE:
    default:
      return 1.0;
  }
}

/**
 * Get adjusted weapon length/reach for small/tiny races using normal-sized weapons
 * Small races can't effectively use full-length weapons, so reach is reduced
 * @param {number} baseLength - Base weapon length/reach in feet
 * @param {string} race - Character's race/species
 * @param {Object} character - Character object (optional, for size category lookup)
 * @returns {number} Adjusted weapon length/reach in feet
 */
export function getAdjustedWeaponLength(baseLength, race, character = null) {
  if (!baseLength || baseLength <= 0) return baseLength;
  
  const weaponSize = getWeaponSizeForRace(race);
  
  // If race has its own weapon size (gnome, giant), use base length
  // They're using appropriately-sized weapons for their race
  if (weaponSize !== WEAPON_SIZE.NORMAL && weaponSize !== WEAPON_SIZE.FAERIE) {
    return baseLength;
  }
  
  // For normal/faerie races, check if they're small/tiny and using normal-sized weapons
  // Import size category system
  let sizeCategory = null;
  if (character) {
    try {
      const { getSizeCategory } = require('./sizeStrengthModifiers.js');
      sizeCategory = getSizeCategory(character);
    } catch (e) {
      // Fallback: infer from race name
      const raceLower = race?.toLowerCase() || '';
      if (raceLower.includes('pixie') || raceLower.includes('sprite') || 
          raceLower.includes('faerie') || raceLower.includes('brownie') ||
          raceLower.includes('leprechaun') || raceLower.includes('bogie')) {
        sizeCategory = 'TINY';
      } else if (raceLower.includes('gnome') || raceLower.includes('kobold') ||
                 raceLower.includes('goblin')) {
        sizeCategory = 'SMALL';
      }
    }
  }
  
  // Adjust length based on size category
  if (sizeCategory === 'TINY') {
    // Tiny races (Pixie, Sprite, etc.) - weapons are proportionally much smaller
    // A 3ft sword for a 6ft human = 1ft sword for a 2ft pixie
    // Reduce to ~30-40% of base length
    return Math.max(0.5, baseLength * 0.35);
  } else if (sizeCategory === 'SMALL') {
    // Small races (Gnome, Kobold, Goblin) - weapons are proportionally smaller
    // A 3ft sword for a 6ft human = 1.5ft sword for a 3ft gnome
    // Reduce to ~50-60% of base length
    return Math.max(1, baseLength * 0.55);
  }
  
  // Normal-sized races or no size info - use base length
  return baseLength;
}

/**
 * Get adjusted weapon weight for small/tiny races using normal-sized weapons
 * Small races find normal weapons heavier relative to their size
 * @param {number} baseWeight - Base weapon weight in lbs
 * @param {string} race - Character's race/species
 * @param {Object} character - Character object (optional, for size category lookup)
 * @returns {number} Adjusted weapon weight in lbs
 */
export function getAdjustedWeaponWeight(baseWeight, race, character = null) {
  if (!baseWeight || baseWeight <= 0) return baseWeight;
  
  const weaponSize = getWeaponSizeForRace(race);
  
  // If race has its own weapon size (gnome, giant), use weight multiplier
  if (weaponSize === WEAPON_SIZE.GIANT) {
    return baseWeight * 2.5;
  } else if (weaponSize === WEAPON_SIZE.SMALL) {
    return baseWeight * 0.6;
  }
  
  // For normal/faerie races using normal-sized weapons, check if they're small/tiny
  let sizeCategory = null;
  if (character) {
    try {
      const { getSizeCategory } = require('./sizeStrengthModifiers.js');
      sizeCategory = getSizeCategory(character);
    } catch (e) {
      // Fallback: infer from race name
      const raceLower = race?.toLowerCase() || '';
      if (raceLower.includes('pixie') || raceLower.includes('sprite') || 
          raceLower.includes('faerie') || raceLower.includes('brownie') ||
          raceLower.includes('leprechaun') || raceLower.includes('bogie')) {
        sizeCategory = 'TINY';
      } else if (raceLower.includes('gnome') || raceLower.includes('kobold') ||
                 raceLower.includes('goblin')) {
        sizeCategory = 'SMALL';
      }
    }
  }
  
  // Adjust weight based on size category
  // Note: Weight doesn't scale linearly - a 2ft pixie can't effectively use a 10lb sword
  // But if they could, it would feel much heavier relative to their size
  if (sizeCategory === 'TINY') {
    // Tiny races find normal weapons very heavy - weight feels 2-3x heavier
    // But actual weight is the same (they just struggle more)
    // For encumbrance purposes, multiply by 2.5x
    return baseWeight * 2.5;
  } else if (sizeCategory === 'SMALL') {
    // Small races find normal weapons heavier - weight feels 1.5-2x heavier
    return baseWeight * 1.75;
  }
  
  // Normal-sized races - use base weight
  return baseWeight;
}

/**
 * Check if a race can effectively use a weapon based on size
 * @param {Object} weapon - Weapon object
 * @param {string} race - Character's race/species
 * @param {Object} character - Character object (optional)
 * @returns {Object} {canUse: boolean, reason: string, effectiveLength: number, effectiveWeight: number}
 */
export function canRaceUseWeapon(weapon, race, character = null) {
  if (!weapon) {
    return { canUse: false, reason: "No weapon provided", effectiveLength: 0, effectiveWeight: 0 };
  }
  
  const weaponSize = getWeaponSizeForRace(race);
  const baseLength = weapon.reach || weapon.length || 3;
  const baseWeight = weapon.weight || 5;
  
  // Get adjusted length and weight
  const effectiveLength = getAdjustedWeaponLength(baseLength, race, character);
  const effectiveWeight = getAdjustedWeaponWeight(baseWeight, race, character);
  
  // Check size category
  let sizeCategory = null;
  if (character) {
    try {
      const { getSizeCategory, SIZE_CATEGORIES } = require('./sizeStrengthModifiers.js');
      sizeCategory = getSizeCategory(character);
      
      // Tiny races have severe restrictions
      if (sizeCategory === SIZE_CATEGORIES.TINY) {
        // Tiny races can only effectively use very short weapons
        if (baseLength > 2) {
          return {
            canUse: false,
            reason: `Weapon too long (${baseLength}ft) for tiny race - maximum 2ft`,
            effectiveLength: effectiveLength,
            effectiveWeight: effectiveWeight,
          };
        }
        // Very heavy weapons are impractical
        if (baseWeight > 3) {
          return {
            canUse: false,
            reason: `Weapon too heavy (${baseWeight}lbs) for tiny race - maximum 3lbs`,
            effectiveLength: effectiveLength,
            effectiveWeight: effectiveWeight,
          };
        }
      }
      
      // Small races have moderate restrictions
      if (sizeCategory === SIZE_CATEGORIES.SMALL) {
        // Small races struggle with very long weapons
        if (baseLength > 6) {
          return {
            canUse: false,
            reason: `Weapon too long (${baseLength}ft) for small race - maximum 6ft`,
            effectiveLength: effectiveLength,
            effectiveWeight: effectiveWeight,
          };
        }
        // Very heavy weapons are difficult
        if (baseWeight > 15) {
          return {
            canUse: false,
            reason: `Weapon too heavy (${baseWeight}lbs) for small race - maximum 15lbs`,
            effectiveLength: effectiveLength,
            effectiveWeight: effectiveWeight,
          };
        }
      }
    } catch (e) {
      // If size system not available, allow use but with adjustments
    }
  }
  
  return {
    canUse: true,
    reason: "Weapon usable by race",
    effectiveLength: effectiveLength,
    effectiveWeight: effectiveWeight,
  };
}

export default {
  WEAPON_SIZE,
  RACE_WEAPON_SIZE,
  getWeaponSizeForRace,
  getGnomeWeaponDamage,
  getGiantWeaponDamage,
  getAdjustedWeaponDamage,
  getWeaponWeightMultiplier,
  getAdjustedWeaponLength,
  getAdjustedWeaponWeight,
  canRaceUseWeapon,
};

