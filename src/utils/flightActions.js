/**
 * Player Flight Actions System
 * Handles player-controlled flight actions: Fly, Land, Change Altitude, Dive Attack, Carry & Drop
 */

import { canFly, isFlying, getAltitude } from "./abilitySystem.js";
import { canCarryTarget } from "./sizeStrengthModifiers.js";
import { GRAPPLE_STATES, initializeGrappleState } from "./grapplingSystem.js";
import { unlinkCombinedBodies, COMBINED_MODES } from "./combinedBodySystem.js";
import { applyFallDamage } from "./updateActiveEffects.js";
import { drainStamina, STAMINA_COSTS } from "./combatFatigueSystem.js";
import { calculateDistance } from "../data/movementRules.js";

function ensureGrappleState(f) {
  if (!f.grappleState) {
    f.grappleState = initializeGrappleState(f);
  }
  return f.grappleState;
}

function clearCarryFlags(carrier, carried) {
  if (carrier) {
    carrier.isCarrying = false;
    carrier.carriedTargetId = null;
    carrier.combinedMode = null;
  }
  if (carried) {
    carried.isCarried = false;
    carried.carriedById = null;
    carried.combinedMode = null;
  }
}

/**
 * Internal: convert a grapple hold into a carry state.
 * This is intentionally lightweight and compatible with syncCombinedPositions().
 */
function performAerialPickup(carrier, carried, options = {}) {
  // Preconditions
  if (!carrier || !carried)
    return { success: false, reason: "Carrier and carried required" };

  const carryCheck = canCarryTarget(carrier, carried, {
    capacityMultiplier: options.capacityMultiplier ?? 10,
    sameSizePsMargin: options.sameSizePsMargin ?? 10,
    minPsLeadForAdjacentSize: options.minPsLeadForAdjacentSize ?? 0,
    ignoreWeight: options.ignoreWeight === true,
  });

  if (!carryCheck.canCarry) {
    return {
      success: false,
      reason: carryCheck.reason || "Cannot carry target",
    };
  }

  // Convert grapple -> carry
  ensureGrappleState(carrier);
  ensureGrappleState(carried);

  carrier.isCarrying = true;
  carrier.carriedTargetId = carried.id;
  carrier.combinedMode = COMBINED_MODES?.CARRY || "carry";

  carried.isCarried = true;
  carried.carriedById = carrier.id;
  carried.combinedMode = COMBINED_MODES?.CARRIED || "carried";

  // Being carried: cannot dodge/run; keep grapple penalties (or stronger)
  carried.grappleState.state = GRAPPLE_STATES.GRAPPLED;
  carried.grappleState.opponent = carrier.id;
  carried.grappleState.canUseLongWeapons = false;
  carried.grappleState.penalties = {
    strike: carried.grappleState.penalties?.strike ?? -2,
    parry: carried.grappleState.penalties?.parry ?? -4,
    dodge: carried.grappleState.penalties?.dodge ?? -4,
  };

  // Carrier remains in control; treat as clinch hold while carrying
  carrier.grappleState.state = GRAPPLE_STATES.CLINCH;
  carrier.grappleState.opponent = carried.id;

  // Ensure carried shares altitude with carrier (mid-air grab)
  const alt = getAltitude(carrier) || 0;
  carried.altitude = alt;
  carried.altitudeFeet = alt;
  carried.isFlying = false; // carried isn't "flying"; it's being carried

  return {
    success: true,
    message: `${carrier.name} lifts ${carried.name} and carries them through the air!`,
    carrier,
    carried,
  };
}

/**
 * Check if a fighter can fly (natural ability or spell/psionic)
 */
