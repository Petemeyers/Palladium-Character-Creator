// ==========================================
// Medieval Combat Simulator dreadRating System (Visibility-Aware)
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
// Canonical dreadRating saves now only trigger when a combatant becomes visible
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
 * Get dreadRating from a combatant
 * @param {Object} combatant - Combatant/combatant object
 * @returns {number} dreadRating (0 if none)
 */
export function getHorrorFactor(combatant) {
  return (
    combatant.dreadRating ||
    combatant.dreadRating ||
    combatant.horror_factor ||
    combatant.abilities?.dreadRating ||
    0
  );
}

/**
 * Check if a combatant has a dreadRating
 * @param {Object} combatant - Combatant/combatant object
 * @returns {boolean} True if combatant has dreadRating >= 8
 */
export function hasHorrorFactor(combatant) {
  const dreadRating = getHorrorFactor(combatant);
  return dreadRating >= 8; // Minimum threshold per rulebook
}

/**
 * Trigger dreadRating saves for all opponents
 * @param {Object} combatant - Combatant with dreadRating
 * @param {Array} targets - Array of opposing combatants
 * @param {Object} terrain - Terrain data with obstacles, lighting (optional)
 * @param {Function} log - logCallback from CombatEngine
 * @param {Object} options - Optional settings
 * @param {boolean} options.bypassRepeatCheck - Skip repeat encounter check (default: false)
 * @param {boolean} options.terrifyingAction - If true, adds +2 to dreadRating (default: false)
 * @param {boolean} options.repeatEncounter - If true, reduces dreadRating by 2 (default: false)
 * @param {Object} options.positions - Map of combatant positions {id: {x, y}} (for visibility checks)
 */
