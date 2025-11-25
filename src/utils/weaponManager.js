// Unified Weapon Management System
// Handles weapon equipping consistently across Character List, Trader Shop, Weapon Shop, and Combat Arena

import axiosInstance from "./axios";

/**
 * Initialize weapon slots for a character
 * @param {Object} character - Character object
 * @returns {Object} Character with initialized weapon slots
 */
export function initializeWeaponSlots(character) {
  console.log("🔍 initializeWeaponSlots - Input character:", character.name);
  console.log(
    "🔍 initializeWeaponSlots - equippedWeapons before:",
    character.equippedWeapons
  );

  if (!character.equipped) {
    character.equipped = {};
  }

  // Only initialize if equippedWeapons doesn't exist or is empty
  if (
    !character.equippedWeapons ||
    !Array.isArray(character.equippedWeapons) ||
    character.equippedWeapons.length === 0
  ) {
    console.log("🔍 initializeWeaponSlots - Initializing weapon slots");
    character.equippedWeapons = [
      {
        name: "Unarmed",
        damage: "1d3",
        type: "unarmed",
        category: "unarmed",
        slot: "Right Hand",
      },
      {
        name: "Unarmed",
        damage: "1d3",
        type: "unarmed",
        category: "unarmed",
        slot: "Left Hand",
      },
    ];
  } else {
    console.log(
      "🔍 initializeWeaponSlots - Weapon slots already exist, skipping initialization"
    );
  }

  console.log(
    "🔍 initializeWeaponSlots - equippedWeapons after:",
    character.equippedWeapons
  );
  return character;
}

/**
 * Check if an item is a weapon
 * @param {Object} item - Item to check
 * @returns {boolean} True if item is a weapon
 */
export function isWeapon(item) {
  if (!item || !item.name) return false;

  // Check explicit weapon types
  if (
    item.type === "weapon" ||
    item.type === "Weapon" ||
    item.category === "Weapons"
  ) {
    return true;
  }

  // Check weapon categories
  if (
    item.category === "one-handed" ||
    item.category === "two-handed" ||
    item.category === "shield"
  ) {
    return true;
  }

  // Check weapon names
  const itemName = item.name.toLowerCase();
  const weaponKeywords = [
    "axe",
    "sword",
    "bow",
    "dagger",
    "sling",
    "spear",
    "mace",
    "club",
    "hammer",
    "staff",
    "wand",
    "crossbow",
    "lance",
    "halberd",
    "rapier",
    "scimitar",
    "flail",
    "morningstar",
    "warhammer",
    "battleaxe",
    "longsword",
    "shortsword",
    "greatsword",
    "handaxe",
    "throwing axe",
    "javelin",
    "trident",
    "shield",
  ];

  return weaponKeywords.some((keyword) => itemName.includes(keyword));
}

/**
 * Get available weapons from character inventory
 * @param {Object} character - Character object
 * @returns {Array} Array of weapon items
 */
export function getAvailableWeapons(character) {
  // Try to find the inventory array
  let inventory = null;

  if (
    character.wardrobe &&
    Array.isArray(character.wardrobe) &&
    character.wardrobe.length > 0
  ) {
    inventory = character.wardrobe;
  } else if (character.inventory && Array.isArray(character.inventory)) {
    inventory = character.inventory;
  } else if (character.items && Array.isArray(character.items)) {
    inventory = character.items;
  } else if (character.gear && Array.isArray(character.gear)) {
    inventory = character.gear;
  } else if (character.equipment && Array.isArray(character.equipment)) {
    inventory = character.equipment;
  } else {
    inventory = [];
  }

  const weapons = inventory.filter((item) => isWeapon(item));
  return weapons;
}

/**
 * Equip a weapon to a character
 * @param {Object} character - Character object
 * @param {Object} weapon - Weapon to equip
 * @param {string} slot - 'right' or 'left' hand
 * @returns {Object} Updated character
 */
export function equipWeapon(character, weapon, slot = "right") {
  const updatedCharacter = { ...character };

  // Initialize weapon slots only if they don't exist
  if (
    !updatedCharacter.equippedWeapons ||
    !Array.isArray(updatedCharacter.equippedWeapons)
  ) {
    initializeWeaponSlots(updatedCharacter);
  }

  const slotKey = slot === "right" ? "weaponPrimary" : "weaponSecondary";
  const slotIndex = slot === "right" ? 0 : 1;

  // Update equipped object
  updatedCharacter.equipped[slotKey] = {
    name: weapon.name,
    damage: weapon.damage || "1d6",
    range: weapon.range,
    reach: weapon.reach,
    category: weapon.category,
    type: weapon.type || "weapon",
  };

  // Update equippedWeapons array
  updatedCharacter.equippedWeapons[slotIndex] = {
    ...weapon,
    slot: slot === "right" ? "Right Hand" : "Left Hand",
  };

  // Update legacy equippedWeapon for compatibility
  if (slot === "right") {
    updatedCharacter.equippedWeapon = weapon.name;
  }

  return updatedCharacter;
}

/**
 * Unequip a weapon from a character
 * @param {Object} character - Character object
 * @param {string} slot - 'right' or 'left' hand
 * @returns {Object} Updated character
 */
