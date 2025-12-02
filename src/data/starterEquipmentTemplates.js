/**
 * Starter Equipment Templates by O.C.C.
 * Defines which items each class starts with (by name)
 * Items will be dynamically looked up from shop data
 */

export const STARTER_TEMPLATES = {
  // Men of Arms
  "Mercenary Fighter": {
    equipped: [
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
    equipped: [
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
    equipped: [
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
    equipped: [
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
    equipped: [
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
    equipped: [
      "Soft Leather Armor",
      "Pants",
      "Boots (Leather)",
      "Gloves",
      "Belt",
    ],
    wardrobe: [],
    inventory: [
      "Backpack",
      "Bow",
      "Arrows (20)",
      "Arrows (20)", // Extra quiver
      "Waterskin",
    ],
  },

  Thief: {
    equipped: ["Tunic", "Pants", "Boots (Soft Leather)", "Hood", "Gloves"],
    wardrobe: ["Cloak (Short)"],
    inventory: ["Lockpicks", "Small sack", "Rope (50ft)", "Dagger"],
  },

  Assassin: {
    equipped: [
      "Soft Leather Armor",
      "Pants",
      "Boots (Soft Leather)",
      "Hood",
      "Gloves",
    ],
    wardrobe: ["Cloak (Long)"],
    inventory: ["Poison Vial", "Disguise Kit", "Small sack", "Dagger", "Knife"],
  },

  // Men of Magic
  Wizard: {
    equipped: [
      "Robe (Light)",
      "Hat (Large Brim)",
      "Pants",
      "Boots (Leather)",
      "Belt",
    ],
    wardrobe: ["Cape (Long, Hooded)"],
    inventory: [
      "Spellbook (Blank)",
      "Ink and Quill",
      "Component Pouch",
      "Candles (5)",
      "Knife",
    ],
  },

  Warlock: {
    equipped: ["Robe (Heavy)", "Hood", "Pants", "Boots (Leather)", "Belt"],
    wardrobe: [],
    inventory: ["Ritual Dagger", "Chalk", "Incense", "Candles (5)"],
  },

  Witch: {
    equipped: ["Robe (Heavy)", "Hood", "Pants", "Boots (Leather)"],
    wardrobe: ["Cape (Long)"],
    inventory: ["Potion Vials (3)", "Herbs Bundle", "Small Cauldron", "Knife"],
  },

  Diabolist: {
    equipped: ["Robe (Heavy)", "Hood", "Pants", "Boots (Leather)", "Belt"],
    wardrobe: [],
    inventory: ["Summoning Chalk", "Binding Runes", "Blood Vial", "Knife"],
  },

  Summoner: {
    equipped: ["Robe (Light)", "Pants", "Boots (Leather)", "Belt"],
    wardrobe: ["Cape (Long)"],
    inventory: [
      "Spellbook (Blank)",
      "Ink and Quill",
      "Summoning Circle Chalk",
      "Candles (5)",
    ],
  },

  "Mind Mage": {
    equipped: ["Robe (Light)", "Pants", "Sandals", "Belt"],
    wardrobe: [],
    inventory: ["Meditation Mat", "Focus Crystal", "Incense"],
  },

  // Clergy
  Priest: {
    equipped: ["Robe (Light)", "Pants", "Sandals", "Belt", "Holy Symbol"],
    wardrobe: [],
    inventory: ["Prayer Book", "Holy Water", "Bandages", "Incense", "Backpack"],
  },

  Druid: {
    equipped: ["Robe (Light)", "Pants", "Boots (Leather)", "Belt"],
    wardrobe: ["Cloak (Long)"],
    inventory: ["Staff", "Herb Pouch", "Waterskin", "Nature Totem"],
  },

  Shaman: {
    equipped: ["Robe (Heavy)", "Hood", "Pants", "Boots (Leather)"],
    wardrobe: [],
    inventory: ["Spirit Bones", "Ritual Paint", "Drum", "Incense"],
  },

  Healer: {
    equipped: ["Robe (Light)", "Pants", "Boots (Leather)", "Belt"],
    wardrobe: [],
    inventory: [
      "Healer's Kit",
      "Bandages (10)",
      "Salves and Ointments",
      "Backpack",
    ],
  },

  // Optional O.C.C.s
  Peasant: {
    equipped: ["Shirt (Wool)", "Pants", "Shoes", "Belt"],
    wardrobe: ["Hat (Short Brim)"],
    inventory: ["Small sack", "Simple Tool"],
  },

  Squire: {
    equipped: ["Tunic", "Pants", "Boots (Leather)", "Belt"],
    wardrobe: [],
    inventory: ["Backpack", "Polish Cloth", "Waterskin"],
  },

  Scholar: {
    equipped: ["Robe (Light)", "Pants", "Shoes", "Belt"],
    wardrobe: [],
    inventory: ["Book Collection (3)", "Ink and Quill", "Blank Journal"],
  },

  Merchant: {
    equipped: ["Tunic", "Pants", "Boots (Leather)", "Belt"],
    wardrobe: ["Jacket (Light)"],
    inventory: ["Merchant's Scale", "Ledger Book", "Belt purse"],
  },

  Noble: {
    equipped: ["Robe (Heavy)", "Pants", "Boots, Knee-High", "Belt"],
    wardrobe: ["Cape (Long)", "Dress (Fancy)"],
    inventory: ["Fine Wine", "Perfume", "Signet Ring"],
  },
};

export default STARTER_TEMPLATES;
