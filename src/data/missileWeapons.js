// Palladium Fantasy Missile Weapons with Range System
// Based on Palladium Fantasy RPG rules

/**
 * Range Categories and Modifiers:
 * - Point-Blank (0-10ft): +2 to strike
 * - Short Range (up to 1/3 max): No modifier
 * - Medium Range (1/3 to 2/3 max): -1 to strike
 * - Long Range (2/3 to max): -3 to strike
 * - Beyond Max Range: Cannot attack
 */

export const RANGE_MODIFIERS = {
  POINT_BLANK: { modifier: +2, description: "Point-Blank (0-10ft)" },
  SHORT: { modifier: 0, description: "Short Range" },
  MEDIUM: { modifier: -1, description: "Medium Range" },
  LONG: { modifier: -3, description: "Long Range" },
  OUT_OF_RANGE: { modifier: null, description: "Out of Range" },
};

export const missileWeapons = {
  // BOWS
  "Short Bow": {
    name: "Short Bow",
    damage: "2d6",
    type: "missile",
    category: "bow",
    twoHanded: true,
    weight: 2,
    price: 30,
    maxRange: 360, // feet
    rateOfFire: 2, // attacks per melee
    ammunition: "arrows",
    startingAmmo: 20,
    description: "Light bow for quick shots",
    requiresWP: "W.P. Bow",
    strengthRequired: 10, // PS requirement
  },
  "Long Bow": {
    name: "Long Bow",
    damage: "3d6",
    type: "missile",
    category: "bow",
    twoHanded: true,
    weight: 3,
    price: 60,
    maxRange: 640, // feet
    rateOfFire: 2,
    ammunition: "arrows",
    startingAmmo: 24,
    description: "Powerful bow with long range",
    requiresWP: "W.P. Long Bow",
    strengthRequired: 12,
  },
  "Composite Bow": {
    name: "Composite Bow",
    damage: "3d6+2",
    type: "missile",
    category: "bow",
    twoHanded: true,
    weight: 3,
    price: 100,
    maxRange: 560, // feet
    rateOfFire: 2,
    ammunition: "arrows",
    startingAmmo: 20,
    description: "Reinforced bow with superior damage",
    requiresWP: "W.P. Bow",
    strengthRequired: 13,
  },
  "Elven Bow": {
    name: "Elven Bow",
    damage: "3d6+3",
    type: "missile",
    category: "bow",
    twoHanded: true,
    weight: 2,
    price: 250,
    maxRange: 720, // feet
    rateOfFire: 3,
    ammunition: "arrows",
    startingAmmo: 30,
    description: "Masterwork elven crafted bow",
    requiresWP: "W.P. Bow",
    strengthRequired: 12,
    special: "+1 to strike",
  },

  // CROSSBOWS
  "Light Crossbow": {
    name: "Light Crossbow",
    damage: "2d6",
    type: "missile",
    category: "crossbow",
    twoHanded: true,
    weight: 7,
    price: 50,
    maxRange: 480, // feet
    rateOfFire: 1, // slower reload
    ammunition: "bolts",
    startingAmmo: 20,
    description: "Easy to use crossbow",
    requiresWP: "W.P. Crossbow",
    strengthRequired: 8,
    reloadTime: "1 action",
  },
  "Heavy Crossbow": {
    name: "Heavy Crossbow",
    damage: "4d6",
    type: "missile",
    category: "crossbow",
    twoHanded: true,
    weight: 14,
    price: 100,
    maxRange: 640, // feet
    rateOfFire: 1,
    ammunition: "bolts",
    startingAmmo: 15,
    description: "Powerful but slow to reload",
    requiresWP: "W.P. Crossbow",
    strengthRequired: 12,
    reloadTime: "2 actions",
  },
  "Repeating Crossbow": {
    name: "Repeating Crossbow",
    damage: "2d4",
    type: "missile",
    category: "crossbow",
    twoHanded: true,
    weight: 10,
    price: 200,
    maxRange: 320, // feet
    rateOfFire: 3,
    ammunition: "bolts",
    startingAmmo: 12, // magazine capacity
    magazineSize: 12,
    description: "Rapid-fire crossbow with magazine",
    requiresWP: "W.P. Crossbow",
    strengthRequired: 10,
    reloadTime: "1 action to reload magazine",
  },

  // THROWN WEAPONS
  "Throwing Knife": {
    name: "Throwing Knife",
    damage: "1d6",
    type: "missile",
    category: "thrown",
    weight: 0.5,
    price: 10,
    maxRange: 40, // feet
    rateOfFire: 3,
    ammunition: "self", // weapon itself
    startingAmmo: 6,
    description: "Balanced knife for throwing",
    requiresWP: "W.P. Knife",
    strengthRequired: 6,
  },
  "Throwing Axe": {
    name: "Throwing Axe",
    damage: "2d4",
    type: "missile",
    category: "thrown",
    weight: 2,
    price: 15,
    maxRange: 30, // feet
    rateOfFire: 2,
    ammunition: "self",
    startingAmmo: 4,
    description: "Single-bladed throwing axe",
    requiresWP: "W.P. Axe",
    strengthRequired: 8,
  },
  Javelin: {
    name: "Javelin",
    damage: "2d6",
    type: "missile",
    category: "thrown",
    weight: 3,
    price: 12,
    maxRange: 90, // feet - can be thrown far
    rateOfFire: 1,
    ammunition: "self",
    startingAmmo: 3,
    description: "Light throwing spear",
    requiresWP: "W.P. Spear",
    strengthRequired: 10,
    special: "Add PS damage bonus",
  },
  Shuriken: {
    name: "Shuriken",
    damage: "1d4",
    type: "missile",
    category: "thrown",
    weight: 0.1,
    price: 5,
    maxRange: 30, // feet
    rateOfFire: 4,
    ammunition: "self",
    startingAmmo: 12,
    description: "Throwing stars",
    requiresWP: "W.P. Shuriken",
    strengthRequired: 5,
  },

  // SLINGS
  Sling: {
    name: "Sling",
    damage: "1d6",
    type: "missile",
    category: "sling",
    weight: 0.5,
    price: 2,
    maxRange: 180, // feet
    rateOfFire: 2,
    ammunition: "sling stones",
    startingAmmo: 30,
    description: "Simple leather sling",
    requiresWP: "W.P. Sling",
    strengthRequired: 6,
  },
  "Staff Sling": {
    name: "Staff Sling",
    damage: "2d6",
    type: "missile",
    category: "sling",
    weight: 3,
    price: 10,
    maxRange: 240, // feet
    rateOfFire: 1,
    ammunition: "sling stones",
    startingAmmo: 20,
    description: "Sling mounted on a staff for more power",
    requiresWP: "W.P. Sling",
    strengthRequired: 10,
  },

  // BLOWGUNS
  Blowgun: {
    name: "Blowgun",
    damage: "1d4", // + poison if applicable
    type: "missile",
    category: "blowgun",
    weight: 1,
    price: 15,
    maxRange: 40, // feet
    rateOfFire: 2,
    ammunition: "darts",
    startingAmmo: 20,
    description: "Silent weapon, often poisoned",
    requiresWP: "W.P. Blowgun",
    strengthRequired: 5,
    special: "Silent, can apply poison",
  },
};

