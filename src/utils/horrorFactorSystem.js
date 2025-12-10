// ==========================================
// Palladium RPG Horror Factor System (Visibility-Aware)
// ==========================================
//
// Integrates with:
//   - terrainSystem.js  (line of sight)
//   - visibilityCalculator.js (lighting / visibility range)
//   - aiVisibilityFilter.js (comprehensive visibility checks)
//   - savingThrowsSystem.js  (for canonical saves)
//   - statusEffectSystem.js (for fear conditions)
//   - combatEngine.js        (triggered on sight)
//
// Canonical HF saves now only trigger when a creature becomes visible
// within 60 ft line of sight or lighting allows identification.
//
// ==========================================

import { rollSavingThrow } from "./savingThrowsSystem.js";
import { applyStatusEffect } from "./statusEffectSystem.js";
import { calculateLineOfSight, applyLightingEffects } from "./terrainSystem.js";
import { getVisibilityRange } from "./visibilityCalculator.js";
import { canAISeeTarget } from "./aiVisibilityFilter.js";
import { calculateDistance } from "../data/movementRules.js";
import CryptoSecureDice from "./cryptoDice.js";

/**
 * Get Horror Factor from a creature
 * @param {Object} creature - Creature/combatant object
 * @returns {number} Horror Factor (0 if none)
 */
export function getHorrorFactor(creature) {
  return (
    creature.HF ||
    creature.horrorFactor ||
    creature.horror_factor ||
    creature.abilities?.horrorFactor ||
    0
  );
}

/**
 * Check if a creature has a Horror Factor
 * @param {Object} creature - Creature/combatant object
 * @returns {boolean} True if creature has HF >= 8
 */
export function hasHorrorFactor(creature) {
  const HF = getHorrorFactor(creature);
  return HF >= 8; // Minimum threshold per rulebook
}

/**
 * Trigger Horror Factor saves for all opponents
 * @param {Object} creature - Combatant with HF
 * @param {Array} targets - Array of opposing combatants
 * @param {Object} terrain - Terrain data with obstacles, lighting (optional)
 * @param {Function} log - logCallback from CombatEngine
 * @param {Object} options - Optional settings
 * @param {boolean} options.bypassRepeatCheck - Skip repeat encounter check (default: false)
 * @param {boolean} options.terrifyingAction - If true, adds +2 to HF (default: false)
 * @param {boolean} options.repeatEncounter - If true, reduces HF by 2 (default: false)
 * @param {Object} options.positions - Map of combatant positions {id: {x, y}} (for visibility checks)
 */
