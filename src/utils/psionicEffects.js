/**
 * Psionic Effects System
 * Handles activation and effects of psionic powers
 * Manages ISP costs, durations, and combat interactions
 */

import {
  canAttemptStopBleeding,
  markBleedingStopped,
} from "./bleedingSystem.js";

/**
 * Activate a psionic power
 * @param {string} powerName - Name of psionic power
 * @param {Object} caster - Character using the power
 * @param {Object} target - Target of the power
 * @param {Function} log - Logging function
 * @param {Object} options - Additional options including combatState
 * @returns {Object} Result object with success, message, updates, etc.
 */
export function usePsionic(powerName, caster, target, log, options = {}) {
  // Check basic requirements
  if (!powerName || !caster) {
    return {
      success: false,
      message: "Invalid psionic power or caster",
      additionalLogs: [],
      casterUpdates: null,
      targetUpdates: null,
    };
  }

  // Get power from caster's psionic powers
  const power = caster.psionicPowers?.find((p) => p?.name === powerName);
  if (!power) {
    return {
      success: false,
      message: `${caster.name} does not know ${powerName}`,
      additionalLogs: [],
      casterUpdates: null,
      targetUpdates: null,
    };
  }

  // Get ISP cost
  const ispCost = power.isp || power.ISP || 10; // Default to 10 if not specified
  const currentISP = caster.currentISP ?? caster.ISP ?? caster.isp ?? 0;

  // --- STOP BLEEDING SPECIAL CASE ---
  if (powerName === "Stop Bleeding") {
    const combatState = options.combatState || { meleeRound: 1 };
    const check = canAttemptStopBleeding(caster, target, combatState);

    if (!check.ok) {
      if (check.reason === "already_stabilized") {
        if (log && typeof log === "function") {
          log(
            `🧠 ${
              target?.name || "Target"
            } is already stabilized; skipping Stop Bleeding.`,
            "info"
          );
        }
      } else if (check.reason === "already_attempted_this_round") {
        if (log && typeof log === "function") {
          log(
            `🧠 Stop Bleeding already attempted on ${
              target?.name || "target"
            } this round; skipping.`,
            "info"
          );
        }
      } else if (check.reason === "not_bleeding") {
        if (log && typeof log === "function") {
          log(
            `🧠 ${
              target?.name || "Target"
            } is not bleeding; Stop Bleeding not needed.`,
            "info"
          );
        }
      } else if (check.reason === "insufficient_isp") {
        if (log && typeof log === "function") {
          log(
            `🧠 ${caster.name} lacks ISP for Stop Bleeding (needs ${ispCost}, has ${currentISP}).`,
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

    // *** THIS is the ONLY place we should modify ISP and log it ***
    const beforeISP = currentISP;
    const afterISP = Math.max(0, beforeISP - ispCost);

    const casterUpdates = {
      deltaISP: -ispCost,
    };

    // Mark bleeding as stopped
    const updatedTarget = { ...target };
    markBleedingStopped(updatedTarget, check.round);

    const targetUpdates = {
      statusEffects: updatedTarget.statusEffects,
      conditions: updatedTarget.conditions,
      activeEffects: updatedTarget.activeEffects,
      meta: updatedTarget.meta,
    };

    if (log && typeof log === "function") {
      log(
        `🧠 Executing psionic: Stop Bleeding (cost: ${ispCost} ISP, caster ISP: ${beforeISP}→${afterISP})`,
        "info"
      );
      log(`✅ Psionic Stop Bleeding executed successfully`, "info");
      log(
        `💚 ${caster.name} channels Stop Bleeding to help ${
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
      ispCost: ispCost,
      casterUpdates: casterUpdates,
      targetUpdates: targetUpdates,
    };
  }

  // --- ALL OTHER PSIONICS CONTINUE AS BEFORE ---
  if (currentISP < ispCost) {
    return {
      success: false,
      message: `${caster.name} lacks the ISP to use ${powerName} (needs ${ispCost}, has ${currentISP})`,
      additionalLogs: [],
      casterUpdates: null,
      targetUpdates: null,
    };
  }

  // Deduct ISP and prepare updates
  const beforeISP = currentISP;
  const afterISP = Math.max(0, beforeISP - ispCost);
  const casterUpdates = {
    deltaISP: -ispCost,
  };

  // Log the activation
  if (log && typeof log === "function") {
    log(
      `🧠 Executing psionic: ${powerName} (cost: ${ispCost} ISP, caster ISP: ${beforeISP}→${afterISP})`,
      "info"
    );
  }

  return {
    success: true,
    message: `${caster.name} successfully uses ${powerName}`,
    additionalLogs: [],
    power: power,
    ispCost: ispCost,
    casterUpdates: casterUpdates,
    targetUpdates: null, // Will be set by executePsionicPower if needed
  };
}

/**
 * Get available psionic powers for a character
 * @param {Object} character - Character object
 * @returns {Array} Array of available psionic powers
 */
export function getAvailablePsionics(character = {}) {
  // TODO: Return list of psionic powers character knows
  return character.psionicPowers || [];
}

/**
 * Calculate ISP cost for a power
 * @param {string} powerName - Name of psionic power
 * @returns {number} ISP cost
 */
export function getISPCost(powerName) {
  // TODO: Get ISP cost from psionics database
  return 10; // Default
}

/**
 * Apply psionic effect to target
 * @param {Object} power - Psionic power data
 * @param {Object} caster - Character using power
 * @param {Object} target - Target of power
 * @param {Function} log - Logging function
 */
export function applyPsionicEffect(power, caster, target, log) {
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
  usePsionic,
  getAvailablePsionics,
  getISPCost,
  applyPsionicEffect,
};
