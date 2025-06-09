// Define equipment and gold based on class
const equipmentByClass = {
  Fighter: {
    inventory: [
      { name: "Set of clothes", category: "Clothing", price: 0 },
      { name: "Boots", category: "Clothing", price: 0 },
      { name: "Belt", category: "Clothing", price: 0 },
      { name: "Large sack", category: "Containers", price: 0 },
      { name: "Small sack", category: "Containers", price: 0 },
      { name: "Low quality weapon", category: "Weapons", price: 0 },
    ],
    gold: 120,
  },
  Wizard: {
    inventory: [
      { name: "Set of clothes", category: "Clothing", price: 0 },
      { name: "Boots", category: "Clothing", price: 0 },
      { name: "Belt", category: "Clothing", price: 0 },
      { name: "Large sack", category: "Containers", price: 0 },
      { name: "Notebook (blank)", category: "Writing Equipment", price: 0 },
      { name: "Ink", category: "Writing Equipment", price: 0 },
      { name: "Pen and quills", category: "Writing Equipment", price: 0 },
      { name: "Chalk", category: "Writing Equipment", price: 0 },
      { name: "Candle", category: "Lighting", price: 0 },
      { name: "Knife", category: "Weapons", price: 0 },
    ],
    gold: 110,
  },
  Cleric: {
    inventory: [
      { name: "Set of clothes", category: "Clothing", price: 0 },
      { name: "Boots", category: "Clothing", price: 0 },
      { name: "Belt", category: "Clothing", price: 0 },
      { name: "Backpack", category: "Containers", price: 0 },
      { name: "Holy water vial", category: "Equipment", price: 0 },
      { name: "Scented candle", category: "Lighting", price: 0 },
      { name: "Bandages", category: "Equipment", price: 0 },
      { name: "Incense sticks (6)", category: "Equipment", price: 0 },
      { name: "Knife", category: "Weapons", price: 0 },
    ],
    gold: 105,
  },
  Noble: {
    inventory: [
      { name: "Set of clothes", category: "Clothing", price: 0 },
      { name: "Boots", category: "Clothing", price: 0 },
      { name: "Belt", category: "Clothing", price: 0 },
      { name: "Large sack", category: "Containers", price: 0 },
      { name: "Small sack", category: "Containers", price: 0 },
      { name: "Low quality weapon", category: "Weapons", price: 0 },
    ],
    gold: 200,
  },
};

// Default equipment for classes not specifically defined
const defaultEquipment = {
  inventory: [
    { name: "Basic set of clothes", category: "Clothing", price: 0 },
    { name: "Boots", category: "Clothing", price: 0 },
    { name: "Sack", category: "Containers", price: 0 },
    { name: "Low quality weapon", category: "Weapons", price: 0 },
  ],
  gold: 50,
};

export const assignInitialEquipment = (characterClass) => {
  return equipmentByClass[characterClass] || defaultEquipment;
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
