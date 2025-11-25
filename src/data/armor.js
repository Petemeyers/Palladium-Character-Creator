// Palladium Fantasy armor data with defense bonuses
export const armors = [
  // Light Armor
  {
    name: "Leather Armor",
    defense: 2,
    type: "armor",
    category: "light",
    weight: 15,
    price: 25,
    description: "Basic leather protection",
  },
  {
    name: "Studded Leather",
    defense: 3,
    type: "armor",
    category: "light",
    weight: 20,
    price: 45,
    description: "Leather with metal studs for better protection",
  },
  {
    name: "Padded Armor",
    defense: 1,
    type: "armor",
    category: "light",
    weight: 10,
    price: 15,
    description: "Quilted cloth padding",
  },

  // Medium Armor
  {
    name: "Chainmail",
    defense: 4,
    type: "armor",
    category: "medium",
    weight: 35,
    price: 75,
    description: "Interlocked metal rings",
  },
  {
    name: "Scale Mail",
    defense: 3,
    type: "armor",
    category: "medium",
    weight: 30,
    price: 60,
    description: "Overlapping metal scales",
  },
  {
    name: "Ring Mail",
    defense: 2,
    type: "armor",
    category: "medium",
    weight: 25,
    price: 35,
    description: "Leather with sewn metal rings",
  },

  // Heavy Armor
  {
    name: "Plate Armor",
    defense: 6,
    type: "armor",
    category: "heavy",
    weight: 50,
    price: 150,
    description: "Full metal plate protection",
  },
  {
    name: "Splint Mail",
    defense: 5,
    type: "armor",
    category: "heavy",
    weight: 40,
    price: 120,
    description: "Leather with vertical metal strips",
  },
  {
    name: "Banded Mail",
    defense: 4,
    type: "armor",
    category: "heavy",
    weight: 35,
    price: 90,
    description: "Leather with horizontal metal bands",
  },

  // Shields
  {
    name: "Small Shield",
    defense: 1,
    type: "armor",
    category: "shield",
    weight: 5,
    price: 15,
    description: "Light wooden shield",
  },
  {
    name: "Large Shield",
    defense: 2,
    type: "armor",
    category: "shield",
    weight: 10,
    price: 25,
    description: "Heavy wooden or metal shield",
  },
  {
    name: "Tower Shield",
    defense: 3,
    type: "armor",
    category: "shield",
    weight: 15,
    price: 40,
    description: "Massive protective shield",
  },
];

// Helper function to find armor by name
export const getArmorByName = (name) => {
  return armors.find((armor) => armor.name === name);
};

// Helper function to get armor by category
export const getArmorByCategory = (category) => {
  return armors.filter((armor) => armor.category === category);
};
