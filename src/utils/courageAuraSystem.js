// ==========================================
// Palladium RPG Courage / Holy Aura System
// ==========================================
//
// Holy or divine characters can project courage,
// countering demonic or supernatural Horror Factors.
// Based on rulebook: Ward of Protection vs Fear, Priests of Light aura,
// Circle of Protection vs Undead/Demons.
//
// Integrates with:
//   - horrorFactorSystem.js (fear auras)
//   - savingThrowsSystem.js (bonuses)
//   - statusEffectSystem.js (remove fear)
//   - combatEngine.js
//
// ==========================================

import { calculateDistance } from "../data/movementRules.js";

/**
 * Define default courage aura parameters by OCC.
 */
export const COURAGE_AURA_PRESETS = {
  "Priest of Light": { radius: 60, bonus: 4, dispelsFear: true },
  PriestOfLight: { radius: 60, bonus: 4, dispelsFear: true },
  Cleric: { radius: 40, bonus: 3, dispelsFear: true },
  Priest: { radius: 40, bonus: 3, dispelsFear: true },
  Paladin: { radius: 50, bonus: 2, dispelsFear: true },
  "Priest of Darkness": { radius: 40, bonus: 2, dispelsFear: false },
  PriestOfDarkness: { radius: 40, bonus: 2, dispelsFear: false },
  "Ward of Protection": { radius: 20, bonus: 2, dispelsFear: true },
};

/**
 * Determine if a combatant emits a courage aura.
 * @param {Object} character - Character to check
 * @returns {boolean} True if character has courage aura
 */
export function hasCourageAura(character) {
  const occ = (character.occ || character.OCC || "").toLowerCase();

  // Check explicit flag first
  if (character.hasCourageAura) {
    return true;
  }

  // Check OCC name against presets
  return Object.keys(COURAGE_AURA_PRESETS).some((key) =>
    occ.includes(key.toLowerCase())
  );
}

/**
 * Get courage aura preset for a character.
 * @param {Object} character - Character with courage aura
 * @returns {Object} Aura preset {radius, bonus, dispelsFear}
 */
export function getCourageAuraPreset(character) {
  const occ = character.occ || character.OCC || "";

  // Find matching preset
  const presetKey = Object.keys(COURAGE_AURA_PRESETS).find((key) =>
    occ.toLowerCase().includes(key.toLowerCase())
  );

  return presetKey
    ? COURAGE_AURA_PRESETS[presetKey]
    : COURAGE_AURA_PRESETS["Priest of Light"]; // Default
}

/**
 * Calculate distance between two combatants.
 * @param {Object} pos1 - Position {x, y}
 * @param {Object} pos2 - Position {x, y}
 * @returns {number} Distance in feet
 */
function getDistanceInFeet(pos1, pos2) {
  if (!pos1 || !pos2) return Infinity;

  // If positions are already in feet, use them directly
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const distanceInCells = Math.hypot(dx, dy);

  // Assume 5 feet per cell (standard hex/square grid)
  return distanceInCells * 5;
}

/**
 * Apply courage aura effects at start of each melee.
 * Raises Horror save bonuses and may dispel fear.
 * @param {Array} combatants - All combatants in encounter
 * @param {Object} positions - Map of combatant positions {id: {x, y}}
 * @param {Function} log - Logging callback
 */
export function processCourageAuras(
  combatants,
  positions = {},
  log = console.log
) {
  const holySources = combatants.filter((c) => hasCourageAura(c));

  if (!holySources.length) return;

  holySources.forEach((source) => {
    const preset = getCourageAuraPreset(source);

    log(
      `✨ ${source.name}'s holy aura radiates courage (${preset.radius} ft, +${preset.bonus} vs Horror)!`,
      "holy"
    );

    combatants.forEach((target) => {
      // Only affects allies (same type/side)
      if (target.type !== source.type || target === source) return;

      // Get positions
      const sourcePos = source.position || positions[source.id];
      const targetPos = target.position || positions[target.id];

      if (!sourcePos || !targetPos) {
        // Fallback: assume within range if positions unavailable
        // (for backward compatibility with non-positional combat)
        return;
      }

      // Calculate distance
      const distance = getDistanceInFeet(sourcePos, targetPos);

      if (distance > preset.radius) return; // Out of range

      // Add a courage bonus to Horror saves this melee
      target.tempBonuses = target.tempBonuses || {};
      target.tempBonuses.horrorSave =
        (target.tempBonuses.horrorSave || 0) + preset.bonus;

      log(
        `🛡️ ${target.name} feels strengthened by ${source.name}'s faith (+${preset.bonus} to Horror saves).`,
        "holy"
      );

      // Optionally dispel fear effects
      if (
        preset.dispelsFear &&
        target.statusEffects &&
        target.statusEffects.length > 0
      ) {
        const fearEffects = ["FEAR", "PARALYZED", "STUNNED"];
        let removedCount = 0;

        // Remove fear-related status effects
        fearEffects.forEach((effectName) => {
          // Check if effect exists (match by name or type field)
          const effectIndex = target.statusEffects.findIndex(
            (e) => e.name === effectName || e.type === effectName
          );

          if (effectIndex >= 0) {
            target.statusEffects.splice(effectIndex, 1);
            removedCount++;
          }
        });

        if (removedCount > 0) {
          log(
            `💖 ${source.name}'s aura banishes fear from ${target.name}.`,
            "holy"
          );
        }
      }
    });
  });
}

/**
 * Clear temporary courage bonuses after each melee.
 * @param {Array} combatants - All combatants in encounter
 */
export function clearCourageBonuses(combatants) {
  combatants.forEach((c) => {
    if (c.tempBonuses && c.tempBonuses.horrorSave) {
      delete c.tempBonuses.horrorSave;
    }
  });
}
