// Helper function to ensure all inventory items have the correct type field
const ensureItemTypes = (inventory) => {
  console.log("ensureItemTypes called with inventory:", inventory);

  return inventory.map((item, index) => {
    console.log(`Processing item ${index}:`, item);

    // Ensure type field - ALWAYS set a proper type
    // Check if type is missing, not a string, or invalid
    if (
      !item.type ||
      typeof item.type !== "string" ||
      item.type === "it" ||
      item.type.length < 4 ||
      item.type.includes("it")
    ) {
      // Determine type based on category or name
      if (
        item.category === "Clothing" ||
        item.name.toLowerCase().includes("clothes") ||
        item.name.toLowerCase().includes("boots") ||
        item.name.toLowerCase().includes("belt")
      ) {
        item.type = "item";
      } else if (
        item.category === "Containers" ||
        item.name.toLowerCase().includes("sack") ||
        item.name.toLowerCase().includes("bag") ||
        item.name.toLowerCase().includes("backpack")
      ) {
        item.type = "item";
      } else if (
        item.category === "Equipment" ||
        item.name.toLowerCase().includes("symbol") ||
        item.name.toLowerCase().includes("book") ||
        item.name.toLowerCase().includes("candle") ||
        item.name.toLowerCase().includes("chalk") ||
        item.name.toLowerCase().includes("ink")
      ) {
        item.type = "item";
      } else if (
        item.category === "Writing Equipment" ||
        item.category === "Lighting"
      ) {
        item.type = "item";
      } else if (
        item.category === "one-handed" ||
        item.category === "two-handed" ||
        item.name.toLowerCase().includes("sword") ||
        item.name.toLowerCase().includes("dagger") ||
        item.name.toLowerCase().includes("staff") ||
        item.name.toLowerCase().includes("bow")
      ) {
        item.type = "weapon";
      } else if (
        item.category === "shield" ||
        item.name.toLowerCase().includes("shield") ||
        item.name.toLowerCase().includes("armor")
      ) {
        item.type = "armor";
      } else {
        item.type = "item"; // Default fallback
      }
    }

    // Ensure category field - ALWAYS assign a category
    if (!item.category) {
      // Determine category based on name or type
      if (
        item.name.toLowerCase().includes("clothes") ||
        item.name.toLowerCase().includes("boots") ||
        item.name.toLowerCase().includes("belt") ||
        item.name.toLowerCase().includes("gloves") ||
        item.name.toLowerCase().includes("hood") ||
        item.name.toLowerCase().includes("tunic") ||
        item.name.toLowerCase().includes("breeches")
      ) {
        item.category = "Clothing";
      } else if (
        item.name.toLowerCase().includes("sack") ||
        item.name.toLowerCase().includes("bag") ||
        item.name.toLowerCase().includes("backpack") ||
        item.name.toLowerCase().includes("pouch")
      ) {
        item.category = "Containers";
      } else if (
        item.name.toLowerCase().includes("sword") ||
        item.name.toLowerCase().includes("dagger") ||
        item.name.toLowerCase().includes("staff") ||
        item.name.toLowerCase().includes("bow") ||
        item.name.toLowerCase().includes("crossbow") ||
        item.name.toLowerCase().includes("spear")
      ) {
        item.category = "one-handed"; // Default to one-handed for weapons
      } else if (
        item.name.toLowerCase().includes("shield") ||
        item.name.toLowerCase().includes("armor")
      ) {
        item.category = "shield"; // Default to shield for armor
      } else if (
        item.name.toLowerCase().includes("symbol") ||
        item.name.toLowerCase().includes("book") ||
        item.name.toLowerCase().includes("candle") ||
        item.name.toLowerCase().includes("chalk") ||
        item.name.toLowerCase().includes("ink")
      ) {
        item.category = "Equipment";
      } else {
        item.category = "Equipment"; // Default fallback
      }
    }

    console.log(`Item ${index} after processing:`, item);
    return item;
  });
};

