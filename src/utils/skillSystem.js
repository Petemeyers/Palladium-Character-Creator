/**
 * Skill System
 * 
 * Single source of truth calculator for skill percentages.
 * All skill percentages come from skillProgression.js tables.
 * 
 * This module:
 * - Normalizes skill names
 * - Gets base percentages from skillProgression.js
 * - Extracts OCC bonuses from skill names (e.g., "+10%", "+15%")
 * - Applies special rules (Read/Write IQ bonus)
 * - Clamps to 98% maximum
 */

import { 
  getSkillPercentageAtLevel,
  getSecondarySkillBonus 
} from '../data/skillProgression';

/**
 * Parse skill string to extract name, OCC bonus, and metadata
 * Handles patterns like:
 * - "Read/Write (+50%)" → { name: "Read/Write", occBonus: 50, meta: {} }
 * - "Speak Additional Languages (Knows 2) (+30%)" → { name: "Speak Additional Language", meta: { knows: 2 }, occBonus: 30 }
 * - "Scale Walls (+10%)" → { name: "Scale Walls", occBonus: 10, meta: {} }
 * 
 * @param {string} skillName - Raw skill name (may include bonuses and metadata)
 * @returns {Object} - { normalizedName, occBonus, meta } where:
 *   - normalizedName: Clean skill name for lookup
 *   - occBonus: Extracted OCC percentage bonus (0 if none)
 *   - meta: Object with metadata like { knows: 2 } for language skills
 */
export function normalizeSkillName(skillName) {
  if (!skillName) return { normalizedName: '', occBonus: 0, meta: {} };
  
  let workingName = skillName.trim();
  const meta = {};
  
  // Extract metadata patterns like "(Knows 2)", "(Knows 3)", etc.
  const metaMatch = workingName.match(/\(Knows\s+(\d+)\)/i);
  if (metaMatch) {
    meta.knows = parseInt(metaMatch[1]);
    // Remove metadata from name
    workingName = workingName.replace(/\(Knows\s+\d+\)/gi, '').trim();
  }
  
  // Extract OCC bonus from skill name (e.g., "Scale Walls (+10%)" or "Read/Write (+40%)")
  // Matches patterns like: (+10%), (+15%), (+40%), (+ 50%), etc.
  // Handles spaces: "(+ 50%)" or "(+50%)"
  const bonusMatch = workingName.match(/\([\+\-]\s*(\d+)%\)/);
  const occBonus = bonusMatch ? parseInt(bonusMatch[1]) : 0;
  
  // Remove bonus notation from name (handles spaces)
  let normalizedName = workingName.replace(/\s*\([\+\-]\s*\d+%\)/g, '').trim();
  
  // Clean up any double spaces or trailing/leading parentheses
  normalizedName = normalizedName.replace(/\s+/g, ' ').trim();
  
  // Handle common skill name variations to match skillProgression.js keys
  const variations = {
    // Read/Write variations
    'Read/Write (Native Language)': 'Read/Write',
    'Read / Write': 'Read/Write',
    'Read/ Write': 'Read/Write',
    
    // Language variations
    'Speak Additional Languages': 'Speak Additional Language',
    'Speak Additional Language (Knows 2)': 'Speak Additional Language',
    'Speak Additional Language (Knows 3)': 'Speak Additional Language',
    'Language (Additional)': 'Speak Additional Language',
    
    // Identify Plants variations
    'Identify Plants/Fruits': 'Identify Plants/Fruit',
    'Identify Plants & Fruits': 'Identify Plants/Fruit',
    'Identify Plants & Animals': 'Identify Plants/Fruit', // Note: May need separate handling in future
    
    // Horsemanship variations
    'Horsemanship (General)': 'Horsemanship',
    'Horsemanship (Knight)': 'Horsemanship',
    'Horsemanship (Paladin)': 'Horsemanship',
    
    // Hand to Hand variations (these don't have percentages, but normalize for consistency)
    'Hand to Hand Combat': 'Hand to Hand: Basic',
    
    // Swimming variations
    'Swimming': 'Swim',
  };
  
  // Apply variation mapping
  const finalName = variations[normalizedName] || normalizedName;
  
  return { normalizedName: finalName, occBonus, meta };
}

/**
 * Get skill percentage for a character and skill
 * 
 * This is the MAIN function - all skill percentages should go through this.
 * Uses skillProgression.js as the single source of truth.
 * 
 * @param {Object} character - Character object with level, IQ, etc.
 * @param {string} skillName - Name of skill (may include OCC bonuses like "+10%")
 * @param {string} skillType - Optional: 'occ', 'elective', or 'secondary' to determine bonuses
 * @returns {number} Skill percentage value (0-98), or 0 if skill has no percentage progression
 */
