/**
 * Player Flight Actions System
 * Handles player-controlled flight actions: Fly, Land, Change Altitude, Dive Attack, Carry & Drop
 */

import { canFly, isFlying, getAltitude } from "./abilitySystem.js";
import { canCarryTarget } from "./sizeStrengthModifiers.js";
import { performAerialPickup, GRAPPLE_STATES } from "./grapplingSystem.js";
import { unlinkCombinedBodies, COMBINED_MODES } from "./combinedBodySystem.js";
import { applyFallDamage } from "./updateActiveEffects.js";
import { drainStamina, STAMINA_COSTS } from "./combatFatigueSystem.js";
import { calculateDistance } from "../data/movementRules.js";

/**
 * Check if a fighter can fly (natural ability or spell/psionic)
 */
export function canFighterFly(fighter) {
  if (!fighter) return false;
  
  // Check natural flight ability
  if (canFly(fighter)) return true;
  
  // Check for FLIGHT effect (spell/psionic)
  const hasFlightEffect = (fighter.activeEffects || []).some(
    (e) => e.type === "FLIGHT" && !e.expired && (e.remainingRounds > 0 || !e.expiresOn)
  );
  
  return hasFlightEffect || fighter.isFlying;
}

/**
 * Start flying (take off)
 */
export function startFlying(fighter, options = {}) {
  if (!fighter) {
    return { success: false, reason: "No fighter provided" };
  }

  if (!canFighterFly(fighter)) {
    return {
      success: false,
      reason: `${fighter.name} cannot fly (no flight ability or active flight effect)`,
    };
  }

  if (isFlying(fighter)) {
    return {
      success: false,
      reason: `${fighter.name} is already flying`,
    };
  }

  const altitude = options.altitude || 20; // Default takeoff altitude
  fighter.isFlying = true;
  fighter.altitude = altitude;
  fighter.altitudeFeet = altitude;

  // Initialize flight state if needed
  if (!fighter.aiFlightState) {
    fighter.aiFlightState = { mode: "cruising", cruiseAltitudeFeet: altitude };
  }

  // Drain stamina for takeoff
  drainStamina(fighter, STAMINA_COSTS.FLY_HOVER, 1);

  return {
    success: true,
    message: `${fighter.name} takes off and begins flying at ${altitude}ft altitude`,
    fighter,
  };
}

/**
 * Land (stop flying)
 */
export function landFighter(fighter, options = {}) {
  if (!fighter) {
    return { success: false, reason: "No fighter provided" };
  }

  if (!isFlying(fighter)) {
    return {
      success: false,
      reason: `${fighter.name} is not flying`,
    };
  }

  const currentAltitude = getAltitude(fighter) || 0;

  // If landing from height, apply fall damage if not controlled landing
  if (currentAltitude > 5 && !options.controlledLanding) {
    const fallResult = applyFallDamage(fighter, currentAltitude);
    Object.assign(fighter, fallResult);
  }

  fighter.isFlying = false;
  fighter.altitude = 0;
  fighter.altitudeFeet = 0;
  fighter.aiFlightState = null;

  // If carrying someone, drop them
  if (fighter.isCarrying && fighter.carriedTargetId) {
    const carried = options.carriedTarget;
    if (carried) {
      const dropResult = dropCarriedTarget(fighter, carried, { height: currentAltitude });
      if (dropResult.success) {
        return {
          success: true,
          message: `${fighter.name} lands and drops ${carried.name} from ${currentAltitude}ft`,
          fighter,
          dropped: dropResult,
        };
      }
    }
  }

  return {
    success: true,
    message: `${fighter.name} lands safely`,
    fighter,
  };
}

/**
 * Change altitude (climb or descend)
 */
export function changeAltitude(fighter, deltaFeet, options = {}) {
  if (!fighter) {
    return { success: false, reason: "No fighter provided" };
  }

  if (!isFlying(fighter)) {
    return {
      success: false,
      reason: `${fighter.name} must be flying to change altitude`,
    };
  }

  const currentAltitude = getAltitude(fighter) || 0;
  const newAltitude = currentAltitude + deltaFeet;
  const maxAltitude = options.maxAltitude || 100; // Reasonable max
  const finalAltitude = Math.max(0, Math.min(newAltitude, maxAltitude)); // Clamp between 0 and maxAltitude

  if (finalAltitude === currentAltitude) {
    return {
      success: false,
      reason: `Cannot change altitude (already at ${currentAltitude}ft or at limit)`,
    };
  }

  fighter.altitude = finalAltitude;
  fighter.altitudeFeet = finalAltitude;

  // Update flight state
  if (fighter.aiFlightState) {
    fighter.aiFlightState.cruiseAltitudeFeet = finalAltitude;
  }

  // Drain stamina based on climb/descent
  const staminaCost = deltaFeet > 0 ? STAMINA_COSTS.FLY_SPRINT : STAMINA_COSTS.FLY_HOVER;
  drainStamina(fighter, staminaCost, Math.abs(deltaFeet) / 10); // Cost per 10ft

  const direction = deltaFeet > 0 ? "climbs" : "descends";
  return {
    success: true,
    message: `${fighter.name} ${direction} from ${currentAltitude}ft to ${finalAltitude}ft`,
    fighter,
    newAltitude: finalAltitude,
  };
}