// Define equipment and gold based on O.C.C. (Palladium Fantasy 1994 rulebook)
// Note: clothingEquipmentData will be imported dynamically in assignInitialEquipment

const equipmentByClass = {
  // 🛡️ MEN OF ARMS O.C.C.s
  "Mercenary Fighter": {
    inventory: [
      // Clothing, boots, belt
      { name: "Set of clothes", type: "item", category: "Clothing", price: 0 },
      { name: "Boots", type: "item", category: "Clothing", price: 0 },
      {
        name: "Belt",
        type: "item",
        category: "Clothing",
        price: 4,
        weight: 0.5,
        description: "Leather belt for attaching pouches, sheaths, and gear.",
        slot: "waist",
      },
      // One large sack and one small sack
      {
        name: "Large sack",
        type: "item",
        category: "Containers",
        price: 0,
        weight: 0.5,
        description: "Large sack for carrying equipment and supplies.",
      },
      {
        name: "Small sack",
        type: "item",
        category: "Containers",
        price: 0,
        weight: 0.2,
        description: "Small sack for personal items and coins.",
      },
      // One low-quality weapon of choice (will be added by system)
    ],
    gold: 120,
    weaponChoice: true, // Flag to add weapon choice
  },
  Soldier: {
    inventory: [
      // Standard Men of Arms equipment
      { name: "Set of clothes", type: "item", category: "Clothing", price: 0 },
      { name: "Boots", type: "item", category: "Clothing", price: 0 },
      {
        name: "Belt",
        type: "item",
        category: "Clothing",
        price: 4,
        weight: 0.5,
        description: "Leather belt for attaching pouches, sheaths, and gear.",
        slot: "waist",
      },
      {
        name: "Large sack",
        type: "item",
        category: "Containers",
        price: 0,
        weight: 0.5,
        description: "Large sack for carrying equipment and supplies.",
      },
      {
        name: "Small sack",
        type: "item",
        category: "Containers",
        price: 0,
        weight: 0.2,
        description: "Small sack for personal items and coins.",
      },
      // Soldier enlistment bonus equipment
      {
        name: "Soft leather armor",
        type: "armor",
        category: "armor",
        price: 25,
        weight: 15,
        description: "Light leather armor provided upon enlistment.",
        defense: 2,
      },
      {
        name: "Short sword",
        type: "weapon",
        category: "one-handed",
        damage: "1d6",
        price: 15,
        weight: 3,
        description: "Standard issue short sword.",
      },
      {
        name: "Knife",
        type: "weapon",
        category: "one-handed",
        damage: "1d6",
        price: 2,
        weight: 1,
        description: "Standard issue dagger.",
      },
      {
        name: "Small wooden shield",
        type: "armor",
        category: "shield",
        price: 10,
        weight: 5,
        description: "Standard issue shield.",
        defense: 1,
      },
      {
        name: "Backpack",
        type: "item",
        category: "Containers",
        price: 5,
        weight: 2,
        description: "Military issue backpack.",
      },
      {
        name: "Grooming supplies",
        type: "item",
        category: "Equipment",
        price: 3,
        weight: 1,
        description: "Basic grooming kit for personal hygiene.",
      },
      {
        name: "Extra set of clothes",
        type: "item",
        category: "Clothing",
        price: 0,
        description: "Additional uniform provided by military.",
      },
    ],
    gold: 120,
    weaponChoice: false, // Soldiers get specific weapons
  },
  Paladin: {
    inventory: [
      // Standard Men of Arms equipment
      { name: "Set of clothes", type: "item", category: "Clothing", price: 0 },
      { name: "Boots", type: "item", category: "Clothing", price: 0 },
      {
        name: "Belt",
        type: "item",
        category: "Clothing",
        price: 4,
        weight: 0.5,
        description: "Leather belt for attaching pouches, sheaths, and gear.",
        slot: "waist",
      },
      {
        name: "Large sack",
        type: "item",
        category: "Containers",
        price: 0,
        weight: 0.5,
        description: "Large sack for carrying equipment and supplies.",
      },
      {
        name: "Small sack",
        type: "item",
        category: "Containers",
        price: 0,
        weight: 0.2,
        description: "Small sack for personal items and coins.",
      },
      // Paladin-specific equipment
      {
        name: "Holy Symbol",
        type: "item",
        category: "Equipment",
        price: 20,
        weight: 0.2,
        description: "Sacred symbol of the paladin's faith.",
      },
      {
        name: "Prayer Book",
        type: "item",
        category: "Equipment",
        price: 25,
        weight: 2,
        description: "Book of prayers and holy texts.",
      },
      {
        name: "Long Sword",
        type: "weapon",
        category: "one-handed",
        damage: "1d8+2",
        price: 55,
        weight: 3.5,
        description: "Blessed long sword for holy combat.",
      },
      {
        name: "Shield",
        type: "armor",
        category: "shield",
        price: 15,
        weight: 8,
        description: "Holy shield emblazoned with sacred symbols.",
        defense: 2,
      },
    ],
    gold: 120,
    weaponChoice: false, // Paladins get specific weapons
  },
  // 🔮 MEN OF MAGIC O.C.C.s
  Wizard: {
    inventory: [
      // Clothing, boots, belt
      { name: "Set of clothes", type: "item", category: "Clothing", price: 0 },
      { name: "Boots", type: "item", category: "Clothing", price: 0 },
      {
        name: "Belt",
        type: "item",
        category: "Clothing",
        price: 4,
        weight: 0.5,
        description: "Leather belt for attaching pouches, sheaths, and gear.",
        slot: "waist",
      },
      // One large sack
      {
        name: "Large sack",
        type: "item",
        category: "Containers",
        price: 0,
        weight: 0.5,
        description: "Large sack for carrying magical components and supplies.",
      },
      // Magical equipment
      {
        name: "Unused notebook",
        type: "item",
        category: "Equipment",
        price: 10,
        weight: 1,
        description: "Blank notebook for recording spells and notes.",
      },
      {
        name: "Ink",
        type: "item",
        category: "Equipment",
        price: 8,
        weight: 0.5,
        description: "Bottle of ink for writing spells.",
      },
      {
        name: "Pens/Quills",
        type: "item",
        category: "Equipment",
        price: 2,
        weight: 0.1,
        description: "Writing implements for spell notation.",
      },
      {
        name: "Chalk",
        type: "item",
        category: "Equipment",
        price: 1,
        weight: 0.1,
        description: "Chalk for drawing magical circles and symbols.",
      },
      {
        name: "Candle",
        type: "item",
        category: "Equipment",
        price: 1,
        weight: 0.2,
        description: "Candle for light and magical rituals.",
      },
      {
        name: "Knife",
        type: "weapon",
        category: "one-handed",
        damage: "1d4",
        price: 2,
        weight: 1,
        description: "Small knife for cutting components and self-defense.",
      },
    ],
    gold: 110,
    weaponChoice: false, // Wizards get specific equipment
  },
  Warlock: {
    inventory: [
      // Standard Men of Magic equipment
      { name: "Set of clothes", type: "item", category: "Clothing", price: 0 },
      { name: "Boots", type: "item", category: "Clothing", price: 0 },
      {
        name: "Belt",
        type: "item",
        category: "Clothing",
        price: 4,
        weight: 0.5,
        description: "Leather belt for attaching pouches, sheaths, and gear.",
        slot: "waist",
      },
      {
        name: "Large sack",
        type: "item",
        category: "Containers",
        price: 0,
        weight: 0.5,
        description: "Large sack for carrying magical components and supplies.",
      },
      {
        name: "Unused notebook",
        type: "item",
        category: "Equipment",
        price: 10,
        weight: 1,
        description: "Blank notebook for recording spells and notes.",
      },
      {
        name: "Ink",
        type: "item",
        category: "Equipment",
        price: 8,
        weight: 0.5,
        description: "Bottle of ink for writing spells.",
      },
      {
        name: "Pens/Quills",
        type: "item",
        category: "Equipment",
        price: 2,
        weight: 0.1,
        description: "Writing implements for spell notation.",
      },
      {
        name: "Chalk",
        type: "item",
        category: "Equipment",
        price: 1,
        weight: 0.1,
        description: "Chalk for drawing magical circles and symbols.",
      },
      {
        name: "Candle",
        type: "item",
        category: "Equipment",
        price: 1,
        weight: 0.2,
        description: "Candle for light and magical rituals.",
      },
      {
        name: "Knife",
        type: "weapon",
        category: "one-handed",
        damage: "1d4",
        price: 2,
        weight: 1,
        description: "Small knife for cutting components and self-defense.",
      },
    ],
    gold: 110,
    weaponChoice: false,
  },
  Diabolist: {
    inventory: [
      // Standard Men of Magic equipment
      { name: "Set of clothes", type: "item", category: "Clothing", price: 0 },
      { name: "Boots", type: "item", category: "Clothing", price: 0 },
      {
        name: "Belt",
        type: "item",
        category: "Clothing",
        price: 4,
        weight: 0.5,
        description: "Leather belt for attaching pouches, sheaths, and gear.",
        slot: "waist",
      },
      {
        name: "Large sack",
        type: "item",
        category: "Containers",
        price: 0,
        weight: 0.5,
        description: "Large sack for carrying magical components and supplies.",
      },
      {
        name: "Unused notebook",
        type: "item",
        category: "Equipment",
        price: 10,
        weight: 1,
        description: "Blank notebook for recording spells and notes.",
      },
      {
        name: "Ink",
        type: "item",
        category: "Equipment",
        price: 8,
        weight: 0.5,
        description: "Bottle of ink for writing spells.",
      },
      {
        name: "Pens/Quills",
        type: "item",
        category: "Equipment",
        price: 2,
        weight: 0.1,
        description: "Writing implements for spell notation.",
      },
      {
        name: "Chalk",
        type: "item",
        category: "Equipment",
        price: 1,
        weight: 0.1,
        description: "Chalk for drawing magical circles and symbols.",
      },
      {
        name: "Candle",
        type: "item",
        category: "Equipment",
        price: 1,
        weight: 0.2,
        description: "Candle for light and magical rituals.",
      },
      {
        name: "Knife",
        type: "weapon",
        category: "one-handed",
        damage: "1d4",
        price: 2,
        weight: 1,
        description: "Small knife for cutting components and self-defense.",
      },
    ],
    gold: 110,
    weaponChoice: false,
  },
  "Mind Mage": {
    inventory: [
      // Standard Men of Magic equipment
      { name: "Set of clothes", type: "item", category: "Clothing", price: 0 },
      { name: "Boots", type: "item", category: "Clothing", price: 0 },
      {
        name: "Belt",
        type: "item",
        category: "Clothing",
        price: 4,
        weight: 0.5,
        description: "Leather belt for attaching pouches, sheaths, and gear.",
        slot: "waist",
      },
      {
        name: "Large sack",
        type: "item",
        category: "Containers",
        price: 0,
        weight: 0.5,
        description: "Large sack for carrying magical components and supplies.",
      },
      {
        name: "Unused notebook",
        type: "item",
        category: "Equipment",
        price: 10,
        weight: 1,
        description: "Blank notebook for recording spells and notes.",
      },
      {
        name: "Ink",
        type: "item",
        category: "Equipment",
        price: 8,
        weight: 0.5,
        description: "Bottle of ink for writing spells.",
      },
      {
        name: "Pens/Quills",
        type: "item",
        category: "Equipment",
        price: 2,
        weight: 0.1,
        description: "Writing implements for spell notation.",
      },
      {
        name: "Chalk",
        type: "item",
        category: "Equipment",
        price: 1,
        weight: 0.1,
        description: "Chalk for drawing magical circles and symbols.",
      },
      {
        name: "Candle",
        type: "item",
        category: "Equipment",
        price: 1,
        weight: 0.2,
        description: "Candle for light and magical rituals.",
      },
      {
        name: "Knife",
        type: "weapon",
        category: "one-handed",
        damage: "1d4",
        price: 2,
        weight: 1,
        description: "Small knife for cutting components and self-defense.",
      },
    ],
    gold: 110,
    weaponChoice: false,
  },
  // ✝️ CLERGY O.C.C.s
  Priest: {
    inventory: [
      // Clothing, boots, belt
      { name: "Set of clothes", type: "item", category: "Clothing", price: 0 },
      { name: "Boots", type: "item", category: "Clothing", price: 0 },
      {
        name: "Belt",
        type: "item",
        category: "Clothing",
        price: 4,
        weight: 0.5,
        description: "Leather belt for attaching pouches, sheaths, and gear.",
        slot: "waist",
      },
      // One backpack or sack
      {
        name: "Backpack",
        type: "item",
        category: "Containers",
        price: 5,
        weight: 2,
        description: "Backpack for carrying religious supplies and equipment.",
      },
      // Religious equipment
      {
        name: "Holy water",
        type: "item",
        category: "Equipment",
        price: 25,
        weight: 0.5,
        description: "Vial of blessed holy water for religious ceremonies.",
      },
      {
        name: "Scented candle",
        type: "item",
        category: "Equipment",
        price: 3,
        weight: 0.3,
        description: "Scented candle for religious rituals and ceremonies.",
      },
      {
        name: "Incense",
        type: "item",
        category: "Equipment",
        price: 5,
        weight: 0.2,
        description: "Sticks of incense for religious ceremonies.",
      },
      {
        name: "Bandages",
        type: "item",
        category: "Equipment",
        price: 2,
        weight: 0.5,
        description: "Medical bandages for healing the sick and wounded.",
      },
      {
        name: "Knife",
        type: "weapon",
        category: "one-handed",
        damage: "1d4",
        price: 2,
        weight: 1,
        description: "Small knife for cutting bandages and self-defense.",
      },
    ],
    gold: 105,
    weaponChoice: false,
  },
  Druid: {
    inventory: [
      // Standard Clergy equipment
      { name: "Set of clothes", type: "item", category: "Clothing", price: 0 },
      { name: "Boots", type: "item", category: "Clothing", price: 0 },
      {
        name: "Belt",
        type: "item",
        category: "Clothing",
        price: 4,
        weight: 0.5,
        description: "Leather belt for attaching pouches, sheaths, and gear.",
        slot: "waist",
      },
      {
        name: "Backpack",
        type: "item",
        category: "Containers",
        price: 5,
        weight: 2,
        description: "Backpack for carrying religious supplies and equipment.",
      },
      {
        name: "Holy water",
        type: "item",
        category: "Equipment",
        price: 25,
        weight: 0.5,
        description: "Vial of blessed holy water for religious ceremonies.",
      },
      {
        name: "Scented candle",
        type: "item",
        category: "Equipment",
        price: 3,
        weight: 0.3,
        description: "Scented candle for religious rituals and ceremonies.",
      },
      {
        name: "Incense",
        type: "item",
        category: "Equipment",
        price: 5,
        weight: 0.2,
        description: "Sticks of incense for religious ceremonies.",
      },
      {
        name: "Bandages",
        type: "item",
        category: "Equipment",
        price: 2,
        weight: 0.5,
        description: "Medical bandages for healing the sick and wounded.",
      },
      {
        name: "Knife",
        type: "weapon",
        category: "one-handed",
        damage: "1d4",
        price: 2,
        weight: 1,
        description: "Small knife for cutting bandages and self-defense.",
      },
    ],
    gold: 105,
    weaponChoice: false,
  },
  Healer: {
    inventory: [
      // Standard Clergy equipment
      { name: "Set of clothes", type: "item", category: "Clothing", price: 0 },
      { name: "Boots", type: "item", category: "Clothing", price: 0 },
      {
        name: "Belt",
        type: "item",
        category: "Clothing",
        price: 4,
        weight: 0.5,
        description: "Leather belt for attaching pouches, sheaths, and gear.",
        slot: "waist",
      },
      {
        name: "Backpack",
        type: "item",
        category: "Containers",
        price: 5,
        weight: 2,
        description: "Backpack for carrying religious supplies and equipment.",
      },
      {
        name: "Holy water",
        type: "item",
        category: "Equipment",
        price: 25,
        weight: 0.5,
        description: "Vial of blessed holy water for religious ceremonies.",
      },
      {
        name: "Scented candle",
        type: "item",
        category: "Equipment",
        price: 3,
        weight: 0.3,
        description: "Scented candle for religious rituals and ceremonies.",
      },
      {
        name: "Incense",
        type: "item",
        category: "Equipment",
        price: 5,
        weight: 0.2,
        description: "Sticks of incense for religious ceremonies.",
      },
      {
        name: "Bandages",
        type: "item",
        category: "Equipment",
        price: 2,
        weight: 0.5,
        description: "Medical bandages for healing the sick and wounded.",
      },
      {
        name: "Knife",
        type: "weapon",
        category: "one-handed",
        damage: "1d4",
        price: 2,
        weight: 1,
        description: "Small knife for cutting bandages and self-defense.",
      },
    ],
    gold: 105,
    weaponChoice: false,
  },
  // ⚒️ OPTIONAL O.C.C.s
  Peasant: {
    inventory: [
      // Clothing, boots
      { name: "Set of clothes", type: "item", category: "Clothing", price: 0 },
      { name: "Boots", type: "item", category: "Clothing", price: 0 },
      // One sack
      {
        name: "Sack",
        type: "item",
        category: "Containers",
        price: 0,
        weight: 0.3,
        description: "Simple sack for carrying belongings.",
      },
      // One low-quality weapon of choice (will be added by system)
    ],
    gold: 50,
    weaponChoice: true,
  },
  Merchant: {
    inventory: [
      // Standard Optional O.C.C. equipment
      { name: "Set of clothes", type: "item", category: "Clothing", price: 0 },
      { name: "Boots", type: "item", category: "Clothing", price: 0 },
      {
        name: "Sack",
        type: "item",
        category: "Containers",
        price: 0,
        weight: 0.3,
        description: "Sack for carrying trade goods.",
      },
      // Merchant-specific items
      {
        name: "Coin purse",
        type: "item",
        category: "Equipment",
        price: 5,
        weight: 0.2,
        description: "Leather purse for carrying coins.",
      },
      {
        name: "Scales",
        type: "item",
        category: "Equipment",
        price: 15,
        weight: 1,
        description: "Small scales for weighing trade goods.",
      },
    ],
    gold: 50,
    weaponChoice: true,
  },
  Noble: {
    inventory: [
      // Same as Men of Arms but with higher quality
      {
        name: "Fine set of clothes",
        type: "item",
        category: "Clothing",
        price: 50,
        description: "High-quality noble clothing.",
      },
      {
        name: "Fine boots",
        type: "item",
        category: "Clothing",
        price: 25,
        description: "High-quality leather boots.",
      },
      {
        name: "Fine belt",
        type: "item",
        category: "Clothing",
        price: 15,
        weight: 0.5,
        description: "Ornate leather belt with silver buckle.",
        slot: "waist",
      },
      {
        name: "Large sack",
        type: "item",
        category: "Containers",
        price: 0,
        weight: 0.5,
        description: "Large sack for carrying equipment and supplies.",
      },
      {
        name: "Small sack",
        type: "item",
        category: "Containers",
        price: 0,
        weight: 0.2,
        description: "Small sack for personal items and coins.",
      },
      // Noble-specific items
      {
        name: "Signet ring",
        type: "item",
        category: "Equipment",
        price: 100,
        weight: 0.1,
        description: "Family signet ring showing noble status.",
      },
      {
        name: "Fine dagger",
        type: "weapon",
        category: "one-handed",
        damage: "1d6",
        price: 25,
        weight: 1,
        description: "Ornate dagger with noble family crest.",
      },
    ],
    gold: 200,
    weaponChoice: true,
  },
  Squire: {
    inventory: [
      // Standard Optional O.C.C. equipment
      { name: "Set of clothes", type: "item", category: "Clothing", price: 0 },
      { name: "Boots", type: "item", category: "Clothing", price: 0 },
      {
        name: "Sack",
        type: "item",
        category: "Containers",
        price: 0,
        weight: 0.3,
        description: "Sack for carrying belongings.",
      },
      // Squire-specific items
      {
        name: "Polishing cloth",
        type: "item",
        category: "Equipment",
        price: 1,
        weight: 0.1,
        description: "Cloth for polishing armor and weapons.",
      },
      {
        name: "Oil",
        type: "item",
        category: "Equipment",
        price: 2,
        weight: 0.5,
        description: "Oil for maintaining weapons and armor.",
      },
    ],
    gold: 50,
    weaponChoice: true,
  },
  Scholar: {
    inventory: [
      // Standard Optional O.C.C. equipment
      { name: "Set of clothes", type: "item", category: "Clothing", price: 0 },
      { name: "Boots", type: "item", category: "Clothing", price: 0 },
      {
        name: "Sack",
        type: "item",
        category: "Containers",
        price: 0,
        weight: 0.3,
        description: "Sack for carrying belongings.",
      },
      // Scholar-specific items
      {
        name: "Book",
        type: "item",
        category: "Equipment",
        price: 25,
        weight: 2,
        description: "Book of knowledge and learning.",
      },
      {
        name: "Ink",
        type: "item",
        category: "Equipment",
        price: 8,
        weight: 0.5,
        description: "Bottle of ink for writing.",
      },
      {
        name: "Quill",
        type: "item",
        category: "Equipment",
        price: 1,
        weight: 0.1,
        description: "Writing quill.",
      },
    ],
    gold: 50,
    weaponChoice: true,
  },
};

