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

  // Initialize equipped object if not exists
  if (!updatedCharacter.equipped) {
    updatedCharacter.equipped = {};
  }

  // Initialize weapon slots only if they don't exist
  if (
    !updatedCharacter.equippedWeapons ||
    !Array.isArray(updatedCharacter.equippedWeapons)
  ) {
    initializeWeaponSlots(updatedCharacter);
  }

  const slotKey = slot === "right" ? "weaponPrimary" : "weaponSecondary";
  const otherSlotKey = slot === "right" ? "weaponSecondary" : "weaponPrimary";
  const slotIndex = slot === "right" ? 0 : 1;
  const otherSlotIndex = slot === "right" ? 1 : 0;

  // Get current weapons in both slots
  const currentWeaponInSlot = updatedCharacter.equippedWeapons[slotIndex];
  const currentWeaponInOtherSlot = updatedCharacter.equippedWeapons[otherSlotIndex];

  // Check if the weapon being equipped is already in the other slot (swapping)
  const isSwapping = currentWeaponInOtherSlot && 
                      currentWeaponInOtherSlot.name === weapon.name && 
                      weapon.name !== "Unarmed";

  let weaponToMoveToInventory = null;

  if (isSwapping) {
    // Swapping weapons between slots
    weaponToMoveToInventory = currentWeaponInSlot;
  } else {
    // Normal equip - weapon from inventory
    weaponToMoveToInventory = currentWeaponInSlot;
  }

  // Update equipped object
  updatedCharacter.equipped[slotKey] = {
    name: weapon.name,
    damage: weapon.damage || "1d6",
    range: weapon.range,
    reach: weapon.reach,
    category: weapon.category,
    type: weapon.type || "weapon",
  };

  // If swapping, update the other slot too
  if (isSwapping && weaponToMoveToInventory && weaponToMoveToInventory.name !== "Unarmed") {
    updatedCharacter.equipped[otherSlotKey] = {
      name: weaponToMoveToInventory.name,
      damage: weaponToMoveToInventory.damage || "1d3",
      range: weaponToMoveToInventory.range,
      reach: weaponToMoveToInventory.reach,
      category: weaponToMoveToInventory.category,
      type: weaponToMoveToInventory.type || "weapon",
    };
  }

  // Update equippedWeapons array
  updatedCharacter.equippedWeapons[slotIndex] = {
    ...weapon,
    slot: slot === "right" ? "Right Hand" : "Left Hand",
  };

  // If swapping, update the other slot in the array too
  if (isSwapping && weaponToMoveToInventory && weaponToMoveToInventory.name !== "Unarmed") {
    updatedCharacter.equippedWeapons[otherSlotIndex] = {
      ...weaponToMoveToInventory,
      slot: slot === "right" ? "Left Hand" : "Right Hand",
    };
  }

  // Handle inventory updates
  let updatedInventory = [...(updatedCharacter.inventory || [])];

  // If not swapping and not unarmed, remove weapon from inventory
  if (!isSwapping && weapon.name !== "Unarmed") {
    const weaponIndex = updatedInventory.findIndex(item => 
      item.name === weapon.name &&
      (item.type === "weapon" || item.type === "Weapon" || 
       item.category === 'one-handed' || item.category === 'two-handed' ||
       item.category === 'ranged' || item.category === 'thrown')
    );
    if (weaponIndex !== -1) {
      updatedInventory.splice(weaponIndex, 1);
    }
  }

  // If there's a weapon to move back to inventory (and it's not Unarmed), add it
  if (weaponToMoveToInventory && weaponToMoveToInventory.name !== "Unarmed") {
    // Check if it's already in inventory (shouldn't be if we're swapping, but check anyway)
    const alreadyInInventory = updatedInventory.some(item => 
      item.name === weaponToMoveToInventory.name &&
      (item.type === "weapon" || item.type === "Weapon" || 
       item.category === 'one-handed' || item.category === 'two-handed' ||
       item.category === 'ranged' || item.category === 'thrown')
    );
    
    if (!alreadyInInventory) {
      updatedInventory.push(weaponToMoveToInventory);
    }
  }

  // Update inventory
  updatedCharacter.inventory = updatedInventory;

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

  // Initialize equipped object if not exists
  if (!updatedCharacter.equipped) {
    updatedCharacter.equipped = {};
  }

  // Initialize weapon slots only if they don't exist
  if (
    !updatedCharacter.equippedWeapons ||
    !Array.isArray(updatedCharacter.equippedWeapons)
  ) {
    initializeWeaponSlots(updatedCharacter);
  }

  const slotKey = slot === "right" ? "weaponPrimary" : "weaponSecondary";
  const slotIndex = slot === "right" ? 0 : 1;

  // Get the weapon that's currently equipped
  const currentWeapon = updatedCharacter.equippedWeapons[slotIndex];

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

  // Add the unequipped weapon back to inventory (if it's not Unarmed)
  if (currentWeapon && currentWeapon.name !== "Unarmed") {
    let updatedInventory = [...(updatedCharacter.inventory || [])];
    
    // Check if weapon is already in inventory
    const alreadyInInventory = updatedInventory.some(item => 
      item.name === currentWeapon.name &&
      (item.type === "weapon" || item.type === "Weapon" || 
       item.category === 'one-handed' || item.category === 'two-handed' ||
       item.category === 'ranged' || item.category === 'thrown')
    );
    
    if (!alreadyInInventory) {
      updatedInventory.push(currentWeapon);
      updatedCharacter.inventory = updatedInventory;
    }
  }

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

  // Initialize equipped object if not exists
  if (!updatedCharacter.equipped) {
    updatedCharacter.equipped = {};
  }

  // Initialize weapon slots only if they don't exist
  if (
    !updatedCharacter.equippedWeapons ||
    !Array.isArray(updatedCharacter.equippedWeapons)
  ) {
    console.log("🔍 autoEquipWeapons - Initializing weapon slots");
    initializeWeaponSlots(updatedCharacter);
  }

  // Get currently equipped weapons (to return to inventory)
  const currentRightWeapon = updatedCharacter.equippedWeapons[0];
  const currentLeftWeapon = updatedCharacter.equippedWeapons[1];

  const availableWeapons = getAvailableWeapons(updatedCharacter);
  console.log("🔍 autoEquipWeapons - Available weapons:", availableWeapons);

  // Handle inventory updates
  let updatedInventory = [...(updatedCharacter.inventory || [])];

  if (availableWeapons.length > 0) {
    // Equip first weapon to right hand
    const firstWeapon = availableWeapons[0];
    console.log("🔍 autoEquipWeapons - First weapon:", firstWeapon);
    
    // Remove first weapon from inventory
    const firstWeaponIndex = updatedInventory.findIndex(item => 
      item.name === firstWeapon.name &&
      (item.type === "weapon" || item.type === "Weapon" || 
       item.category === 'one-handed' || item.category === 'two-handed' ||
       item.category === 'ranged' || item.category === 'thrown')
    );
    if (firstWeaponIndex !== -1) {
      updatedInventory.splice(firstWeaponIndex, 1);
    }

    // Return current right weapon to inventory if not Unarmed
    if (currentRightWeapon && currentRightWeapon.name !== "Unarmed") {
      const alreadyInInventory = updatedInventory.some(item => 
        item.name === currentRightWeapon.name &&
        (item.type === "weapon" || item.type === "Weapon" || 
         item.category === 'one-handed' || item.category === 'two-handed' ||
         item.category === 'ranged' || item.category === 'thrown')
      );
      if (!alreadyInInventory) {
        updatedInventory.push(currentRightWeapon);
      }
    }

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
      
      // Remove second weapon from inventory
      const secondWeaponIndex = updatedInventory.findIndex(item => 
        item.name === secondWeapon.name &&
        (item.type === "weapon" || item.type === "Weapon" || 
         item.category === 'one-handed' || item.category === 'two-handed' ||
         item.category === 'ranged' || item.category === 'thrown')
      );
      if (secondWeaponIndex !== -1) {
        updatedInventory.splice(secondWeaponIndex, 1);
      }

      // Return current left weapon to inventory if not Unarmed
      if (currentLeftWeapon && currentLeftWeapon.name !== "Unarmed") {
        const alreadyInInventory = updatedInventory.some(item => 
          item.name === currentLeftWeapon.name &&
          (item.type === "weapon" || item.type === "Weapon" || 
           item.category === 'one-handed' || item.category === 'two-handed' ||
           item.category === 'ranged' || item.category === 'thrown')
        );
        if (!alreadyInInventory) {
          updatedInventory.push(currentLeftWeapon);
        }
      }

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
    } else {
      // No second weapon, return current left weapon to inventory if not Unarmed
      if (currentLeftWeapon && currentLeftWeapon.name !== "Unarmed") {
        const alreadyInInventory = updatedInventory.some(item => 
          item.name === currentLeftWeapon.name &&
          (item.type === "weapon" || item.type === "Weapon" || 
           item.category === 'one-handed' || item.category === 'two-handed' ||
           item.category === 'ranged' || item.category === 'thrown')
        );
        if (!alreadyInInventory) {
          updatedInventory.push(currentLeftWeapon);
        }
      }
    }

    // Update inventory
    updatedCharacter.inventory = updatedInventory;

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
 * Sync equippedWeapons array from equipped object
 * Ensures both weapon storage systems are in sync
 * @param {Object} character - Character object
 * @returns {Object} Character with synced equippedWeapons
 */
