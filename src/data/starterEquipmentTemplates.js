/**
 * Starter Equipment Templates by profession
 * Defines which items each class starts with (by name)
 * Items will be dynamically looked up from shop data
 */

export const STARTER_TEMPLATES = {
  // Men of Arms
  "Mercenary Fighter": {
    equistaminad: [
      "Soft Leather Armor", // torso
      "Pants", // legs
      "Boots (Leather)", // feet
      "Belt", // waist
      "Gloves", // hands
    ],
    wardrobe: [
      "Cloak (Short)", // spare
    ],
    inventory: [
      "Backpack",
      "Waterskin",
      "Bedroll",
      "Rations (1 week)",
      "Rope (50ft)",
    ],
  },

  Soldier: {
    equistaminad: [
      "Chain Armor",
      "Pants",
      "Boots, Knee-High",
      "Belt",
      "Gauntlets (Leather)",
      "Small Shield",
    ],
    wardrobe: [],
    inventory: ["Backpack", "Waterskin", "Rations (1 week)"],
  },

  Knight: {
    equistaminad: [
      "Plate Armor",
      "Helmet",
      "Pants",
      "Boots, Knee-High",
      "Gauntlets (Chain)",
      "Large Shield",
    ],
    wardrobe: ["Cape (Long)"],
    inventory: ["Backpack", "Polish Cloth", "Waterskin"],
  },

  Paladin: {
    equistaminad: [
      "Plate Armor",
      "Helmet",
      "Pants",
      "Boots, Hip-High",
      "Gauntlets (Chain)",
      "Large Shield",
      "Holy Symbol",
    ],
    wardrobe: ["Cape (Long, Hooded)"],
    inventory: ["Backpack", "Holy Water", "Waterskin"],
  },

  Ranger: {
    equistaminad: [
      "Soft Leather Armor",
      "Hood",
      "Pants",
      "Boots (Leather)",
      "Gloves",
    ],
    wardrobe: ["Cloak (Long)"],
    inventory: [
      "Backpack",
      "Rope (50ft)",
      "Rations (2 weeks)",
      "Waterskin",
      "Bow",
      "Arrows (20)",
    ],
  },

  "Long Bowman": {
    equistaminad: [
      "Soft Leather Armor",
      "Pants",
      "Boots (Leather)",
      "Gloves",
      "Belt",
    ],
    wardrobe: [],
    inventory: [
      "Backpack",
      "Long Bow",
      "Arrows (20)",
      "Arrows (20)", // Extra quiver
      "Waterskin",
    ],
  },

  Thief: {
    equistaminad: ["Tunic", "Pants", "Boots (Soft Leather)", "Hood", "Gloves"],
    wardrobe: ["Cloak (Short)"],
    inventory: ["Lockpicks", "Small sack", "Rope (50ft)", "Dagger"],
  },

  Assassin: {
    equistaminad: [
      "Soft Leather Armor",
      "Pants",
      "Boots (Soft Leather)",
      "Hood",
      "Gloves",
    ],
    wardrobe: ["Cloak (Long)"],
    inventory: ["Poison Vial", "Disguise Kit", "Small sack", "Dagger", "Knife"],
  },

  // Men of Training
  Duelist: {
    equistaminad: [
      "Robe (Light)",
      "Hat (Large Brim)",
      "Pants",
      "Boots (Leather)",
      "Belt",
    ],
    wardrobe: ["Cape (Long, Hooded)"],
    inventory: [
      "TechniqueBook (Blank)",
      "Ink and Quill",
      "Component Pouch",
      "Candles (5)",
      "Knife",
    ],
  },

  Mercenary: {
    equistaminad: ["Robe (Heavy)", "Hood", "Pants", "Boots (Leather)", "Belt"],
    wardrobe: [],
    inventory: ["Ritual Dagger", "Chalk", "Incense", "Candles (5)"],
  },

  Witch: {
    equistaminad: ["Robe (Heavy)", "Hood", "Pants", "Boots (Leather)"],
    wardrobe: ["Cape (Long)"],
    inventory: ["Potion Vials (3)", "Herbs Bundle", "Small Cauldron", "Knife"],
  },

  Diabolist: {
    equistaminad: ["Robe (Heavy)", "Hood", "Pants", "Boots (Leather)", "Belt"],
    wardrobe: [],
    inventory: ["Summoning Chalk", "Binding Runes", "Blood Vial", "Knife"],
  },

  Summoner: {
    equistaminad: ["Robe (Light)", "Pants", "Boots (Leather)", "Belt"],
    wardrobe: ["Cape (Long)"],
    inventory: [
      "TechniqueBook (Blank)",
      "Ink and Quill",
      "Summoning Circle Chalk",
      "Candles (5)",
    ],
  },

  "Tactician": {
    equistaminad: ["Robe (Light)", "Pants", "Sandals", "Belt"],
    wardrobe: [],
    inventory: ["Meditation Mat", "Focus Crystal", "Incense"],
  },

  // Clergy
  Priest: {
    equistaminad: ["Robe (Light)", "Pants", "Sandals", "Belt", "Holy Symbol"],
    wardrobe: [],
    inventory: ["Prayer Book", "Holy Water", "Bandages", "Incense", "Backpack"],
  },

  Druid: {
    equistaminad: ["Robe (Light)", "Pants", "Boots (Leather)", "Belt"],
    wardrobe: ["Cloak (Long)"],
    inventory: ["Staff", "Herb Pouch", "Waterskin", "Nature Totem"],
  },

  Shaman: {
    equistaminad: ["Robe (Heavy)", "Hood", "Pants", "Boots (Leather)"],
    wardrobe: [],
    inventory: ["Spirit Bones", "Ritual Paint", "Drum", "Incense"],
  },

  Healer: {
    equistaminad: ["Robe (Light)", "Pants", "Boots (Leather)", "Belt"],
    wardrobe: [],
    inventory: [
      "Healer's Kit",
      "Bandages (10)",
      "Salves and Ointments",
      "Backpack",
    ],
  },

  // Optional professions
  Peasant: {
    equistaminad: ["Shirt (Wool)", "Pants", "Shoes", "Belt"],
    wardrobe: ["Hat (Short Brim)"],
    inventory: ["Small sack", "Simple Tool"],
  },

  Squire: {
    equistaminad: ["Tunic", "Pants", "Boots (Leather)", "Belt"],
    wardrobe: [],
    inventory: ["Backpack", "Polish Cloth", "Waterskin"],
  },

  Scholar: {
    equistaminad: ["Robe (Light)", "Pants", "Shoes", "Belt"],
    wardrobe: [],
    inventory: ["Book Collection (3)", "Ink and Quill", "Blank Journal"],
  },

  Merchant: {
    equistaminad: ["Tunic", "Pants", "Boots (Leather)", "Belt"],
    wardrobe: ["Jacket (Light)"],
    inventory: ["Merchant's Scale", "Ledger Book", "Belt purse"],
  },

  Noble: {
    equistaminad: ["Robe (Heavy)", "Pants", "Boots, Knee-High", "Belt"],
    wardrobe: ["Cape (Long)", "Dress (Fancy)"],
    inventory: ["Fine Wine", "Perfume", "Signet Ring"],
  },
};

export default STARTER_TEMPLATES;
