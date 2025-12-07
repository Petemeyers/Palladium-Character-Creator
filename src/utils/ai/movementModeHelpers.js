/**
 * Movement Mode Helpers
 * 
 * Centralizes the decision logic for when creatures should use flight vs ground movement.
 * 
 * Key concepts:
 * - poorGroundRunner: true = creature is clumsy on ground, prefers air
 * - preferFlight: true = creature strongly prefers flying over ground running
 * - movementMode: "float" = incorporeal/elemental, never uses ground movement
 * - usesGroundRun: false = never attempts ground running (for floaters)
 */

import { canFighterFly } from '../flightActions.js';
import speciesBehavior from '../../data/speciesBehavior.json';
import { calculateDistance } from '../../data/movementRules.js';

/**
 * Get the species behavior profile for a fighter
 * @param {Object} fighter - Fighter object
 * @returns {Object} Species behavior profile from speciesBehavior.json
 */
export function getSpeciesProfile(fighter) {
  const key = fighter.speciesKey || fighter.species || fighter.id || 'defaultHumanoid';
  return speciesBehavior.species[key] || speciesBehavior.species.defaultHumanoid;
}

/**
 * Determine if a fighter should use flight movement instead of ground movement
 * 
 * Decision logic:
 * 1. Floaters (ghosts, elementals) → always use flight, never ground
 * 2. Can't fly → forced ground
 * 3. Already airborne → stay airborne
 * 4. preferFlight: true → take off for any meaningful distance (>5ft)
 * 5. poorGroundRunner: true → fly for medium/long distances (>10ft)
 * 6. Good ground runners → fly only for long reposition (>30ft)
 * 
 * @param {Object} fighter - Fighter object
 * @param {Object} target - Target object (optional, for distance calculation)
 * @param {Object} context - Additional context (optional)
 * @returns {boolean} True if fighter should use flight movement
 */
export function shouldUseFlight(fighter, target, context = {}) {
  if (!fighter) return false;

  const profile = getSpeciesProfile(fighter);

  // Floaters (ghosts, air elementals) → always "flying" / no ground run
  if (profile.movementMode === 'float' || profile.usesGroundRun === false) {
    return true;
  }

  // Can't fly at all → forced ground
  if (!canFighterFly(fighter)) {
    return false;
  }

  // Calculate distance to target if provided
  const distanceFeet = target && fighter.position && target.position
    ? calculateDistance(fighter.position, target.position)
    : 0;

  const isAlreadyAirborne = (fighter.altitudeFeet ?? fighter.altitude ?? 0) > 0;

  // If already in air, stay in air unless explicitly landing
  if (isAlreadyAirborne) {
    return true;
  }

  // Species that strongly prefer flight (raptors, harpies, pixies, etc.)
  if (profile.preferFlight) {
    // If there's any meaningful distance, they will take off
    if (distanceFeet > 5) {
      return true;
    }
  }

  // Clumsy on ground + medium/long distance → choose to fly
  if (profile.poorGroundRunner && distanceFeet > 10) {
    return true;
  }

  // Big grounded brutes (dragons, gargoyles, baal_rog) can choose either.
  // Default: use ground within 20 ft, fly only for long reposition.
  if (!profile.poorGroundRunner && distanceFeet > 30) {
    return true;
  }

  return false;
}

/**
 * Get the default movement mode for UI display/suggestions
 * Useful for player action UI to show "Move (Fly)" vs "Move (Run)"
 * 
 * @param {Object} fighter - Fighter object
 * @param {Object} target - Target object (optional)
 * @param {Object} context - Additional context (optional)
 * @returns {string} "flight" or "ground"
 */
export function getDefaultMovementMode(fighter, target, context = {}) {
  return shouldUseFlight(fighter, target, context) ? 'flight' : 'ground';
}

/**
 * Alias for getDefaultMovementMode (backward compatibility)
 * @deprecated Use getDefaultMovementMode instead
 */
export function getDefaultMovementModeForUI(fighter, target) {
  return getDefaultMovementMode(fighter, target);
}

