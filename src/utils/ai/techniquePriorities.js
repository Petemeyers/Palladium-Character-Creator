// src/utils/ai/techniquePriorities.js
/**
 * Role-Based Technique Priority Trees (Medieval Combat Simulator-Faithful)
 * 
 * Different techniquecasting roles have different priorities:
 * - Angel: Judge, Purifier, Enfraiderer
 * - Raider: Terror, Corruption, Attrition
 * - Duelist: Tactical Analyst
 */

/**
 * Angel technique priority (Ariel-style)
 * Role: Judge, Purifier, Enfraiderer
 */
export const SUPPORT_TECHNIQUE_PRIORITY = [
  "reveal",      // See Aura, Sense Training, See Invisible
  "control",     // Fear, Immobilization, Control the Field
  "holy_damage", // Holy damage, Smite equivalents
  "melee",       // Fallback to melee
  "withdraw"     // Flight, Teleport (low %)
];

/**
 * Raider technique priority
 * Role: Terror, Corruption, Attrition
 */
export const RAIDER_TECHNIQUE_PRIORITY = [
  "fear",        // Exploit Fear
  "curse",       // Drain / Curse
  "area_damage", // Area Damage
  "summon",      // Summon Allies
  "escape"       // Escape if banished threatened
];

/**
 * Duelist technique priority
 * Role: Tactical Analyst
 */
export const DUELIST_TECHNIQUE_PRIORITY = [
  "analyze",     // See Aura, Sense Training
  "probe",       // Low-cost elemental technique to test
  "exploit",     // Exploit Confirmed Weakness
  "control",     // Buff / Control
  "escape"       // Retreat
];

/**
 * Get technique priority list based on fighter role/type
 * @param {Object} fighter - Fighter object
 * @returns {Array<string>} Priority list
 */
export function getTechniquePriority(fighter) {
  if (!fighter) return DUELIST_TECHNIQUE_PRIORITY;

  const name = (fighter.name || "").toLowerCase();
  const category = (fighter.category || "").toLowerCase();
  const species = (fighter.species || "").toLowerCase();
  const type = (fighter.type || "").toLowerCase();

  // Angel detection
  if (name.includes("ariel") || 
      category.includes("angel") || 
      species.includes("angel") ||
      category.includes("combatant_of_training") && name.includes("ariel")) {
    return SUPPORT_TECHNIQUE_PRIORITY;
  }

  // Raider detection
  if (category.includes("raider") || 
      species.includes("raider") || 
      type.includes("raider") ||
      name.includes("baal") ||
      name.includes("rog")) {
    return RAIDER_TECHNIQUE_PRIORITY;
  }

  // Default to duelist (tactical analyst)
  return DUELIST_TECHNIQUE_PRIORITY;
}

/**
 * Tag a technique by its purpose/type
 * @param {Object} technique - Technique object
 * @returns {Array<string>} Array of tags
 */
export function tagTechnique(technique) {
  if (!technique || !technique.name) return [];

  const name = (technique.name || "").toLowerCase();
  const description = (technique.description || technique.effect || "").toLowerCase();
  const tags = [];

  // Reveal/Analysis techniques
  if (name.includes("see aura") || name.includes("sense training") || 
      name.includes("see invisible") || name.includes("detect")) {
    tags.push("reveal", "analyze");
  }

  // Control techniques
  if (name.includes("fear") || name.includes("paralyze") || 
      name.includes("hold") || name.includes("immobilize") ||
      name.includes("sleep") || name.includes("charm")) {
    tags.push("control");
  }

  // Holy damage
  if (name.includes("holy") || name.includes("smite") || 
      name.includes("divine") || name.includes("blessed") ||
      description.includes("holy") || description.includes("divine")) {
    tags.push("holy_damage");
  }

  // Fire damage
  if (name.includes("fire") || name.includes("flame") || 
      name.includes("burn") || description.includes("fire")) {
    tags.push("fire_damage");
  }

  // Cold damage
  if (name.includes("cold") || name.includes("ice") || 
      name.includes("frost") || description.includes("cold")) {
    tags.push("cold_damage");
  }

  // Area damage
  if (name.includes("ball") || name.includes("blast") || 
      name.includes("explosion") || description.includes("area") ||
      description.includes("radius")) {
    tags.push("area_damage");
  }

  // Curse/Drain
  if (name.includes("curse") || name.includes("drain") || 
      name.includes("weaken") || description.includes("curse")) {
    tags.push("curse");
  }

  // Summon
  if (name.includes("summon") || name.includes("call") || 
      description.includes("summon")) {
    tags.push("summon");
  }

  // Escape/Teleport
  if (name.includes("teleport") || name.includes("dimension") || 
      name.includes("escape") || name.includes("flee")) {
    tags.push("escape");
  }

  // Flight
  if (name.includes("fly") || name.includes("flight") || 
      name.includes("levitate")) {
    tags.push("withdraw");
  }

  // If no tags, default to generic damage
  if (tags.length === 0 && (technique.damage || technique.combatDamage)) {
    tags.push("damage");
  }

  return tags;
}

/**
 * Get techniques matching a priority tier
 * @param {Array<Object>} techniqueCatalog - Available techniques
 * @param {string} tier - Priority tier (reveal, control, holy_damage, etc.)
 * @returns {Array<Object>} Matching techniques
 */
export function getTechniquesByTag(techniqueCatalog, tier) {
  if (!techniqueCatalog || techniqueCatalog.length === 0) return [];

  return techniqueCatalog.filter(technique => {
    const tags = tagTechnique(technique);
    return tags.includes(tier);
  });
}

/**
 * Check if technique matches any of the priority tiers
 * @param {Object} technique - Technique object
 * @param {Array<string>} priorityList - Priority list
 * @returns {boolean} True if technique matches a priority tier
 */
export function techniqueMatchesPriority(technique, priorityList) {
  if (!technique || !priorityList) return false;

  const tags = tagTechnique(technique);
  return priorityList.some(tier => tags.includes(tier));
}