/**
 * Perform a dive attack (drop altitude and attack)
 */
export function performDiveAttack(fighter, target, options = {}) {
  if (!fighter || !target) {
    return { success: false, reason: "Fighter and target required" };
  }

  if (!isFlying(fighter)) {
    return {
      success: false,
      reason: `${fighter.name} must be flying to perform a dive attack`,
    };
  }

  const currentAltitude = getAltitude(fighter) || 0;
  const targetAltitude = getAltitude(target) || 0;
  const attackAltitude = targetAltitude + 5; // 5ft above target

  if (currentAltitude <= attackAltitude) {
    return {
      success: false,
      reason: `${fighter.name} is too low to dive (must be above ${attackAltitude}ft)`,
    };
  }

  // Drop to attack altitude
  fighter.altitude = attackAltitude;
  fighter.altitudeFeet = attackAltitude;

  // Get dive bonus from species behavior or options
  const diveBonus = options.diveBonus || 0;

  return {
    success: true,
    message: `${fighter.name} dives from ${currentAltitude}ft to ${attackAltitude}ft to attack ${target.name}`,
    fighter,
    attackBonus: diveBonus,
    newAltitude: attackAltitude,
  };
}

/**
 * Lift and carry a grappled target while flying
 */
export function liftAndCarry(fighter, target, options = {}) {
  if (!fighter || !target) {
    return { success: false, reason: "Fighter and target required" };
  }

  if (!isFlying(fighter)) {
    return {
      success: false,
      reason: `${fighter.name} must be flying to carry a target`,
    };
  }

  // Check if already grappling
  if (
    !fighter.grappleState ||
    fighter.grappleState.state !== GRAPPLE_STATES.GROUND ||
    fighter.grappleState.opponent !== target.id
  ) {
    return {
      success: false,
      reason: `${fighter.name} must have ${target.name} grappled on the ground first`,
    };
  }

  // Use existing aerial pickup function
  const result = performAerialPickup(fighter, target);

  if (result.success) {
    // Drain extra stamina for carrying (1.5x hover cost)
    drainStamina(fighter, STAMINA_COSTS.FLY_CRUISE, 1.5);
  }

  return result;
}

/**
 * Drop a carried target from height
 */
export function dropCarriedTarget(fighter, target, options = {}) {
  if (!fighter || !target) {
    return { success: false, reason: "Fighter and target required" };
  }

  if (!fighter.isCarrying || fighter.carriedTargetId !== target.id) {
    return {
      success: false,
      reason: `${fighter.name} is not carrying ${target.name}`,
    };
  }

  const dropHeight = options.height || getAltitude(fighter) || 0;

  // Unlink combined bodies
  const { f1, f2 } = unlinkCombinedBodies(fighter, target);

  // Apply fall damage to dropped target
  const afterFall = applyFallDamage(target, dropHeight);

  return {
    success: true,
    message: `${fighter.name} drops ${target.name} from ${dropHeight}ft`,
    fighter: f1,
    target: afterFall,
    fallDamage: dropHeight > 0,
  };
}

/**
 * Move while flying (flying movement)
 */
export function flyToHex(fighter, targetHex, options = {}) {
  if (!fighter || !targetHex) {
    return { success: false, reason: "Fighter and target hex required" };
  }

  if (!isFlying(fighter)) {
    return {
      success: false,
      reason: `${fighter.name} must be flying to use flying movement`,
    };
  }

  // This is a helper that returns movement info
  // Actual movement is handled by handlePositionChange in CombatPage
  const movementType = options.movementType || "FLY";
  const altitude = getAltitude(fighter) || 20;

  return {
    success: true,
    message: `${fighter.name} flies to new position`,
    movementType,
    altitude,
    targetHex,
  };
}

