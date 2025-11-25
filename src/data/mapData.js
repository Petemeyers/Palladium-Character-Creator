// World Map Data for Palladium Fantasy RPG
export const LOCATIONS = [
  {
    name: "Greyford Village",
    type: "village",
    coords: [10, 15],
    description: "A small farming community on the edge of the wilderness",
    encounterChance: 15, // 15% chance of random encounter
    population: "~200 humans",
    notable: "The Golden Goose Inn, Blacksmith, General Store",
  },
  {
    name: "Blackwood Forest",
    type: "forest",
    coords: [12, 20],
    description:
      "Ancient woodland filled with towering oaks and mysterious shadows",
    encounterChance: 35, // Higher danger in wilderness
    population: "Wildlife, bandits, fey creatures",
    notable: "Old ruins, hidden glades, bandit camps",
  },
  {
    name: "Ironfang Keep",
    type: "ruins",
    coords: [20, 25],
    description: "Crumbling fortress once held by the Ironfang clan",
    encounterChance: 50, // Very dangerous ruins
    population: "Monsters, undead, treasure hunters",
    notable: "Ancient armory, cursed chambers, hidden vaults",
  },
  {
    name: "Silverstream Port",
    type: "harbor",
    coords: [30, 12],
    description: "Bustling trading port on the Silver River",
    encounterChance: 10, // Safer in civilization
    population: "~500 mixed races",
    notable: "Merchant ships, fish market, taverns, shipwright",
  },
  {
    name: "Frostfang Mountains",
    type: "mountains",
    coords: [40, 30],
    description: "Treacherous peaks where dragons once nested",
    encounterChance: 40, // Dangerous mountain terrain
    population: "Mountain tribes, dragons, giants",
    notable: "Ancient dragon lairs, mining camps, mountain passes",
  },
  {
    name: "Whispering Marsh",
    type: "swamp",
    coords: [15, 35],
    description: "Misty wetlands where the dead are said to walk",
    encounterChance: 45, // Very dangerous swamp
    population: "Undead, swamp creatures, witches",
    notable: "Abandoned villages, witch huts, ancient burial mounds",
  },
  {
    name: "Golden Plains",
    type: "plains",
    coords: [25, 20],
    description: "Rolling grasslands perfect for farming and grazing",
    encounterChance: 20, // Moderate danger
    population: "Nomadic tribes, farmers, centaurs",
    notable: "Trading posts, ancient standing stones, herds of wild horses",
  },
  {
    name: "Crystal Caverns",
    type: "caves",
    coords: [35, 25],
    description: "Glowing crystal formations deep beneath the earth",
    encounterChance: 30, // Underground dangers
    population: "Cave dwellers, crystal elementals, miners",
    notable: "Crystal formations, underground lakes, mining operations",
  },
];

// Travel distances and times between locations
export const TRAVEL_ROUTES = {
  "Greyford Village": {
    "Blackwood Forest": { distance: 2, time: "4 hours", difficulty: "easy" },
    "Golden Plains": { distance: 3, time: "6 hours", difficulty: "easy" },
    "Silverstream Port": {
      distance: 4,
      time: "8 hours",
      difficulty: "moderate",
    },
  },
  "Blackwood Forest": {
    "Greyford Village": { distance: 2, time: "4 hours", difficulty: "easy" },
    "Ironfang Keep": { distance: 3, time: "6 hours", difficulty: "moderate" },
    "Whispering Marsh": { distance: 4, time: "8 hours", difficulty: "hard" },
  },
  "Ironfang Keep": {
    "Blackwood Forest": {
      distance: 3,
      time: "6 hours",
      difficulty: "moderate",
    },
    "Frostfang Mountains": {
      distance: 5,
      time: "10 hours",
      difficulty: "hard",
    },
  },
  "Silverstream Port": {
    "Greyford Village": {
      distance: 4,
      time: "8 hours",
      difficulty: "moderate",
    },
    "Golden Plains": { distance: 3, time: "6 hours", difficulty: "easy" },
    "Crystal Caverns": { distance: 4, time: "8 hours", difficulty: "moderate" },
  },
  "Frostfang Mountains": {
    "Ironfang Keep": { distance: 5, time: "10 hours", difficulty: "hard" },
    "Crystal Caverns": { distance: 3, time: "6 hours", difficulty: "moderate" },
  },
  "Whispering Marsh": {
    "Blackwood Forest": { distance: 4, time: "8 hours", difficulty: "hard" },
  },
  "Golden Plains": {
    "Greyford Village": { distance: 3, time: "6 hours", difficulty: "easy" },
    "Silverstream Port": { distance: 3, time: "6 hours", difficulty: "easy" },
  },
  "Crystal Caverns": {
    "Silverstream Port": {
      distance: 4,
      time: "8 hours",
      difficulty: "moderate",
    },
    "Frostfang Mountains": {
      distance: 3,
      time: "6 hours",
      difficulty: "moderate",
    },
  },
};

