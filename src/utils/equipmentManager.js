/**
 * Equipment Management Utilities
 * Handle equipping/unequipping clothing and armor items consistently across the application
 *
 * Exports:
 * - isItemEquipped: Check if an item is currently equipped
 * - calculateArmorPenalties: Calculate movement penalties from armor weight
 */

import { EQUIPMENT_SLOTS, CLOTHING_ITEMS } from "../data/equipmentSlots";
import clothingEquipment from "../data/clothingEquipment.json";
import { inferSlot } from "../data/shopItems";
import axiosInstance from "./axios";

/**
 * Check if an item is clothing/armor
 * @param {Object} item - Item to check
 * @returns {boolean} True if item is clothing or armor
 */
export function isClothingOrArmor(item) {
  if (!item || !item.name) return false;

  // Check explicit types
  if (
    item.type === "clothing" ||
    item.type === "armor" ||
    item.type === "light armor" ||
    item.type === "medium armor" ||
    item.type === "heavy armor" ||
    item.category === "Clothing" ||
    item.category === "Armor"
  ) {
    return true;
  }

  // Check for armor rating (indicates armor)
  if (item.armorRating && item.armorRating > 0) {
    return true;
  }

  // Check item names for clothing keywords
  const itemName = item.name.toLowerCase();
  const clothingKeywords = [
    "tunic",
    "robe",
    "shirt",
    "pants",
    "breeches",
    "boots",
    "shoes",
    "gloves",
    "hat",
    "hood",
    "cap",
    "helmet",
    "armor",
    "mail",
    "plate",
    "leather",
    "chain",
    "jerkin",
    "coat",
    "cloak",
    "cape",
    "sandal",
    "wrap",
    "gauntlet",
    "bracer",
    "greave",
    "sabatons",
    "cuirass",
    "coif",
    "circlet",
    "bandana",
  ];

  return clothingKeywords.some((keyword) => itemName.includes(keyword));
}

/**
 * Get available clothing/armor from character inventory
 * @param {Object} character - Character object
 * @returns {Array} Array of clothing/armor items
 */
export function getAvailableClothing(character) {
  // Combine all possible inventory sources
  let inventory = [];

  // Add items from all possible inventory locations
  if (character.inventory && Array.isArray(character.inventory)) {
    inventory = [...inventory, ...character.inventory];
  }
  if (character.wardrobe && Array.isArray(character.wardrobe)) {
    inventory = [...inventory, ...character.wardrobe];
  }
  if (character.items && Array.isArray(character.items)) {
    inventory = [...inventory, ...character.items];
  }
  if (character.gear && Array.isArray(character.gear)) {
    inventory = [...inventory, ...character.gear];
  }
  if (character.equipment && Array.isArray(character.equipment)) {
    inventory = [...inventory, ...character.equipment];
  }

  const clothing = inventory.filter((item) => isClothingOrArmor(item));

  // Assign slots to items that don't have them
  const clothingWithSlots = clothing.map((item) => {
    if (!item.slot) {
      const slot = inferSlot(item.name, item.category || "");
      return { ...item, slot };
    }
    return item;
  });

  return clothingWithSlots;
}

/**
 * Initialize equipment slots for a character
 * @param {Object} character - Character object
 * @returns {Object} Character with initialized equipment slots
 */
export function initializeEquipmentSlots(character) {
  if (!character.equipped) {
    character.equipped = {};
  }

  // Initialize equipment slots if they don't exist
  Object.values(EQUIPMENT_SLOTS).forEach((slot) => {
    if (!character.equipped[slot]) {
      character.equipped[slot] = null;
    }
  });

  return character;
}

/**
 * Look up armor rating from item name
 * Handles name variations and matches from multiple data sources
 * @param {string} itemName - The name of the item
 * @returns {Object} { armorRating: number, sdc: number } or null if not found
 */
