// ==========================================
// Palladium RPG Saving Throws System (1994)
// ==========================================
//
// Implements official save targets and bonuses by OCC and level.
// Integrates with statusEffectsSystem, unifiedAbilities, and combatEngine.
//
// Magic, Psionic, Poison, and Fear/Horror saves follow Palladium RAW.
//
// Dependencies: CryptoSecureDice
// ==========================================

import CryptoSecureDice from "./cryptoDice.js";
// eslint-disable-next-line import/no-unresolved
import { OCCS } from "../data/occData.js";

// ------------------------------------------
// Base Save Targets by Type (per rulebook)
// ------------------------------------------
export const BASE_SAVES = {
  magic: 12, // Save vs Magic: 12+ on d20 (normal human)
  psionics: 15, // Non-psychics need 15+, minor/major/masters have bonuses below
  poison: 14, // Save vs Poison: 14+ for standard toxins
  horror: 12, // Save vs Horror/Fear Factor: 12+ (mod by PE and OCC)
};

// ------------------------------------------
// OCC-Based Modifiers (officially by category)
// ------------------------------------------
export const OCC_SAVE_MODIFIERS = {
  "Men of Arms": {
    magic: 0,
    psionics: 0,
    poison: 1,
    horror: 1,
  },
  "Men of Magic": {
    magic: 2,
    psionics: 0,
    poison: -2,
    horror: 0,
  },
  "Men of the Mind": {
    magic: 1,
    psionics: 4,
    poison: 0,
    horror: 2,
  },
  Rogue: {
    magic: 0,
    psionics: 0,
    poison: 1,
    horror: 0,
  },
  Scholar: {
    magic: 0,
    psionics: 0,
    poison: 0,
    horror: 0,
  },
  Cleric: {
    magic: 2,
    psionics: 1,
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
export const PSIONIC_SAVE_BONUSES = {
  none: 0, // non-psychic
  minor: 2,
  major: 4,
  master: 6, // e.g. Mind Mage
};

// ------------------------------------------
// Helper: Determine OCC Category from character
// ------------------------------------------
export function getOCCCategory(character) {
  // Check unified abilities first
  if (character.unified?.occCategory) {
    return character.unified.occCategory;
  }

  // Check OCC data directly from character or OCC data files
  const occName = character.occ || character.OCC || character.class || "";

  // If we have OCC data imported, check it first
  if (typeof OCCS !== "undefined" && OCCS[occName] && OCCS[occName].category) {
    return OCCS[occName].category;
  }

  // Map OCC names to categories (fallback if category not directly available)
  const occCategoryMap = {
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

    // Men of Magic
    Wizard: "Men of Magic",
    Warlock: "Men of Magic",
    Summoner: "Men of Magic",
    Diabolist: "Men of Magic",
    Illusionist: "Men of Magic",
    Witch: "Men of Magic",

    // Clerics
    Priest: "Cleric",
    Cleric: "Cleric",
    PriestOfLight: "Cleric",
    PriestOfDarkness: "Cleric",
    Druid: "Cleric",
    Shaman: "Cleric",

    // Men of the Mind
    "Mind Mage": "Men of the Mind",
    MindMage: "Men of the Mind",
    "Psi-Healer": "Men of the Mind",
    PsiMystic: "Men of the Mind",

    // Scholars
    Scholar: "Scholar",
    Scribe: "Scholar",
  };

  // Try exact match first
  if (occCategoryMap[occName]) {
    return occCategoryMap[occName];
  }

  // Try partial match
  for (const [key, category] of Object.entries(occCategoryMap)) {
    if (
      occName.toLowerCase().includes(key.toLowerCase()) ||
      key.toLowerCase().includes(occName.toLowerCase())
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
  // Check if character has psionic powers
  const hasPsionics =
    character.psionics ||
    character.ISP > 0 ||
    character.psionicPowers?.length > 0 ||
    character.unified?.psionics?.knownPowers?.length > 0;

  if (!hasPsionics) {
    return "none";
  }

  // Check OCC category - Mind Mages are typically "master"
  const occCategory = getOCCCategory(character);
  if (occCategory === "Men of the Mind") {
    return "master";
  }

  // Check if character has a psionic level field
  if (character.psionicLevel) {
    return character.psionicLevel.toLowerCase();
  }

  // Default: assume minor if they have psionics but aren't Mind Mage
  return "minor";
}

// ------------------------------------------
// Compute Save Roll
// ------------------------------------------
export function rollSavingThrow({
  type = "magic",
  character,
  occCategory = null,
  psychicLevel = null,
  level = null,
  PE = null,
  log = console.log,
}) {
  // Auto-detect values from character if not provided
  const finalOccCategory = occCategory || getOCCCategory(character);
  const finalPsychicLevel = psychicLevel || getPsychicLevel(character);
  const finalLevel = level !== null ? level : character.level || 1;
  const finalPE =
    PE !== null ? PE : character.attributes?.PE || character.PE || 10;

  const base = BASE_SAVES[type] || 12;
  const occBonus = OCC_SAVE_MODIFIERS[finalOccCategory]?.[type] || 0;
  const lvlBonus = getLevelSaveBonus(finalLevel);
  const peBonus = Math.floor((finalPE - 10) / 2);
  const psiBonus =
    type === "psionics" ? PSIONIC_SAVE_BONUSES[finalPsychicLevel] || 0 : 0;

  // Apply temporary bonuses (e.g., from courage auras)
  const tempBonus = character.tempBonuses?.horrorSave || 0;

  const totalBonus = occBonus + lvlBonus + peBonus + psiBonus + tempBonus;
  const roll = CryptoSecureDice.rollD20();
  const total = roll + totalBonus;

  const success = total >= base;
  const details = `🎲 Save vs ${type.toUpperCase()}: rolled ${roll} + ${totalBonus} = ${total} (need ${base})`;

  if (success) {
    log(`🛡️ ${character.name || "Character"} succeeds! ${details}`, "save");
  } else {
    log(`💀 ${character.name || "Character"} fails. ${details}`, "save");
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
// Convenience Wrappers
// ------------------------------------------
export const saveVsMagic = (char, opts = {}) =>
  rollSavingThrow({ ...opts, character: char, type: "magic" });

export const saveVsPsionics = (char, opts = {}) =>
  rollSavingThrow({ ...opts, character: char, type: "psionics" });

export const saveVsPoison = (char, opts = {}) =>
  rollSavingThrow({ ...opts, character: char, type: "poison" });

export const saveVsHorror = (char, opts = {}) =>
  rollSavingThrow({ ...opts, character: char, type: "horror" });
