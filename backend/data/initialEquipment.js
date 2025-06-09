export const initialEquipment = {
  MenAtArms: {
    basic: [
      { name: "Set of clothes", category: "Clothing", price: 0 },
      { name: "Boots", category: "Clothing", price: 0 },
      { name: "Belt", category: "Clothing", price: 0 },
      { name: "Large sack", category: "Containers", price: 0 },
      { name: "Small sack", category: "Containers", price: 0 },
      { name: "Low quality weapon", category: "Weapons", price: 0 },
    ],
    startingGold: 120,
    special: {
      Soldier: {
        additional: [
          { name: "Military uniform", category: "Clothing", price: 0 },
          { name: "Military insignia", category: "Equipment", price: 0 },
          { name: "Standard issue weapon", category: "Weapons", price: 0 },
        ],
      },
    },
  },
  MenOfMagic: {
    basic: [
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
    startingGold: 110,
  },
  Clergy: {
    basic: [
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
    startingGold: 105,
  },
  Optional: {
    basic: [
      { name: "Basic set of clothes", category: "Clothing", price: 0 },
      { name: "Boots", category: "Clothing", price: 0 },
      { name: "Sack", category: "Containers", price: 0 },
      { name: "Low quality weapon", category: "Weapons", price: 0 },
    ],
    startingGold: 50,
    special: {
      Noble: {
        startingGold: 200,
        equipment: "MenAtArms", // Uses Men at Arms equipment list
      },
    },
  },
};