function lookupArmorRating(itemName) {
  if (!itemName) return null;

  // Normalize item name for matching (handle variations)
  const normalizedName = itemName.toLowerCase().trim();

  // Armor rating lookup table (from Palladium rules and data files)
  // Handles name variations like "Gauntlets (Chain)" vs "Chain Gauntlets"
  const armorLookup = {
    // Gauntlets
    "gauntlets (chain)": { armorRating: 12, sdc: 30 }, // traderEquipment.js says 12
    "chain gauntlets": { armorRating: 12, sdc: 30 },
    "gauntlets (leather)": { armorRating: 6, sdc: 15 },
    "leather gauntlets": { armorRating: 6, sdc: 15 },
    "leather bracers": { armorRating: 6, sdc: 15 },
    "gauntlets (plate)": { armorRating: 16, sdc: 60 },
    "plate gauntlets": { armorRating: 16, sdc: 60 },

    // Full armor sets
    "padded armor": { armorRating: 5, sdc: 15 },
    "soft leather armor": { armorRating: 6, sdc: 20 },
    "hard leather armor": { armorRating: 8, sdc: 30 },
    "studded leather armor": { armorRating: 10, sdc: 35 },
    "ring mail armor": { armorRating: 12, sdc: 40 },
    "chain mail armor": { armorRating: 13, sdc: 45 },
    "chain armor": { armorRating: 13, sdc: 45 },
    "scale mail armor": { armorRating: 14, sdc: 55 },
    "splint mail armor": { armorRating: 15, sdc: 60 },
    "plate mail armor": { armorRating: 16, sdc: 70 },
    "plate armor": { armorRating: 16, sdc: 70 },
    "full plate armor": { armorRating: 17, sdc: 90 },

    // Helmets
    "leather cap": { armorRating: 4, sdc: 10 },
    "chain coif": { armorRating: 10, sdc: 25 },
    "plate helm": { armorRating: 14, sdc: 40 },

    // Boots
    "studded boots": { armorRating: 5, sdc: 15 },
    "iron sabatons": { armorRating: 14, sdc: 40 },
    "boots of swiftness": { armorRating: 8, sdc: 20 },
    "boots, knee-high": { armorRating: 0, sdc: 0 }, // Regular boots, no armor

    // Shields
    "shield, small wood": { armorRating: 10, sdc: 25 },
    "small shield": { armorRating: 10, sdc: 25 },
    "shield, large iron": { armorRating: 14, sdc: 50 },
    "large shield": { armorRating: 14, sdc: 50 },
  };

  // Try exact match first
  if (armorLookup[normalizedName]) {
    return armorLookup[normalizedName];
  }

  // Try partial matches for name variations
  for (const [key, value] of Object.entries(armorLookup)) {
    if (
      normalizedName.includes(key) ||
      key.includes(normalizedName.split("(")[0].trim())
    ) {
      return value;
    }
  }

  return null;
}

/**
 * Equip an item to a character
 * @param {Object} character - Character object
 * @param {Object} item - The item to equip
 * @returns {Object} Updates object with only changed fields
 */
export function equipItem(character, item) {
  if (!item || !item.slot) {
    console.error("Item must have a slot property");
    return {};
  }

  const slot = item.slot;
  const equipped = { ...(character.equipped || {}) };
  const wardrobe = [...(character.wardrobe || [])];
  const inventory = [...(character.inventory || [])];

  // Check if slot already has an item
  const currentItem = equipped[slot];

  // Unequip current item if exists and return it to wardrobe
  if (currentItem) {
    wardrobe.push(currentItem);
  }

  // Remove item from wardrobe/inventory
  const newWardrobe = wardrobe.filter(
    (i) => !(i.name === item.name && i.slot === item.slot)
  );
  const newInventory = inventory.filter(
    (i) => !(i.name === item.name && i.slot === item.slot)
  );

  // Look up armor rating if not already set
  let armorRating = item.armorRating || item.defense || 0;
  let sdc = item.sdc || 0;

  // If armor rating is 0 or missing, try to look it up from item name
  if (!armorRating && item.name) {
    const armorData = lookupArmorRating(item.name);
    if (armorData) {
      armorRating = armorData.armorRating;
      sdc = armorData.sdc || sdc;
    }
  }

  // Equip the new item
  equipped[slot] = {
    name: item.name,
    weight: item.weight || 0,
    armorRating: armorRating,
    sdc: sdc,
    currentSDC: sdc, // Track current S.D.C. for damage
    price: item.price || item.value || 0,
    category: item.category || "Clothing",
    type: item.type || "clothing",
    description: item.description || "",
    slot: slot,
    broken: false, // Track if armor is broken (S.D.C. = 0)
  };

  // Return only the fields that changed
  return {
    equipped,
    wardrobe: newWardrobe,
    inventory: newInventory,
  };
}

/**
 * Unequip an item from a character
 * @param {Object} character - Character object
 * @param {String} slot - The equipment slot
 * @returns {Object} Updates object with only changed fields
 */
export function unequipItem(character, slot) {
  const equipped = { ...(character.equipped || {}) };
  const wardrobe = [...(character.wardrobe || [])];

  const item = equipped[slot];
  if (item) {
    // Add item back to wardrobe
    wardrobe.push(item);
    // Remove from equipped
    equipped[slot] = null;
  }

  // Return only the fields that changed
  return {
    equipped,
    wardrobe,
  };
}

