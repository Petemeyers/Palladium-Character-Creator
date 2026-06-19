/**
 * PROFESSION Skill Mastaminar - Maps profession and skills to combat modifiers
 *
 * Extracts combat-relevant skills from character PROFESSION and skill data:
 * - Prowl: Stealth checks (Phase 0 pre-combat)
 * - Track: Target detection by signs/smell
 * - Hand to Hand: Defines actions per round, critical range
 * - Horsemanship: Mounted bonuses
 * - Block/Evade/Attack: Combat bonuses (already built-in via bonuses object)
 * - Tactics/Training: Mental/exceptional action hooks
 *
 * Returns normalized skill modifiers for use in combat engine.
 */

import { PROFESSIONS } from "../data/professionData.js";
import { professionSkillTables } from "./professionSkills.js";
import { getSkillBonusesAtLevel } from "../data/skillProgression.js";

/**
 * Extract Hand to Hand type from PROFESSION skills
 * @param {Object} professionData - PROFESSION data object
 * @returns {string|null} Hand to Hand type (e.g., "Basic", "Mercenary", "Knight")
 */
function extractHandToHandType(professionData) {
  if (!professionData || !professionData.professionSkills) return null;

  const handToHandSkill = professionData.professionSkills.find((skill) =>
    skill.toLowerCase().includes("hand to hand")
  );

  if (handToHandSkill) {
    const match = handToHandSkill.match(/hand\s+to\s+hand[:\s]+(.+)/i);
    return match ? match[1].trim() : "Basic";
  }

  return null;
}

/**
 * Get actions per round based on Hand to Hand type
 * @param {string} handToHandType - Hand to Hand type
 * @returns {number} Actions per round
 */
function getAttacksPerMeleeFromHandToHand(handToHandType, level = 1) {
  if (!handToHandType) return 1; // Rulebook default if no H2H selected (esp. Non-Men of Arms)

  // Normalize to our skillProgression keys
  const type = String(handToHandType).toLowerCase();

  let skillName = null;
  if (type.includes("soldier")) skillName = "Hand to Hand (Soldier)";
  else if (type.includes("mercenary")) skillName = "Hand to Hand (Mercenary)";
  else if (
    type.includes("non-men") ||
    type.includes("non men") ||
    type.includes("non-men of arms")
  ) {
    skillName = "Hand to Hand (Non-Men of Arms)";
  } else if (type.includes("basic")) skillName = "Hand to Hand (Basic)";
  else if (type.includes("expert")) skillName = "Hand to Hand (Expert)";
  else if (type.includes("martial")) skillName = "Hand to Hand (Martial Arts)";

  if (!skillName) return 1;

  const prog = getSkillBonusesAtLevel(skillName, level);
  // getSkillBonusesAtLevel returns the total attacks-per-melee at that level (state table)
  return prog.attacks || 1;
}

/**
 * Get skill percentage from character data
 * @param {Object} character - Character object
 * @param {string} skillName - Skill name to look up
 * @returns {number} Skill percentage (0-100)
 */
function getSkillPercentage(character, skillName) {
  // Check direct skills object
  if (character.skills && character.skills[skillName]) {
    return character.skills[skillName];
  }

  // Check lowercase keys
  const lowerSkillName = skillName.toLowerCase();
  if (character.skills) {
    for (const key in character.skills) {
      if (key.toLowerCase() === lowerSkillName) {
        return character.skills[key];
      }
    }
  }

  // Check PROFESSION skill tables (base percentage)
  const professionName = character.profession || character.PROFESSION;
  if (professionName && professionSkillTables[professionName]) {
    const professionSkills = professionSkillTables[professionName];
    const skillKey = lowerSkillName.replace(/\s+/g, "");

    // Try direct match
    if (professionSkills[skillKey] !== undefined) {
      return professionSkills[skillKey];
    }

    // Try partial match
    for (const key in professionSkills) {
      if (
        key.toLowerCase().includes(skillKey) ||
        skillKey.includes(key.toLowerCase())
      ) {
        return professionSkills[key];
      }
    }
  }

  return 0; // No skill found
}

