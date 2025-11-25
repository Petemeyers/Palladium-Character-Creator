/**
 * Weapon Slot Manager
 * Handles right hand/left hand weapon slots and two-handed weapons
 */

/**
 * Weapon slot types
 */
export const WEAPON_SLOTS = {
  RIGHT_HAND: "rightHand",
  LEFT_HAND: "leftHand",
  TWO_HANDED: "twoHanded",
};

/**
 * Determine if weapon is two-handed
 * @param {object} weapon - Weapon object
 * @returns {boolean}
 */
export function isTwoHandedWeapon(weapon) {
  if (!weapon) return false;

  const twoHandedTypes = [
    "two-handed",
    "Two-Handed Sword",
    "Two Handed Sword",
    "Great Sword",
    "Battle Axe",
    "Halberd",
    "Pike",
    "Pole Arm",
    "Polearm",
    "Great Axe",
    "Maul",
    "War Maul",
    "Flail",
    "Staff",
    "Long Spear",
    "Spear", // Most spears are two-handed
    "Lance",
  ];

  // Bows and crossbows are two-handed (except hand crossbow)
  const twoHandedRanged = [
    "Bow",
    "Long Bow",
    "Short Bow",
    "Composite Bow",
    "Elven Bow",
    "Crossbow",
    "Heavy Crossbow",
    "Light Crossbow",
    "Repeating Crossbow",
  ];

  // Check by category
  if (weapon.category === "two-handed") return true;
  if (weapon.category === "bow") return true;
  if (weapon.category === "crossbow") return true;

  // Check by name for melee weapons
  if (twoHandedTypes.some((type) => weapon.name?.includes(type))) return true;

  // Check by name for ranged weapons
  if (twoHandedRanged.some((type) => weapon.name?.includes(type))) return true;

  // Check if explicitly marked
  if (weapon.twoHanded === true) return true;

  return false;
}

/**
 * Determine if weapon can be used two-handed for bonus
 * @param {object} weapon - Weapon object
 * @returns {boolean}
 */
export function canUseTwoHanded(weapon) {
  if (!weapon) return false;

  // Already two-handed weapons can't be "used two-handed"
  if (isTwoHandedWeapon(weapon)) return false;

  // Check if it's a one-handed melee weapon that can optionally be used two-handed
  const oneHandedMelee = [
    "Long Sword",
    "Broadsword",
    "Short Sword",
    "Bastard Sword", // Can be one or two handed
    "War Hammer",
    "Mace",
    "Hand Axe",
    "Axe", // Generic axe
  ];

  return (
    oneHandedMelee.some((type) => weapon.name?.includes(type)) ||
    weapon.canUseTwoHanded === true
  );
}

/**
 * Get damage bonus for using weapon two-handed
 * @param {object} weapon - Weapon object
 * @returns {string} - Bonus damage dice or modifier
 */
export function getTwoHandedBonus(weapon) {
  if (!weapon) return null;

  // Bastard Sword gets extra dice
  if (weapon.name?.includes("Bastard Sword")) {
    return "+1d6";
  }

  // Most weapons get +2 to +4 damage when two-handed
  if (canUseTwoHanded(weapon)) {
    return "+2"; // Standard two-handed bonus
  }

  return null;
}

/**
 * Check if character can dual wield
 * @param {object} character - Character object
 * @returns {boolean}
 */
export function canDualWield(character) {
  // Check for dual wield ability or high PP
  const hasAbility = character.abilities?.some(
    (ability) =>
      ability.name?.toLowerCase().includes("dual wield") ||
      ability.name?.toLowerCase().includes("two weapon")
  );

  // High PP (16+) allows dual wielding with penalties
  const highPP = character.attributes?.PP >= 16;

  return hasAbility || highPP;
}

/**
 * Get dual wield penalties
 * @param {object} character - Character object
 * @returns {object} - Penalties for dual wielding
 */
export function getDualWieldPenalties(character) {
  const hasAbility = character.abilities?.some(
    (ability) =>
      ability.name?.toLowerCase().includes("dual wield") ||
      ability.name?.toLowerCase().includes("two weapon")
  );

  if (hasAbility) {
    // Trained dual wielders have reduced penalties
    return {
      rightHand: -2,
      leftHand: -4,
      description: "Trained dual wielder penalties",
    };
  }

  // Untrained dual wielding has heavy penalties
  return {
    rightHand: -4,
    leftHand: -6,
    description: "Untrained dual wielding penalties",
  };
}

/**
 * Initialize weapon slots for character
 * @param {object} character - Character object
 * @returns {object} - Weapon slots state
 */
export function initializeWeaponSlots(character) {
  return {
    rightHand: null,
    leftHand: null,
    usingTwoHanded: false,
  };
}

/**
 * Equip weapon to slot
 * @param {object} slots - Current weapon slots
 * @param {object} weapon - Weapon to equip
 * @param {string} slot - Slot to equip to (rightHand/leftHand)
 * @returns {object} - Updated slots
 */
