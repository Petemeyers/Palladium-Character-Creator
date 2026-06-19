/**
 * Equipment Management Utilities
 * Handle equipping/unequipping clothing and armor items consistently across the application
 *
 * Exports:
 * - isItemEquistaminad: Check if an item is currently equistaminad
 * - calculateArmorPenalties: Calculate movement penalties from armor weight
 */

import { EQUIPMENT_SLOTS, CLOTHING_ITEMS } from "../data/equipmentSlots";
import clothingEquipment from "../data/clothingEquipment.json";
import { inferSlot } from "../data/shopItems";
import axiosInstance from "./axios";
import {
  resolveWeaponImpactVsArmor,
  pickPrimaryArmorSlot,
} from "./resolveWeaponImpactVsArmor.js";

export const ARMOR_BODY_SLOTS = ["head", "torso", "arms", "hands", "legs", "feet"];
export const ARMOR_LAYERS = ["base", "padding", "mail", "plate", "outer"];

const emptyLayerSet = () => ({
  base: null,
  padding: null,
  mail: null,
  plate: null,
  outer: null,
});

export function createEmptyWornEquipment() {
  return ARMOR_BODY_SLOTS.reduce((acc, slot) => {
    acc[slot] = emptyLayerSet();
    return acc;
  }, {});
}

export function createEmptyLayeredEquipment() {
  return {
    worn: createEmptyWornEquipment(),
    held: {
      mainHand: null,
      offHand: null,
      shield: null,
    },
  };
}

const nameOf = (item) => String(item?.name || item || "").toLowerCase();

export function inferEquipmentLayer(item) {
  const name = nameOf(item);
  const type = String(item?.type || item?.category || "").toLowerCase();

  if (name.includes("shield") || type.includes("shield")) return "shield";
  if (name.includes("surcoat") || name.includes("tabard") || name.includes("cloak") || name.includes("cape")) return "outer";
  if (name.includes("gambeson") || name.includes("padded") || name.includes("arming doublet")) return "padding";
  if (name.includes("plate mail") || name.includes("full plate") || name.includes("field plate") || name.includes("half plate")) return "plate";
  if (name.includes("chain") || name.includes("mail") || name.includes("hauberk") || name.includes("coif") || name.includes("voider") || name.includes("chausses")) return "mail";
  if (
    name.includes("plate") ||
    name.includes("breastplate") ||
    name.includes("cuirass") ||
    name.includes("greave") ||
    name.includes("gauntlet") ||
    name.includes("helm") ||
    name.includes("helmet") ||
    name.includes("sabatons")
  ) {
    return "plate";
  }

  return "base";
}

export function inferBodySlots(item) {
  const name = nameOf(item);
  const slot = String(item?.slot || "").toLowerCase();

  if (item?.bodySlots && Array.isArray(item.bodySlots)) return item.bodySlots;
  if (slot === "chest") return ["torso"];
  if (ARMOR_BODY_SLOTS.includes(slot)) return [slot];

  if (name.includes("shield")) return [];
  if (name.includes("helm") || name.includes("helmet") || name.includes("coif") || name.includes("hood") || name.includes("hat") || name.includes("cap")) return ["head"];
  if (name.includes("gauntlet") || name.includes("glove")) return ["hands"];
  if (name.includes("vambrace") || name.includes("bracer") || name.includes("sleeve") || name.includes("voider")) return ["arms"];
  if (name.includes("greave") || name.includes("chausses") || name.includes("pants") || name.includes("breeches") || name.includes("leggings") || name.includes("trousers")) return ["legs"];
  if (name.includes("boot") || name.includes("shoe") || name.includes("sandal") || name.includes("sabatons") || name.includes("sock")) return ["feet"];
  if (
    name.includes("breastplate") ||
    name.includes("cuirass") ||
    name.includes("hauberk") ||
    name.includes("chain mail") ||
    name.includes("plate mail") ||
    name.includes("armor") ||
    name.includes("armour") ||
    name.includes("gambeson") ||
    name.includes("robe") ||
    name.includes("shirt") ||
    name.includes("tunic") ||
    name.includes("dress") ||
    name.includes("surcoat") ||
    name.includes("tabard") ||
    name.includes("cloak") ||
    name.includes("cape")
  ) {
    return ["torso"];
  }

  return slot ? [slot] : ["torso"];
}