/**
 * Map PROFESSION and skills to combat modifiers
 * @param {Object} character - Character object with profession, skills, etc.
 * @returns {Object} Combat-relevant skill modifiers
 */
export function mapPROFESSIONSkillsToCombat(character) {
  const result = {
    prowl: 0,
    track: 0,
    handToHand: null,
    actionsPerRound: 1, // Default
    horsemanship: 0,
    tactics: false,
    trainingUser: false,
    detectAmbush: 0,
    scaleWalls: 0,
    other: {}, // Store other combat-relevant skills
  };

  // Get PROFESSION name
  const professionName = character.profession || character.PROFESSION || character.professionName;
  if (!professionName) return result;

  // Get PROFESSION data
  const professionData = PROFESSIONS[professionName] || PROFESSIONS[character.profession] || null;

  // Extract Hand to Hand type
  if (professionData) {
    const handToHandType = extractHandToHandType(professionData);
    if (handToHandType) {
      result.handToHand = handToHandType;
      result.actionsPerRound = getAttacksPerMeleeFromHandToHand(handToHandType);
    }
  }

  // Get skill percentages
  result.prowl = getSkillPercentage(character, "Prowl");
  result.track = getSkillPercentage(character, "Track");
  result.horsemanship = getSkillPercentage(character, "Horsemanship");
  result.detectAmbush = getSkillPercentage(character, "Detect Ambush");
  result.scaleWalls = getSkillPercentage(character, "Scale Walls");

  // Check for Tactics
  if (
    character.tactics ||
    character.focus > 0 ||
    character.tacticalOptions?.length > 0
  ) {
    result.tactics = true;
  }

  // Check for Training User
  const trainingPROFESSIONs = [
    "Duelist",
    "Mercenary",
    "Summoner",
    "Diabolist",
    "Illusionist",
    "Witch",
    "Priest",
    "Cleric",
    "Druid",
    "Shaman",
  ];
  if (trainingPROFESSIONs.some((profession) => professionName.includes(profession) || profession.includes(professionName))) {
    result.trainingUser = true;
  }
  if (character.training || character.stamina > 0 || character.techniques?.length > 0) {
    result.trainingUser = true;
  }

  // Store other combat-relevant skills
  if (result.detectAmbush > 0) result.other.detectAmbush = result.detectAmbush;
  if (result.scaleWalls > 0) result.other.scaleWalls = result.scaleWalls;

  return result;
}

/**
 * Get Prowl skill percentage for stealth checks
 * @param {Object} character - Character object
 * @returns {number} Prowl skill percentage
 */
export function getProwlSkill(character) {
  return getSkillPercentage(character, "Prowl");
}

/**
 * Get Track skill percentage for target detection
 * @param {Object} character - Character object
 * @returns {number} Track skill percentage
 */
export function getTrackSkill(character) {
  return getSkillPercentage(character, "Track");
}

/**
 * Check if character has mounted combat bonuses (Horsemanship)
 * @param {Object} character - Character object
 * @returns {boolean} True if character has horsemanship skill
 */
export function hasHorsemanship(character) {
  return getSkillPercentage(character, "Horsemanship") > 0;
}

/**
 * Get actions per round from Hand to Hand skill
 * @param {Object} character - Character object
 * @returns {number} Actions per round
 */
export function getAttacksPerMelee(character) {
  const professionName = character.profession || character.PROFESSION || character.professionName;
  const professionData = PROFESSIONS[professionName] || PROFESSIONS[character.profession] || null;

  if (professionData) {
    const handToHandType = extractHandToHandType(professionData);
    if (handToHandType) {
      return getAttacksPerMeleeFromHandToHand(handToHandType);
    }
  }

  // Fallback to character's existing actionsPerRound or default
  return character.actionsPerRound || character.actions || 2;
}

export default {
  mapPROFESSIONSkillsToCombat,
  getProwlSkill,
  getTrackSkill,
  hasHorsemanship,
  getAttacksPerMelee,
};