export function getSkillPercentage(character, skillName, skillType = null) {
  if (!character || !skillName) return 0;
  
  const level = character.level || 1;
  const iq = character.IQ || character.iq || 0;
  
  // Normalize skill name and extract OCC bonus and metadata
  const { normalizedName, occBonus, meta } = normalizeSkillName(skillName);
  
  // Get base percentage from skillProgression.js (single source of truth)
  let basePercentage = getSkillPercentageAtLevel(normalizedName, level, iq);
  
  // Handle dual-percentage skills (returns object with first/second or create/recognize)
  if (typeof basePercentage === 'object' && basePercentage !== null) {
    // For dual skills, use the first percentage (or create for Disguise/Forgery)
    // In the future, could add a parameter to select which one
    basePercentage = basePercentage.first || basePercentage.create || 0;
  }
  
  // If no progression found in skillProgression.js, return 0
  // (This means the skill doesn't have a percentage-based progression - e.g., combat skills use bonuses instead)
  if (basePercentage === null || basePercentage === undefined) {
    return 0;
  }
  
  // Add OCC bonus (extracted from skill name like "Scale Walls (+10%)")
  let total = basePercentage + occBonus;
  
  // Apply secondary skill bonus if this is a secondary skill
  if (skillType === 'secondary') {
    const secondaryBonus = getSecondarySkillBonus(normalizedName);
    total += secondaryBonus;
  }
  
  // Read/Write special rule: +10% if IQ >= 12
  // Note: This is already handled in getSkillPercentageAtLevel, but we ensure it's applied
  // The function in skillProgression.js handles this internally
  
  // Clamp to 98% maximum (Palladium rule)
  return Math.min(98, Math.max(0, total));
}

/**
 * Get skill value for a character (alias for getSkillPercentage for backward compatibility)
 * @param {Object} character - Character object
 * @param {string} skillName - Name of skill
 * @returns {number} Skill percentage value
 */
export function getSkillValue(character, skillName) {
  return getSkillPercentage(character, skillName);
}

/**
 * Check if character has a skill
 * @param {Object} character - Character object
 * @param {string} skillName - Name of skill
 * @returns {boolean} True if character has the skill
 */
export function hasSkill(character, skillName) {
  if (!character || !skillName) return false;
  
  const normalized = normalizeSkillName(skillName).normalizedName;
  
  // Check O.C.C., elective, and secondary skills
  const allSkills = [
    ...(character.occSkills || []),
    ...(character.electiveSkills || []),
    ...(character.secondarySkills || [])
  ];
  
  return allSkills.some(skill => {
    const skillNormalized = normalizeSkillName(skill).normalizedName;
    return skillNormalized === normalized || 
           skillNormalized.includes(normalized) || 
           normalized.includes(skillNormalized);
  });
}

/**
 * Lookup a skill by name (returns skill percentage data)
 * @param {string} skillName - Name of skill to lookup
 * @param {number} level - Character level
 * @param {number} iq - Character IQ
 * @returns {Object|null} Skill data or null if not found
 */
export function lookupSkill(skillName, level = 1, iq = 0) {
  if (!skillName) return null;
  
  const { normalizedName } = normalizeSkillName(skillName);
  const percentage = getSkillPercentageAtLevel(normalizedName, level, iq);
  
  if (percentage === null) return null;
  
  return {
    name: normalizedName,
    basePercentage: typeof percentage === 'object' ? percentage.first || percentage.create || 0 : percentage,
    level: level,
    category: 'general',
  };
}

/**
 * Perform a skill check
 * @param {Object} character - Character making the check
 * @param {string} skillName - Name of skill to check
 * @param {number} difficulty - Difficulty modifier (added to skill percentage)
 * @param {Function} rollDie - Function to roll dice
 * @returns {Object} Skill check result
 */
export function performSkillCheck(character, skillName, difficulty = 0, rollDie = null) {
  if (!character || !skillName) {
    return {
      success: false,
      roll: 0,
      skillValue: 0,
      total: 0,
      target: 0,
    };
  }

  // Get skill percentage using the main calculator
  const skillValue = getSkillPercentage(character, skillName);
  
  // Roll percentile (1d100)
  const roll = rollDie 
    ? rollDie(100) 
    : Math.floor(Math.random() * 100) + 1;
  
  // In Palladium, roll UNDER skill percentage (lower is better)
  // Difficulty modifier is added to skill percentage (makes it easier)
  const target = skillValue + difficulty;
  const success = roll <= target;
  
  return {
    success,
    roll,
    skillValue,
    total: roll,
    target,
    difficulty,
  };
}

/**
 * Roll a skill check (simplified version that takes skill percentage directly)
 * @param {number} skillPercent - Skill percentage value
 * @param {number} difficulty - Difficulty modifier (optional)
 * @param {Function} rollDie - Function to roll dice (optional)
 * @returns {Object} Skill check result with success, roll, total, etc.
 */
export function rollSkillCheck(skillPercent, difficulty = 0, rollDie = null) {
  if (typeof skillPercent !== 'number' || skillPercent < 0) {
    return {
      success: false,
      roll: 0,
      skillValue: 0,
      total: 0,
      target: 0,
      message: "Invalid skill percentage",
    };
  }

  // Roll percentile (1d100)
  const roll = rollDie 
    ? rollDie(100) 
    : Math.floor(Math.random() * 100) + 1;

  // In Palladium, you need to roll UNDER your skill percentage
  // Lower is better (opposite of D&D)
  const target = skillPercent + difficulty;
  const success = roll <= target;

  return {
    success,
    roll,
    skillValue: skillPercent,
    total: roll,
    target,
    difficulty,
    message: success 
      ? `Success! Rolled ${roll} (needed ${target} or less)`
      : `Failure! Rolled ${roll} (needed ${target} or less)`,
  };
}

export default {
  performSkillCheck,
  getSkillValue,
  hasSkill,
  lookupSkill,
  getSkillPercentage,
  rollSkillCheck,
  normalizeSkillName,
};