export function triggerHorrorFactor(
  creature,
  targets,
  terrain = {},
  log = console.log,
  options = {}
) {
  const {
    bypassRepeatCheck = false,
    terrifyingAction = false,
    repeatEncounter = false,
  } = options;

  let HF = getHorrorFactor(creature);

  // Below threshold = ignore
  if (!HF || HF < 8) return;

  // Apply modifiers
  if (terrifyingAction) {
    HF += 2; // +2 for witnessing terrifying acts
  }
  if (repeatEncounter) {
    HF -= 2; // -2 for repeat encounters (veteran monster hunters)
  }

  // Ensure HF doesn't go below minimum
  HF = Math.max(8, HF);

  const positions = options.positions || {};

  targets.forEach((target) => {
    const creatureId = creature.id || creature.name?.toLowerCase() || "unknown";
    
    // Skip if target already rolled vs this creature type (unless bypassed)
    // Use meta.horrorChecks for consistent tracking (same as horrorSystem.js)
    if (!bypassRepeatCheck) {
      const prevChecks = target.meta?.horrorChecks || {};
      if (prevChecks[creatureId]) {
        return; // Already checked this encounter
      }
    }

    // Visibility check - only trigger if target can actually see the creature
    const visible = isVisibleToTarget(creature, target, terrain, positions);
    if (!visible) {
      return; // Skip until target has LOS and lighting allows identification
    }

    // Mark as checked once visible (prevents re-triggering on same sighting)
    // Use meta.horrorChecks for consistent tracking
    if (!bypassRepeatCheck) {
      const currentRound = options.currentRound ?? options.meleeRound ?? 1;
      const prevChecks = target.meta?.horrorChecks || {};
      target.meta = {
        ...(target.meta || {}),
        horrorChecks: {
          ...prevChecks,
          [creatureId]: {
            round: currentRound,
            result: "pending", // Will be updated after save roll
          },
        },
      };
    }

    log(`👁️ ${creature.name} emerges into view! Horror Factor ${HF}`, "horror");

    // Perform Horror save (using canonical saving throw system)
    // Note: HF value IS the save target (not base 12)
    // Use a silent log to prevent double-logging, then log with correct HF target
    const saveResult = rollSavingThrow({
      type: "horror",
      character: target,
      log: () => {}, // Silent - we'll log manually with correct HF target
    });

    // Calculate actual save success against HF value (HF is the target, not base 12)
    const actualSaveTarget = HF;
    const saveSuccess = saveResult.total >= actualSaveTarget;

    // Update meta to record the result
    if (!bypassRepeatCheck) {
      const currentRound = options.currentRound ?? options.meleeRound ?? 1;
      const prevChecks = target.meta?.horrorChecks || {};
      target.meta = {
        ...(target.meta || {}),
        horrorChecks: {
          ...prevChecks,
          [creatureId]: {
            round: currentRound,
            result: saveSuccess ? "success" : "fail",
          },
        },
      };
    }

    // Log with correct HF target (includes tempBonus from courage auras if present)
    const tempBonusDisplay =
      saveResult.tempBonus > 0
        ? ` (including +${saveResult.tempBonus} from courage)`
        : "";
    const details = `🎲 Save vs HORROR (HF ${HF}): rolled ${saveResult.roll} + ${saveResult.totalBonus} = ${saveResult.total} (need ${HF})${tempBonusDisplay}`;
    if (saveSuccess) {
      log(`🛡️ ${target.name} succeeds! ${details}`, "save");
    } else {
      log(`💀 ${target.name} fails. ${details}`, "save");
    }

    if (saveSuccess) {
      log(
        `😤 ${target.name} steels their nerves against ${creature.name}.`,
        "save"
      );
      return;
    }

    // Calculate failure margin
    const margin = actualSaveTarget - saveResult.total;

    // Apply canonical failure results based on margin
    if (margin <= 3) {
      // Fail by 1-3: Shaken for 1 melee round
      const shakenResult = applyStatusEffect(target, "SHAKEN", {
        caster: creature,
        logCallback: log,
        bypassSave: true, // Already rolled save above
      });

      if (shakenResult.success) {
        // Override duration to 1 melee round
        const shakenEffect = target.statusEffects?.find(
          (e) => e.name === "SHAKEN"
        );
        if (shakenEffect) {
          shakenEffect.remainingRounds = 1;
          shakenEffect.duration = 1;
        }
        log(
          `😨 ${target.name} is shaken by ${creature.name}'s presence and fights at a penalty for 1 melee!`,
          "status"
        );
      }
    } else if (margin <= 6) {
      // Fail by 4-6: Hesitates (lose one action) for 1 melee round
      const hesitantResult = applyStatusEffect(target, "HESITANT", {
        caster: creature,
        logCallback: log,
        bypassSave: true, // Already rolled save above
      });

      if (hesitantResult.success) {
        const hesitantEffect = target.statusEffects?.find(
          (e) => e.name === "HESITANT"
        );
        if (hesitantEffect) {
          hesitantEffect.remainingRounds = 1;
          hesitantEffect.duration = 1;
        }
        log(
          `😰 ${target.name} hesitates in terror and loses their next action!`,
          "status"
        );
      }
    } else {
      // Fail by 7+: Flee uncontrollably 1-4 melees
      const fleeDur = Math.max(1, Math.floor(CryptoSecureDice.rollDie(4)));

      const fleeingResult = applyStatusEffect(target, "FLEEING", {
        caster: creature,
        logCallback: log,
        bypassSave: true, // Already rolled save above
      });

      if (fleeingResult.success) {
        // Override duration
        const fleeingEffect = target.statusEffects?.find(
          (e) => e.name === "FLEEING"
        );
        if (fleeingEffect) {
          fleeingEffect.remainingRounds = fleeDur;
          fleeingEffect.duration = fleeDur;
        }
        log(
          `😱 ${target.name} breaks and flees in terror for ${fleeDur} melee${
            fleeDur > 1 ? "s" : ""
          }!`,
          "status"
        );
      }
    }

    // Check for critical failure (natural 1)
    if (saveResult.roll === 1) {
      log(`💀 ${target.name} suffers total mental collapse!`, "horror");
      // Apply most severe effect (fleeing) with extended duration
      const fleeingResult = applyStatusEffect(target, "FLEEING", {
        caster: creature,
        logCallback: log,
        bypassSave: true,
      });

      if (fleeingResult.success) {
        const fleeingEffect = target.statusEffects?.find(
          (e) => e.name === "FLEEING"
        );
        if (fleeingEffect) {
          fleeingEffect.remainingRounds = 10; // Extended duration for critical failure
          fleeingEffect.duration = 10;
        }
        log(`😱 ${target.name} flees blindly until out of sight!`, "status");
      }
    }
  });
}