export function canFighterFly(fighter) {
  if (!fighter) return false;

  // Check natural flight ability
  if (canFly(fighter)) return true;

  // Check for FLIGHT effect (spell/psionic)
  const hasFlightEffect = (fighter.activeEffects || []).some(
    (e) =>
      e.type === "FLIGHT" &&
      !e.expired &&
      (e.remainingRounds > 0 || !e.expiresOn)
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
      const dropResult = dropCarriedTarget(fighter, carried, {
        height: currentAltitude,
      });
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
  const staminaCost =
    deltaFeet > 0 ? STAMINA_COSTS.FLY_SPRINT : STAMINA_COSTS.FLY_HOVER;
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
  if (!fighter || !target)
    return { success: false, reason: "Fighter and target required" };
  if (!isFlying(fighter)) {
    return {
      success: false,
      reason: `${fighter.name} must be flying to perform a dive attack`,
    };
  }

  const currentAltitude = getAltitude(fighter) || 0;
  const targetAltitude = getAltitude(target) || 0;

  // Only requirement: flying. Keep barely airborne for mid-air grab + melee reach.
  const offsetFeet = options.attackOffsetFeet ?? 5;
  const attackAltitude = Math.max(targetAltitude, 0) + offsetFeet;

  // Guard: if already at contact altitude, treat as normal strike (no bogus 5→5 dive)
  if (currentAltitude <= attackAltitude + 0.1) {
    // Already at contact altitude: treat as normal strike.
    return {
      success: true,
      message: `${fighter.name} swoops low and strikes!`,
      fighter,
      attackBonus: 0,
      newAltitude: attackAltitude,
    };
  }

  fighter.altitude = attackAltitude;
  fighter.altitudeFeet = attackAltitude;

  const drop = Math.max(0, currentAltitude - attackAltitude);
  const diveBonus = options.diveBonus ?? Math.min(4, Math.floor(drop / 10));

  return {
    success: true,
    message: `${fighter.name} swoops from ${currentAltitude}ft to ${attackAltitude}ft to attack ${target.name}`,
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

  // Must have an active MID-AIR grapple connection.
  // We intentionally do NOT allow "ground-grapple -> carry" here for hawk-style grabs.
  ensureGrappleState(fighter);
  ensureGrappleState(target);

  const fState = fighter.grappleState;
  const tState = target.grappleState;

  const carrierAlt = getAltitude(fighter) || 0;

  // Carrier must be holding in a clinch while the target is grappled.
  // Ground holds are excluded for hawk mid-air grabs.
  const isMidAirLinked =
    carrierAlt > 0 &&
    fState.opponent === target.id &&
    fState.state === GRAPPLE_STATES.CLINCH &&
    tState.opponent === fighter.id &&
    tState.state === GRAPPLE_STATES.GRAPPLED;

  if (!isMidAirLinked) {
    return {
      success: false,
      reason: `${fighter.name} must have a mid-air clinch on ${target.name} to lift & carry`,
    };
  }

  // Optional spatial sanity check (prevents carrying across the map due to stale state)
  if (options.positions) {
    const fPos = options.positions[fighter.id];
    const tPos = options.positions[target.id];
    if (fPos && tPos) {
      const dist = calculateDistance(fPos, tPos);
      if (dist > (options.maxCarryDistanceFeet ?? 5.5)) {
        return {
          success: false,
          reason: `${fighter.name} is too far to pick up ${
            target.name
          } (${Math.round(dist)}ft)`,
        };
      }
    }
  }

  const result = performAerialPickup(fighter, target, options);

  if (result.success) {
    // Drain extra stamina for carrying (heavier than hover)
    drainStamina(fighter, STAMINA_COSTS.FLY_CRUISE, 1.5);
  }

  return result;
}

/**
 * Drop a carried target from height
 */
export function dropCarriedTarget(fighter, target, options = {}) {
  if (!fighter || !target)
    return { success: false, reason: "Fighter and target required" };

  if (!fighter.isCarrying || fighter.carriedTargetId !== target.id) {
    return {
      success: false,
      reason: `${fighter.name} is not carrying ${target.name}`,
    };
  }

  const dropHeight = options.height || getAltitude(fighter) || 0;

  // Unlink combined bodies (fallback-safe)
  let f1 = fighter;
  let f2 = target;
  try {
    const unlinked = unlinkCombinedBodies(fighter, target);
    f1 = unlinked.f1 || fighter;
    f2 = unlinked.f2 || target;
  } catch (e) {
    // If combined body system isn't active, clear flags manually
    clearCarryFlags(fighter, target);
  }

  // Ensure carry/grapple flags are cleared after dropping
  try {
    clearCarryFlags(f1, f2);
    ensureGrappleState(f1);
    ensureGrappleState(f2);
    f1.grappleState.state = GRAPPLE_STATES.NEUTRAL;
    f1.grappleState.opponent = null;
    f2.grappleState.state = GRAPPLE_STATES.NEUTRAL;
    f2.grappleState.opponent = null;
  } catch (e) {
    // ignore
  }
  // Apply fall damage to dropped target
  const afterFall = applyFallDamage(f2, dropHeight);

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
