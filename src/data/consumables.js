// Palladium Fantasy consumable items with effects
export const consumables = [
  // Healing Items
  {
    name: "Healing Potion",
    effect: "heal-2d4+2",
    type: "consumable",
    category: "healing",
    weight: 1,
    price: 50,
    description: "Magical potion that restores health",
  },
  {
    name: "Greater Healing Potion",
    effect: "heal-3d6+3",
    type: "consumable",
    category: "healing",
    weight: 1,
    price: 100,
    description: "More powerful healing elixir",
  },
  {
    name: "Cure Light Wounds",
    effect: "heal-1d8+1",
    type: "consumable",
    category: "healing",
    weight: 1,
    price: 25,
    description: "Minor healing potion",
  },
  {
    name: "Bandages",
    effect: "heal-1d3",
    type: "consumable",
    category: "healing",
    weight: 0.5,
    price: 5,
    description: "Basic medical supplies",
  },

  // Buff Items
  {
    name: "Strength Elixir",
    effect: "buff-strength+2",
    type: "consumable",
    category: "buff",
    weight: 1,
    price: 75,
    description: "Temporarily increases physical strength",
  },
  {
    name: "Speed Potion",
    effect: "buff-speed+2",
    type: "consumable",
    category: "buff",
    weight: 1,
    price: 60,
    description: "Increases movement and initiative",
  },
  {
    name: "Iron Skin Elixir",
    effect: "buff-defense+3",
    type: "consumable",
    category: "buff",
    weight: 1,
    price: 80,
    description: "Temporarily toughens skin",
  },
  {
    name: "Eagle Eye Tonic",
    effect: "buff-perception+2",
    type: "consumable",
    category: "buff",
    weight: 1,
    price: 45,
    description: "Enhances vision and awareness",
  },

  // Utility Items
  {
    name: "Antidote",
    effect: "cure-poison",
    type: "consumable",
    category: "utility",
    weight: 1,
    price: 40,
    description: "Neutralizes most poisons",
  },
  {
    name: "Restoration Elixir",
    effect: "cure-fatigue",
    type: "consumable",
    category: "utility",
    weight: 1,
    price: 35,
    description: "Removes fatigue and exhaustion",
  },
  {
    name: "Invisibility Potion",
    effect: "invisibility-10min",
    type: "consumable",
    category: "utility",
    weight: 1,
    price: 200,
    description: "Makes user invisible for 10 minutes",
  },

  // Combat Items
  {
    name: "Oil of Sharpness",
    effect: "weapon-bonus+1",
    type: "consumable",
    category: "combat",
    weight: 0.5,
    price: 30,
    description: "Makes weapon more effective",
  },
  {
    name: "Acid Vial",
    effect: "damage-1d6",
    type: "consumable",
    category: "combat",
    weight: 1,
    price: 25,
    description: "Corrosive acid for combat",
  },
  {
    name: "Holy Water",
    effect: "damage-undead-2d6",
    type: "consumable",
    category: "combat",
    weight: 1,
    price: 50,
    description: "Sacred water that harms undead",
  },
];

// Helper function to find consumable by name
export const getConsumableByName = (name) => {
  return consumables.find((consumable) => consumable.name === name);
};

// Helper function to get consumables by category
export const getConsumablesByCategory = (category) => {
  return consumables.filter((consumable) => consumable.category === category);
};

// Helper function to parse effect strings
export const parseEffect = (effect) => {
  if (effect.startsWith("heal-")) {
    const dice = effect.replace("heal-", "");
    return { type: "healing", dice };
  } else if (effect.startsWith("buff-")) {
    const buff = effect.replace("buff-", "");
    return { type: "buff", buff };
  } else if (effect.startsWith("cure-")) {
    const condition = effect.replace("cure-", "");
    return { type: "cure", condition };
  } else if (effect.startsWith("damage-")) {
    const damage = effect.replace("damage-", "");
    return { type: "damage", damage };
  } else {
    return { type: "special", effect };
  }
};
