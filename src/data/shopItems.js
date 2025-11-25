/**
 * Shop Items Database - Imported from backend for frontend use
 * This allows the character creator to reference real shop prices and items
 */

export const shopItems = [
  // Clothing
  { id: 1, name: "Socks", price: 0.5, category: "Clothing", weight: 0.1 },
  { id: 2, name: "Shirt (Wool)", price: 6, category: "Clothing", weight: 1 },
  { id: 3, name: "Shirt (Silk)", price: 15, category: "Clothing", weight: 0.8 },
  { id: 4, name: "Vest", price: 15, category: "Clothing", weight: 1 },
  { id: 5, name: "Jacket (Light)", price: 20, category: "Clothing", weight: 2 },
  { id: 6, name: "Jacket (Heavy)", price: 40, category: "Clothing", weight: 3 },
  {
    id: 7,
    name: "Jacket (Leather)",
    price: 40,
    category: "Clothing",
    weight: 3,
  },
  {
    id: 8,
    name: "Jacket, Fur (Common, Heavy)",
    price: 70,
    category: "Clothing",
    weight: 5,
  },
  { id: 11, name: "Pants", price: 12, category: "Clothing", weight: 1 },
  { id: 12, name: "Work Pants", price: 16, category: "Clothing", weight: 1.5 },
  { id: 13, name: "Skirt", price: 10, category: "Clothing", weight: 1 },
  {
    id: 14,
    name: "Dress (Common)",
    price: 30,
    category: "Clothing",
    weight: 2,
  },
  {
    id: 15,
    name: "Dress (Fancy)",
    price: 60,
    category: "Clothing",
    weight: 2.5,
  },
  { id: 16, name: "Surcoat", price: 40, category: "Clothing", weight: 2 },
  {
    id: 17,
    name: "Boots (Cloth)",
    price: 8,
    category: "Clothing",
    weight: 1.5,
  },
  {
    id: 18,
    name: "Boots (Soft Leather)",
    price: 15,
    category: "Clothing",
    weight: 2,
  },
  {
    id: 19,
    name: "Boots (Leather)",
    price: 20,
    category: "Clothing",
    weight: 2,
  },
  {
    id: 20,
    name: "Boots (Work/Reinforced)",
    price: 30,
    category: "Clothing",
    weight: 3,
  },
  {
    id: 21,
    name: "Boots, Knee-High",
    price: 50,
    category: "Clothing",
    weight: 3,
  },
  {
    id: 22,
    name: "Boots, Hip-High",
    price: 70,
    category: "Clothing",
    weight: 4,
  },
  { id: 23, name: "Shoes", price: 20, category: "Clothing", weight: 1 },
  { id: 24, name: "Sandals", price: 10, category: "Clothing", weight: 0.5 },
  { id: 25, name: "Scarf", price: 5, category: "Clothing", weight: 0.2 },
  {
    id: 26,
    name: "Cap (Pull Over)",
    price: 5,
    category: "Clothing",
    weight: 0.3,
  },
  {
    id: 27,
    name: "Hat (Short Brim)",
    price: 15,
    category: "Clothing",
    weight: 0.5,
  },
  {
    id: 28,
    name: "Hat (Large Brim)",
    price: 20,
    category: "Clothing",
    weight: 0.5,
  },
  {
    id: 29,
    name: "Hat (Large Brim, Leather)",
    price: 35,
    category: "Clothing",
    weight: 0.8,
  },
  { id: 30, name: "Belt", price: 4, category: "Clothing", weight: 0.5 },
  { id: 31, name: "Sword Belt", price: 6, category: "Clothing", weight: 0.8 },
  { id: 32, name: "Sword Sheath", price: 18, category: "Clothing", weight: 1 },
  {
    id: 33,
    name: "Knife Sheath",
    price: 10,
    category: "Clothing",
    weight: 0.5,
  },
  { id: 34, name: "Cape (Short)", price: 15, category: "Clothing", weight: 2 },
  { id: 35, name: "Cape (Long)", price: 25, category: "Clothing", weight: 3 },
  {
    id: 36,
    name: "Cape (Long, Hooded)",
    price: 35,
    category: "Clothing",
    weight: 3,
  },
  { id: 37, name: "Robe (Light)", price: 20, category: "Clothing", weight: 2 },
  { id: 38, name: "Robe (Heavy)", price: 40, category: "Clothing", weight: 4 },
  { id: 39, name: "Gloves", price: 8, category: "Clothing", weight: 0.3 },
  {
    id: 40,
    name: "Gauntlets (Leather)",
    price: 20,
    category: "Clothing",
    weight: 1,
  },
  {
    id: 41,
    name: "Gauntlets (Chain)",
    price: 40,
    category: "Clothing",
    weight: 2,
  },
  { id: 42, name: "Hood", price: 8, category: "Clothing", weight: 0.3 },
  { id: 43, name: "Cloak (Short)", price: 18, category: "Clothing", weight: 2 },
  { id: 44, name: "Cloak (Long)", price: 30, category: "Clothing", weight: 3 },
  { id: 45, name: "Tunic", price: 12, category: "Clothing", weight: 1.5 },

  // Containers
  { id: 50, name: "Belt purse", price: 2, category: "Containers", weight: 0.2 },
  { id: 51, name: "Small sack", price: 4, category: "Containers", weight: 0.3 },
  { id: 52, name: "Large sack", price: 8, category: "Containers", weight: 0.5 },
  { id: 53, name: "Backpack", price: 20, category: "Containers", weight: 2 },
  {
    id: 54,
    name: "Water skin (2 pints)",
    price: 5,
    category: "Containers",
    weight: 0.5,
  },

  // Weapons
  {
    id: 200,
    name: "Knife",
    price: 10,
    category: "Weapons",
    weight: 1,
    damage: "1d4",
  },
  {
    id: 201,
    name: "Dagger",
    price: 25,
    category: "Weapons",
    weight: 2,
    damage: "1d4",
  },
  {
    id: 202,
    name: "Short Sword",
    price: 50,
    category: "Weapons",
    weight: 3,
    damage: "1d6",
  },
  {
    id: 203,
    name: "Long Sword",
    price: 100,
    category: "Weapons",
    weight: 5,
    damage: "2d6",
  },
  {
    id: 204,
    name: "Battle Axe",
    price: 80,
    category: "Weapons",
    weight: 8,
    damage: "2d6",
  },
  {
    id: 205,
    name: "Lance",
    price: 120,
    category: "Weapons",
    weight: 10,
    damage: "2d6+2",
  },
  {
    id: 206,
    name: "Bow",
    price: 80,
    category: "Weapons",
    weight: 2,
    damage: "1d6",
  },
  {
    id: 207,
    name: "Arrows (20)",
    price: 20,
    category: "Ammunition",
    weight: 2,
  },
  {
    id: 208,
    name: "Staff",
    price: 25,
    category: "Weapons",
    weight: 4,
    damage: "1d6",
  },

  // Equipment
  {
    id: 300,
    name: "Holy Symbol",
    price: 20,
    category: "Equipment",
    weight: 0.2,
  },
  { id: 301, name: "Rope (50ft)", price: 15, category: "Equipment", weight: 5 },
  { id: 302, name: "Rations (1 week)", price: 10, category: "Food", weight: 5 },
  { id: 303, name: "Candle", price: 1, category: "Lighting", weight: 0.1 },
  { id: 304, name: "Lockpicks", price: 25, category: "Tools", weight: 0.5 },
  { id: 305, name: "Bedroll", price: 8, category: "Camping", weight: 3 },
  { id: 306, name: "Waterskin", price: 5, category: "Containers", weight: 1 },
  {
    id: 307,
    name: "Spellbook (Blank)",
    price: 50,
    category: "Writing Equipment",
    weight: 3,
  },
  {
    id: 308,
    name: "Ink and Quill",
    price: 8,
    category: "Writing Equipment",
    weight: 0.5,
  },
  {
    id: 309,
    name: "Component Pouch",
    price: 15,
    category: "Equipment",
    weight: 1,
  },
  { id: 310, name: "Candles (5)", price: 3, category: "Lighting", weight: 0.5 },
  {
    id: 311,
    name: "Chalk",
    price: 2,
    category: "Writing Equipment",
    weight: 0.3,
  },
  { id: 312, name: "Incense", price: 5, category: "Equipment", weight: 0.5 },
  { id: 313, name: "Holy Water", price: 20, category: "Equipment", weight: 1 },
  { id: 314, name: "Bandages", price: 5, category: "Equipment", weight: 0.5 },
  {
    id: 315,
    name: "Bandages (10)",
    price: 10,
    category: "Equipment",
    weight: 1,
  },
  {
    id: 316,
    name: "Polish Cloth",
    price: 2,
    category: "Equipment",
    weight: 0.2,
  },
  {
    id: 317,
    name: "Rations (2 weeks)",
    price: 20,
    category: "Food",
    weight: 10,
  },
  { id: 318, name: "Prayer Book", price: 25, category: "Equipment", weight: 2 },
  { id: 319, name: "Poison Vial", price: 50, category: "Tools", weight: 0.1 },
  { id: 320, name: "Disguise Kit", price: 40, category: "Tools", weight: 3 },
  {
    id: 321,
    name: "Ritual Dagger",
    price: 30,
    category: "Weapons",
    weight: 1,
    damage: "1d4",
  },
  {
    id: 322,
    name: "Summoning Chalk",
    price: 15,
    category: "Equipment",
    weight: 1,
  },
  {
    id: 323,
    name: "Binding Runes",
    price: 25,
    category: "Equipment",
    weight: 0.5,
  },
  {
    id: 324,
    name: "Blood Vial",
    price: 20,
    category: "Equipment",
    weight: 0.2,
  },
  {
    id: 325,
    name: "Potion Vials (3)",
    price: 10,
    category: "Equipment",
    weight: 0.5,
  },
  { id: 326, name: "Herbs Bundle", price: 8, category: "Equipment", weight: 1 },
  {
    id: 327,
    name: "Small Cauldron",
    price: 30,
    category: "Equipment",
    weight: 5,
  },
  {
    id: 328,
    name: "Meditation Mat",
    price: 15,
    category: "Equipment",
    weight: 2,
  },
  {
    id: 329,
    name: "Focus Crystal",
    price: 60,
    category: "Equipment",
    weight: 0.3,
  },
  { id: 330, name: "Herb Pouch", price: 10, category: "Equipment", weight: 1 },
  {
    id: 331,
    name: "Nature Totem",
    price: 20,
    category: "Equipment",
    weight: 0.5,
  },
  {
    id: 332,
    name: "Spirit Bones",
    price: 15,
    category: "Equipment",
    weight: 0.5,
  },
  {
    id: 333,
    name: "Ritual Paint",
    price: 12,
    category: "Equipment",
    weight: 0.5,
  },
  { id: 334, name: "Drum", price: 25, category: "Equipment", weight: 3 },
  {
    id: 335,
    name: "Healer's Kit",
    price: 40,
    category: "Equipment",
    weight: 3,
  },
  {
    id: 336,
    name: "Salves and Ointments",
    price: 20,
    category: "Equipment",
    weight: 1,
  },
  { id: 337, name: "Simple Tool", price: 5, category: "Tools", weight: 2 },
  {
    id: 338,
    name: "Book Collection (3)",
    price: 60,
    category: "Equipment",
    weight: 6,
  },
  {
    id: 339,
    name: "Blank Journal",
    price: 10,
    category: "Writing Equipment",
    weight: 1,
  },
  {
    id: 340,
    name: "Merchant's Scale",
    price: 30,
    category: "Tools",
    weight: 2,
  },
  {
    id: 341,
    name: "Ledger Book",
    price: 15,
    category: "Writing Equipment",
    weight: 2,
  },
  { id: 342, name: "Fine Wine", price: 50, category: "Food", weight: 2 },
  { id: 343, name: "Perfume", price: 30, category: "Equipment", weight: 0.2 },
  {
    id: 344,
    name: "Signet Ring",
    price: 100,
    category: "Jewelry",
    weight: 0.1,
  },
  {
    id: 345,
    name: "Summoning Circle Chalk",
    price: 20,
    category: "Equipment",
    weight: 1,
  },
];