export function equipWeapon(slots, weapon, slot = "rightHand") {
  const newSlots = { ...slots };

  if (isTwoHandedWeapon(weapon)) {
    // Two-handed weapon takes both slots
    newSlots.rightHand = weapon;
    newSlots.leftHand = null; // Clear left hand
    newSlots.usingTwoHanded = true;
  } else {
    // One-handed weapon
    newSlots[slot] = weapon;
    newSlots.usingTwoHanded = false;

    // If right hand has two-handed weapon, clear it
    if (
      slot === "leftHand" &&
      newSlots.rightHand &&
      isTwoHandedWeapon(newSlots.rightHand)
    ) {
      newSlots.rightHand = null;
    }
  }

  return newSlots;
}

/**
 * Unequip weapon from slot
 * @param {object} slots - Current weapon slots
 * @param {string} slot - Slot to clear
 * @returns {object} - Updated slots
 */
export function unequipWeapon(slots, slot) {
  const newSlots = { ...slots };
  newSlots[slot] = null;

  // If clearing a two-handed weapon, clear both slots
  if (newSlots.usingTwoHanded) {
    newSlots.rightHand = null;
    newSlots.leftHand = null;
    newSlots.usingTwoHanded = false;
  }

  return newSlots;
}

/**
 * Toggle using one-handed weapon two-handed
 * @param {object} slots - Current weapon slots
 * @returns {object} - Updated slots
 */
export function toggleTwoHandedGrip(slots) {
  const newSlots = { ...slots };

  // Can only do this if right hand has one-handed weapon that can be used two-handed
  if (newSlots.rightHand && canUseTwoHanded(newSlots.rightHand)) {
    newSlots.usingTwoHanded = !newSlots.usingTwoHanded;

    if (newSlots.usingTwoHanded) {
      // Clear left hand when gripping two-handed
      newSlots.leftHand = null;
    }
  }

  return newSlots;
}

/**
 * Get total attack bonuses from equipped weapons
 * @param {object} slots - Current weapon slots
 * @param {object} character - Character object
 * @returns {object} - Attack bonuses
 */
export function getWeaponBonuses(slots, character) {
  const bonuses = {
    strike: 0,
    parry: 0,
    damage: 0,
    attacks: 0,
  };

  // Right hand weapon
  if (slots.rightHand) {
    const weapon = slots.rightHand;

    // Add weapon-specific bonuses
    if (weapon.bonuses) {
      bonuses.strike += weapon.bonuses.strike || 0;
      bonuses.parry += weapon.bonuses.parry || 0;
      bonuses.damage += weapon.bonuses.damage || 0;
    }

    // Two-handed grip bonus
    if (slots.usingTwoHanded && canUseTwoHanded(weapon)) {
      bonuses.damage += 2; // +2 damage for two-handed grip
      bonuses.strike += 1; // Better control with two hands
    }
  }

  // Left hand weapon (dual wielding)
  if (slots.leftHand && !slots.usingTwoHanded) {
    bonuses.attacks += 1; // Extra attack from off-hand

    // Apply dual wield penalties
    const penalties = getDualWieldPenalties(character);
    bonuses.strike += penalties.rightHand; // Penalty to right hand
    // Left hand uses its own penalties when attacking
  }

  return bonuses;
}

/**
 * Get weapon damage string
 * @param {object} weapon - Weapon object
 * @param {boolean} usingTwoHanded - Is weapon being used two-handed
 * @returns {string} - Damage dice string
 */
export function getWeaponDamage(weapon, usingTwoHanded = false) {
  if (!weapon) return "1d4"; // Unarmed

  let damage = weapon.damage || "1d6";

  // Add two-handed bonus
  if (usingTwoHanded && canUseTwoHanded(weapon)) {
    const bonus = getTwoHandedBonus(weapon);
    if (bonus) {
      damage += bonus;
    }
  }

  return damage;
}

/**
 * Check if slots are valid
 * @param {object} slots - Weapon slots
 * @returns {object} - Validation result
 */
export function validateWeaponSlots(slots) {
  // Two-handed weapon can't have left hand weapon
  if (slots.rightHand && isTwoHandedWeapon(slots.rightHand) && slots.leftHand) {
    return {
      valid: false,
      error: "Cannot equip left hand weapon with two-handed weapon",
    };
  }

  // Using two-handed grip can't have left hand weapon
  if (slots.usingTwoHanded && slots.leftHand) {
    return {
      valid: false,
      error: "Cannot use two-handed grip while dual wielding",
    };
  }

  return { valid: true };
}

export default {
  WEAPON_SLOTS,
  isTwoHandedWeapon,
  canUseTwoHanded,
  getTwoHandedBonus,
  canDualWield,
  getDualWieldPenalties,
  initializeWeaponSlots,
  equipWeapon,
  unequipWeapon,
  toggleTwoHandedGrip,
  getWeaponBonuses,
  getWeaponDamage,
  validateWeaponSlots,
};