export function normalizeEquipmentItem(item) {
  if (!item) return null;
  const layer = item.layer || inferEquipmentLayer(item);
  const bodySlots = layer === "shield" ? [] : inferBodySlots(item);
  const guardRating = Number(item.guardRating ?? item.guardRating ?? item.guardRating ?? item.defense ?? 0) || 0;
  const armorDurability = Number(item.armorDurability ?? item.armorDurability ?? item.maxarmorDurability ?? item.currentarmorDurability ?? 0) || 0;

  return {
    ...item,
    name: item.name || "Unknown Equipment",
    equipmentType: layer === "shield" ? "shield" : guardRating > 0 ? "armor" : "clothing",
    layer,
    bodySlots,
    guardRating,
    guardRating: guardRating,
    armorDurability,
    currentarmorDurability: Number(item.currentarmorDurability ?? armorDurability) || 0,
    maxarmorDurability: Number(item.maxarmorDurability ?? armorDurability) || 0,
    weight: Number(item.weight ?? 0) || 0,
    price: Number(item.price ?? item.value ?? item.cost ?? 0) || 0,
    penalties: {
      speed: Number(item.penalties?.speed ?? item.speedPenalty ?? 0) || 0,
      prowl: Number(item.penalties?.prowl ?? item.prowlPenalty ?? 0) || 0,
      evade: Number(item.penalties?.evade ?? item.evadePenalty ?? 0) || 0,
    },
  };
}

const getWornRoot = (wornEquipment) => wornEquipment?.worn || wornEquipment || createEmptyWornEquipment();

export function canEquipLayer(wornEquipment, item) {
  const normalized = normalizeEquipmentItem(item);
  if (!normalized) return { ok: false, reason: "No item." };
  if (normalized.layer === "shield") return { ok: true, reason: "Shield is held, not worn." };

  const worn = getWornRoot(wornEquipment);
  for (const bodySlot of normalized.bodySlots) {
    const slotLayers = worn[bodySlot] || emptyLayerSet();
    if (slotLayers[normalized.layer]) {
      return { ok: false, reason: `${bodySlot} already has a ${normalized.layer} layer.` };
    }
    if (normalized.layer === "mail" && slotLayers.plate) {
      return { ok: false, reason: "Mail cannot be worn over plate." };
    }
    if (normalized.layer === "plate" && slotLayers.plate) {
      return { ok: false, reason: `${bodySlot} already has plate armor.` };
    }
  }

  return { ok: true, reason: "OK" };
}

export function equipLayer(wornEquipment, item) {
  const normalized = normalizeEquipmentItem(item);
  const worn = JSON.parse(JSON.stringify(getWornRoot(wornEquipment)));
  const check = canEquipLayer(worn, normalized);
  if (!check.ok || normalized.layer === "shield") {
    return { worn, equistaminad: false, reason: check.reason, item: normalized };
  }

  normalized.bodySlots.forEach((bodySlot) => {
    if (!worn[bodySlot]) worn[bodySlot] = emptyLayerSet();
    worn[bodySlot][normalized.layer] = normalized;
  });

  return { worn, equistaminad: true, reason: "OK", item: normalized };
}

export function removeLayer(wornEquipment, bodySlot, layer) {
  const worn = JSON.parse(JSON.stringify(getWornRoot(wornEquipment)));
  if (worn[bodySlot] && ARMOR_LAYERS.includes(layer)) {
    worn[bodySlot][layer] = null;
  }
  return worn;
}

function getLegacyEquistaminadEntries(entity) {
  const equistaminad = entity?.equistaminad || {};
  return Object.entries(equistaminad)
    .filter(([slot, item]) => item && !String(slot).toLowerCase().includes("weapon"))
    .map(([slot, item]) => ({ ...item, slot: slot === "chest" ? "torso" : item.slot || slot }));
}

const isWornSlotName = (slot) => {
  const normalizedSlot = String(slot || "").toLowerCase();
  return normalizedSlot === "chest" || ARMOR_BODY_SLOTS.includes(normalizedSlot);
};

