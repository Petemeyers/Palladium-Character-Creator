// Dynamic encounter engine for Palladium RPG
import bestiaryData from "../data/bestiary.json";
import npcArchetypesData from "../data/npc_archetypes.json";
import encounterTablesData from "../data/encounter_tables.json";
import { defaultMerchants } from "../components/data.jsx";
import { getAllBestiaryEntries } from "../utils/bestiaryUtils.js";

// Utility function to roll dice
const rollDice = (sides, count = 1) => {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total;
};

// Parse dice notation (e.g., "2d6", "1d8+2")
const parseDiceNotation = (notation) => {
  if (!notation || notation === "variable")
    return { dice: 0, sides: 0, bonus: 0 };

  const match = notation.match(/(\d+)d(\d+)([+-]\d+)?/);
  if (!match) return { dice: 0, sides: 0, bonus: 0 };

  const dice = parseInt(match[1]);
  const sides = parseInt(match[2]);
  const bonus = match[3] ? parseInt(match[3]) : 0;

  return { dice, sides, bonus };
};

// Roll HP based on notation (e.g., "7-56" or "4d8")
const rollHP = (hpNotation) => {
  if (!hpNotation) return 10;

  // Handle range notation (e.g., "7-56")
  if (hpNotation.includes("-")) {
    const [min, max] = hpNotation.split("-").map(Number);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Handle dice notation (e.g., "4d8")
  const { dice, sides, bonus } = parseDiceNotation(hpNotation);
  if (dice > 0 && sides > 0) {
    return rollDice(sides, dice) + bonus;
  }

  return 10; // Default fallback
};

// Convert bestiary/NPC data to combat-ready format
const convertToCombatUnit = (entity, id) => {
  const hp = rollHP(entity.HP);

  return {
    _id: id,
    name: entity.name,
    hp: hp,
    maxHp: hp,
    weapon: entity.attacks?.[0]?.name || "Claw",
    damage: entity.attacks?.[0]?.damage || "1d6",
    ar: entity.AR || 0,
    bonuses: entity.bonuses || {},
    abilities: entity.abilities || [],
    category: entity.category,
    alignment: entity.alignment,
    size: entity.size,
    description: entity.description,
  };
};

// Get entity from bestiary or NPC archetypes
const getEntity = (entityId) => {
  // Check bestiary first
  const bestiaryEntity = getAllBestiaryEntries(bestiaryData).find(
    (e) => e.id === entityId
  );
  if (bestiaryEntity) return bestiaryEntity;

  // Check NPC archetypes
  const npcEntity = npcArchetypesData.npcArchetypes.find(
    (e) => e.id === entityId
  );
  if (npcEntity) return npcEntity;

  return null;
};

// Roll on encounter table
const rollEncounter = (tableName) => {
  const table = encounterTablesData.encounters[tableName];
  if (!table) return null;

  const roll = rollDice(100, 1);

  for (const entry of table) {
    const [min, max] = entry.roll.split("-").map(Number);
    if (roll >= min && roll <= max) {
      return entry.result;
    }
  }

  return null;
};

// Generate encounter based on location and time
export const generateEncounter = (
  location = "forest_low",
  timeOfDay = "daytime"
) => {
  // Determine which table to use based on location and time
  let tableName = location;

  // Override with time-based table if it exists and is more appropriate
  if (timeOfDay === "nighttime" && encounterTablesData.encounters.nighttime) {
    tableName = "nighttime";
  } else if (
    timeOfDay === "daytime" &&
    encounterTablesData.encounters.daytime
  ) {
    tableName = "daytime";
  }

  // Roll for encounter
  const entityId = rollEncounter(tableName);
  if (!entityId) return null;

  // Handle merchant encounters
  if (
    entityId === "merchant_caravan" ||
    entityId === "merchant" ||
    entityId === "traveling_peddler"
  ) {
    const merchant =
      defaultMerchants[Math.floor(Math.random() * defaultMerchants.length)];
    return {
      name:
        entityId === "merchant_caravan"
          ? "Merchant Caravan"
          : entityId === "traveling_peddler"
          ? "Traveling Peddler"
          : "Merchant",
      type: "Merchant",
      description:
        entityId === "merchant_caravan"
          ? "A group of traders traveling the road."
          : entityId === "traveling_peddler"
          ? "A lone trader with strange goods."
          : "A merchant with goods to sell.",
      merchant: merchant,
      enemies: null,
    };
  }

  // Get entity data
  const entity = getEntity(entityId);
  if (!entity) return null;

  // Determine number of entities (1 for most, more for pack animals)
  let count = 1;
  if (entity.abilities) {
    for (const ability of entity.abilities) {
      if (
        ability.includes("Pack animals") ||
        ability.includes("Travel in groups")
      ) {
        // Extract group size from ability description
        const match = ability.match(/\((\d+)-(\d+)\)/);
        if (match) {
          const min = parseInt(match[1]);
          const max = parseInt(match[2]);
          count = Math.floor(Math.random() * (max - min + 1)) + min;
        } else if (ability.includes("Pack animals")) {
          count = rollDice(6, 1) + 2; // 3-8 for general pack animals
        } else if (ability.includes("Travel in groups")) {
          count = rollDice(4, 1) + 1; // 2-5 for general groups
        }
        break;
      }
    }
  }

  // Generate multiple entities
  const enemies = [];
  for (let i = 0; i < count; i++) {
    const enemy = convertToCombatUnit(entity, `${entityId}-${Date.now()}-${i}`);
    enemies.push(enemy);
  }

  return {
    name: count > 1 ? `${entity.name}s` : entity.name,
    type: entity.category,
    description: entity.description,
    enemies: enemies,
  };
};

// Get available encounter tables
export const getEncounterTables = () => {
  return Object.keys(encounterTablesData.encounters);
};

// Get available locations/biomes
export const getAvailableLocations = () => {
  const locations = [];
  for (const [key, value] of Object.entries(encounterTablesData.encounters)) {
    if (!["daytime", "nighttime"].includes(key)) {
      locations.push({
        id: key,
        name: key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      });
    }
  }
  return locations;
};

// Get entity by ID (for manual spawning)
export const getEntityById = (entityId) => {
  const entity = getEntity(entityId);
  if (!entity) return null;

  return convertToCombatUnit(entity, `${entityId}-${Date.now()}`);
};

// Get all available entities
export const getAllEntities = () => {
  const entities = [];

  // Add bestiary entities (monsters including playable characters)
  if (bestiaryData.bestiary) {
    const bestiaryEntries = getAllBestiaryEntries(bestiaryData);
    for (const entity of bestiaryEntries) {
      entities.push({
        id: entity.id,
        name: entity.name,
        category: entity.category,
        type: "bestiary",
        playable: entity.playable || false,
      });
    }
  }

  // Add NPC archetypes
  if (npcArchetypesData.npcArchetypes) {
    for (const entity of npcArchetypesData.npcArchetypes) {
      entities.push({
        id: entity.id,
        name: entity.name,
        category: entity.category,
        type: "npc",
      });
    }
  }

  return entities;
};

// Get entity details
export const getEntityDetails = (entityId) => {
  return getEntity(entityId);
};

// Roll random encounter from any table
export const rollRandomEncounter = () => {
  const tables = getEncounterTables();
  const randomTable = tables[Math.floor(Math.random() * tables.length)];
  return generateEncounter(randomTable);
};

// Get encounter table for a specific location
export const getEncounterTable = (location) => {
  return encounterTablesData.encounters[location] || null;
};

// Calculate encounter difficulty (for future use)
export const calculateEncounterDifficulty = (enemies) => {
  if (!enemies || enemies.length === 0) return "trivial";

  let totalHP = 0;
  let totalAR = 0;

  for (const enemy of enemies) {
    totalHP += enemy.hp || 10;
    totalAR += enemy.ar || 0;
  }

  const avgHP = totalHP / enemies.length;
  const avgAR = totalAR / enemies.length;

  if (avgHP < 15 && avgAR < 8) return "easy";
  if (avgHP < 30 && avgAR < 12) return "medium";
  if (avgHP < 60 && avgAR < 16) return "hard";
  return "extreme";
};

export default {
  generateEncounter,
  getEncounterTables,
  getAvailableLocations,
  getEntityById,
  getAllEntities,
  getEntityDetails,
  rollRandomEncounter,
  getEncounterTable,
  calculateEncounterDifficulty,
};