// Low quality weapon options for new characters (Palladium Fantasy standard)
const lowQualityWeapons = [
  {
    name: "Club",
    type: "weapon",
    category: "one-handed",
    damage: "1d6",
    price: 0,
    weight: 3,
    description: "A simple wooden club, basic but effective.",
  },
  {
    name: "Dagger",
    type: "weapon",
    category: "one-handed",
    damage: "1d6",
    price: 2,
    weight: 1,
    description: "A basic dagger for self-defense.",
  },
  {
    name: "Short Sword",
    type: "weapon",
    category: "one-handed",
    damage: "1d6",
    price: 10,
    weight: 2,
    description:
      "A basic short sword, better than a club but still low quality.",
  },
  {
    name: "Spear",
    type: "weapon",
    category: "two-handed",
    damage: "1d6",
    price: 5,
    weight: 4,
    description: "A simple spear, useful for keeping enemies at distance.",
  },
  {
    name: "Hand Axe",
    type: "weapon",
    category: "one-handed",
    damage: "1d6",
    price: 8,
    weight: 3,
    description: "A small hand axe, good for both combat and utility.",
  },
];

// Default equipment for classes not specifically defined (Optional O.C.C. template)
const defaultEquipment = {
  inventory: [
    { name: "Set of clothes", type: "item", category: "Clothing", price: 0 },
    { name: "Boots", type: "item", category: "Clothing", price: 0 },
    {
      name: "Sack",
      type: "item",
      category: "Containers",
      price: 0,
      weight: 0.3,
      description: "Simple sack for carrying belongings.",
    },
    // Weapon will be chosen randomly from lowQualityWeapons
  ],
  gold: 50,
  weaponChoice: true,
};