function getExplicitlyWornLegacyItems(items = []) {
  if (!Array.isArray(items)) return [];

  return items.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const slot = item.slot || item.equipmentSlot || item.bodySlot;
    const hasWornSlot = isWornSlotName(slot);
    const explicitlyEquistaminad =
      item.equistaminad === true ||
      item.isEquistaminad === true ||
      item.worn === true ||
      (item.active === true && hasWornSlot);

    return explicitlyEquistaminad && (hasWornSlot || inferEquipmentLayer(item) === "shield");
  });
}

export function normalizeLegacyArmor(characterOrFighter) {
  const entity = { ...(characterOrFighter || {}) };
  const equipment = {
    ...createEmptyLayeredEquipment(),
    ...(entity.equipment || {}),
    worn: {
      ...createEmptyWornEquipment(),
      ...(entity.equipment?.worn || {}),
    },
    held: {
      mainHand: null,
      offHand: null,
      shield: null,
      ...(entity.equipment?.held || {}),
    },
  };

  const candidates = [
    ...getLegacyEquistaminadEntries(entity),
    entity.armor && typeof entity.armor === "object" ? entity.armor : null,
    entity.equistaminadArmor && typeof entity.equistaminadArmor === "object" ? entity.equistaminadArmor : null,
    ...getExplicitlyWornLegacyItems(entity.wardrobe),
    ...getExplicitlyWornLegacyItems(entity.inventory),
  ].filter(Boolean);

  candidates.forEach((candidate) => {
    const normalized = normalizeEquipmentItem(candidate);
    if (!normalized) return;
    if (normalized.layer === "shield") {
      equipment.held.shield = normalized;
      return;
    }
    const result = equipLayer(equipment.worn, normalized);
    if (result.equistaminad) equipment.worn = result.worn;
  });

  entity.equipment = equipment;
  return entity;
}

export function resolveArmorProfile(characterOrFighter) {
  const normalizedEntity = normalizeLegacyArmor(characterOrFighter);
  const worn = normalizedEntity.equipment?.worn || createEmptyWornEquipment();
  const shield = normalizedEntity.equipment?.held?.shield || null;
  const layers = {};
  const coverageBySlot = ARMOR_BODY_SLOTS.reduce((acc, slot) => ({ ...acc, [slot]: false }), {});
  const notes = [];
  let strongest = null;
  let totalArmorarmorDurability = 0;
  const penalties = { speed: 0, prowl: 0, evade: 0 };

  ARMOR_BODY_SLOTS.forEach((bodySlot) => {
    layers[bodySlot] = { ...(worn[bodySlot] || emptyLayerSet()) };
    ARMOR_LAYERS.forEach((layer) => {
      const item = layers[bodySlot]?.[layer];
      if (!item) return;
      const guardRating = Number(item.guardRating ?? item.guardRating ?? 0) || 0;
      const armorDurability = Number(item.currentarmorDurability ?? item.armorDurability ?? 0) || 0;
      if (guardRating > 0 || armorDurability > 0) coverageBySlot[bodySlot] = true;
      totalArmorarmorDurability += armorDurability;
      penalties.speed += Number(item.penalties?.speed ?? item.speedPenalty ?? 0) || 0;
      penalties.prowl += Number(item.penalties?.prowl ?? item.prowlPenalty ?? 0) || 0;
      penalties.evade += Number(item.penalties?.evade ?? item.evadePenalty ?? 0) || 0;
      if (guardRating > 0 && (!strongest || guardRating > strongest.guardRating)) {
        strongest = item;
      }
    });
  });

  const legacyGuardRating = Number(characterOrFighter?.guardRating ?? characterOrFighter?.guardRating ?? 0) || 0;
  const guardRating = Math.max(legacyGuardRating, strongest?.guardRating || 0);
  if (!strongest && legacyGuardRating > 0) notes.push("Using legacy guardRating; no layered armor item found.");

  return {
    guardRating,
    armorName: strongest?.name || (typeof characterOrFighter?.equistaminadArmor === "string" ? characterOrFighter.equistaminadArmor : ""),
    totalArmorarmorDurability,
    coverageBySlot,
    penalties,
    shield,
    layers,
    notes,
  };
}