/**
 * Fix armor ratings for already-equipped items
 * This corrects items that were equipped without proper armor rating lookup
 * @param {Object} character - Character object
 * @returns {Object} Updated character with corrected armor ratings
 */
export function fixEquippedArmorRatings(character) {
  const updatedCharacter = { ...character };
  const equipped = { ...(updatedCharacter.equipped || {}) };
  let needsUpdate = false;

  Object.entries(equipped).forEach(([slot, item]) => {
    if (item && item.name) {
      // Check if armor rating is missing or 0 for armor items
      const armorData = lookupArmorRating(item.name);
      if (armorData && armorData.armorRating > 0) {
        // If current AR is 0 but should have AR, fix it
        if (!item.armorRating || item.armorRating === 0) {
          equipped[slot] = {
            ...item,
            armorRating: armorData.armorRating,
            sdc: armorData.sdc || item.sdc || 0,
            currentSDC: armorData.sdc || item.currentSDC || item.sdc || 0,
          };
          needsUpdate = true;
        }
      }
    }
  });

  if (needsUpdate) {
    updatedCharacter.equipped = equipped;
  }

  return updatedCharacter;
}

/**
 * Get equipment display info for UI
 * @param {Object} character - Character object
 * @returns {Object} Equipment display info
 */
export function getEquipmentDisplayInfo(character) {
  const equipped = character.equipped || {};

  return {
    head: equipped.head || {
      name: "None",
      armorRating: 0,
      currentSDC: 0,
      type: "none",
    },
    torso: equipped.torso || {
      name: "None",
      armorRating: 0,
      currentSDC: 0,
      type: "none",
    },
    legs: equipped.legs || {
      name: "None",
      armorRating: 0,
      currentSDC: 0,
      type: "none",
    },
    feet: equipped.feet || {
      name: "None",
      armorRating: 0,
      currentSDC: 0,
      type: "none",
    },
    hands: equipped.hands || {
      name: "None",
      armorRating: 0,
      currentSDC: 0,
      type: "none",
    },
    back: equipped.back || {
      name: "None",
      armorRating: 0,
      currentSDC: 0,
      type: "none",
    },
    waist: equipped.waist || {
      name: "None",
      armorRating: 0,
      currentSDC: 0,
      type: "none",
      capacity: 0,
    },
    hasEquipment: Object.values(equipped).some(
      (item) => item && item.name !== "None"
    ),
  };
}

/**
 * Get total armor rating from equipped items
 * @param {Object} character - Character object
 * @returns {Number} Total armor rating (highest A.R. from any piece, per Palladium rules)
 */
export function getTotalArmorRating(character) {
  const equipped = character.equipped || {};
  // In Palladium, armor rating is the highest A.R. of any single piece, not cumulative
  return Math.max(
    ...Object.values(equipped).map((item) => {
      if (item && item.armorRating && !item.broken) {
        return item.armorRating;
      }
      return 0;
    }),
    0
  );
}

/**
 * Get total weight from equipped items
 * @param {Object} character - Character object
 * @returns {Number} Total weight
 */
export function getTotalEquippedWeight(character) {
  const equipped = character.equipped || {};
  return Object.values(equipped).reduce((total, item) => {
    if (item && item.weight) {
      return total + item.weight;
    }
    return total;
  }, 0);
}

/**
 * Calculate movement penalties from armor weight (Palladium 1994 rules)
 * @param {Object} character - Character object
 * @returns {Object} Movement penalties
 */
export function calculateArmorPenalties(character) {
  const totalWeight = getTotalEquippedWeight(character);
  const equipped = character.equipped || {};

  // Palladium rule: -1 Speed per 10 lbs of armor
  const speedPenalty = Math.floor(totalWeight / 10);

  // Check for heavy armor penalties
  const hasHeavyArmor = Object.values(equipped).some(
    (item) => item && (item.type === "heavy" || item.type === "heavy armor")
  );

  // Heavy armor may reduce Prowl/Dodge by 10% or more
  const prowlPenalty = hasHeavyArmor ? 10 : 0;
  const dodgePenalty = hasHeavyArmor ? 10 : 0;

  return {
    speedPenalty,
    prowlPenalty,
    dodgePenalty,
    totalWeight,
  };
}

/**
 * Get carrying capacity bonus from equipped containers
 * @param {Object} character - Character object
 * @returns {number} Carrying capacity bonus in pounds
 */
