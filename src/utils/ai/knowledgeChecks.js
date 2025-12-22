// src/utils/ai/knowledgeChecks.js
/**
 * Knowledge Check System (Palladium-Faithful)
 * 
 * Uses Lore skills to identify enemy types and infer weaknesses.
 * No automatic detection - must roll against skill.
 */

import { inferWeaknessFromLore } from "./weaknessMemory.js";

/**
 * Get appropriate Lore skill for a fighter
 * @param {Object} fighter - Fighter object
 * @param {string} enemyType - Type of enemy (demon, undead, fae, etc.)
 * @returns {number|null} Skill percentage or null if no skill
 */
export function getLoreSkill(fighter, enemyType) {
  if (!fighter || !fighter.skills) return null;

  const type = (enemyType || "").toLowerCase();
  const skills = Array.isArray(fighter.skills) ? fighter.skills : [];

  // Check for matching lore skill
  const loreSkill = skills.find(skill => {
    const skillName = (skill.name || skill.skill || "").toLowerCase();
    return (
      skillName.includes("lore") &&
      (skillName.includes(type) || 
       (type === "demon" && skillName.includes("demon")) ||
       (type === "undead" && skillName.includes("undead")) ||
       (type === "demon" && skillName.includes("demonology")) ||
       (type === "undead" && skillName.includes("necromancy"))
      )
    );
  });

  if (loreSkill) {
    // Return skill percentage
    return loreSkill.percent || loreSkill.percentage || loreSkill.value || null;
  }

  // Check for general "Lore" skill
  const generalLore = skills.find(skill => {
    const skillName = (skill.name || skill.skill || "").toLowerCase();
    return skillName === "lore" || skillName === "general lore";
  });

  if (generalLore) {
    return generalLore.percent || generalLore.percentage || generalLore.value || null;
  }

  return null;
}

/**
 * Attempt a knowledge check
 * @param {Object} ai - AI fighter attempting the check
 * @param {Object} enemy - Enemy to identify
 * @param {string} loreType - Type of lore to use (demon, undead, fae, etc.)
 * @returns {Object|null} Result with success, inferred weaknesses, or null if no skill
 */
export function attemptKnowledgeCheck(ai, enemy, loreType) {
  const skill = getLoreSkill(ai, loreType);
  if (!skill) return null;

  // Roll percentile (1-100)
  const roll = Math.floor(Math.random() * 100) + 1;

  if (roll <= skill) {
    // Success - infer weaknesses
    return {
      success: true,
      roll,
      skill,
      inferred: inferWeaknessFromLore(loreType),
      enemyType: loreType
    };
  }

  // Failure
  return {
    success: false,
    roll,
    skill
  };
}

/**
 * Infer weakness from lore type (re-exported from weaknessMemory for convenience)
 */
export { inferWeaknessFromLore };

/**
 * Determine enemy type from bestiary data or observed characteristics
 * @param {Object} enemy - Enemy fighter object
 * @returns {string|null} Enemy type (demon, undead, fae, etc.) or null
 */
export function detectEnemyType(enemy) {
  if (!enemy) return null;

  // Check bestiary category/species
  const category = (enemy.category || "").toLowerCase();
  const species = (enemy.species || "").toLowerCase();
  const type = (enemy.type || "").toLowerCase();

  if (category.includes("demon") || species.includes("demon") || type.includes("demon")) {
    return "demon";
  }

  if (category.includes("undead") || species.includes("undead") || type.includes("undead")) {
    return "undead";
  }

  if (category.includes("fae") || category.includes("faerie") || species.includes("fae")) {
    return "fae";
  }

  if (category.includes("construct") || category.includes("golem")) {
    return "construct";
  }

  // Check abilities for clues
  const abilities = enemy.abilities || {};
  if (typeof abilities === "object" && !Array.isArray(abilities)) {
    if (abilities.impervious_to && abilities.impervious_to.includes("fire")) {
      // Fire immunity often indicates demon
      if (category.includes("creature") || category.includes("monster")) {
        return "demon";
      }
    }
  }

  return null;
}

/**
 * Try knowledge check (wrapper for enemyTurnAI)
 * Supports both old signature (ai, target, context) and new object-based signature
 * @param {Object|Object} aiOrParams - AI fighter OR params object { caster, target, threatProfile, weaknessMemory, distanceFeet }
 * @param {Object} [target] - Target enemy (if using old signature)
 * @param {Object} [context] - Context object (if using old signature)
 * @returns {Object|null} Result with weaknessMemory and/or threatProfile updates, or null
 */
export function tryKnowledgeCheck(aiOrParams, target, context = {}) {
  // Handle new object-based signature
  if (aiOrParams && typeof aiOrParams === "object" && !aiOrParams.id && !aiOrParams.name) {
    const params = aiOrParams;
    const ai = params.caster || params.ai;
    const tgt = params.target;
    
    if (!ai || !tgt) return null;
    
    // Detect enemy type
    const enemyType = detectEnemyType(tgt);
    if (!enemyType) return null;
    
    // Attempt knowledge check
    const result = attemptKnowledgeCheck(ai, tgt, enemyType);
    if (!result || !result.success) return null;
    
    // Build updated memory from inferred weaknesses
    const targetKey = params.targetKey || getTargetMemoryKey(tgt);
    const weaknessMemory = params.weaknessMemory || {};
    const updatedMemory = {
      [targetKey]: {
        suspected: result.inferred?.suspected || [],
        avoid: result.inferred?.avoid || [],
        lastUpdated: Date.now()
      }
    };
    
    return {
      success: true,
      enemyType,
      weaknessMemory: updatedMemory,
      threatProfile: params.threatProfile || null
    };
  }
  
  // Handle old signature (ai, target, context)
  const ai = aiOrParams;
  if (!ai || !target) return null;
  
  // Detect enemy type
  const enemyType = detectEnemyType(target);
  if (!enemyType) return null;
  
  // Attempt knowledge check
  const result = attemptKnowledgeCheck(ai, target, enemyType);
  if (!result || !result.success) return null;
  
  // Build updated memory from inferred weaknesses
  const updatedMemory = {
    suspected: result.inferred?.suspected || [],
    avoid: result.inferred?.avoid || [],
    lastUpdated: Date.now()
  };
  
  return {
    success: true,
    enemyType,
    updatedMemory
  };
}

// Helper to get target memory key (if not imported from weaknessMemory)
function getTargetMemoryKey(target) {
  const base =
    target?.baseName ||
    target?.species ||
    target?.race ||
    target?.name ||
    target?.id ||
    "unknown_target";
  const cat = target?.category || target?.type || target?.creatureType || "";
  return `${String(base).toLowerCase()}::${String(cat).toLowerCase()}`;
}

