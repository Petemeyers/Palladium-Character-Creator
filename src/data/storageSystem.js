/**
 * Storage and Housing System - Based on 1994 Palladium Fantasy RPG Rules
 * Handles character storage, housing costs, and property ownership
 */

export const STORAGE_TYPES = {
  // Personal Storage (carried)
  BACKPACK: {
    name: "Backpack",
    capacity: 40, // lbs
    costPerMonth: 0,
    risk: "low",
    type: "carried",
    description: "Canvas pack worn on the back. Portable but limited capacity.",
  },

  BELT_POUCH: {
    name: "Belt Pouch",
    capacity: 5, // lbs
    costPerMonth: 0,
    risk: "low",
    type: "carried",
    description:
      "Small leather pouch worn on the belt. Fast access to essentials.",
  },

  // Temporary Storage
  INN_ROOM: {
    name: "Inn Room Storage",
    capacity: 200, // lbs
    costPerMonth: 15, // gp
    risk: "medium",
    type: "temporary",
    description: "Secure storage room at a local inn. Safe but expensive.",
  },

  INN_LOCKER: {
    name: "Inn Locker",
    capacity: 100, // lbs
    costPerMonth: 5, // gp
    risk: "medium",
    type: "temporary",
    description: "Small locker at an inn. Basic security for travelers.",
  },

  GUILD_STORAGE: {
    name: "Guild Storage",
    capacity: 300, // lbs
    costPerMonth: 10, // gp (membership required)
    risk: "low",
    type: "guild",
    description: "Secure storage for guild members. Requires membership.",
  },

  TEMPLE_STORAGE: {
    name: "Temple Storage",
    capacity: 250, // lbs
    costPerMonth: 8, // gp (donation)
    risk: "low",
    type: "religious",
    description: "Sacred storage at a temple. Requires faith and donations.",
  },

  // Permanent Storage
  RENTED_WAREHOUSE: {
    name: "Rented Warehouse",
    capacity: 1000, // lbs
    costPerMonth: 25, // gp
    risk: "medium",
    type: "commercial",
    description: "Large commercial storage space. Good for merchants.",
  },

  SMALL_HOUSE: {
    name: "Small House",
    capacity: 2000, // lbs
    costPerMonth: 50, // gp (upkeep)
    purchaseCost: 1500, // gp
    risk: "low",
    type: "owned",
    description: "Modest dwelling with basic storage. Your first home!",
  },

  STONE_TOWNHOUSE: {
    name: "Stone Townhouse",
    capacity: 4000, // lbs
    costPerMonth: 100, // gp (upkeep)
    purchaseCost: 4000, // gp
    risk: "low",
    type: "owned",
    description: "Sturdy stone house in town. Excellent security.",
  },

  MANOR_HOUSE: {
    name: "Manor House",
    capacity: 8000, // lbs
    costPerMonth: 200, // gp (upkeep + servants)
    purchaseCost: 10000, // gp
    risk: "low",
    type: "owned",
    description: "Luxurious manor with servants and guards.",
  },

  WIZARD_TOWER: {
    name: "Wizard Tower",
    capacity: 6000, // lbs
    costPerMonth: 150, // gp (upkeep + magical maintenance)
    purchaseCost: 8000, // gp
    risk: "low",
    type: "owned",
    description: "Magical tower with enhanced security and storage.",
  },

  THIEF_SAFEHOUSE: {
    name: "Thief Safehouse",
    capacity: 1500, // lbs
    costPerMonth: 30, // gp (discretion fee)
    purchaseCost: 2000, // gp
    risk: "low", // Hidden location
    type: "owned",
    description: "Hidden safehouse with secret entrances.",
  },

  // Magical Storage (from Palladium rules)
  DIMENSIONAL_POCKET: {
    name: "Dimensional Pocket",
    capacity: 200, // lbs
    costPerMonth: 0,
    purchaseCost: 5000, // gp (magical item)
    risk: "low",
    type: "magical",
    description: "Magical extradimensional space. Portable and secure.",
  },

  WEIGHTLESS_SACK: {
    name: "Weightless Sack",
    capacity: 300, // lbs (weightless, but size limited)
    costPerMonth: 0,
    purchaseCost: 3000, // gp (magical item)
    risk: "low",
    type: "magical",
    description: "Magical sack that makes contents weightless.",
  },

  // Hidden/Secret Storage
  HIDDEN_CACHE: {
    name: "Hidden Cache",
    capacity: 300, // lbs
    costPerMonth: 0,
    risk: "high",
    type: "hidden",
    description: "Secret buried or hidden storage. Free but risky.",
  },

  BURIED_TREASURE: {
    name: "Buried Treasure",
    capacity: 500, // lbs
    costPerMonth: 0,
    risk: "high",
    type: "hidden",
    description: "Deep buried cache. Hard to find but vulnerable.",
  },
};

export const HOUSING_COSTS = {
  // Monthly living costs (from Palladium rules)
  PEASANT: { cost: 10, description: "Peasant or beggar lifestyle" },
  TRADESMAN: { cost: 35, description: "Tradesman or soldier lifestyle" },
  MIDDLE_CLASS: { cost: 150, description: "Middle-class townhouse lifestyle" },
  NOBLE: { cost: 500, description: "Manor, keep, or stronghold lifestyle" },
};

export const PROPERTY_UPKEEP = {
  // Monthly upkeep costs (1-2% of property value)
  SMALL_HOUSE: { upkeep: 50, servants: 0, guards: 0 },
  STONE_TOWNHOUSE: { upkeep: 100, servants: 2, guards: 1 },
  MANOR_HOUSE: { upkeep: 200, servants: 5, guards: 3 },
  WIZARD_TOWER: { upkeep: 150, servants: 2, guards: 2, magical: 50 },
  THIEF_SAFEHOUSE: { upkeep: 30, servants: 0, guards: 0 },
};

export const MAGICAL_STORAGE_ITEMS = {
  DIMENSIONAL_POCKET: {
    name: "Dimensional Pocket",
    capacity: 200,
    weight: 0,
    price: 5000,
    description: "Creates a small extradimensional space for storage",
    magical: true,
    savingThrow: "vs Magic 16+ to survive destruction",
  },

  WEIGHTLESS_SACK: {
    name: "Weightless Sack",
    capacity: 300,
    weight: 1,
    price: 3000,
    description: "Makes all contents weightless but size-limited",
    magical: true,
    savingThrow: "vs Magic 14+ to survive destruction",
  },

  BAG_OF_HOLDING: {
    name: "Bag of Holding",
    capacity: 500,
    weight: 2,
    price: 8000,
    description: "Large extradimensional storage bag",
    magical: true,
    savingThrow: "vs Magic 18+ to survive destruction",
  },
};

export default {
  STORAGE_TYPES,
  HOUSING_COSTS,
  PROPERTY_UPKEEP,
  MAGICAL_STORAGE_ITEMS,
};