export function getContainerCapacityBonus(character) {
  if (!character.equipped || typeof character.equipped !== "object") {
    return 0;
  }

  let bonus = 0;

  // Check each equipped item for container capacity bonuses
  Object.values(character.equipped).forEach((item) => {
    if (item && (item.category === "Containers" || item.type === "storage")) {
      // Container capacity bonuses based on type
      const containerBonuses = {
        "Small sack": 20,
        "Large sack": 50,
        Backpack: 40,
        Knapsack: 30,
        "Adventurer's Pack": 60,
        "Belt Pouch": 5,
        "Belt purse": 3,
        "Shoulder purse (Small)": 10,
        "Shoulder purse (Large)": 20,
        "Small pocket purse": 2,
        "Saddle bag": 80,
        "Cloth handle bag": 25,
        "Leather handle bag": 30,
        "Water skin (2 pints)": 0,
        "Water skin (½ gallon)": 0,
        "Tobacco pouch": 1,
      };

      bonus += containerBonuses[item.name] || 0;
    }
  });

  // Check waist equipment for storage capacity (belts, sheaths, etc.)
  const waistItem = character.equipped?.waist;
  if (waistItem && waistItem.name !== "None") {
    // Check if it's a storage item (belt pouch, weapon belt, etc.)
    if (waistItem.capacity) {
      bonus += waistItem.capacity * 5; // Convert capacity units to weight (lbs)
    } else if (
      waistItem.type === "storage" ||
      waistItem.category === "storage"
    ) {
      // Check common storage items on waist
      const waistStorageBonuses = {
        "Belt Pouch": 5,
        "Weapon Belt": 10,
        Sheath: 5,
        Belt: 5,
        "Leather Belt": 5,
        "Ornate Belt": 5,
      };
      bonus += waistStorageBonuses[waistItem.name] || 0;
    }
  }

  return bonus;
}

/**
 * Get total carrying capacity (base + container bonuses)
 * @param {Object} character - Character object
 * @returns {number} Total carrying capacity in pounds
 */
export function getTotalCarryingCapacity(character) {
  const baseCapacity = character.carryWeight?.maxWeight || 0;
  const containerBonus = getContainerCapacityBonus(character);

  return baseCapacity + containerBonus;
}

/**
 * Auto-equip clothing/armor from inventory
 * @param {Object} character - Character object
 * @returns {Object} Updated character
 */
export function autoEquipClothing(character) {
  const updatedCharacter = { ...character };

  // Initialize equipment slots if needed
  initializeEquipmentSlots(updatedCharacter);

  const availableClothing = getAvailableClothing(updatedCharacter);

  // Group items by slot
  const itemsBySlot = {};
  availableClothing.forEach((item) => {
    if (item.slot) {
      if (!itemsBySlot[item.slot]) {
        itemsBySlot[item.slot] = [];
      }
      itemsBySlot[item.slot].push(item);
    }
  });

  // Auto-equip the best item for each slot
  Object.entries(itemsBySlot).forEach(([slot, items]) => {
    if (items.length > 0) {
      // Sort by armor rating (defense), then by value
      const bestItem = items.sort((a, b) => {
        const aDefense = a.defense || a.armorRating || 0;
        const bDefense = b.defense || b.armorRating || 0;
        if (aDefense !== bDefense) {
          return bDefense - aDefense;
        }
        return (b.price || b.value || 0) - (a.price || a.value || 0);
      })[0];

      updatedCharacter.equipped[slot] = {
        name: bestItem.name,
        weight: bestItem.weight || 0,
        defense: bestItem.defense || bestItem.armorRating || 0,
        price: bestItem.price || bestItem.value || 0,
        category: bestItem.category || "Clothing",
        type: bestItem.type || "clothing",
        description: bestItem.description || "",
        slot: slot,
      };
    }
  });

  return updatedCharacter;
}

/**
 * Calculate armor damage based on Palladium 1994 rules
 * @param {Object} character - Character object
 * @param {number} attackRoll - The attack roll (1-20)
 * @param {number} damage - The damage dealt
 * @param {string} targetSlot - The armor slot being hit (optional)
 * @returns {Object} Damage calculation result
 */