export function syncEquippedWeapons(character) {
  const updatedCharacter = { ...character };

  // Initialize equipped object if not exists
  if (!updatedCharacter.equipped) {
    updatedCharacter.equipped = {};
  }

  // Initialize equippedWeapons array if not exists
  if (
    !updatedCharacter.equippedWeapons ||
    !Array.isArray(updatedCharacter.equippedWeapons) ||
    updatedCharacter.equippedWeapons.length === 0
  ) {
    updatedCharacter.equippedWeapons = [
      { name: "Unarmed", damage: "1d3", type: "unarmed", category: "unarmed", slot: "Right Hand" },
      { name: "Unarmed", damage: "1d3", type: "unarmed", category: "unarmed", slot: "Left Hand" }
    ];
  }

  // Sync from equipped.weaponPrimary to equippedWeapons[0]
  if (updatedCharacter.equipped.weaponPrimary) {
    updatedCharacter.equippedWeapons[0] = {
      name: updatedCharacter.equipped.weaponPrimary.name,
      damage: updatedCharacter.equipped.weaponPrimary.damage || "1d3",
      type: updatedCharacter.equipped.weaponPrimary.type || "unarmed",
      category: updatedCharacter.equipped.weaponPrimary.category || "unarmed",
      range: updatedCharacter.equipped.weaponPrimary.range,
      reach: updatedCharacter.equipped.weaponPrimary.reach,
      slot: "Right Hand"
    };
  }

  // Sync from equipped.weaponSecondary to equippedWeapons[1]
  if (updatedCharacter.equipped.weaponSecondary) {
    updatedCharacter.equippedWeapons[1] = {
      name: updatedCharacter.equipped.weaponSecondary.name,
      damage: updatedCharacter.equipped.weaponSecondary.damage || "1d3",
      type: updatedCharacter.equipped.weaponSecondary.type || "unarmed",
      category: updatedCharacter.equipped.weaponSecondary.category || "unarmed",
      range: updatedCharacter.equipped.weaponSecondary.range,
      reach: updatedCharacter.equipped.weaponSecondary.reach,
      slot: "Left Hand"
    };
  }

  return updatedCharacter;
}

