export const attributeBonuses = {
  strength: 0,
  agility: 0,
  endurance: 0,
  intellect: 0,
  willpower: 0,
  presence: 0,
  charisma: 0,
};

export function getBonus(attribute, value) {
  const score = Number(value ?? attributeBonuses[attribute] ?? 10);
  return Math.floor((score - 10) / 2);
}

export const speciesData = {
  HUMAN: { label: "Human", type: "human" },
  ANIMAL: { label: "Animal", type: "animal" },
};

export const alignments = ["lawful-good", "neutral-good", "chaotic-good", "lawful-neutral", "true-neutral", "chaotic-neutral", "lawful-evil", "neutral-evil", "chaotic-evil"];
export const socialBackgrounds = ["Peasant", "Townsperson", "Retinue", "Mercenary Company", "Noble Household"];
export const ageTable = { Human: [16, 20, 25, 30, 40, 50, 60, 70] };
export const dispositions = ["friendly", "neutral", "defensive", "hostile"];
export const hostilities = ["none", "rival", "enemy"];
export const hostilityLevels = hostilities;
export const landsOfOrigin = ["Northern Marches", "River Town", "Hill Country", "Coastal Keep", "Border Fort"];

export function rollFromTable(roll, table) {
  if (!Array.isArray(table) || table.length === 0) return null;
  const index = Math.max(0, Math.min(table.length - 1, Number(roll || 1) - 1));
  return table[index];
}

export const speciesCharacteristics = {
  HUMAN: { species: "human", size: "Medium", speed: 30 },
  ANIMAL: { species: "animal", size: "Varies", speed: 40 },
};

export const characterClasses = [
  "Knight",
  "Squire",
  "Man-at-Arms",
  "Footman",
  "Spearman",
  "Pikeman",
  "Halberdier",
  "Longbowman",
  "Crossbowman",
  "Shield Bearer",
  "Duelist",
  "Mercenary",
  "Brigand",
  "Raider",
  "Guard",
  "Peasant Fighter",
  "Noble Duelist",
  "Arena Champion",
];

export function canBeClass(character, className) {
  return Boolean(character) && characterClasses.includes(className);
}

export function getAvailableClasses() {
  return characterClasses;
}

export const professionAbilities = {};

export const encounters = [
  { id: "road-brigands", name: "Road Brigands", combatants: ["Brigand", "Raider"] },
  { id: "guard-patrol", name: "Guard Patrol", combatants: ["Guard", "Spearman"] },
  { id: "wild-boar", name: "Wild Boar", combatants: ["Boar"] },
];

export const lootTables = {
  common: ["Coin purse", "Rations", "Utility knife", "Repair kit"],
};

export const racialStocks = {
  human: ["Dagger", "Arming Sword", "Spear", "Gambeson"],
  animal: [],
};

export const defaultMerchants = [
  {
    id: "arena-quartermaster",
    name: "Arena Quartermaster",
    type: "equipment",
    inventory: ["Dagger", "Arming Sword", "Spear", "Gambeson", "Mail Shirt"],
    racialBias: [],
    personality: { haggleChance: 0.25 },
  },
];

export const shopItems = [
  { id: "dagger", name: "Dagger", type: "weapon", price: 10 },
  { id: "arming-sword", name: "Arming Sword", type: "weapon", price: 45 },
  { id: "spear", name: "Spear", type: "weapon", price: 18 },
  { id: "gambeson", name: "Gambeson", type: "armor", price: 20 },
  { id: "mail-shirt", name: "Mail Shirt", type: "armor", price: 80 },
];

export const trainingTechniques = [];
export const tacticalOptions = [];
export const racialAbilities = {};

export default {
  attributeBonuses,
  speciesData,
  alignments,
  characterClasses,
  encounters,
  lootTables,
  racialStocks,
  defaultMerchants,
  shopItems,
};