// Encounter tables by location type
export const ENCOUNTER_TABLES = {
  village: [
    { name: "Merchant Caravan", type: "friendly", chance: 30 },
    { name: "Town Guard Patrol", type: "neutral", chance: 20 },
    { name: "Beggar", type: "neutral", chance: 15 },
    { name: "Pickpocket", type: "hostile", chance: 10 },
    { name: "Noble's Retinue", type: "neutral", chance: 15 },
    { name: "Traveling Bard", type: "friendly", chance: 10 },
  ],
  forest: [
    { name: "Wolf Pack", type: "hostile", chance: 25 },
    { name: "Bandits", type: "hostile", chance: 20 },
    { name: "Forest Sprite", type: "neutral", chance: 15 },
    { name: "Wild Boar", type: "hostile", chance: 15 },
    { name: "Ranger", type: "friendly", chance: 10 },
    { name: "Ancient Treant", type: "neutral", chance: 10 },
    { name: "Goblin Scouts", type: "hostile", chance: 5 },
  ],
  ruins: [
    { name: "Skeleton Warriors", type: "hostile", chance: 30 },
    { name: "Giant Rats", type: "hostile", chance: 20 },
    { name: "Treasure Hunter", type: "neutral", chance: 15 },
    { name: "Ghost", type: "hostile", chance: 15 },
    { name: "Ancient Guardian", type: "hostile", chance: 10 },
    { name: "Bandit Hideout", type: "hostile", chance: 10 },
  ],
  harbor: [
    { name: "Merchant Ship", type: "friendly", chance: 25 },
    { name: "Fishermen", type: "friendly", chance: 20 },
    { name: "Smugglers", type: "neutral", chance: 15 },
    { name: "Sea Monster", type: "hostile", chance: 10 },
    { name: "Pirate Ship", type: "hostile", chance: 10 },
    { name: "Merfolk", type: "neutral", chance: 10 },
    { name: "Dock Workers", type: "neutral", chance: 10 },
  ],
  mountains: [
    { name: "Mountain Goat", type: "neutral", chance: 20 },
    { name: "Avalanche", type: "environmental", chance: 15 },
    { name: "Mountain Troll", type: "hostile", chance: 15 },
    { name: "Eagle", type: "neutral", chance: 15 },
    { name: "Mining Expedition", type: "friendly", chance: 10 },
    { name: "Dragon", type: "hostile", chance: 10 },
    { name: "Giant", type: "hostile", chance: 10 },
    { name: "Mountain Storm", type: "environmental", chance: 5 },
  ],
  swamp: [
    { name: "Swamp Gas", type: "environmental", chance: 20 },
    { name: "Giant Toad", type: "hostile", chance: 20 },
    { name: "Will-o'-Wisp", type: "hostile", chance: 15 },
    { name: "Swamp Witch", type: "neutral", chance: 15 },
    { name: "Undead", type: "hostile", chance: 15 },
    { name: "Quicksand", type: "environmental", chance: 10 },
    { name: "Swamp Dragon", type: "hostile", chance: 5 },
  ],
  plains: [
    { name: "Wild Horses", type: "neutral", chance: 25 },
    { name: "Nomadic Traders", type: "friendly", chance: 20 },
    { name: "Grassland Predators", type: "hostile", chance: 15 },
    { name: "Ancient Standing Stones", type: "neutral", chance: 15 },
    { name: "Centaur Herd", type: "neutral", chance: 10 },
    { name: "Dust Storm", type: "environmental", chance: 10 },
    { name: "Bandit Raiders", type: "hostile", chance: 5 },
  ],
  caves: [
    { name: "Cave Bear", type: "hostile", chance: 25 },
    { name: "Giant Bats", type: "hostile", chance: 20 },
    { name: "Crystal Elemental", type: "neutral", chance: 15 },
    { name: "Underground River", type: "environmental", chance: 15 },
    { name: "Mining Accident", type: "environmental", chance: 10 },
    { name: "Deep Dwarf", type: "friendly", chance: 10 },
    { name: "Cave-in", type: "environmental", chance: 5 },
  ],
};
