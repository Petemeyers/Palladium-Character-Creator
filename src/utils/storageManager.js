/**
 * Storage Manager - Handles character storage, housing, and property management
 * Based on 1994 Palladium Fantasy RPG rules
 */

import {
  STORAGE_TYPES,
  HOUSING_COSTS,
  PROPERTY_UPKEEP,
  MAGICAL_STORAGE_ITEMS,
} from "../data/storageSystem.js";

/**
 * Get available storage options for a character
 * @param {Object} character - Character object
 * @returns {Array} Array of available storage options
 */
export function getAvailableStorageOptions(character) {
  const options = [];

  // Always available - personal storage
  options.push(STORAGE_TYPES.BACKPACK);
  options.push(STORAGE_TYPES.BELT_POUCH);

  // Temporary storage - always available
  options.push(STORAGE_TYPES.INN_ROOM);
  options.push(STORAGE_TYPES.INN_LOCKER);

  // Guild storage - requires guild membership
  if (character.guildMembership) {
    options.push(STORAGE_TYPES.GUILD_STORAGE);
  }

  // Temple storage - requires religious affiliation
  if (character.religion || character.alignment?.includes("Good")) {
    options.push(STORAGE_TYPES.TEMPLE_STORAGE);
  }

  // Commercial storage - requires merchant status or sufficient gold
  if (character.gold >= 1000 || character.occupation === "Merchant") {
    options.push(STORAGE_TYPES.RENTED_WAREHOUSE);
  }

  // Owned property - requires purchase
  if (character.properties) {
    character.properties.forEach((property) => {
      const storageType = STORAGE_TYPES[property.type.toUpperCase()];
      if (storageType) {
        options.push({
          ...storageType,
          owned: true,
          location: property.location,
        });
      }
    });
  }

  // Magical storage - requires magical items
  if (character.magicalItems) {
    character.magicalItems.forEach((item) => {
      if (MAGICAL_STORAGE_ITEMS[item.type]) {
        options.push({
          ...MAGICAL_STORAGE_ITEMS[item.type],
          owned: true,
          itemId: item.id,
        });
      }
    });
  }

  return options;
}

/**
 * Calculate total storage capacity for a character
 * @param {Object} character - Character object
 * @returns {Object} Storage capacity breakdown
 */
export function calculateStorageCapacity(character) {
  const options = getAvailableStorageOptions(character);

  let totalCapacity = 0;
  let monthlyCost = 0;
  let ownedCapacity = 0;
  let rentedCapacity = 0;

  options.forEach((option) => {
    totalCapacity += option.capacity;

    if (option.owned) {
      ownedCapacity += option.capacity;
      // Owned property has upkeep costs
      if (option.type === "owned") {
        monthlyCost += option.costPerMonth || 0;
      }
    } else {
      rentedCapacity += option.capacity;
      monthlyCost += option.costPerMonth || 0;
    }
  });

  return {
    totalCapacity,
    ownedCapacity,
    rentedCapacity,
    monthlyCost,
    options,
  };
}

/**
 * Store an item in a specific storage location
 * @param {Object} character - Character object
 * @param {Object} item - Item to store
 * @param {string} storageType - Type of storage to use
 * @returns {Object} Result of storage operation
 */
export function storeItem(character, item, storageType) {
  const storage = STORAGE_TYPES[storageType];
  if (!storage) {
    return { success: false, error: "Invalid storage type" };
  }

  // Check if character has access to this storage type
  const availableOptions = getAvailableStorageOptions(character);
  const hasAccess = availableOptions.some(
    (option) => option.name === storage.name
  );

  if (!hasAccess) {
    return {
      success: false,
      error: "Character does not have access to this storage type",
    };
  }

  // Check capacity
  const currentStorage = character.storage || {};
  const storageContents = currentStorage[storageType] || [];
  const currentWeight = storageContents.reduce(
    (total, storedItem) => total + (storedItem.weight || 0),
    0
  );

  if (currentWeight + (item.weight || 0) > storage.capacity) {
    return { success: false, error: "Storage capacity exceeded" };
  }

  // Store the item
  if (!character.storage) character.storage = {};
  if (!character.storage[storageType]) character.storage[storageType] = [];

  character.storage[storageType].push({
    ...item,
    storedAt: new Date().toISOString(),
    storageType,
  });

  return { success: true, message: `Item stored in ${storage.name}` };
}

/**
 * Retrieve an item from storage
 * @param {Object} character - Character object
 * @param {string} storageType - Type of storage
 * @param {string} itemId - ID of item to retrieve
 * @returns {Object} Result of retrieval operation
 */
