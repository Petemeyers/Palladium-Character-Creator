/**
 * Starting Equipment Trade-In Manager
 * Handles trade-in of starting equipment for OCC-specific alternatives
 */

import STARTER_TEMPLATES from "../data/starterEquipmentTemplates.js";
import { shopItems } from "../data/shopItems.js";

/**
 * Get starting equipment items that can be traded in for a character
 * @param {Object} character - Character object
 * @returns {Array} Array of starting equipment items that can be traded in
 */
export function getTradeableStartingEquipment(character) {
  const tradeableItems = [];

  if (!character.inventory || !Array.isArray(character.inventory)) {
    return tradeableItems;
  }

  // Define items that can be traded in (basic starting equipment)
  const tradeableItemNames = [
    "Basic set of clothes",
    "Set of clothes",
    "Boots",
    "Shoes",
    "Belt",
    "Sack",
    "Large sack",
    "Small sack",
    "Backpack",
    "Knapsack",
    "Club",
    "Dagger",
    "Knife",
    "Low quality weapon",
    "Robe (Light)",
    "Robe (Heavy)",
    "Pants",
    "Tunic",
    "Jacket (Light)",
    "Cape (Long)",
    "Dress (Fancy)",
    "Boots (Leather)",
    "Boots, Knee-High",
  ];

  // Check inventory for tradeable items
  character.inventory.forEach((item) => {
    if (
      item.name &&
      tradeableItemNames.some((tradeable) =>
        item.name.toLowerCase().includes(tradeable.toLowerCase())
      )
    ) {
      tradeableItems.push({
        ...item,
        canTradeIn: true,
        tradeInReason:
          "Starting equipment - can be upgraded to OCC-specific gear",
      });
    }
  });

  return tradeableItems;
}

/**
 * Get OCC-specific equipment alternatives for trade-in
 * @param {string} occ - Character's OCC/Class
 * @returns {Array} Array of alternative equipment options
 */
export function getOccEquipmentAlternatives(occ) {
  const template = STARTER_TEMPLATES[occ];
  if (!template) {
    console.warn(`No starting equipment template found for OCC: ${occ}`);
    return [];
  }

  const alternatives = [];

  // Get equipped items alternatives
  if (template.equipped) {
    template.equipped.forEach((itemName) => {
      const shopItem = shopItems.find((item) => item.name === itemName);
      if (shopItem) {
        alternatives.push({
          ...shopItem,
          category: "equipped",
          slot: inferSlotFromName(itemName),
          description: `Professional ${occ.toLowerCase()} equipment - ${
            shopItem.description || "Standard issue gear"
          }`,
        });
      }
    });
  }

  // Get wardrobe items alternatives
  if (template.wardrobe) {
    template.wardrobe.forEach((itemName) => {
      const shopItem = shopItems.find((item) => item.name === itemName);
      if (shopItem) {
        alternatives.push({
          ...shopItem,
          category: "wardrobe",
          slot: inferSlotFromName(itemName),
          description: `Professional ${occ.toLowerCase()} equipment - ${
            shopItem.description || "Standard issue gear"
          }`,
        });
      }
    });
  }

  // Get inventory items alternatives
  if (template.inventory) {
    template.inventory.forEach((itemName) => {
      const shopItem = shopItems.find((item) => item.name === itemName);
      if (shopItem) {
        alternatives.push({
          ...shopItem,
          category: "inventory",
          slot: inferSlotFromName(itemName),
          description: `Professional ${occ.toLowerCase()} equipment - ${
            shopItem.description || "Standard issue gear"
          }`,
        });
      }
    });
  }

  return alternatives;
}

/**
 * Infer equipment slot from item name
 * @param {string} itemName - Name of the item
 * @returns {string} Inferred slot
 */
function inferSlotFromName(itemName) {
  const name = itemName.toLowerCase();

  if (
    name.includes("helmet") ||
    name.includes("hat") ||
    name.includes("hood")
  ) {
    return "head";
  }
  if (
    name.includes("armor") ||
    name.includes("tunic") ||
    name.includes("robe") ||
    name.includes("shirt")
  ) {
    return "torso";
  }
  if (
    name.includes("pants") ||
    name.includes("breeches") ||
    name.includes("legs")
  ) {
    return "legs";
  }
  if (
    name.includes("boots") ||
    name.includes("shoes") ||
    name.includes("sandals")
  ) {
    return "feet";
  }
  if (
    name.includes("gloves") ||
    name.includes("gauntlets") ||
    name.includes("hands")
  ) {
    return "hands";
  }
  if (name.includes("belt")) {
    return "waist";
  }
  if (name.includes("shield")) {
    return "shield";
  }
  if (name.includes("cloak") || name.includes("cape")) {
    return "back";
  }

  return "misc";
}

/**
 * Check if a character has any tradeable starting equipment
 * @param {Object} character - Character object
 * @returns {boolean} True if character has tradeable starting equipment
 */
export function hasTradeableStartingEquipment(character) {
  return getTradeableStartingEquipment(character).length > 0;
}

/**
 * Get trade-in value for starting equipment
 * @param {string} itemName - Name of the item being traded in
 * @returns {number} Trade-in value in gold
 */
export function getStartingEquipmentTradeInValue(itemName) {
  const tradeInValues = {
    "Basic set of clothes": 5,
    "Set of clothes": 5,
    Boots: 3,
    Shoes: 3,
    Belt: 2,
    Sack: 2,
    "Large sack": 4,
    "Small sack": 2,
    Backpack: 8,
    Knapsack: 6,
    Club: 2,
    Dagger: 3,
    Knife: 2,
    "Low quality weapon": 5,
    "Robe (Light)": 8,
    "Robe (Heavy)": 12,
    Pants: 4,
    Tunic: 6,
    "Jacket (Light)": 10,
    "Cape (Long)": 15,
    "Dress (Fancy)": 20,
    "Boots (Leather)": 8,
    "Boots, Knee-High": 12,
  };

  return tradeInValues[itemName] || 1;
}

export default {
  getTradeableStartingEquipment,
  getOccEquipmentAlternatives,
  hasTradeableStartingEquipment,
  getStartingEquipmentTradeInValue,
};
