/**
 * OCC Skill Mapper - Maps O.C.C. and skills to combat modifiers
 *
 * Extracts combat-relevant skills from character OCC and skill data:
 * - Prowl: Stealth checks (Phase 0 pre-combat)
 * - Track: Target detection by signs/smell
 * - Hand to Hand: Defines attacks per melee, critical range
 * - Horsemanship: Mounted bonuses
 * - Parry/Dodge/Strike: Combat bonuses (already built-in via bonuses object)
 * - Psionics/Magic: Mental/magical action hooks
 *
 * Returns normalized skill modifiers for use in combat engine.
 */

import { OCCS } from "../data/occData.js";
import { occSkillTables } from "./occSkills.js";
import { getSkillBonusesAtLevel } from "../data/skillProgression.js";

/**
 * Extract Hand to Hand type from OCC skills
 * @param {Object} occData - OCC data object
 * @returns {string|null} Hand to Hand type (e.g., "Basic", "Mercenary", "Knight")
 */
function extractHandToHandType(occData) {
  if (!occData || !occData.occSkills) return null;

  const handToHandSkill = occData.occSkills.find((skill) =>
    skill.toLowerCase().includes("hand to hand")
  );

  if (handToHandSkill) {
    const match = handToHandSkill.match(/hand\s+to\s+hand[:\s]+(.+)/i);
    return match ? match[1].trim() : "Basic";
  }

  return null;
}

/**
 * Get attacks per melee based on Hand to Hand type
 * @param {string} handToHandType - Hand to Hand type
 * @returns {number} Attacks per melee
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

  // Check OCC skill tables (base percentage)
  const occName = character.occ || character.OCC;
  if (occName && occSkillTables[occName]) {
    const occSkills = occSkillTables[occName];
    const skillKey = lowerSkillName.replace(/\s+/g, "");

    // Try direct match
    if (occSkills[skillKey] !== undefined) {
      return occSkills[skillKey];
    }

    // Try partial match
    for (const key in occSkills) {
      if (
        key.toLowerCase().includes(skillKey) ||
        skillKey.includes(key.toLowerCase())
      ) {
        return occSkills[key];
      }
    }
  }

  return 0; // No skill found
}

/**
 * Map OCC and skills to combat modifiers
 * @param {Object} character - Character object with occ, skills, etc.
 * @returns {Object} Combat-relevant skill modifiers
 */
export function mapOCCSkillsToCombat(character) {
  const result = {
    prowl: 0,
    track: 0,
    handToHand: null,
    attacksPerMelee: 1, // Default
    horsemanship: 0,
    psionics: false,
    magicUser: false,
    detectAmbush: 0,
    scaleWalls: 0,
    other: {}, // Store other combat-relevant skills
  };

  // Get OCC name
  const occName = character.occ || character.OCC || character.occName;
  if (!occName) return result;

  // Get OCC data
  const occData = OCCS[occName] || OCCS[character.occ] || null;

  // Extract Hand to Hand type
  if (occData) {
    const handToHandType = extractHandToHandType(occData);
    if (handToHandType) {
      result.handToHand = handToHandType;
      result.attacksPerMelee = getAttacksPerMeleeFromHandToHand(handToHandType);
    }
  }

  // Get skill percentages
  result.prowl = getSkillPercentage(character, "Prowl");
  result.track = getSkillPercentage(character, "Track");
  result.horsemanship = getSkillPercentage(character, "Horsemanship");
  result.detectAmbush = getSkillPercentage(character, "Detect Ambush");
  result.scaleWalls = getSkillPercentage(character, "Scale Walls");

  // Check for Psionics
  if (
    character.psionics ||
    character.ISP > 0 ||
    character.psionicPowers?.length > 0
  ) {
    result.psionics = true;
  }

  // Check for Magic User
  const magicOCCs = [
    "Wizard",
    "Warlock",
    "Summoner",
    "Diabolist",
    "Illusionist",
    "Witch",
    "Priest",
    "Cleric",
    "Druid",
    "Shaman",
  ];
  if (magicOCCs.some((occ) => occName.includes(occ) || occ.includes(occName))) {
    result.magicUser = true;
  }
  if (character.magic || character.PPE > 0 || character.spells?.length > 0) {
    result.magicUser = true;
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
 * Get attacks per melee from Hand to Hand skill
 * @param {Object} character - Character object
 * @returns {number} Attacks per melee
 */
export function getAttacksPerMelee(character) {
  const occName = character.occ || character.OCC || character.occName;
  const occData = OCCS[occName] || OCCS[character.occ] || null;

  if (occData) {
    const handToHandType = extractHandToHandType(occData);
    if (handToHandType) {
      return getAttacksPerMeleeFromHandToHand(handToHandType);
    }
  }

  // Fallback to character's existing attacksPerMelee or default
  return character.attacksPerMelee || character.actions || 2;
}

export default {
  mapOCCSkillsToCombat,
  getProwlSkill,
  getTrackSkill,
  hasHorsemanship,
  getAttacksPerMelee,
};