export function triggerHorrorFactor(
  combatant,
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

  let dreadRating = getHorrorFactor(combatant);

  // Below threshold = ignore
  if (!dreadRating || dreadRating < 8) return;

  // Apply modifiers
  if (terrifyingAction) {
    dreadRating += 2; // +2 for witnessing terrifying acts
  }
  if (repeatEncounter) {
    dreadRating -= 2; // -2 for repeat encounters (veteran opponent hunters)
  }

  // Ensure dreadRating doesn't go below minimum
  dreadRating = Math.max(8, dreadRating);

  const positions = options.positions || {};

  targets.forEach((target) => {
    const combatantId = combatant.id || combatant.name?.toLowerCase() || "unknown";
    
    // Skip if target already rolled vs this combatant type (unless bypassed)
    // Use meta.horrorChecks for consistent tracking (same as dreadSystem.js)
    if (!bypassRepeatCheck) {
      const prevChecks = target.meta?.horrorChecks || {};
      if (prevChecks[combatantId]) {
        return; // Already checked this encounter
      }
    }

    // Visibility check - only trigger if target can actually see the combatant
    const visible = isVisibleToTarget(combatant, target, terrain, positions);
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
          [combatantId]: {
            round: currentRound,
            result: "pending", // Will be updated after save roll
          },
        },
      };
    }

    log(`ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ‚ÂÃƒÂ¯Ã‚Â¸Ã‚Â ${combatant.name} emerges into view! dreadRating ${dreadRating}`, "horror");

    // Perform courageCheck (using canonical saving throw system)
    // Note: dreadRating value IS the save target (not base 12)
    // Use a silent log to prevent double-logging, then log with correct dreadRating target
    const saveResult = rollSavingThrow({
      type: "horror",
      character: target,
      log: () => {}, // Silent - we'll log manually with correct dreadRating target
    });

    // Calculate actual save success against dreadRating value (dreadRating is the target, not base 12)
    const actualSaveTarget = dreadRating;
    const saveSuccess = saveResult.total >= actualSaveTarget;

    // Update meta to record the result
    if (!bypassRepeatCheck) {
      const currentRound = options.currentRound ?? options.meleeRound ?? 1;
      const prevChecks = target.meta?.horrorChecks || {};
      target.meta = {
        ...(target.meta || {}),
        horrorChecks: {
          ...prevChecks,
          [combatantId]: {
            round: currentRound,
            result: saveSuccess ? "success" : "fail",
          },
        },
      };
    }

    // Log with correct dreadRating target (includes tempBonus from courage auras if present)
    const tempBonusDisplay =
      saveResult.tempBonus > 0
        ? ` (including +${saveResult.tempBonus} from courage)`
        : "";
    const details = `ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â² Save vs HORROR (dreadRating ${dreadRating}): rolled ${saveResult.roll} + ${saveResult.totalBonus} = ${saveResult.total} (need ${dreadRating})${tempBonusDisplay}`;
    if (saveSuccess) {
      log(`ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂºÃ‚Â¡ÃƒÂ¯Ã‚Â¸Ã‚Â ${target.name} succeeds! ${details}`, "save");
    } else {
      log(`ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â€šÂ¬ ${target.name} fails. ${details}`, "save");
    }

    if (saveSuccess) {
      log(
        `ÃƒÂ°Ã…Â¸Ã‹Å“Ã‚Â¤ ${target.name} steels their nerves against ${combatant.name}.`,
        "save"
      );
      return;
    }

    // Calculate failure margin
    const margin = actualSaveTarget - saveResult.total;

    // Apply canonical failure results based on margin
    if (margin <= 3) {
      // Fail by 1-3: Shaken for 1 combat round
      const shakenResult = applyStatusEffect(target, "SHAKEN", {
        caster: combatant,
        logCallback: log,
        bypassSave: true, // Already rolled save above
      });

      if (shakenResult.success) {
        // Override duration to 1 combat round
        const shakenEffect = target.statusEffects?.find(
          (e) => e.name === "SHAKEN"
        );
        if (shakenEffect) {
          shakenEffect.remainingRounds = 1;
          shakenEffect.duration = 1;
        }
        log(
          `ÃƒÂ°Ã…Â¸Ã‹Å“Ã‚Â¨ ${target.name} is shaken by ${combatant.name}'s presence and fights at a penalty for 1 melee!`,
          "status"
        );
      }
    } else if (margin <= 6) {
      // Fail by 4-6: Hesitates (lose one action) for 1 combat round
      const hesitantResult = applyStatusEffect(target, "HESITANT", {
        caster: combatant,
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
          `ÃƒÂ°Ã…Â¸Ã‹Å“Ã‚Â° ${target.name} hesitates in terror and loses their next action!`,
          "status"
        );
      }
    } else {
      // Fail by 7+: Flee unconchampionably 1-4 melees
      const fleeDur = Math.max(1, Math.floor(CryptoSecureDice.rollDie(4)));

      const fleeingResult = applyStatusEffect(target, "FLEEING", {
        caster: combatant,
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
          `ÃƒÂ°Ã…Â¸Ã‹Å“Ã‚Â± ${target.name} breaks and flees in terror for ${fleeDur} melee${
            fleeDur > 1 ? "s" : ""
          }!`,
          "status"
        );
      }
    }

    // Check for critical failure (natural 1)
    if (saveResult.roll === 1) {
      log(`ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â€šÂ¬ ${target.name} suffers total mental collapse!`, "horror");
      // Apply most severe effect (fleeing) with extended duration
      const fleeingResult = applyStatusEffect(target, "FLEEING", {
        caster: combatant,
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
        log(`ÃƒÂ°Ã…Â¸Ã‹Å“Ã‚Â± ${target.name} flees blindly until out of sight!`, "status");
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
 * Determine if target can *see* the source combatant.
 * Uses terrain system, lighting, and nightvision rules.
 * @param {Object} source - Combatant with dreadRating
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
 * Trigger dreadRating for all visible opponents
 * This version filters targets by visibility before triggering
 * @param {Object} combatant - Combatant with dreadRating
 * @param {Array} allCombatants - All combatants in encounter
 * @param {Object} terrain - Terrain data with obstacles, lighting
 * @param {Function} log - logCallback
 * @param {Object} options - Optional settings
 */
export function triggerHorrorFactorVisible(
  combatant,
  allCombatants,
  terrain = {},
  log = console.log,
  options = {}
) {
  const positions = options.positions || {};

  // Filter to only opponents that can see the combatant
  const visibleTargets = allCombatants.filter((target) => {
    if (target === combatant) return false;
    if (target.type === combatant.type) return false; // Same side
    return isVisibleToTarget(combatant, target, terrain, positions);
  });

  triggerHorrorFactor(combatant, visibleTargets, terrain, log, options);
}
