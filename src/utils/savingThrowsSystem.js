// ==========================================
// Medieval Combat Simulator Saving Throws System (1994)
// ==========================================
//
// Implements official save targets and bonuses by PROFESSION and level.
// Integrates with statusEffectsSystem, unifiedAbilities, and combatEngine.
//
// Training, Tactical, Poison, and Fear/courageChecks follow Medieval Combat Simulator RAW.
//
// Dependencies: CryptoSecureDice
// ==========================================

import CryptoSecureDice from "./cryptoDice.js";
// eslint-disable-next-line import/no-unresolved
import { PROFESSIONS } from "../data/professionData.js";

// ------------------------------------------
// Base Save Targets by Type (per rulebook)
// ------------------------------------------
export const BASE_SAVES = {
  training: 12, // Save vs Training: 12+ on d20 (normal human)
  tactics: 15, // Non-psychics need 15+, minor/major/masters have bonuses below
  poison: 14, // Save vs Poison: 14+ for standard toxins
  horror: 12, // Save vs Horror/Fear Factor: 12+ (mod by PE and PROFESSION)
};

// ------------------------------------------
// PROFESSION-Based Modifiers (officially by category)
// ------------------------------------------
export const PROFESSION_SAVE_MODIFIERS = {
  "Men of Arms": {
    training: 0,
    tactics: 0,
    poison: 1,
    horror: 1,
  },
  "Men of Training": {
    training: 2,
    tactics: 0,
    poison: -2,
    horror: 0,
  },
  "Men of the Mind": {
    training: 1,
    tactics: 4,
    poison: 0,
    horror: 2,
  },
  Rogue: {
    training: 0,
    tactics: 0,
    poison: 1,
    horror: 0,
  },
  Scholar: {
    training: 0,
    tactics: 0,
    poison: 0,
    horror: 0,
  },
  Cleric: {
    training: 2,
    tactics: 1,
    poison: 0,
    horror: 2,
  },
};

// ------------------------------------------
// Level-Based Save Scaling (RAW approximation)
// ------------------------------------------
export function getLevelSaveBonus(level = 1) {
  if (level >= 15) return 5;
  if (level >= 10) return 4;
  if (level >= 5) return 3;
  if (level >= 3) return 2;
  return 0;
}

// ------------------------------------------
// Psychic Category Bonuses
// ------------------------------------------
export const TACTICAL_SAVE_BONUSES = {
  none: 0, // non-psychic
  minor: 2,
  major: 4,
  master: 6, // e.g. Tactician
};

// ------------------------------------------
// Helper: Determine PROFESSION Category from character
// ------------------------------------------
export function getPROFESSIONCategory(character) {
  // Check unified abilities first
  if (character.unified?.professionCategory) {
    return character.unified.professionCategory;
  }

  // Check PROFESSION data directly from character or PROFESSION data files
  const professionName = character.profession || character.PROFESSION || character.class || "";

  // If we have PROFESSION data imported, check it first
  if (typeof PROFESSIONS !== "undefined" && PROFESSIONS[professionName] && PROFESSIONS[professionName].category) {
    return PROFESSIONS[professionName].category;
  }

  // Map PROFESSION names to categories (fallback if category not directly available)
  const professionCategoryMap = {
    // Men of Arms
    Soldier: "Men of Arms",
    Mercenary: "Men of Arms",
    Knight: "Men of Arms",
    Paladin: "Men of Arms",
    Ranger: "Men of Arms",
    Barbarian: "Men of Arms",
    Thief: "Rogue",
    Assassin: "Rogue",
    Rogue: "Rogue",

    // Men of Training
    Duelist: "Men of Training",
    Mercenary: "Men of Training",
    Summoner: "Men of Training",
    Diabolist: "Men of Training",
    Illusionist: "Men of Training",
    Witch: "Men of Training",

    // Clerics
    Priest: "Cleric",
    Cleric: "Cleric",
    PriestOfLight: "Cleric",
    PriestOfDarkness: "Cleric",
    Druid: "Cleric",
    Shaman: "Cleric",

    // Men of the Mind
    "Tactician": "Men of the Mind",
    MindMage: "Men of the Mind",
    "Psi-Healer": "Men of the Mind",
    PsiMystic: "Men of the Mind",

    // Scholars
    Scholar: "Scholar",
    Scribe: "Scholar",
  };

  // Try exact match first
  if (professionCategoryMap[professionName]) {
    return occCategoryMap[professionName];
  }

  // Try partial match
  for (const [key, category] of Object.entries(professionCategoryMap)) {
    if (
      professionName.toLowerCase().includes(key.toLowerCase()) ||
      key.toLowerCase().includes(professionName.toLowerCase())
    ) {
      return category;
    }
  }

  // Default fallback
  return "Men of Arms";
}

