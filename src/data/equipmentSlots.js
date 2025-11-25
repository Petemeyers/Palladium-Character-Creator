/**
 * Equipment Slot System for Palladium Fantasy RPG
 * Defines wearable slots and equipment categories
 */

// Equipment slot definitions
export const EQUIPMENT_SLOTS = {
  HEAD: "head",
  TORSO: "torso",
  LEGS: "legs",
  FEET: "feet",
  HANDS: "hands",
  BACK: "back",
  WAIST: "waist",
  NECK: "neck",
  RING_LEFT: "ringLeft",
  RING_RIGHT: "ringRight",
  WEAPON_PRIMARY: "weaponPrimary",
  WEAPON_SECONDARY: "weaponSecondary",
  SHIELD: "shield",
};

// Slot display names
export const SLOT_NAMES = {
  [EQUIPMENT_SLOTS.HEAD]: "Head",
  [EQUIPMENT_SLOTS.TORSO]: "Torso",
  [EQUIPMENT_SLOTS.LEGS]: "Legs",
  [EQUIPMENT_SLOTS.FEET]: "Feet",
  [EQUIPMENT_SLOTS.HANDS]: "Hands",
  [EQUIPMENT_SLOTS.BACK]: "Back",
  [EQUIPMENT_SLOTS.WAIST]: "Waist",
  [EQUIPMENT_SLOTS.NECK]: "Neck",
  [EQUIPMENT_SLOTS.RING_LEFT]: "Left Ring",
  [EQUIPMENT_SLOTS.RING_RIGHT]: "Right Ring",
  [EQUIPMENT_SLOTS.WEAPON_PRIMARY]: "Main Hand",
  [EQUIPMENT_SLOTS.WEAPON_SECONDARY]: "Off Hand",
  [EQUIPMENT_SLOTS.SHIELD]: "Shield",
};

// Clothing/equipment item types
export const CLOTHING_ITEMS = {
  // Head
  HAT: { name: "Hat", slot: EQUIPMENT_SLOTS.HEAD, weight: 0.5 },
  HOOD: { name: "Hood", slot: EQUIPMENT_SLOTS.HEAD, weight: 0.3 },
  HELMET: { name: "Helmet", slot: EQUIPMENT_SLOTS.HEAD, weight: 3 },
  WIZARD_HAT: {
    name: "Wizard Hat (Large Brim)",
    slot: EQUIPMENT_SLOTS.HEAD,
    weight: 0.5,
  },

  // Torso
  ROBE_LIGHT: { name: "Robe (Light)", slot: EQUIPMENT_SLOTS.TORSO, weight: 2 },
  ROBE_HEAVY: { name: "Robe (Heavy)", slot: EQUIPMENT_SLOTS.TORSO, weight: 4 },
  SHIRT: { name: "Shirt", slot: EQUIPMENT_SLOTS.TORSO, weight: 1 },
  TUNIC: { name: "Tunic", slot: EQUIPMENT_SLOTS.TORSO, weight: 1.5 },
  LEATHER_ARMOR: {
    name: "Soft Leather Armor",
    slot: EQUIPMENT_SLOTS.TORSO,
    weight: 8,
    defense: 10,
  },
  CHAIN_MAIL: {
    name: "Chain Mail",
    slot: EQUIPMENT_SLOTS.TORSO,
    weight: 25,
    defense: 13,
  },
  PLATE_ARMOR: {
    name: "Plate Armor",
    slot: EQUIPMENT_SLOTS.TORSO,
    weight: 40,
    defense: 16,
  },

  // Legs
  PANTS: { name: "Pants", slot: EQUIPMENT_SLOTS.LEGS, weight: 1 },
  TROUSERS: { name: "Trousers", slot: EQUIPMENT_SLOTS.LEGS, weight: 1.5 },
  SKIRT: { name: "Skirt", slot: EQUIPMENT_SLOTS.LEGS, weight: 1 },
  KILT: { name: "Kilt", slot: EQUIPMENT_SLOTS.LEGS, weight: 1.2 },

  // Feet
  BOOTS: { name: "Boots", slot: EQUIPMENT_SLOTS.FEET, weight: 2 },
  BOOTS_KNEE_HIGH: {
    name: "Boots (Knee-High)",
    slot: EQUIPMENT_SLOTS.FEET,
    weight: 3,
  },
  SANDALS: { name: "Sandals", slot: EQUIPMENT_SLOTS.FEET, weight: 0.5 },
  SHOES: { name: "Shoes", slot: EQUIPMENT_SLOTS.FEET, weight: 1 },

  // Hands
  GLOVES: { name: "Gloves", slot: EQUIPMENT_SLOTS.HANDS, weight: 0.5 },
  GAUNTLETS: { name: "Gauntlets", slot: EQUIPMENT_SLOTS.HANDS, weight: 2 },

  // Back
  CLOAK: { name: "Cloak", slot: EQUIPMENT_SLOTS.BACK, weight: 2 },
  CAPE: { name: "Cape (Long, Hooded)", slot: EQUIPMENT_SLOTS.BACK, weight: 3 },
  BACKPACK: { name: "Backpack", slot: EQUIPMENT_SLOTS.BACK, weight: 2 },

  // Waist
  BELT: { name: "Belt", slot: EQUIPMENT_SLOTS.WAIST, weight: 0.5 },
  SASH: { name: "Sash", slot: EQUIPMENT_SLOTS.WAIST, weight: 0.3 },
  BELT_ORNATE: {
    name: "Belt (Ornate)",
    slot: EQUIPMENT_SLOTS.WAIST,
    weight: 1,
  },

  // Neck
  SCARF: { name: "Scarf", slot: EQUIPMENT_SLOTS.NECK, weight: 0.2 },
  AMULET: { name: "Amulet", slot: EQUIPMENT_SLOTS.NECK, weight: 0.1 },
  NECKLACE: { name: "Necklace", slot: EQUIPMENT_SLOTS.NECK, weight: 0.1 },
};

// Initialize empty equipment slots
export function initializeEquipmentSlots() {
  return {
    [EQUIPMENT_SLOTS.HEAD]: null,
    [EQUIPMENT_SLOTS.TORSO]: null,
    [EQUIPMENT_SLOTS.LEGS]: null,
    [EQUIPMENT_SLOTS.FEET]: null,
    [EQUIPMENT_SLOTS.HANDS]: null,
    [EQUIPMENT_SLOTS.BACK]: null,
    [EQUIPMENT_SLOTS.WAIST]: null,
    [EQUIPMENT_SLOTS.NECK]: null,
    [EQUIPMENT_SLOTS.RING_LEFT]: null,
    [EQUIPMENT_SLOTS.RING_RIGHT]: null,
    [EQUIPMENT_SLOTS.WEAPON_PRIMARY]: null,
    [EQUIPMENT_SLOTS.WEAPON_SECONDARY]: null,
    [EQUIPMENT_SLOTS.SHIELD]: null,
  };
}

// Check if an item can be equipped in a slot
export function canEquipInSlot(item, slot) {
  if (!item || !item.slot) return false;
  return item.slot === slot;
}

// Get total weight of equipped items
export function getTotalEquippedWeight(equipped) {
  let total = 0;
  Object.values(equipped).forEach((item) => {
    if (item && item.weight) {
      total += item.weight;
    }
  });
  return total;
}

// Get total armor rating from equipped items
export function getTotalArmorRating(equipped) {
  let total = 0;
  Object.values(equipped).forEach((item) => {
    if (item && item.defense) {
      total += item.defense;
    }
  });
  return total;
}
