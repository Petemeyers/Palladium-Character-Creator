// Palladium Fantasy RPG Skills Dataset
export const skills = {
  // Physical Skills
  Climb: {
    attribute: "PE",
    type: "Physical",
    encumbranceAffected: true,
    description: "Ability to climb trees and natural surfaces",
    difficulty: "Easy",
    locations: ["wilderness", "ruins", "dungeon_entrance"],
  },
  "Scale Walls": {
    attribute: "PS",
    type: "Physical",
    encumbranceAffected: true,
    description: "Ability to scale walls, fortifications, and buildings",
    difficulty: "Average",
    locations: ["town", "city", "dungeon_entrance", "ruins"],
  },
  Swimming: {
    attribute: "PE",
    type: "Physical",
    encumbranceAffected: true,
    description: "Ability to swim and survive in water",
    difficulty: "Easy",
    locations: ["boat_bizantium", "island_bizantium", "port_western"],
  },
  Horsemanship: {
    attribute: "PS",
    type: "Physical",
    encumbranceAffected: true,
    description: "Riding and handling horses",
    difficulty: "Easy",
    locations: ["tavern_eastern", "inn_eastern", "caravan"],
  },
  Tracking: {
    attribute: "IQ",
    type: "Physical",
    encumbranceAffected: false,
    description: "Following tracks and signs",
    difficulty: "Hard",
    locations: ["wilderness_camp", "jungle_camp", "trading_post"],
  },
  "Wilderness Survival": {
    attribute: "PE",
    type: "Physical",
    encumbranceAffected: false,
    description: "Surviving in wilderness conditions",
    difficulty: "Hard",
    locations: ["wilderness_camp", "jungle_camp", "ruins_oldkingdom"],
  },

  // Rogue Skills
  "Pick Locks": {
    attribute: "PP",
    type: "Rogue",
    encumbranceAffected: false,
    description: "Opening locks without keys",
    difficulty: "Hard",
    locations: ["dungeon_entrance", "ruins_jungle", "capital_inn"],
  },
  "Detect Concealment": {
    attribute: "IQ",
    type: "Rogue",
    encumbranceAffected: false,
    description: "Finding hidden doors, traps, and secret compartments",
    difficulty: "Hard",
    locations: ["dungeon_entrance", "ruins_jungle", "capital_inn"],
  },
  "Detect Ambush": {
    attribute: "IQ",
    type: "Rogue",
    encumbranceAffected: false,
    description: "Spotting ambushes and traps",
    difficulty: "Hard",
    locations: ["wilderness_camp", "jungle_camp", "wolfen_camp"],
  },
  Streetwise: {
    attribute: "IQ",
    type: "Rogue",
    encumbranceAffected: false,
    description: "Knowledge of criminal activities and urban survival",
    difficulty: "Hard",
    locations: ["port_western", "trading_post", "capital_inn"],
  },

  // Scholar Skills
  "Lore: Local": {
    attribute: "IQ",
    type: "Scholar",
    encumbranceAffected: false,
    description: "Knowledge of local history, customs, and people",
    difficulty: "Easy",
    locations: ["tavern_eastern", "village_oldkingdom", "island_bizantium"],
  },
  "Lore: Geography": {
    attribute: "IQ",
    type: "Scholar",
    encumbranceAffected: false,
    description: "Knowledge of lands, cities, and travel routes",
    difficulty: "Easy",
    locations: ["boat_bizantium", "caravan", "port_western"],
  },
  "Lore: Magic": {
    attribute: "IQ",
    type: "Scholar",
    encumbranceAffected: false,
    description: "Knowledge of magical theory and practice",
    difficulty: "Hard",
    locations: ["ruins_oldkingdom", "ruins_jungle", "capital_inn"],
  },
  "Lore: Demons": {
    attribute: "IQ",
    type: "Scholar",
    encumbranceAffected: false,
    description: "Knowledge of demons, monsters, and supernatural beings",
    difficulty: "Hard",
    locations: ["wilderness_camp", "jungle_camp", "ruins_jungle"],
  },
  "Lore: Politics": {
    attribute: "IQ",
    type: "Scholar",
    encumbranceAffected: false,
    description: "Knowledge of political systems and current events",
    difficulty: "Hard",
    locations: ["capital_inn", "wolfen_camp", "port_western"],
  },
  "Lore: Military": {
    attribute: "IQ",
    type: "Scholar",
    encumbranceAffected: false,
    description: "Knowledge of military tactics and warfare",
    difficulty: "Hard",
    locations: ["wolfen_camp", "wolfen_village", "capital_inn"],
  },

  // Communication Skills
  "Charm/Impress": {
    attribute: "ME",
    type: "Communication",
    encumbranceAffected: false,
    description: "Ability to influence and impress others",
    difficulty: "Easy",
    locations: ["tavern_eastern", "capital_inn", "island_bizantium"],
  },
  Gambling: {
    attribute: "IQ",
    type: "Communication",
    encumbranceAffected: false,
    description: "Skill at games of chance and bluffing",
    difficulty: "Easy",
    locations: ["tavern_eastern", "capital_inn", "port_western"],
  },

  // Technical Skills
  Blacksmithing: {
    attribute: "PS",
    type: "Technical",
    encumbranceAffected: false,
    description: "Creating and repairing metal items",
    difficulty: "Hard",
    locations: ["village_oldkingdom", "trading_post", "wolfen_village"],
  },
  Herbalism: {
    attribute: "IQ",
    type: "Technical",
    encumbranceAffected: false,
    description: "Knowledge of plants and their medicinal properties",
    difficulty: "Hard",
    locations: ["jungle_camp", "wilderness_camp", "village_oldkingdom"],
  },
};

// Helper function to get skills by type
export const getSkillsByType = (type) => {
  return Object.entries(skills)
    .filter(([, skill]) => skill.type === type)
    .map(([skillName, skill]) => ({ name: skillName, ...skill }));
};

// Helper function to get skills by attribute
export const getSkillsByAttribute = (attribute) => {
  return Object.entries(skills)
    .filter(([, skill]) => skill.attribute === attribute)
    .map(([skillName, skill]) => ({ name: skillName, ...skill }));
};

// Helper function to get skills for a specific location
export const getSkillsForLocation = (locationId) => {
  return Object.entries(skills)
    .filter(([, skill]) => skill.locations.includes(locationId))
    .map(([skillName, skill]) => ({ name: skillName, ...skill }));
};

// Helper function to get skill by name
export const getSkillByName = (skillName) => {
  return skills[skillName] ? { name: skillName, ...skills[skillName] } : null;
};