export function retrieveItem(character, storageType, itemId) {
  if (!character.storage || !character.storage[storageType]) {
    return { success: false, error: "Storage not found" };
  }

  const storageContents = character.storage[storageType];
  const itemIndex = storageContents.findIndex(
    (item) => item._id === itemId || item.id === itemId
  );

  if (itemIndex === -1) {
    return { success: false, error: "Item not found in storage" };
  }

  const item = storageContents[itemIndex];

  // Check if character has carrying capacity
  const currentWeight =
    character.inventory?.reduce(
      (total, invItem) => total + (invItem.weight || 0),
      0
    ) || 0;
  const maxCapacity = character.carryWeight?.maxWeight || 100;

  if (currentWeight + (item.weight || 0) > maxCapacity) {
    return { success: false, error: "Not enough carrying capacity" };
  }

  // Remove from storage and add to inventory
  storageContents.splice(itemIndex, 1);
  if (!character.inventory) character.inventory = [];
  character.inventory.push(item);

  return {
    success: true,
    message: `Item retrieved from ${STORAGE_TYPES[storageType]?.name}`,
  };
}

/**
 * Calculate monthly housing and storage costs
 * @param {Object} character - Character object
 * @returns {Object} Cost breakdown
 */
export function calculateMonthlyCosts(character) {
  const storageCapacity = calculateStorageCapacity(character);

  // Base living costs based on character lifestyle
  let baseLivingCost = HOUSING_COSTS.PEASANT.cost;
  if (character.gold >= 10000) {
    baseLivingCost = HOUSING_COSTS.NOBLE.cost;
  } else if (character.gold >= 5000) {
    baseLivingCost = HOUSING_COSTS.MIDDLE_CLASS.cost;
  } else if (character.gold >= 1000) {
    baseLivingCost = HOUSING_COSTS.TRADESMAN.cost;
  }

  // Property upkeep costs
  let propertyUpkeep = 0;
  if (character.properties) {
    character.properties.forEach((property) => {
      const upkeep = PROPERTY_UPKEEP[property.type.toUpperCase()];
      if (upkeep) {
        propertyUpkeep += upkeep.upkeep;
        propertyUpkeep += (upkeep.servants || 0) * 10; // 10 gp per servant
        propertyUpkeep += (upkeep.guards || 0) * 15; // 15 gp per guard
        if (upkeep.magical) {
          propertyUpkeep += upkeep.magical;
        }
      }
    });
  }

  const totalMonthlyCost =
    baseLivingCost + storageCapacity.monthlyCost + propertyUpkeep;

  return {
    baseLivingCost,
    storageCost: storageCapacity.monthlyCost,
    propertyUpkeep,
    totalMonthlyCost,
    breakdown: {
      lifestyle: `${HOUSING_COSTS.PEASANT.description}: ${baseLivingCost} gp`,
      storage: `Storage fees: ${storageCapacity.monthlyCost} gp`,
      property: `Property upkeep: ${propertyUpkeep} gp`,
    },
  };
}

/**
 * Purchase a property for a character
 * @param {Object} character - Character object
 * @param {string} propertyType - Type of property to purchase
 * @param {string} location - Location of the property
 * @returns {Object} Result of purchase operation
 */
export function purchaseProperty(character, propertyType, location) {
  const storageType = STORAGE_TYPES[propertyType.toUpperCase()];
  if (!storageType || !storageType.purchaseCost) {
    return {
      success: false,
      error: "Property type not available for purchase",
    };
  }

  if (character.gold < storageType.purchaseCost) {
    return {
      success: false,
      error: `Insufficient gold. Need ${storageType.purchaseCost} gp`,
    };
  }

  // Deduct cost and add property
  character.gold -= storageType.purchaseCost;

  if (!character.properties) character.properties = [];
  character.properties.push({
    type: propertyType,
    location,
    purchasedAt: new Date().toISOString(),
    capacity: storageType.capacity,
  });

  return {
    success: true,
    message: `Purchased ${storageType.name} in ${location} for ${storageType.purchaseCost} gp`,
    remainingGold: character.gold,
  };
}

/**
 * Get storage contents for a character
 * @param {Object} character - Character object
 * @param {string} storageType - Type of storage to check
 * @returns {Array} Array of stored items
 */
export function getStorageContents(character, storageType) {
  if (!character.storage || !character.storage[storageType]) {
    return [];
  }

  return character.storage[storageType];
}

/**
 * Get all storage contents across all storage types
 * @param {Object} character - Character object
 * @returns {Object} Storage contents by type
 */
export function getAllStorageContents(character) {
  if (!character.storage) {
    return {};
  }

  const contents = {};
  Object.keys(character.storage).forEach((storageType) => {
    contents[storageType] = character.storage[storageType];
  });

  return contents;
}

export default {
  getAvailableStorageOptions,
  calculateStorageCapacity,
  storeItem,
  retrieveItem,
  calculateMonthlyCosts,
  purchaseProperty,
  getStorageContents,
  getAllStorageContents,
};
