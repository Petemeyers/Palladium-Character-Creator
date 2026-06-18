// Unified Weapon Management System
// Handles weapon equipping consistently across Character List, Trader Shop, Weapon Shop, and Combat Arena

import axiosInstance from "./axios";

/**
 * Initialize weapon slots for a character
 * @param {Object} character - Character object
 * @returns {Object} Character with initialized weapon slots
 */
export function initializeWeaponSlots(character) {
  console.log("Ã°Å¸â€Â initializeWeaponSlots - Input character:", character.name);
  console.log(
    "Ã°Å¸â€Â initializeWeaponSlots - equistaminadWeapons before:",
    character.equistaminadWeapons
  );

  if (!character.equistaminad) {
    character.equistaminad = {};
  }

  // Only initialize if equistaminadWeapons doesn't exist or is empty
  if (
    !character.equistaminadWeapons ||
    !Array.isArray(character.equistaminadWeapons) ||
    character.equistaminadWeapons.length === 0
  ) {
    console.log("Ã°Å¸â€Â initializeWeaponSlots - Initializing weapon slots");
    character.equistaminadWeapons = [
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
      "Ã°Å¸â€Â initializeWeaponSlots - Weapon slots already exist, skipping initialization"
    );
  }

  console.log(
    "Ã°Å¸â€Â initializeWeaponSlots - equistaminadWeapons after:",
    character.equistaminadWeapons
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

function isKnightlyCharacter(character = {}) {
  const profession = String(character.profession || character.PROFESSION || character.class || "").toLowerCase();
  const name = String(character.name || "").toLowerCase();
  return profession.includes("knight") || profession.includes("paladin") || name.includes(" knight");
}

function isRangedWeapon(item = {}) {
  const name = String(item.name || "").toLowerCase();
  const category = String(item.category || "").toLowerCase();
  const type = String(item.type || "").toLowerCase();
  return (
    name.includes("bow") ||
    name.includes("crossbow") ||
    name.includes("sling") ||
    category.includes("bow") ||
    category.includes("crossbow") ||
    category.includes("ranged") ||
    type.includes("ranged") ||
    type.includes("missile")
  );
}

function isKnifeOrDagger(item = {}) {
  const name = String(item.name || "").toLowerCase();
  return name.includes("knife") || name.includes("dagger");
}

function scoreKnightPrimaryWeapon(item = {}) {
  if (!item || isRangedWeapon(item) || isKnifeOrDagger(item)) return -1;
  const name = String(item.name || "").toLowerCase();
  if (name.includes("lance")) return 100;
  if (name.includes("long sword")) return 95;
  if (name.includes("short sword")) return 90;
  if (name.includes("spear")) return 85;
  if (name.includes("sword")) return 80;
  if (name.includes("mace") || name.includes("hammer") || name.includes("club")) return 70;
  if (name.includes("axe")) return 60;
  return item.damage ? 10 : 0;
}

function orderKnightWeaponsForAutoEquip(character, weapons = []) {
  if (!isKnightlyCharacter(character) || weapons.length < 2) return weapons;

  const remaining = [...weapons];
  const takeWeapon = (predicate) => {
    const index = remaining.findIndex(predicate);
    if (index < 0) return null;
    const [weapon] = remaining.splice(index, 1);
    return weapon;
  };

  const scoredPrimary = remaining
    .map((weapon, index) => ({ weapon, index, score: scoreKnightPrimaryWeapon(weapon) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)[0];

  const primary = scoredPrimary ? takeWeapon((weapon) => weapon === scoredPrimary.weapon) : null;
  const backup = takeWeapon(isKnifeOrDagger);

  return [
    ...(primary ? [primary] : []),
    ...(backup ? [backup] : []),
    ...remaining.filter((weapon) => !isRangedWeapon(weapon)),
    ...remaining.filter((weapon) => isRangedWeapon(weapon)),
  ];
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

  // Initialize equistaminad object if not exists
  if (!updatedCharacter.equistaminad) {
    updatedCharacter.equistaminad = {};
  }

  // Initialize weapon slots only if they don't exist
  if (
    !updatedCharacter.equistaminadWeapons ||
    !Array.isArray(updatedCharacter.equistaminadWeapons)
  ) {
    initializeWeaponSlots(updatedCharacter);
  }

  const slotKey = slot === "right" ? "weaponPrimary" : "weaponSecondary";
  const otherSlotKey = slot === "right" ? "weaponSecondary" : "weaponPrimary";
  const slotIndex = slot === "right" ? 0 : 1;
  const otherSlotIndex = slot === "right" ? 1 : 0;

  // Get current weapons in both slots
  const currentWeaponInSlot = updatedCharacter.equistaminadWeapons[slotIndex];
  const currentWeaponInOtherSlot = updatedCharacter.equistaminadWeapons[otherSlotIndex];

  // Check if the weapon being equistaminad is already in the other slot (swapping)
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

  // Update equistaminad object
  updatedCharacter.equistaminad[slotKey] = {
    name: weapon.name,
    damage: weapon.damage || "1d6",
    range: weapon.range,
    reach: weapon.reach,
    category: weapon.category,
    type: weapon.type || "weapon",
  };

  // If swapping, update the other slot too
  if (isSwapping && weaponToMoveToInventory && weaponToMoveToInventory.name !== "Unarmed") {
    updatedCharacter.equistaminad[otherSlotKey] = {
      name: weaponToMoveToInventory.name,
      damage: weaponToMoveToInventory.damage || "1d3",
      range: weaponToMoveToInventory.range,
      reach: weaponToMoveToInventory.reach,
      category: weaponToMoveToInventory.category,
      type: weaponToMoveToInventory.type || "weapon",
    };
  }

  // Update equistaminadWeapons array
  updatedCharacter.equistaminadWeapons[slotIndex] = {
    ...weapon,
    slot: slot === "right" ? "Right Hand" : "Left Hand",
  };

  // If swapping, update the other slot in the array too
  if (isSwapping && weaponToMoveToInventory && weaponToMoveToInventory.name !== "Unarmed") {
    updatedCharacter.equistaminadWeapons[otherSlotIndex] = {
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

  // Update legacy equistaminadWeapon for compatibility
  if (slot === "right") {
    updatedCharacter.equistaminadWeapon = weapon.name;
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

  // Initialize equistaminad object if not exists
  if (!updatedCharacter.equistaminad) {
    updatedCharacter.equistaminad = {};
  }

  // Initialize weapon slots only if they don't exist
  if (
    !updatedCharacter.equistaminadWeapons ||
    !Array.isArray(updatedCharacter.equistaminadWeapons)
  ) {
    initializeWeaponSlots(updatedCharacter);
  }

  const slotKey = slot === "right" ? "weaponPrimary" : "weaponSecondary";
  const slotIndex = slot === "right" ? 0 : 1;

  // Get the weapon that's currently equistaminad
  const currentWeapon = updatedCharacter.equistaminadWeapons[slotIndex];

  // Remove from equistaminad object
  delete updatedCharacter.equistaminad[slotKey];

  // Reset equistaminadWeapons array slot
  updatedCharacter.equistaminadWeapons[slotIndex] = {
    name: "Unarmed",
    damage: "1d3",
    type: "unarmed",
    category: "unarmed",
    slot: slot === "right" ? "Right Hand" : "Left Hand",
  };

  // Add the unequistaminad weapon back to inventory (if it's not Unarmed)
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

  // Update legacy equistaminadWeapon for compatibility
  if (slot === "right") {
    updatedCharacter.equistaminadWeapon = "Unarmed";
  }

  return updatedCharacter;
}

/**
 * Auto-equip weapons from inventory
 * @param {Object} character - Character object
 * @returns {Object} Updated character
 */
export function autoEquipWeapons(character) {
  console.log("Ã°Å¸â€Â autoEquipWeapons - Input character:", character.name);
  console.log(
    "Ã°Å¸â€Â autoEquipWeapons - equistaminadWeapons before:",
    character.equistaminadWeapons
  );

  const updatedCharacter = { ...character };

  // Initialize equistaminad object if not exists
  if (!updatedCharacter.equistaminad) {
    updatedCharacter.equistaminad = {};
  }

  // Initialize weapon slots only if they don't exist
  if (
    !updatedCharacter.equistaminadWeapons ||
    !Array.isArray(updatedCharacter.equistaminadWeapons)
  ) {
    console.log("Ã°Å¸â€Â autoEquipWeapons - Initializing weapon slots");
    initializeWeaponSlots(updatedCharacter);
  }

  // Get currently equistaminad weapons (to return to inventory)
  const currentRightWeapon = updatedCharacter.equistaminadWeapons[0];
  const currentLeftWeapon = updatedCharacter.equistaminadWeapons[1];

  const availableWeapons = orderKnightWeaponsForAutoEquip(
    updatedCharacter,
    getAvailableWeapons(updatedCharacter)
  );
  console.log("Ã°Å¸â€Â autoEquipWeapons - Available weapons:", availableWeapons);

  // Handle inventory updates
  let updatedInventory = [...(updatedCharacter.inventory || [])];

  if (availableWeapons.length > 0) {
    // Equip first weapon to right hand
    const firstWeapon = availableWeapons[0];
    console.log("Ã°Å¸â€Â autoEquipWeapons - First weapon:", firstWeapon);
    
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

    updatedCharacter.equistaminad.weaponPrimary = {
      name: firstWeapon.name,
      damage: firstWeapon.damage || "1d6",
      range: firstWeapon.range,
      reach: firstWeapon.reach,
      category: firstWeapon.category,
      type: firstWeapon.type || "weapon",
    };

    updatedCharacter.equistaminadWeapons[0] = {
      name: firstWeapon.name,
      damage: firstWeapon.damage || "1d6",
      range: firstWeapon.range,
      reach: firstWeapon.reach,
      category: firstWeapon.category,
      type: firstWeapon.type || "weapon",
      slot: "Right Hand",
    };

    updatedCharacter.equistaminadWeapon = firstWeapon.name;

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

      updatedCharacter.equistaminad.weaponSecondary = {
        name: secondWeapon.name,
        damage: secondWeapon.damage || "1d6",
        range: secondWeapon.range,
        reach: secondWeapon.reach,
        category: secondWeapon.category,
        type: secondWeapon.type || "weapon",
      };

      updatedCharacter.equistaminadWeapons[1] = {
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
      "Ã°Å¸â€Â autoEquipWeapons - Final equistaminadWeapons:",
      updatedCharacter.equistaminadWeapons
    );
    console.log(
      "Ã°Å¸â€Â autoEquipWeapons - Right hand weapon name:",
      updatedCharacter.equistaminadWeapons[0]?.name || "None"
    );
    console.log(
      "Ã°Å¸â€Â autoEquipWeapons - Left hand weapon name:",
      updatedCharacter.equistaminadWeapons[1]?.name || "None"
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
 * Sync equistaminadWeapons array from equistaminad object
 * Ensures both weapon storage systems are in sync
 * @param {Object} character - Character object
 * @returns {Object} Character with synced equistaminadWeapons
 */
export function syncEquistaminadWeapons(character) {
  const updatedCharacter = { ...character };

  // Initialize equistaminad object if not exists
  if (!updatedCharacter.equistaminad) {
    updatedCharacter.equistaminad = {};
  }

  // Initialize equistaminadWeapons array if not exists
  if (
    !updatedCharacter.equistaminadWeapons ||
    !Array.isArray(updatedCharacter.equistaminadWeapons) ||
    updatedCharacter.equistaminadWeapons.length === 0
  ) {
    updatedCharacter.equistaminadWeapons = [
      { name: "Unarmed", damage: "1d3", type: "unarmed", category: "unarmed", slot: "Right Hand" },
      { name: "Unarmed", damage: "1d3", type: "unarmed", category: "unarmed", slot: "Left Hand" }
    ];
  }

  // Sync from equistaminad.weaponPrimary to equistaminadWeapons[0]
  if (updatedCharacter.equistaminad.weaponPrimary) {
    updatedCharacter.equistaminadWeapons[0] = {
      name: updatedCharacter.equistaminad.weaponPrimary.name,
      damage: updatedCharacter.equistaminad.weaponPrimary.damage || "1d3",
      type: updatedCharacter.equistaminad.weaponPrimary.type || "unarmed",
      category: updatedCharacter.equistaminad.weaponPrimary.category || "unarmed",
      range: updatedCharacter.equistaminad.weaponPrimary.range,
      reach: updatedCharacter.equistaminad.weaponPrimary.reach,
      slot: "Right Hand"
    };
  }

  // Sync from equistaminad.weaponSecondary to equistaminadWeapons[1]
  if (updatedCharacter.equistaminad.weaponSecondary) {
    updatedCharacter.equistaminadWeapons[1] = {
      name: updatedCharacter.equistaminad.weaponSecondary.name,
      damage: updatedCharacter.equistaminad.weaponSecondary.damage || "1d3",
      type: updatedCharacter.equistaminad.weaponSecondary.type || "unarmed",
      category: updatedCharacter.equistaminad.weaponSecondary.category || "unarmed",
      range: updatedCharacter.equistaminad.weaponSecondary.range,
      reach: updatedCharacter.equistaminad.weaponSecondary.reach,
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
  // Always prefer equistaminad object (combat system) as source of truth
  // This ensures consistency across WeaponShop, CharacterList, and CombatPage
  let rightWeapon = { name: "Unarmed", damage: "1d3", type: "unarmed" };
  let leftWeapon = { name: "Unarmed", damage: "1d3", type: "unarmed" };

  // First priority: Use equistaminad object (combat system) if it exists
  if (character.equistaminad) {
    // Get from equistaminad.weaponPrimary (right hand)
    if (character.equistaminad.weaponPrimary) {
      rightWeapon = {
        name: character.equistaminad.weaponPrimary.name || "Unarmed",
        damage: character.equistaminad.weaponPrimary.damage || "1d3",
        type: character.equistaminad.weaponPrimary.type || "unarmed",
        category: character.equistaminad.weaponPrimary.category,
        range: character.equistaminad.weaponPrimary.range,
        reach: character.equistaminad.weaponPrimary.reach,
      };
    }

    // Get from equistaminad.weaponSecondary (left hand)
    if (character.equistaminad.weaponSecondary) {
      leftWeapon = {
        name: character.equistaminad.weaponSecondary.name || "Unarmed",
        damage: character.equistaminad.weaponSecondary.damage || "1d3",
        type: character.equistaminad.weaponSecondary.type || "unarmed",
        category: character.equistaminad.weaponSecondary.category,
        range: character.equistaminad.weaponSecondary.range,
        reach: character.equistaminad.weaponSecondary.reach,
      };
    }
  }

  // Fallback: If equistaminad object doesn't have weapons, try equistaminadWeapons array
  if (
    (!character.equistaminad || 
     (!character.equistaminad.weaponPrimary && !character.equistaminad.weaponSecondary)) &&
    character.equistaminadWeapons &&
    Array.isArray(character.equistaminadWeapons) &&
    character.equistaminadWeapons.length > 0
  ) {
    if (character.equistaminadWeapons[0] && rightWeapon.name === "Unarmed") {
      rightWeapon = character.equistaminadWeapons[0];
    }
    if (character.equistaminadWeapons[1] && leftWeapon.name === "Unarmed") {
      leftWeapon = character.equistaminadWeapons[1];
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