export function calculateArmorDamage(
  character,
  attackRoll,
  damage,
  targetSlot = null
) {
  const equipped = character.equipped || {};
  const result = {
    armorHit: false,
    armorDamaged: false,
    characterDamaged: false,
    damageToArmor: 0,
    damageToCharacter: 0,
    brokenArmor: [],
  };

  // If specific slot targeted, check only that slot
  const slotsToCheck = targetSlot ? [targetSlot] : Object.keys(equipped);

  for (const slot of slotsToCheck) {
    const armor = equipped[slot];
    if (!armor || !armor.armorRating || armor.broken) continue;

    // Palladium rule: if attack roll < A.R., armor is hit
    if (attackRoll < armor.armorRating) {
      result.armorHit = true;
      result.damageToArmor += damage;

      // Reduce armor S.D.C.
      armor.currentSDC = Math.max(0, armor.currentSDC - damage);

      if (armor.currentSDC <= 0) {
        armor.broken = true;
        result.brokenArmor.push({ slot, name: armor.name });
        result.armorDamaged = true;
      }

      return result; // Armor absorbed the hit
    }
  }

  // If we get here, no armor blocked the attack
  result.characterDamaged = true;
  result.damageToCharacter = damage;
  return result;
}

/**
 * Repair armor piece
 * @param {Object} character - Character object
 * @param {string} slot - The armor slot to repair
 * @param {number} repairAmount - Amount of S.D.C. to restore
 * @returns {Object} Updated character
 */
export function repairArmor(character, slot, repairAmount) {
  const updatedCharacter = { ...character };
  const equipped = { ...updatedCharacter.equipped };

  if (equipped[slot] && equipped[slot].sdc) {
    equipped[slot].currentSDC = Math.min(
      equipped[slot].sdc,
      equipped[slot].currentSDC + repairAmount
    );

    // If fully repaired, mark as not broken
    if (equipped[slot].currentSDC > 0) {
      equipped[slot].broken = false;
    }
  }

  updatedCharacter.equipped = equipped;
  return updatedCharacter;
}

/**
 * Get total S.D.C. from all equipped armor
 * @param {Object} character - Character object
 * @returns {Number} Total current S.D.C.
 */
export function getTotalArmorSDC(character) {
  const equipped = character.equipped || {};
  return Object.values(equipped).reduce((total, item) => {
    if (item && item.currentSDC && !item.broken) {
      return total + item.currentSDC;
    }
    return total;
  }, 0);
}

/**
 * Calculate repair cost for armor (Palladium 1994 rules)
 * @param {Object} armorItem - The armor item to repair
 * @param {number} repairAmount - Amount of S.D.C. to restore
 * @returns {number} Repair cost in gold pieces
 */
export function calculateRepairCost(armorItem, repairAmount) {
  if (!armorItem || !armorItem.price || repairAmount <= 0) {
    return 0;
  }

  // Palladium rule: 10-25% of item value per 10 S.D.C. repaired
  const repairRate = 0.15; // Use 15% as middle ground
  const sdcUnits = Math.ceil(repairAmount / 10); // Round up to nearest 10 S.D.C.

  return Math.ceil(armorItem.price * repairRate * sdcUnits);
}

/**
 * Get repair cost for all damaged armor
 * @param {Object} character - Character object
 * @returns {Object} Repair costs by slot
 */
export function getRepairCosts(character) {
  const equipped = character.equipped || {};
  const repairCosts = {};

  Object.entries(equipped).forEach(([slot, item]) => {
    if (item && item.sdc && item.currentSDC < item.sdc) {
      const damageAmount = item.sdc - item.currentSDC;
      repairCosts[slot] = {
        item: item.name,
        damageAmount,
        cost: calculateRepairCost(item, damageAmount),
      };
    }
  });

  return repairCosts;
}

/**
 * Save character equipment changes to backend
 * @param {string} characterId - Character ID
 * @param {Object} updatedCharacter - Updated character object
 * @returns {Promise<Object>} Updated character from backend
 */
export async function saveCharacterEquipment(characterId, updatedCharacter) {
  try {
    const response = await axiosInstance.put(
      `/characters/${characterId}`,
      updatedCharacter
    );
    return response.data;
  } catch (error) {
    console.error("Error saving character equipment:", error);
    throw error;
  }
}

/**
 * Check if an item is currently equipped
 * @param {Object} character - Character object
 * @param {Object} item - Item to check
 * @returns {boolean} True if item is equipped
 */
export function isItemEquipped(character, item) {
  if (!character || !item || !character.equipped) return false;

  const equipped = character.equipped;

  // Check if item is equipped in any equipment slot
  for (const [slot, equippedItem] of Object.entries(equipped)) {
    if (equippedItem && equippedItem.name === item.name) {
      return true;
    }
  }

  // Check if item is equipped as a weapon
  if (character.equippedWeapons && Array.isArray(character.equippedWeapons)) {
    return character.equippedWeapons.some(
      (weapon) => weapon.name === item.name
    );
  }

  return false;
}
