/**
 * Combat Ammunition Manager
 * Handles ammunition tracking during combat
 */

import { getMissileWeapon, isMissileWeapon } from "../data/missileWeapons";
import { getWeaponByName } from "../data/weapons.js";

// Inventory item name aliases for ammo types.
// (People tend to write "rocks"/"stones" interchangeably for slings.)
const AMMO_NAME_ALIASES = {
  arrows: ["arrows", "arrow", "standard arrows", "bodkin arrows", "fire arrows", "silver arrows"],
  bolts: ["bolts", "bolt", "crossbow bolts", "crossbow bolt"],
  "sling stones": ["sling stones", "sling stone", "stones", "stone", "rocks", "rock"],
  darts: ["darts", "dart", "blowgun darts", "poisoned darts"],
};

function normName(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Given a weapon item/name, return the most reliable data we can find
 * (missileWeapons.js -> weapons.js -> raw item).
 */
function getWeaponData(weapon) {
  const name = typeof weapon === "string" ? weapon : weapon?.name;
  return getMissileWeapon(name) || getWeaponByName(name) || weapon || null;
}

/** Get inventory item name aliases that satisfy an ammoType. */
export function getAmmoAliases(ammoType) {
  const key = normName(ammoType);
  return AMMO_NAME_ALIASES[key] || [key];
}

/** Sum ammo across stacks in inventory. */
export function getInventoryAmmoCount(character, ammoType) {
  const aliases = getAmmoAliases(ammoType);
  const inv = Array.isArray(character?.inventory) ? character.inventory : [];

  return inv.reduce((sum, item) => {
    const itemName = normName(item?.name);
    if (!itemName || !aliases.includes(itemName)) return sum;
    const qty = Number.isFinite(item?.quantity) ? Number(item.quantity) : 1;
    return sum + Math.max(0, qty);
  }, 0);
}

/**
 * Decrement ammo in a character inventory. Returns a NEW character object.
 * Ammo items are left in inventory with quantity=0 (per your requirement).
 */
export function decrementInventoryAmmo(character, ammoType, amount = 1) {
  const aliases = getAmmoAliases(ammoType);
  const inv = Array.isArray(character?.inventory) ? character.inventory : [];
  if (amount <= 0 || inv.length === 0) return character;

  let remaining = amount;

  const nextInv = inv.map((item) => {
    if (remaining <= 0) return item;

    const itemName = normName(item?.name);
    if (!itemName || !aliases.includes(itemName)) return item;

    const qty = Number.isFinite(item?.quantity) ? Number(item.quantity) : 1;
    const current = Math.max(0, qty);
    if (current <= 0) return { ...item, quantity: 0 };

    const spend = Math.min(current, remaining);
    remaining -= spend;

    return { ...item, quantity: current - spend };
  });

  return remaining === amount ? character : { ...character, inventory: nextInv };
}

/**
 * Initialize ammo counts strictly from inventory.
 * Returns { characterId: { ammoType: count } }
 */
export function initializeAmmo(characters) {
  const ammoCount = {};

  characters.forEach((char) => {
    if (!char.inventory) return;

    const ammoTypesNeeded = new Set();

    for (const item of char.inventory) {
      const w = getWeaponData(item);
      const ammoType = normName(w?.ammunition);
      const hasRange = Number.isFinite(w?.maxRange) || Number.isFinite(w?.range);
      if (!ammoType || ammoType === "self" || !hasRange) continue;
      ammoTypesNeeded.add(ammoType);
    }

    if (ammoTypesNeeded.size === 0) return;

    const charId = char.id || char._id;
    if (!charId) return;

    ammoCount[charId] = {};
    for (const ammoType of ammoTypesNeeded) {
      ammoCount[charId][ammoType] = getInventoryAmmoCount(char, ammoType);
    }
  });

  return ammoCount;
}

export function canFireMissileWeapon(character, ammoCount) {
  const equippedWeapon = character.inventory?.find(
    (item) => item.name === character.equippedWeapon
  );

  if (!equippedWeapon) return { canFire: false, reason: "No weapon equipped" };

  const weaponData = getWeaponData(equippedWeapon);
  const ammoType = normName(weaponData?.ammunition);
  const hasRange = Number.isFinite(weaponData?.maxRange) || Number.isFinite(weaponData?.range);

  if (!ammoType || ammoType === "self" || !hasRange) {
    return { canFire: true, reason: "Not a ranged weapon that consumes ammo" };
  }

  const currentAmmo =
    ammoCount[character.id || character._id]?.[ammoType] ?? getInventoryAmmoCount(character, ammoType);

  if (currentAmmo <= 0) return { canFire: false, reason: `Out of ${ammoType}!` };

  return { canFire: true, reason: `${currentAmmo} ${ammoType} remaining` };
}

/**
 * Get ammunition info for character
 * @param {object} character - Character object
 * @param {object} ammoCount - Optional ammo count cache (for UI)
 * @returns {object|null} - Ammo info or null
 */
export function getAmmoInfo(character, ammoCount = null) {
  const equippedWeapon = character.inventory?.find(
    (item) => item.name === character.equippedWeapon
  );

  if (!equippedWeapon) return null;

  const weaponData = getWeaponData(equippedWeapon);
  if (!weaponData) return null;

  const ammoType = normName(weaponData?.ammunition);
  const hasRange = Number.isFinite(weaponData?.maxRange) || Number.isFinite(weaponData?.range);
  
  if (!ammoType || ammoType === "self" || !hasRange) return null;

  const charId = character.id || character._id;
  const currentAmmo = ammoCount?.[charId]?.[ammoType] ?? getInventoryAmmoCount(character, ammoType);
  const maxAmmo = weaponData.startingAmmo || 20;

  return {
    ammoType: ammoType,
    current: currentAmmo,
    max: maxAmmo,
    percentage: maxAmmo > 0 ? (currentAmmo / maxAmmo) * 100 : 0,
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
  const maxRange = weapon?.maxRange || weapon?.range;
  if (!maxRange || !Number.isFinite(maxRange)) {
    return { modifier: 0, description: "Melee range" };
  }

  if (distance <= 10) {
    return { modifier: +2, description: "Point-Blank (+2)" };
  } else if (distance <= maxRange / 3) {
    return { modifier: 0, description: "Short range" };
  } else if (distance <= (maxRange * 2) / 3) {
    return { modifier: -1, description: "Medium range (-1)" };
  } else if (distance <= maxRange) {
    return { modifier: -3, description: "Long range (-3)" };
  } else {
    return { modifier: null, description: "Out of range!" };
  }
}

export default {
  initializeAmmo,
  canFireMissileWeapon,
  getInventoryAmmoCount,
  decrementInventoryAmmo,
  getAmmoInfo,
  calculateRangeModifier,
  getAmmoAliases,
};