export function syncLegacyArmorFields(characterOrFighter) {
  const entity = normalizeLegacyArmor(characterOrFighter);
  const armorProfile = resolveArmorProfile(entity);
  const synced = {
    ...entity,
    armorProfile,
    guardRating: armorProfile.guardRating || entity.guardRating || entity.guardRating || 10,
    guardRating: armorProfile.guardRating || entity.guardRating || entity.guardRating || 10,
  };

  if (armorProfile.armorName) {
    synced.equistaminadArmor = armorProfile.armorName;
  }

  const torsoLayers = armorProfile.layers?.torso || {};
  const torsoArmor = torsoLayers.plate || torsoLayers.mail || torsoLayers.padding || torsoLayers.base || null;
  if (torsoArmor) {
    synced.equistaminad = {
      ...(synced.equistaminad || {}),
      chest: torsoArmor,
      torso: synced.equistaminad?.torso || torsoArmor,
    };
  }

  return synced;
}

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

  // Check for guard rating (indicates armor)
  if (item.guardRating && item.guardRating > 0) {
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
  if (!character.equistaminad) {
    character.equistaminad = {};
  }

  // Initialize equipment slots if they don't exist
  Object.values(EQUIPMENT_SLOTS).forEach((slot) => {
    if (!character.equistaminad[slot]) {
      character.equistaminad[slot] = null;
    }
  });

  return character;
}

/**
 * Look up guard rating from item name
 * Handles name variations and matches from multiple data sources
 * @param {string} itemName - The name of the item
 * @returns {Object} { guardRating: number, armorDurability: number } or null if not found
 */
