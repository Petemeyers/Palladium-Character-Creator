/**
 * Combat Ammunition Manager
 * Handles ammunition tracking during combat
 */

import { getMissileWeapon, isMissileWeapon } from "../data/missileWeapons";

/**
 * Initialize ammunition for all characters with missile weapons
 * @param {array} characters - Array of character objects
 * @returns {object} - Ammo count object { characterId: { ammoType: count } }
 */
export function initializeAmmo(characters) {
  const ammoCount = {};

  characters.forEach((char) => {
    if (!char.inventory) return;

    const missileWeapons = char.inventory.filter((item) => {
      const weaponData = getMissileWeapon(item.name);
      return weaponData || isMissileWeapon(item);
    });

    if (missileWeapons.length > 0) {
      ammoCount[char._id] = {};

      missileWeapons.forEach((weapon) => {
        const weaponData = getMissileWeapon(weapon.name);
        if (weaponData && weaponData.ammunition) {
          // Check if character already has ammo count set
          if (!ammoCount[char._id][weaponData.ammunition]) {
            ammoCount[char._id][weaponData.ammunition] =
              weaponData.startingAmmo;
          }
        }
      });
    }
  });

  return ammoCount;
}

/**
 * Use ammunition for a character's missile weapon
 * @param {object} ammoCount - Current ammo count state
 * @param {string} characterId - Character ID
 * @param {string} ammoType - Type of ammunition
 * @param {number} amount - Amount to use (negative to add, positive to subtract)
 * @returns {object} - Updated ammo count
 */
export function useAmmo(ammoCount, characterId, ammoType, amount = 1) {
  const newAmmoCount = { ...ammoCount };

  if (!newAmmoCount[characterId]) {
    newAmmoCount[characterId] = {};
  }

  if (!newAmmoCount[characterId][ammoType]) {
    newAmmoCount[characterId][ammoType] = 0;
  }

  // Subtract ammo (don't go below 0)
  newAmmoCount[characterId][ammoType] = Math.max(
    0,
    newAmmoCount[characterId][ammoType] - amount
  );

  return newAmmoCount;
}

/**
 * Set ammunition count for a character
 * @param {object} ammoCount - Current ammo count state
 * @param {string} characterId - Character ID
 * @param {string} ammoType - Type of ammunition
 * @param {number} newCount - New ammo count
 * @returns {object} - Updated ammo count
 */
export function setAmmo(ammoCount, characterId, ammoType, newCount) {
  const newAmmoCount = { ...ammoCount };

  if (!newAmmoCount[characterId]) {
    newAmmoCount[characterId] = {};
  }

  newAmmoCount[characterId][ammoType] = Math.max(0, newCount);

  return newAmmoCount;
}

/**
 * Replenish all ammunition after combat
 * @param {object} ammoCount - Current ammo count state
 * @param {array} characters - Array of character objects
 * @returns {object} - Replenished ammo count
 */
export function replenishAllAmmo(characters) {
  return initializeAmmo(characters);
}

/**
 * Check if character can fire missile weapon
 * @param {object} character - Character object
 * @param {object} ammoCount - Current ammo count state
 * @returns {object} - { canFire: boolean, reason: string }
 */
export function canFireMissileWeapon(character, ammoCount) {
  // Check if equipped weapon is a missile weapon
  const equippedWeapon = character.inventory?.find(
    (item) => item.name === character.equippedWeapon
  );

  if (!equippedWeapon) {
    return { canFire: false, reason: "No weapon equipped" };
  }

  const weaponData = getMissileWeapon(equippedWeapon.name);

  if (!weaponData) {
    return { canFire: true, reason: "Not a missile weapon (melee attack)" };
  }

  // Check ammunition
  const currentAmmo = ammoCount[character._id]?.[weaponData.ammunition] || 0;

  if (currentAmmo <= 0) {
    return {
      canFire: false,
      reason: `Out of ${weaponData.ammunition}!`,
    };
  }

  return {
    canFire: true,
    reason: `${currentAmmo} ${weaponData.ammunition} remaining`,
  };
}

/**
 * Get ammunition info for character
 * @param {object} character - Character object
 * @param {object} ammoCount - Current ammo count state
 * @returns {object|null} - Ammo info or null
 */
export function getAmmoInfo(character, ammoCount) {
  const equippedWeapon = character.inventory?.find(
    (item) => item.name === character.equippedWeapon
  );

  if (!equippedWeapon) return null;

  const weaponData = getMissileWeapon(equippedWeapon.name);
  if (!weaponData) return null;

  const currentAmmo = ammoCount[character._id]?.[weaponData.ammunition] || 0;
  const maxAmmo = weaponData.startingAmmo;

  return {
    ammoType: weaponData.ammunition,
    current: currentAmmo,
    max: maxAmmo,
    percentage: (currentAmmo / maxAmmo) * 100,
    weaponData,
  };
}

/**
 * Calculate range modifier for attack
 * @param {number} distance - Distance to target in feet
 * @param {object} weapon - Weapon data
 * @returns {object} - { modifier: number, description: string }
 */
export function calculateRangeModifier(distance, weapon) {
  if (!weapon || !weapon.maxRange) {
    return { modifier: 0, description: "Melee range" };
  }

  if (distance <= 10) {
    return { modifier: +2, description: "Point-Blank (+2)" };
  } else if (distance <= weapon.maxRange / 3) {
    return { modifier: 0, description: "Short range" };
  } else if (distance <= (weapon.maxRange * 2) / 3) {
    return { modifier: -1, description: "Medium range (-1)" };
  } else if (distance <= weapon.maxRange) {
    return { modifier: -3, description: "Long range (-3)" };
  } else {
    return { modifier: null, description: "Out of range!" };
  }
}

export default {
  initializeAmmo,
  useAmmo,
  setAmmo,
  replenishAllAmmo,
  canFireMissileWeapon,
  getAmmoInfo,
  calculateRangeModifier,
};
