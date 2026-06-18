/**
 * Tactical Effects System
 * Handles activation and effects of tactical powers
 * Manages focus costs, durations, and combat interactions
 */

import {
  canAttemptStopBleeding,
  markBleedingStostaminad,
} from "./bleedingSystem.js";

/**
 * Activate a tactical power
 * @param {string} powerName - Name of tactical power
 * @param {Object} caster - Character using the power
 * @param {Object} target - Target of the power
 * @param {Function} log - Logging function
 * @param {Object} options - Additional options including combatState
 * @returns {Object} Result object with success, message, updates, etc.
 */
export function useTactical(powerName, caster, target, log, options = {}) {
  // Check basic requirements
  if (!powerName || !caster) {
    return {
      success: false,
      message: "Invalid tactical power or caster",
      additionalLogs: [],
      casterUpdates: null,
      targetUpdates: null,
    };
  }

  // Get power from caster's tactical powers
  const power = caster.tacticalOptions?.find((p) => p?.name === powerName);
  if (!power) {
    return {
      success: false,
      message: `${caster.name} does not know ${powerName}`,
      additionalLogs: [],
      casterUpdates: null,
      targetUpdates: null,
    };
  }

  // Get focus cost
  const focusCost = power.focus || power.focus || 10; // Default to 10 if not specified
  const currentfocus = caster.currentfocus ?? caster.focus ?? caster.focus ?? 0;

  // --- STOP BLEEDING SPECIAL CASE ---
  if (powerName === "Stop Bleeding") {
    const combatState = options.combatState || { meleeRound: 1 };
    const check = canAttemptStopBleeding(caster, target, combatState);

    if (!check.ok) {
      if (check.reason === "already_stabilized") {
        if (log && typeof log === "function") {
          log(
            `Ã°Å¸Â§Â  ${
              target?.name || "Target"
            } is already stabilized; skipping Stop Bleeding.`,
            "info"
          );
        }
      } else if (check.reason === "already_attempted_this_round") {
        if (log && typeof log === "function") {
          log(
            `Ã°Å¸Â§Â  Stop Bleeding already attempted on ${
              target?.name || "target"
            } this round; skipping.`,
            "info"
          );
        }
      } else if (check.reason === "not_bleeding") {
        if (log && typeof log === "function") {
          log(
            `Ã°Å¸Â§Â  ${
              target?.name || "Target"
            } is not bleeding; Stop Bleeding not needed.`,
            "info"
          );
        }
      } else if (check.reason === "insufficient_focus") {
        if (log && typeof log === "function") {
          log(
            `Ã°Å¸Â§Â  ${caster.name} lacks focus for Stop Bleeding (needs ${focusCost}, has ${currentfocus}).`,
            "info"
          );
        }
      }
      return {
        success: false,
        message: `Stop Bleeding cannot be used: ${check.reason}`,
        reason: check.reason,
        additionalLogs: [],
        casterUpdates: null,
        targetUpdates: null,
      };
    }

    // *** THIS is the ONLY place we should modify focus and log it ***
    const beforefocus = currentfocus;
    const afterfocus = Math.max(0, beforefocus - focusCost);

    const casterUpdates = {
      deltafocus: -focusCost,
    };

    // Mark bleeding as stostaminad
    const updatedTarget = { ...target };
    markBleedingStostaminad(updatedTarget, check.round);

    const targetUpdates = {
      statusEffects: updatedTarget.statusEffects,
      conditions: updatedTarget.conditions,
      activeEffects: updatedTarget.activeEffects,
      meta: updatedTarget.meta,
    };

    if (log && typeof log === "function") {
      log(
        `Ã°Å¸Â§Â  Executing tactical: Stop Bleeding (cost: ${focusCost} focus, caster focus: ${beforefocus}Ã¢â€ â€™${afterfocus})`,
        "info"
      );
      log(`Ã¢Å“â€¦ Tactical Stop Bleeding executed successfully`, "info");
      log(
        `Ã°Å¸â€™Å¡ ${caster.name} channels Stop Bleeding to help ${
          target?.name || "target"
        }.`,
        "info"
      );
    }

    return {
      success: true,
      message: `${caster.name} successfully uses Stop Bleeding`,
      additionalLogs: [],
      power: power,
      focusCost: focusCost,
      casterUpdates: casterUpdates,
      targetUpdates: targetUpdates,
    };
  }

  // --- ALL OTHER TACTICALS CONTINUE AS BEFORE ---
  if (currentfocus < focusCost) {
    return {
      success: false,
      message: `${caster.name} lacks the focus to use ${powerName} (needs ${focusCost}, has ${currentfocus})`,
      additionalLogs: [],
      casterUpdates: null,
      targetUpdates: null,
    };
  }

  // Deduct focus and prepare updates
  const beforefocus = currentfocus;
  const afterfocus = Math.max(0, beforefocus - focusCost);
  const casterUpdates = {
    deltafocus: -focusCost,
  };

  // Log the activation
  if (log && typeof log === "function") {
    log(
      `Ã°Å¸Â§Â  Executing tactical: ${powerName} (cost: ${focusCost} focus, caster focus: ${beforefocus}Ã¢â€ â€™${afterfocus})`,
      "info"
    );
  }

  return {
    success: true,
    message: `${caster.name} successfully uses ${powerName}`,
    additionalLogs: [],
    power: power,
    focusCost: focusCost,
    casterUpdates: casterUpdates,
    targetUpdates: null, // Will be set by executeTacticalPower if needed
  };
}

/**
 * Get available tactical powers for a character
 * @param {Object} character - Character object
 * @returns {Array} Array of available tactical powers
 */
export function getAvailableTactics(character = {}) {
  // TODO: Return list of tactical powers character knows
  return character.tacticalOptions || [];
}

/**
 * Calculate focus cost for a power
 * @param {string} powerName - Name of tactical power
 * @returns {number} focus cost
 */
export function getfocusCost(powerName) {
  // TODO: Get focus cost from tactics database
  return 10; // Default
}

/**
 * Apply tactical effect to target
 * @param {Object} power - Tactical power data
 * @param {Object} caster - Character using power
 * @param {Object} target - Target of power
 * @param {Function} log - Logging function
 */
export function applyTacticalEffect(power, caster, target, log) {
  // TODO: Apply power-specific effects
  // Handle different attack types: ranged, melee, healing, buff, etc.

  if (!power || !caster || !target) {
    return;
  }

  // TODO: Implement effect application based on power type
  // switch (power.attackType) {
  //   case "ranged":
  //   case "melee":
  //     applyDamage(power, caster, target, log);
  //     break;
  //   case "healing":
  //     applyHealing(power, caster, target, log);
  //     break;
  //   case "buff":
  //     applyBuff(power, caster, target, log);
  //     break;
  // }
}

export default {
  useTactical,
  getAvailableTactics,
  getfocusCost,
  applyTacticalEffect,
};