// Helper function to find an item by name (fuzzy match)
export function findShopItem(itemName) {
  const normalized = itemName.toLowerCase().trim();

  // Try exact match first
  let item = shopItems.find((i) => i.name.toLowerCase() === normalized);

  // Try partial match
  if (!item) {
    item = shopItems.find(
      (i) =>
        i.name.toLowerCase().includes(normalized) ||
        normalized.includes(i.name.toLowerCase())
    );
  }

  return item || null;
}

// Helper to infer equipment slot from item name/category
export function inferSlot(itemName, category = "") {
  const name = itemName.toLowerCase();
  const cat = category.toLowerCase();

  // Head items
  if (
    name.includes("hat") ||
    name.includes("helmet") ||
    name.includes("hood") ||
    name.includes("cap")
  ) {
    return "head";
  }

  // Torso items
  if (
    name.includes("robe") ||
    name.includes("armor") ||
    name.includes("shirt") ||
    name.includes("tunic") ||
    name.includes("jacket") ||
    name.includes("vest") ||
    name.includes("dress") ||
    name.includes("surcoat") ||
    cat === "armor"
  ) {
    return "torso";
  }

  // Legs items
  if (
    name.includes("pants") ||
    name.includes("skirt") ||
    name.includes("trousers") ||
    name.includes("kilt")
  ) {
    return "legs";
  }

  // Feet items
  if (
    name.includes("boot") ||
    name.includes("shoe") ||
    name.includes("sandal")
  ) {
    return "feet";
  }

  // Hand items
  if (name.includes("glove") || name.includes("gauntlet")) {
    return "hands";
  }

  // Back items
  if (
    name.includes("cape") ||
    name.includes("cloak") ||
    name.includes("backpack") ||
    name.includes("sack")
  ) {
    return "back";
  }

  // Waist items
  if (name.includes("belt") && !name.includes("purse")) {
    return "waist";
  }

  // Neck items
  if (
    name.includes("amulet") ||
    name.includes("necklace") ||
    name.includes("scarf") ||
    name.includes("symbol")
  ) {
    return "neck";
  }

  // Shields
  if (name.includes("shield")) {
    return "shield";
  }

  // Weapons
  if (
    cat === "weapons" ||
    name.includes("sword") ||
    name.includes("axe") ||
    name.includes("lance") ||
    name.includes("bow") ||
    name.includes("staff") ||
    name.includes("dagger") ||
    name.includes("knife") ||
    name.includes("dagger")
  ) {
    return "weaponPrimary";
  }

  // Default to accessory for misc items
  return "accessory";
}

export default shopItems;
