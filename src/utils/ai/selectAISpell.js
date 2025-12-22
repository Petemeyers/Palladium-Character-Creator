/**
 * AI Spell Selection System
 * Selects appropriate spells for AI casters based on combat situation
 */

import { isCombatSupportedSpell, getSpellCost, isHealingSpell, hasSpellDamage, isSupportSpell } from "../spellUtils.js";

export function selectAISpell(caster, spellbook, fighters, positions, lastSpellMemory = {}) {
  if (!spellbook || spellbook.length === 0) {
    return null;
  }

  const enemies = fighters.filter(f => f.type !== caster.type && f.currentHP > 0);
  const allies = fighters.filter(f => f.type === caster.type && f.currentHP > 0);
  
  // Get current PPE
  const currentPPE = caster.currentPPE ?? caster.PPE ?? 0;
  
  // Filter to combat-supported spells that the caster can afford
  let availableSpells = spellbook.filter(spell => {
    // Must be combat-supported
    if (!isCombatSupportedSpell(spell)) return false;
    
    // Must be affordable
    const cost = getSpellCost(spell);
    if (cost > currentPPE) return false;
    
    return true;
  });
  
  // Avoid repeating the same spell 3 turns in a row
  const lastSpellName = lastSpellMemory[caster.id];
  if (lastSpellName) {
    // Filter out spells that were cast in the last 2 turns
    const recentSpells = lastSpellMemory[`${caster.id}_recent`] || [];
    availableSpells = availableSpells.filter(spell => 
      !recentSpells.includes(spell.name)
    );
    
    // If we filtered everything out, allow repeats (better than no spell)
    if (availableSpells.length === 0) {
      availableSpells = spellbook.filter(spell => {
        if (!isCombatSupportedSpell(spell)) return false;
        const cost = getSpellCost(spell);
        return cost <= currentPPE;
      });
    }
  }

  // Priority 1: Healing - if any ally is below 50% HP
  const woundedAllies = allies.filter(a => {
    const maxHP = a.maxHP || a.HP || a.hitPoints || 100;
    const currentHP = a.currentHP || a.hp || 0;
    return currentHP < maxHP / 2;
  });

  if (woundedAllies.length > 0) {
    // Look for healing spells from available (combat-supported) spells
    const healingSpells = availableSpells.filter(s => isHealingSpell(s));

    if (healingSpells.length > 0) {
      return healingSpells[0]; // Return first healing spell found
    }
  }

  // Priority 2: Control/Debuff spells - if enemies are present
  if (enemies.length > 0) {
    const controlSpells = availableSpells.filter(s => {
      const name = (s.name || "").toLowerCase();
      const desc = (s.description || "").toLowerCase();
      return name.includes("paralyze") || name.includes("sleep") || 
             name.includes("charm") || name.includes("hold") ||
             name.includes("blind") || name.includes("slow") ||
             desc.includes("paralyze") || desc.includes("stun") ||
             s.tags?.includes("control") || s.tags?.includes("debuff");
    });

    if (controlSpells.length > 0) {
      return controlSpells[0]; // Return first control spell found
    }
  }

  // Priority 3: Direct damage spells - if enemies are present
  if (enemies.length > 0) {
    const damageSpells = availableSpells.filter(s => hasSpellDamage(s) && !isHealingSpell(s));

    if (damageSpells.length > 0) {
      // Prefer higher damage spells if available
      const sortedByDamage = damageSpells.sort((a, b) => {
        const aDmg = parseDamage(a.damage || a.combatDamage || "0");
        const bDmg = parseDamage(b.damage || b.combatDamage || "0");
        return bDmg - aDmg;
      });
      return sortedByDamage[0];
    }
  }

  // Fallback: Return random spell from available (combat-supported) spells
  if (availableSpells.length > 0) {
    return availableSpells[Math.floor(Math.random() * availableSpells.length)];
  }
  
  // Last resort: return null if no combat-supported spells available
  return null;
}

/**
 * Parse damage string to get average damage value for comparison
 * @param {string} damageStr - Damage string like "1d6+2" or "2d4"
 * @returns {number} Average damage value
 */
function parseDamage(damageStr) {
  if (!damageStr || typeof damageStr !== "string") return 0;
  
  try {
    // Simple parser for dice expressions like "1d6+2" or "2d4"
    const match = damageStr.match(/(\d+)d(\d+)([+-]\d+)?/);
    if (match) {
      const dice = parseInt(match[1], 10);
      const sides = parseInt(match[2], 10);
      const bonus = match[3] ? parseInt(match[3], 10) : 0;
      return (dice * (sides + 1) / 2) + bonus;
    }
  } catch (e) {
    // Ignore parse errors
  }
  
  return 0;
}