/**
 * Reset horror checks for a new encounter
 * Call this when starting a new combat encounter
 * @param {Array} combatants - Array of combatants
 */
export function resetHorrorChecks(combatants) {
  combatants.forEach((c) => {
    // Clear both old _horrorChecked Set and new meta.horrorChecks
    if (c._horrorChecked) {
      c._horrorChecked.clear();
    }
    if (c.meta?.horrorChecks) {
      c.meta.horrorChecks = {};
    }
  });
}

/**
 * Determine if target can *see* the source creature.
 * Uses terrain system, lighting, and nightvision rules.
 * @param {Object} source - Creature with HF
 * @param {Object} target - Observer trying to see source
 * @param {Object} terrain - Terrain data with obstacles, lighting
 * @param {Object} positions - Map of combatant positions {id: {x, y}}
 * @returns {boolean} True if target can see source
 */
function isVisibleToTarget(source, target, terrain = {}, positions = {}) {
  // Use comprehensive AI visibility filter if available
  if (positions && positions[source.id] && positions[target.id]) {
    try {
      const canSee = canAISeeTarget(target, source, positions, terrain);
      return canSee;
    } catch (e) {
      // Fallback to manual check if aiVisibilityFilter fails
      console.warn("AI visibility filter failed, using manual check:", e);
    }
  }

  // Manual visibility check (fallback)
  const sourcePos = source.position || positions[source.id];
  const targetPos = target.position || positions[target.id];

  if (!sourcePos || !targetPos) {
    return false; // Missing position data
  }

  // Calculate distance
  const distance = calculateDistance(sourcePos, targetPos);

  // Line of sight check (terrain aware)
  const terrainObstacles = terrain.obstacles || [];
  const losResult = calculateLineOfSight(sourcePos, targetPos, {
    obstacles: terrainObstacles,
  });

  if (!losResult.hasLineOfSight) {
    return false; // Blocked by terrain
  }

  // Lighting & night vision modifiers
  const lighting =
    terrain.lighting || terrain.lightingData?.name || "BRIGHT_DAYLIGHT";
  const hasInfravision = target.hasInfravision || false;

  // Get visibility range based on lighting
  const visibilityRange = getVisibilityRange(lighting, hasInfravision, target);

  // Check if within visibility range
  if (distance > visibilityRange) {
    return false; // Beyond visibility range
  }

  // Apply lighting effects (includes nightvision checks)
  const lightingResult = applyLightingEffects(
    distance,
    lighting,
    hasInfravision,
    target // For nightvision check
  );

  // If target has night vision, check if it extends range
  const nvRange = target.abilities?.senses?.nightvision?.range || 0;
  const effectiveVision = visibilityRange + nvRange;

  // Can see if within effective vision range and lighting allows
  return distance <= effectiveVision && lightingResult.canSee;
}

/**
 * Trigger Horror Factor for all visible opponents
 * This version filters targets by visibility before triggering
 * @param {Object} creature - Combatant with HF
 * @param {Array} allCombatants - All combatants in encounter
 * @param {Object} terrain - Terrain data with obstacles, lighting
 * @param {Function} log - logCallback
 * @param {Object} options - Optional settings
 */
export function triggerHorrorFactorVisible(
  creature,
  allCombatants,
  terrain = {},
  log = console.log,
  options = {}
) {
  const positions = options.positions || {};

  // Filter to only opponents that can see the creature
  const visibleTargets = allCombatants.filter((target) => {
    if (target === creature) return false;
    if (target.type === creature.type) return false; // Same side
    return isVisibleToTarget(creature, target, terrain, positions);
  });

  triggerHorrorFactor(creature, visibleTargets, terrain, log, options);
}