// Ammunition types
export const ammunition = {
  arrows: {
    name: "Arrows",
    price: 1, // per arrow
    weight: 0.1,
    bundleSize: 20,
    bundlePrice: 15,
    description: "Standard arrows for bows",
  },
  bolts: {
    name: "Crossbow Bolts",
    price: 1.5,
    weight: 0.1,
    bundleSize: 20,
    bundlePrice: 20,
    description: "Bolts for crossbows",
  },
  "sling stones": {
    name: "Sling Stones",
    price: 0.1,
    weight: 0.1,
    bundleSize: 30,
    bundlePrice: 2,
    description: "Smooth stones for slings (can be found for free)",
  },
  darts: {
    name: "Blowgun Darts",
    price: 2,
    weight: 0.05,
    bundleSize: 20,
    bundlePrice: 30,
    description: "Darts for blowguns",
  },
};

// Special ammunition types
export const specialAmmunition = {
  "Silver Arrows": {
    name: "Silver Arrows",
    price: 10,
    weight: 0.1,
    damage: "normal",
    description: "Effective against supernatural creatures",
    special: "Bypasses supernatural immunity",
  },
  "Fire Arrows": {
    name: "Fire Arrows",
    price: 5,
    weight: 0.15,
    damage: "+1d6 fire",
    description: "Oil-soaked and ignited arrows",
    special: "Additional 1d6 fire damage, can ignite flammables",
  },
  "Poisoned Darts": {
    name: "Poisoned Darts",
    price: 20,
    weight: 0.05,
    damage: "normal + poison",
    description: "Coated with poison",
    special: "Target saves vs poison or takes additional damage/effects",
  },
  "Bodkin Arrows": {
    name: "Bodkin Arrows (Armor Piercing)",
    price: 3,
    weight: 0.1,
    damage: "normal",
    description: "Designed to pierce armor",
    special: "-2 to target's AR",
  },
};

/**
 * Calculate range category and modifier
 * @param {number} distance - Distance to target in feet
 * @param {object} weapon - Missile weapon object
 * @returns {object} - Range category info with modifier
 */
export function getRangeInfo(distance, weapon) {
  if (!weapon.maxRange) {
    return { category: "MELEE", ...RANGE_MODIFIERS.SHORT };
  }

  if (distance <= 10) {
    return { category: "POINT_BLANK", ...RANGE_MODIFIERS.POINT_BLANK };
  } else if (distance <= weapon.maxRange / 3) {
    return { category: "SHORT", ...RANGE_MODIFIERS.SHORT };
  } else if (distance <= (weapon.maxRange * 2) / 3) {
    return { category: "MEDIUM", ...RANGE_MODIFIERS.MEDIUM };
  } else if (distance <= weapon.maxRange) {
    return { category: "LONG", ...RANGE_MODIFIERS.LONG };
  } else {
    return { category: "OUT_OF_RANGE", ...RANGE_MODIFIERS.OUT_OF_RANGE };
  }
}

/**
 * Check if weapon is a missile weapon
 * @param {object} weapon - Weapon object
 * @returns {boolean}
 */
export function isMissileWeapon(weapon) {
  return weapon && weapon.type === "missile";
}

/**
 * Get all missile weapons
 * @returns {array} - Array of missile weapon objects
 */
export function getAllMissileWeapons() {
  return Object.values(missileWeapons);
}

/**
 * Get missile weapon by name
 * @param {string} weaponName
 * @returns {object|null}
 */
export function getMissileWeapon(weaponName) {
  return missileWeapons[weaponName] || null;
}

export default missileWeapons;