export function unequipWeapon(character, slot = "right") {
  const updatedCharacter = { ...character };

  // Initialize weapon slots only if they don't exist
  if (
    !updatedCharacter.equippedWeapons ||
    !Array.isArray(updatedCharacter.equippedWeapons)
  ) {
    initializeWeaponSlots(updatedCharacter);
  }

  const slotKey = slot === "right" ? "weaponPrimary" : "weaponSecondary";
  const slotIndex = slot === "right" ? 0 : 1;

  // Remove from equipped object
  delete updatedCharacter.equipped[slotKey];

  // Reset equippedWeapons array slot
  updatedCharacter.equippedWeapons[slotIndex] = {
    name: "Unarmed",
    damage: "1d3",
    type: "unarmed",
    category: "unarmed",
    slot: slot === "right" ? "Right Hand" : "Left Hand",
  };

  // Update legacy equippedWeapon for compatibility
  if (slot === "right") {
    updatedCharacter.equippedWeapon = "Unarmed";
  }

  return updatedCharacter;
}

/**
 * Auto-equip weapons from inventory
 * @param {Object} character - Character object
 * @returns {Object} Updated character
 */
export function autoEquipWeapons(character) {
  console.log("🔍 autoEquipWeapons - Input character:", character.name);
  console.log(
    "🔍 autoEquipWeapons - equippedWeapons before:",
    character.equippedWeapons
  );

  const updatedCharacter = { ...character };

  // Initialize weapon slots only if they don't exist
  if (
    !updatedCharacter.equippedWeapons ||
    !Array.isArray(updatedCharacter.equippedWeapons)
  ) {
    console.log("🔍 autoEquipWeapons - Initializing weapon slots");
    initializeWeaponSlots(updatedCharacter);
  }

  const availableWeapons = getAvailableWeapons(updatedCharacter);
  console.log("🔍 autoEquipWeapons - Available weapons:", availableWeapons);

  if (availableWeapons.length > 0) {
    // Equip first weapon to right hand
    const firstWeapon = availableWeapons[0];
    console.log("🔍 autoEquipWeapons - First weapon:", firstWeapon);
    updatedCharacter.equipped.weaponPrimary = {
      name: firstWeapon.name,
      damage: firstWeapon.damage || "1d6",
      range: firstWeapon.range,
      reach: firstWeapon.reach,
      category: firstWeapon.category,
      type: firstWeapon.type || "weapon",
    };

    updatedCharacter.equippedWeapons[0] = {
      name: firstWeapon.name,
      damage: firstWeapon.damage || "1d6",
      range: firstWeapon.range,
      reach: firstWeapon.reach,
      category: firstWeapon.category,
      type: firstWeapon.type || "weapon",
      slot: "Right Hand",
    };

    updatedCharacter.equippedWeapon = firstWeapon.name;

    // Equip second weapon to left hand if available
    if (availableWeapons.length > 1) {
      const secondWeapon = availableWeapons[1];
      updatedCharacter.equipped.weaponSecondary = {
        name: secondWeapon.name,
        damage: secondWeapon.damage || "1d6",
        range: secondWeapon.range,
        reach: secondWeapon.reach,
        category: secondWeapon.category,
        type: secondWeapon.type || "weapon",
      };

      updatedCharacter.equippedWeapons[1] = {
        name: secondWeapon.name,
        damage: secondWeapon.damage || "1d6",
        range: secondWeapon.range,
        reach: secondWeapon.reach,
        category: secondWeapon.category,
        type: secondWeapon.type || "weapon",
        slot: "Left Hand",
      };
    }

    console.log(
      "🔍 autoEquipWeapons - Final equippedWeapons:",
      updatedCharacter.equippedWeapons
    );
    console.log(
      "🔍 autoEquipWeapons - Right hand weapon name:",
      updatedCharacter.equippedWeapons[0]?.name || "None"
    );
    console.log(
      "🔍 autoEquipWeapons - Left hand weapon name:",
      updatedCharacter.equippedWeapons[1]?.name || "None"
    );
  }

  return updatedCharacter;
}

/**
 * Save character weapon changes to backend
 * @param {string} characterId - Character ID
 * @param {Object} updatedCharacter - Updated character object
 * @returns {Promise<Object>} Updated character from backend
 */
export async function saveCharacterWeapons(characterId, updatedCharacter) {
  try {
    const response = await axiosInstance.put(
      `/characters/${characterId}`,
      updatedCharacter
    );
    return response.data;
  } catch (error) {
    console.error("Error saving character weapons:", error);
    throw error;
  }
}

/**
 * Get weapon display info for UI
 * @param {Object} character - Character object
 * @returns {Object} Weapon display info
 */
export function getWeaponDisplayInfo(character) {
  // Don't initialize weapon slots here - this is just for display
  // The weapon slots should already be initialized elsewhere

  if (
    !character.equippedWeapons ||
    !Array.isArray(character.equippedWeapons) ||
    character.equippedWeapons.length === 0
  ) {
    // If no equippedWeapons array exists, return default unarmed info
    return {
      rightHand: { name: "Unarmed", damage: "1d3", type: "unarmed" },
      leftHand: { name: "Unarmed", damage: "1d3", type: "unarmed" },
      hasWeapons: false,
    };
  }

  const rightWeapon = character.equippedWeapons[0] || {
    name: "Unarmed",
    damage: "1d3",
    type: "unarmed",
  };
  const leftWeapon = character.equippedWeapons[1] || {
    name: "Unarmed",
    damage: "1d3",
    type: "unarmed",
  };

  return {
    rightHand: {
      name: rightWeapon.name || "Unarmed",
      damage: rightWeapon.damage || "1d3",
      type: rightWeapon.type || "unarmed",
    },
    leftHand: {
      name: leftWeapon.name || "Unarmed",
      damage: leftWeapon.damage || "1d3",
      type: leftWeapon.type || "unarmed",
    },
    hasWeapons:
      (rightWeapon.name && rightWeapon.name !== "Unarmed") ||
      (leftWeapon.name && leftWeapon.name !== "Unarmed"),
  };
}
