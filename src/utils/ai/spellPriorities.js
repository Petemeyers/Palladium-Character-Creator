// src/utils/ai/spellPriorities.js
/**
 * Role-Based Spell Priority Trees (Palladium-Faithful)
 * 
 * Different spellcasting roles have different priorities:
 * - Angel: Judge, Purifier, Enforcer
 * - Demon: Terror, Corruption, Attrition
 * - Wizard: Tactical Analyst
 */

/**
 * Angel spell priority (Ariel-style)
 * Role: Judge, Purifier, Enforcer
 */
export const ANGEL_SPELL_PRIORITY = [
  "reveal",      // See Aura, Sense Magic, See Invisible
  "control",     // Fear, Immobilization, Control the Field
  "holy_damage", // Holy damage, Smite equivalents
  "melee",       // Fallback to melee
  "withdraw"     // Flight, Teleport (low %)
];

/**
 * Demon spell priority
 * Role: Terror, Corruption, Attrition
 */
export const DEMON_SPELL_PRIORITY = [
  "fear",        // Exploit Fear
  "curse",       // Drain / Curse
  "area_damage", // Area Damage
  "summon",      // Summon Allies
  "escape"       // Escape if banished threatened
];

/**
 * Wizard spell priority
 * Role: Tactical Analyst
 */
export const WIZARD_SPELL_PRIORITY = [
  "analyze",     // See Aura, Sense Magic
  "probe",       // Low-cost elemental spell to test
  "exploit",     // Exploit Confirmed Weakness
  "control",     // Buff / Control
  "escape"       // Retreat
];

/**
 * Get spell priority list based on fighter role/type
 * @param {Object} fighter - Fighter object
 * @returns {Array<string>} Priority list
 */
export function getSpellPriority(fighter) {
  if (!fighter) return WIZARD_SPELL_PRIORITY;

  const name = (fighter.name || "").toLowerCase();
  const category = (fighter.category || "").toLowerCase();
  const species = (fighter.species || "").toLowerCase();
  const type = (fighter.type || "").toLowerCase();

  // Angel detection
  if (name.includes("ariel") || 
      category.includes("angel") || 
      species.includes("angel") ||
      category.includes("creature_of_magic") && name.includes("ariel")) {
    return ANGEL_SPELL_PRIORITY;
  }

  // Demon detection
  if (category.includes("demon") || 
      species.includes("demon") || 
      type.includes("demon") ||
      name.includes("baal") ||
      name.includes("rog")) {
    return DEMON_SPELL_PRIORITY;
  }

  // Default to wizard (tactical analyst)
  return WIZARD_SPELL_PRIORITY;
}

/**
 * Tag a spell by its purpose/type
 * @param {Object} spell - Spell object
 * @returns {Array<string>} Array of tags
 */
export function tagSpell(spell) {
  if (!spell || !spell.name) return [];

  const name = (spell.name || "").toLowerCase();
  const description = (spell.description || spell.effect || "").toLowerCase();
  const tags = [];

  // Reveal/Analysis spells
  if (name.includes("see aura") || name.includes("sense magic") || 
      name.includes("see invisible") || name.includes("detect")) {
    tags.push("reveal", "analyze");
  }

  // Control spells
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
  if (tags.length === 0 && (spell.damage || spell.combatDamage)) {
    tags.push("damage");
  }

  return tags;
}

/**
 * Get spells matching a priority tier
 * @param {Array<Object>} spellCatalog - Available spells
 * @param {string} tier - Priority tier (reveal, control, holy_damage, etc.)
 * @returns {Array<Object>} Matching spells
 */
export function getSpellsByTag(spellCatalog, tier) {
  if (!spellCatalog || spellCatalog.length === 0) return [];

  return spellCatalog.filter(spell => {
    const tags = tagSpell(spell);
    return tags.includes(tier);
  });
}

/**
 * Check if spell matches any of the priority tiers
 * @param {Object} spell - Spell object
 * @param {Array<string>} priorityList - Priority list
 * @returns {boolean} True if spell matches a priority tier
 */
export function spellMatchesPriority(spell, priorityList) {
  if (!spell || !priorityList) return false;

  const tags = tagSpell(spell);
  return priorityList.some(tier => tags.includes(tier));
}