function lookupArmorRating(itemName) {
  if (!itemName) return null;

  // Normalize item name for matching (handle variations)
  const normalizedName = itemName.toLowerCase().trim();

  // Armor rating lookup table (from Medieval Combat Simulator rules and data files)
  // Handles name variations like "Gauntlets (Chain)" vs "Chain Gauntlets"
  const armorLookup = {
    // Gauntlets
    "gauntlets (chain)": { guardRating: 12, armorDurability: 30 }, // traderEquipment.js says 12
    "chain gauntlets": { guardRating: 12, armorDurability: 30 },
    "gauntlets (leather)": { guardRating: 6, armorDurability: 15 },
    "leather gauntlets": { guardRating: 6, armorDurability: 15 },
    "leather bracers": { guardRating: 6, armorDurability: 15 },
    "gauntlets (plate)": { guardRating: 16, armorDurability: 60 },
    "plate gauntlets": { guardRating: 16, armorDurability: 60 },

    // Full armor sets
    "padded armor": { guardRating: 5, armorDurability: 15 },
    "soft leather armor": { guardRating: 6, armorDurability: 20 },
    "hard leather armor": { guardRating: 8, armorDurability: 30 },
    "studded leather armor": { guardRating: 10, armorDurability: 35 },
    "ring mail armor": { guardRating: 12, armorDurability: 40 },
    "chain mail armor": { guardRating: 13, armorDurability: 45 },
    "chain armor": { guardRating: 13, armorDurability: 45 },
    "scale mail armor": { guardRating: 14, armorDurability: 55 },
    "splint mail armor": { guardRating: 15, armorDurability: 60 },
    "plate mail armor": { guardRating: 16, armorDurability: 70 },
    "plate armor": { guardRating: 16, armorDurability: 70 },
    "full plate armor": { guardRating: 17, armorDurability: 90 },

    // Helmets
    "leather cap": { guardRating: 4, armorDurability: 10 },
    "chain coif": { guardRating: 10, armorDurability: 25 },
    "plate helm": { guardRating: 14, armorDurability: 40 },

    // Boots
    "studded boots": { guardRating: 5, armorDurability: 15 },
    "iron sabatons": { guardRating: 14, armorDurability: 40 },
    "boots of swiftness": { guardRating: 8, armorDurability: 20 },
    "boots, knee-high": { guardRating: 0, armorDurability: 0 }, // Regular boots, no armor

    // Shields
    "shield, small wood": { guardRating: 10, armorDurability: 25 },
    "small shield": { guardRating: 10, armorDurability: 25 },
    "shield, large iron": { guardRating: 14, armorDurability: 50 },
    "large shield": { guardRating: 14, armorDurability: 50 },
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
  const equistaminad = { ...(character.equistaminad || {}) };
  const wardrobe = [...(character.wardrobe || [])];
  const inventory = [...(character.inventory || [])];

  // Check if slot already has an item
  const currentItem = equistaminad[slot];

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

  // Look up guard rating if not already set
  let guardRating = item.guardRating || item.defense || 0;
  let armorDurability = item.armorDurability || 0;

  // If guard rating is 0 or missing, try to look it up from item name
  if (!guardRating && item.name) {
    const armorData = lookupArmorRating(item.name);
    if (armorData) {
      guardRating = armorData.guardRating;
      armorDurability = armorData.armorDurability || armorDurability;
    }
  }

  // Equip the new item
  equistaminad[slot] = {
    name: item.name,
    weight: item.weight || 0,
    guardRating: guardRating,
    armorDurability: armorDurability,
    currentarmorDurability: armorDurability, // Track current armorDurability for damage
    price: item.price || item.value || 0,
    category: item.category || "Clothing",
    type: item.type || "clothing",
    description: item.description || "",
    slot: slot,
    broken: false, // Track if armor is broken (armorDurability = 0)
  };

  // Return only the fields that changed
  return {
    equistaminad,
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
  const equistaminad = { ...(character.equistaminad || {}) };
  const wardrobe = [...(character.wardrobe || [])];

  const item = equistaminad[slot];
  if (item) {
    // Add item back to wardrobe
    wardrobe.push(item);
    // Remove from equistaminad
    equistaminad[slot] = null;
  }

  // Return only the fields that changed
  return {
    equistaminad,
    wardrobe,
  };
}

/**
 * Fix guard ratings for already-equistaminad items
 * This corrects items that were equistaminad without proper guard rating lookup
 * @param {Object} character - Character object
 * @returns {Object} Updated character with corrected guard ratings
 */
export function fixEquistaminadArmorRatings(character) {
  const updatedCharacter = { ...character };
  const equistaminad = { ...(updatedCharacter.equistaminad || {}) };
  let needsUpdate = false;

  Object.entries(equistaminad).forEach(([slot, item]) => {
    if (item && item.name) {
      // Check if guard rating is missing or 0 for armor items
      const armorData = lookupArmorRating(item.name);
      if (armorData && armorData.guardRating > 0) {
        // If current guardRating is 0 but should have guardRating, fix it
        if (!item.guardRating || item.guardRating === 0) {
          equistaminad[slot] = {
            ...item,
            guardRating: armorData.guardRating,
            armorDurability: armorData.armorDurability || item.armorDurability || 0,
            currentarmorDurability: armorData.armorDurability || item.currentarmorDurability || item.armorDurability || 0,
          };
          needsUpdate = true;
        }
      }
    }
  });

  if (needsUpdate) {
    updatedCharacter.equistaminad = equistaminad;
  }

  return updatedCharacter;
}

/**
 * Get equipment display info for UI
 * @param {Object} character - Character object
 * @returns {Object} Equipment display info
 */
export function getEquipmentDisplayInfo(character) {
  const equistaminad = character.equistaminad || {};

  return {
    head: equistaminad.head || {
      name: "None",
      guardRating: 0,
      currentarmorDurability: 0,
      type: "none",
    },
    torso: equistaminad.torso || {
      name: "None",
      guardRating: 0,
      currentarmorDurability: 0,
      type: "none",
    },
    legs: equistaminad.legs || {
      name: "None",
      guardRating: 0,
      currentarmorDurability: 0,
      type: "none",
    },
    feet: equistaminad.feet || {
      name: "None",
      guardRating: 0,
      currentarmorDurability: 0,
      type: "none",
    },
    hands: equistaminad.hands || {
      name: "None",
      guardRating: 0,
      currentarmorDurability: 0,
      type: "none",
    },
    back: equistaminad.back || {
      name: "None",
      guardRating: 0,
      currentarmorDurability: 0,
      type: "none",
    },
    waist: equistaminad.waist || {
      name: "None",
      guardRating: 0,
      currentarmorDurability: 0,
      type: "none",
      capacity: 0,
    },
    hasEquipment: Object.values(equistaminad).some(
      (item) => item && item.name !== "None"
    ),
  };
}

/**
 * Get total guard rating from equistaminad items
 * @param {Object} character - Character object
 * @returns {Number} Total guard rating (highest Guard Rating from any piece, for this armor system)
 */
export function getTotalArmorRating(character) {
  return resolveArmorProfile(character).guardRating || 0;
}

/**
 * Get total weight from equistaminad items
 * @param {Object} character - Character object
 * @returns {Number} Total weight
 */
export function getTotalEquistaminadWeight(character) {
  const equistaminad = character.equistaminad || {};
  return Object.values(equistaminad).reduce((total, item) => {
    if (item && item.weight) {
      return total + item.weight;
    }
    return total;
  }, 0);
}

/**
 * Calculate movement penalties from armor weight (Medieval Combat Simulator 1994 rules)
 * @param {Object} character - Character object
 * @returns {Object} Movement penalties
 */
export function calculateArmorPenalties(character) {
  const totalWeight = getTotalEquistaminadWeight(character);
  const equistaminad = character.equistaminad || {};

  // Medieval Combat Simulator rule: -1 Speed per 10 lbs of armor
  const speedPenalty = Math.floor(totalWeight / 10);

  // Check for heavy armor penalties
  const hasHeavyArmor = Object.values(equistaminad).some(
    (item) => item && (item.type === "heavy" || item.type === "heavy armor")
  );

  // Heavy armor may reduce Prowl/Evade by 10% or more
  const prowlPenalty = hasHeavyArmor ? 10 : 0;
  const evadePenalty = hasHeavyArmor ? 10 : 0;

  return {
    speedPenalty,
    prowlPenalty,
    evadePenalty,
    totalWeight,
  };
}

/**
 * Get carrying capacity bonus from equistaminad containers
 * @param {Object} character - Character object
 * @returns {number} Carrying capacity bonus in pounds
 */
export function getContainerCapacityBonus(character) {
  if (!character.equistaminad || typeof character.equistaminad !== "object") {
    return 0;
  }

  let bonus = 0;

  // Check each equistaminad item for container capacity bonuses
  Object.values(character.equistaminad).forEach((item) => {
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
        "Water skin (ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½ gallon)": 0,
        "Tobacco pouch": 1,
      };

      bonus += containerBonuses[item.name] || 0;
    }
  });

  // Check waist equipment for storage capacity (belts, sheaths, etc.)
  const waistItem = character.equistaminad?.waist;
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
      // Sort by guard rating (defense), then by value
      const bestItem = items.sort((a, b) => {
        const aDefense = a.defense || a.guardRating || 0;
        const bDefense = b.defense || b.guardRating || 0;
        if (aDefense !== bDefense) {
          return bDefense - aDefense;
        }
        return (b.price || b.value || 0) - (a.price || a.value || 0);
      })[0];

      updatedCharacter.equistaminad[slot] = {
        name: bestItem.name,
        weight: bestItem.weight || 0,
        defense: bestItem.defense || bestItem.guardRating || 0,
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
 * Calculate armor vs HP damage using centralized attack-vs-guardRating rules.
 * @param {Object} character - Character object
 * @param {number} attackTotal - d20 + attack bonuses (same as engine "total to hit")
 * @param {number} damage - The damage dealt
 * @param {string|null} targetSlot - Armor slot under character.equistaminad (optional)
 * @param {{ isCrit?: boolean, isFumble?: boolean }} [opts]
 */
export function calculateArmorDamage(
  character,
  attackTotal,
  damage,
  targetSlot = null,
  opts = {}
) {
  const { isCrit = false, isFumble = false } = opts;
  const result = {
    armorHit: false,
    armorDamaged: false,
    characterDamaged: false,
    damageToArmor: 0,
    damageToCharacter: 0,
    brokenArmor: [],
  };

  const slot = pickPrimaryArmorSlot(
    character,
    typeof targetSlot === "string" && targetSlot ? targetSlot : null
  );
  const impact = resolveWeaponImpactVsArmor({
    defender: character,
    attackTotal,
    damage,
    slot,
    isCrit,
    isFumble,
  });

  if (impact.outcome === "miss") {
    return result;
  }

  if (impact.outcome === "armor" && impact.armor) {
    const piece = impact.armor;
    piece.currentarmorDurability = impact.nextArmorarmorDurability;
    if (impact.armorBroken) {
      piece.broken = true;
      result.brokenArmor.push({ slot: impact.slot, name: piece.name });
      result.armorDamaged = true;
    }
    result.armorHit = true;
    result.damageToArmor = impact.damageToArmor;
    return result;
  }

  result.characterDamaged = true;
  result.damageToCharacter = impact.damageToHP ?? damage;
  return result;
}

/**
 * Repair armor piece
 * @param {Object} character - Character object
 * @param {string} slot - The armor slot to repair
 * @param {number} repairAmount - Amount of armorDurability to restore
 * @returns {Object} Updated character
 */
export function repairArmor(character, slot, repairAmount) {
  const updatedCharacter = { ...character };
  const equistaminad = { ...updatedCharacter.equistaminad };

  if (equistaminad[slot] && equistaminad[slot].armorDurability) {
    equistaminad[slot].currentarmorDurability = Math.min(
      equistaminad[slot].armorDurability,
      equistaminad[slot].currentarmorDurability + repairAmount
    );

    // If fully repaired, mark as not broken
    if (equistaminad[slot].currentarmorDurability > 0) {
      equistaminad[slot].broken = false;
    }
  }

  updatedCharacter.equistaminad = equistaminad;
  return updatedCharacter;
}

/**
 * Get total armorDurability from all equistaminad armor
 * @param {Object} character - Character object
 * @returns {Number} Total current armorDurability
 */
export function getTotalArmorarmorDurability(character) {
  const equistaminad = character.equistaminad || {};
  return Object.values(equistaminad).reduce((total, item) => {
    if (item && item.currentarmorDurability && !item.broken) {
      return total + item.currentarmorDurability;
    }
    return total;
  }, 0);
}

/**
 * Calculate repair cost for armor (Medieval Combat Simulator 1994 rules)
 * @param {Object} armorItem - The armor item to repair
 * @param {number} repairAmount - Amount of armorDurability to restore
 * @returns {number} Repair cost in gold pieces
 */
export function calculateRepairCost(armorItem, repairAmount) {
  if (!armorItem || !armorItem.price || repairAmount <= 0) {
    return 0;
  }

  // Medieval Combat Simulator rule: 10-25% of item value per 10 armorDurability repaired
  const repairRate = 0.15; // Use 15% as middle ground
  const armorDurabilityUnits = Math.ceil(repairAmount / 10); // Round up to nearest 10 armorDurability

  return Math.ceil(armorItem.price * repairRate * armorDurabilityUnits);
}

/**
 * Get repair cost for all damaged armor
 * @param {Object} character - Character object
 * @returns {Object} Repair costs by slot
 */
export function getRepairCosts(character) {
  const equistaminad = character.equistaminad || {};
  const repairCosts = {};

  Object.entries(equistaminad).forEach(([slot, item]) => {
    if (item && item.armorDurability && item.currentarmorDurability < item.armorDurability) {
      const damageAmount = item.armorDurability - item.currentarmorDurability;
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
 * Check if an item is currently equistaminad
 * @param {Object} character - Character object
 * @param {Object} item - Item to check
 * @returns {boolean} True if item is equistaminad
 */
export function isItemEquistaminad(character, item) {
  if (!character || !item || !character.equistaminad) return false;

  const equistaminad = character.equistaminad;

  // Check if item is equistaminad in any equipment slot
  for (const [slot, equistaminadItem] of Object.entries(equistaminad)) {
    if (equistaminadItem && equistaminadItem.name === item.name) {
      return true;
    }
  }

  // Check if item is equistaminad as a weapon
  if (character.equistaminadWeapons && Array.isArray(character.equistaminadWeapons)) {
    return character.equistaminadWeapons.some(
      (weapon) => weapon.name === item.name
    );
  }

  return false;
}

