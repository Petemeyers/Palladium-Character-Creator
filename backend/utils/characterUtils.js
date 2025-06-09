import { initialEquipment } from "../data/initialEquipment.js";

export const assignInitialEquipment = (characterClass) => {
  try {
    console.log("Assigning equipment for class:", characterClass); // Debug log

    // Convert class name to match initialEquipment keys
    const classCategory = getClassCategory(characterClass);
    console.log("Class category:", classCategory); // Debug log

    if (!classCategory || !initialEquipment[classCategory]) {
      console.error(
        "No equipment configuration found for class:",
        characterClass
      );
      // Return default equipment instead of throwing error
      return {
        inventory: [
          { name: "Basic Clothes", category: "Clothing", price: 0 },
          { name: "Basic Weapon", category: "Weapons", price: 0 },
        ],
        gold: 50,
      };
    }

    const equipment = initialEquipment[classCategory];
    let startingItems = [...equipment.basic];
    let gold = equipment.startingGold;

    // Handle special cases
    if (equipment.special?.[characterClass]) {
      const special = equipment.special[characterClass];
      if (special.additional) {
        startingItems = [...startingItems, ...special.additional];
      }
      if (special.startingGold) {
        gold = special.startingGold;
      }
      if (special.equipment) {
        startingItems = [...initialEquipment[special.equipment].basic];
      }
    }

    console.log("Assigned equipment:", { startingItems, gold }); // Debug log

    return {
      inventory: startingItems.map((item) => ({
        name: item.name,
        category: item.category,
        price: item.price || 0,
        description: item.description || "",
        type: "Item",
      })),
      gold,
    };
  } catch (error) {
    console.error("Error assigning initial equipment:", error);
    // Return basic equipment on error
    return {
      inventory: [
        { name: "Basic Clothes", category: "Clothing", price: 0 },
        { name: "Basic Weapon", category: "Weapons", price: 0 },
      ],
      gold: 50,
    };
  }
};

// Helper function to determine equipment category based on class
export const getClassCategory = (characterClass) => {
  const classCategories = {
    // Men at Arms category
    Fighter: "MenAtArms",
    Soldier: "MenAtArms",
    Knight: "MenAtArms",
    Ranger: "MenAtArms",
    Warrior: "MenAtArms",

    // Men of Magic category
    Wizard: "MenOfMagic",
    Sorcerer: "MenOfMagic",
    Warlock: "MenOfMagic",
    Mage: "MenOfMagic",

    // Clergy category
    Cleric: "Clergy",
    Priest: "Clergy",
    Paladin: "Clergy",
    Monk: "Clergy",

    // Optional category (including special cases)
    Noble: "Optional",
    Merchant: "Optional",
    Rogue: "Optional",
    Thief: "Optional",
  };

  // Return the category or 'Optional' as default
  return classCategories[characterClass] || "Optional";
};

// Helper function to validate equipment assignment
export const validateEquipment = (inventory) => {
  if (!Array.isArray(inventory)) {
    throw new Error("Inventory must be an array");
  }

  return inventory.every(
    (item) =>
      item.name &&
      typeof item.name === "string" &&
      item.category &&
      typeof item.category === "string"
  );
};

// Helper function to calculate total equipment value
export const calculateEquipmentValue = (inventory) => {
  return inventory.reduce((total, item) => total + (item.price || 0), 0);
};