export const assignInitialEquipment = async (
  characterClass,
  characterRace = "Human"
) => {
  console.log("🚀 assignInitialEquipment called with:", {
    characterClass,
    characterRace,
  });

  // Import clothing data dynamically
  const clothingEquipmentData = await import("../data/clothingEquipment.json", {
    assert: { type: "json" },
  }).then((m) => m.default);

  const baseEquipment = equipmentByClass[characterClass] || defaultEquipment;

  // Create a copy to avoid modifying the original
  const equipment = JSON.parse(JSON.stringify(baseEquipment));

  // Add weapon choice if the class allows it
  if (equipment.weaponChoice || !equipmentByClass[characterClass]) {
    const randomWeapon =
      lowQualityWeapons[Math.floor(Math.random() * lowQualityWeapons.length)];
    equipment.inventory.push(randomWeapon);
    console.log("🎲 Random weapon selected:", randomWeapon.name);
  }

  // Remove the weaponChoice flag from the final equipment
  delete equipment.weaponChoice;

  console.log("📦 Base equipment:", equipment);

  // Ensure all items have the correct type field
  equipment.inventory = ensureItemTypes(equipment.inventory);

  // Replace generic clothing with race-specific clothing
  const raceKey =
    characterRace.charAt(0).toUpperCase() +
    characterRace.slice(1).toLowerCase();
  const raceClothing = clothingEquipmentData?.raceClothing?.[raceKey];

  if (raceClothing) {
    // Replace "Set of clothes" or "Basic set of clothes" with individual race-specific clothing pieces
    const clothingPieces = [];

    // Create individual clothing items for each slot
    if (raceClothing.head) {
      clothingPieces.push({
        name: raceClothing.head,
        type: "item",
        category: "Clothing",
        slot: "head",
        price: 0,
        weight: 0.5,
        description: `Traditional ${raceKey.toLowerCase()} headwear`,
        race: raceKey,
      });
    }

    if (raceClothing.torso) {
      clothingPieces.push({
        name: raceClothing.torso,
        type: "item",
        category: "Clothing",
        slot: "torso",
        price: 0,
        weight: 1.5,
        description: `Traditional ${raceKey.toLowerCase()} torso garment`,
        race: raceKey,
      });
    }

    if (raceClothing.legs) {
      clothingPieces.push({
        name: raceClothing.legs,
        type: "item",
        category: "Clothing",
        slot: "legs",
        price: 0,
        weight: 1,
        description: `Traditional ${raceKey.toLowerCase()} legwear`,
        race: raceKey,
      });
    }

    if (raceClothing.feet) {
      clothingPieces.push({
        name: raceClothing.feet,
        type: "item",
        category: "Clothing",
        slot: "feet",
        price: 0,
        weight: 2,
        description: `Traditional ${raceKey.toLowerCase()} footwear`,
        race: raceKey,
      });
    }

    if (raceClothing.hands) {
      clothingPieces.push({
        name: raceClothing.hands,
        type: "item",
        category: "Clothing",
        slot: "hands",
        price: 0,
        weight: 0.5,
        description: `Traditional ${raceKey.toLowerCase()} handwear`,
        race: raceKey,
      });
    }

    // Replace clothing items with individual pieces
    equipment.inventory = equipment.inventory.flatMap((item) => {
      if (
        item.name === "Set of clothes" ||
        item.name === "Basic set of clothes"
      ) {
        return clothingPieces; // Replace single item with multiple clothing pieces
      }
      // Remove generic "Boots" if we have race-specific footwear
      if (item.name === "Boots" && raceClothing.feet) {
        return []; // Remove the generic boots since we have race-specific footwear
      }
      return item;
    });
  }

  // Ensure all items have proper type and category fields after clothing replacement
  equipment.inventory = ensureItemTypes(equipment.inventory);

  return equipment;
};

// Export the data for use in other files
export { equipmentByClass, defaultEquipment };

export const calculateCarryWeight = (physicalStrength) => {
  return physicalStrength * 10; // PS x 10 pounds
};

export const calculateCarryDuration = (
  physicalEndurance,
  isHeavyExertion = false
) => {
  // Light activities: PE x 2 minutes
  // Heavy activities: PE x 1 minute
  return {
    minutes: physicalEndurance * (isHeavyExertion ? 1 : 2),
    isHeavyExertion,
  };
};