/**
 * Get weapon display info for UI
 * @param {Object} character - Character object
 * @returns {Object} Weapon display info
 */
export function getWeaponDisplayInfo(character) {
  // Always prefer equipped object (combat system) as source of truth
  // This ensures consistency across WeaponShop, CharacterList, and CombatPage
  let rightWeapon = { name: "Unarmed", damage: "1d3", type: "unarmed" };
  let leftWeapon = { name: "Unarmed", damage: "1d3", type: "unarmed" };

  // First priority: Use equipped object (combat system) if it exists
  if (character.equipped) {
    // Get from equipped.weaponPrimary (right hand)
    if (character.equipped.weaponPrimary) {
      rightWeapon = {
        name: character.equipped.weaponPrimary.name || "Unarmed",
        damage: character.equipped.weaponPrimary.damage || "1d3",
        type: character.equipped.weaponPrimary.type || "unarmed",
        category: character.equipped.weaponPrimary.category,
        range: character.equipped.weaponPrimary.range,
        reach: character.equipped.weaponPrimary.reach,
      };
    }

    // Get from equipped.weaponSecondary (left hand)
    if (character.equipped.weaponSecondary) {
      leftWeapon = {
        name: character.equipped.weaponSecondary.name || "Unarmed",
        damage: character.equipped.weaponSecondary.damage || "1d3",
        type: character.equipped.weaponSecondary.type || "unarmed",
        category: character.equipped.weaponSecondary.category,
        range: character.equipped.weaponSecondary.range,
        reach: character.equipped.weaponSecondary.reach,
      };
    }
  }

  // Fallback: If equipped object doesn't have weapons, try equippedWeapons array
  if (
    (!character.equipped || 
     (!character.equipped.weaponPrimary && !character.equipped.weaponSecondary)) &&
    character.equippedWeapons &&
    Array.isArray(character.equippedWeapons) &&
    character.equippedWeapons.length > 0
  ) {
    if (character.equippedWeapons[0] && rightWeapon.name === "Unarmed") {
      rightWeapon = character.equippedWeapons[0];
    }
    if (character.equippedWeapons[1] && leftWeapon.name === "Unarmed") {
      leftWeapon = character.equippedWeapons[1];
    }
  }

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