// ------------------------------------------
// Helper: Determine Psychic Level
// ------------------------------------------
export function getPsychicLevel(character) {
  // Check if character has tactical powers
  const hasTactics =
    character.tactics ||
    character.focus > 0 ||
    character.tacticalOptions?.length > 0 ||
    character.unified?.tactics?.knownPowers?.length > 0;

  if (!hasTactics) {
    return "none";
  }

  // Check PROFESSION category - Tacticians are typically "master"
  const professionCategory = getPROFESSIONCategory(character);
  if (professionCategory === "Men of the Mind") {
    return "master";
  }

  // Check if character has a tactical level field
  if (character.tacticalLevel) {
    return character.tacticalLevel.toLowerCase();
  }

  // Default: assume minor if they have tactics but aren't Tactician
  return "minor";
}

// ------------------------------------------
// Compute Save Roll
// ------------------------------------------
export function rollSavingThrow({
  type = "training",
  character,
  occCategory = null,
  psychicLevel = null,
  level = null,
  PE = null,
  log = console.log,
}) {
  // Auto-detect values from character if not provided
  const finalProfessionCategory = occCategory || getPROFESSIONCategory(character);
  const finalPsychicLevel = psychicLevel || getPsychicLevel(character);
  const finalLevel = level !== null ? level : character.level || 1;
  const finalPE =
    PE !== null ? PE : character.attributes?.PE || character.PE || 10;

  const base = BASE_SAVES[type] || 12;
  const professionBonus = PROFESSION_SAVE_MODIFIERS[finalProfessionCategory]?.[type] || 0;
  const lvlBonus = getLevelSaveBonus(finalLevel);
  const peBonus = Math.floor((finalPE - 10) / 2);
  const psiBonus =
    type === "tactics" ? TACTICAL_SAVE_BONUSES[finalPsychicLevel] || 0 : 0;

  // Apply temporary bonuses (e.g., from courage auras)
  const tempBonus = character.tempBonuses?.horrorSave || 0;

  const totalBonus = occBonus + lvlBonus + peBonus + psiBonus + tempBonus;
  const roll = CryptoSecureDice.rollD20();
  const total = roll + totalBonus;

  const success = total >= base;
  const details = `Ã°Å¸Å½Â² Save vs ${type.toUstaminarCase()}: rolled ${roll} + ${totalBonus} = ${total} (need ${base})`;

  if (success) {
    log(`Ã°Å¸â€ºÂ¡Ã¯Â¸Â ${character.name || "Character"} succeeds! ${details}`, "save");
  } else {
    log(`Ã°Å¸â€™â‚¬ ${character.name || "Character"} fails. ${details}`, "save");
  }

  return {
    success,
    roll,
    total,
    base,
    totalBonus,
    occBonus,
    lvlBonus,
    peBonus,
    psiBonus,
    tempBonus,
  };
}

// ------------------------------------------
// Convenience Wrastaminars
// ------------------------------------------
export const saveVsTraining = (char, opts = {}) =>
  rollSavingThrow({ ...opts, character: char, type: "training" });

export const saveVsTactics = (char, opts = {}) =>
  rollSavingThrow({ ...opts, character: char, type: "tactics" });

export const saveVsPoison = (char, opts = {}) =>
  rollSavingThrow({ ...opts, character: char, type: "poison" });

export const saveVsHorror = (char, opts = {}) =>
  rollSavingThrow({ ...opts, character: char, type: "horror" });
