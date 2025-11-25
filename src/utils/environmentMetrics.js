/**
 * Dynamic Environment Width System
 * Calculates effective combat width based on terrain density, party size, formation, and obstacles
 */

import { TERRAIN_TYPES } from "./terrainSystem.js";

/**
 * Get creature size category for width calculations
 * @param {Object} actor - Combatant object
 * @returns {string} Size category: "SMALL", "MEDIUM", "LARGE", "HUGE"
 */
function getCreatureSizeCategory(actor) {
  if (!actor) return "MEDIUM";

  // Check if actor has explicit size property
  if (actor.size) {
    const sizeUpper = actor.size.toUpperCase();
    if (["SMALL", "MEDIUM", "LARGE", "HUGE", "GIANT"].includes(sizeUpper)) {
      return sizeUpper;
    }
  }

  // Infer from height/weight if available
  const height = actor.height || actor.attributes?.height || 0;
  const weight = actor.weight || actor.attributes?.weight || 0;

  if (height > 15 || weight > 2000) return "HUGE";
  if (height > 8 || weight > 500) return "LARGE";
  if (height < 3 || weight < 50) return "SMALL";

  return "MEDIUM";
}

/**
 * Get width occupied by a creature based on size
 * @param {Object} actor - Combatant object
 * @returns {number} Width in feet
 */
function getCreatureWidth(actor) {
  const sizeCategory = getCreatureSizeCategory(actor);

  switch (sizeCategory) {
    case "SMALL":
      return 1.5; // Halflings, goblins
    case "MEDIUM":
      return 2; // Humans, elves, orcs
    case "LARGE":
      return 3; // Ogres, trolls
    case "HUGE":
    case "GIANT":
      return 4; // Giants, dragons
    default:
      return 2;
  }
}

/**
 * Dynamically calculates effective combat width (in feet)
 * based on terrain density, party size, formation, and obstacles.
 *
 * @param {string} terrain - Terrain type key (e.g., "DENSE_FOREST", "CAVE_INTERIOR")
 * @param {Array} actors - Array of combatants in the area
 * @param {Object} options - Additional options
 * @param {Array} options.obstacles - Array of obstacle positions
 * @param {number} options.formationSpacing - Formation spacing multiplier (default: 1)
 * @returns {number} Effective width in feet
 */
export function getDynamicWidth(terrain, actors = [], options = {}) {
  const base = TERRAIN_TYPES[terrain];

  if (!base) {
    console.warn(
      `Unknown terrain type: ${terrain}, using OPEN_GROUND defaults`
    );
    return 10; // Default width
  }

  // Start with base clearance width
  let width = base.clearance?.width || 10;
  const height = base.clearance?.height || 10;
  const density = base.density || 0;

  // Adjust width based on density (tree cover, debris, walls)
  // High density narrows space significantly
  width -= density * 3;

  // Adjust for number of combatants in formation
  // More actors = tighter formation = less lateral space
  if (actors.length > 3) {
    const crowdingPenalty = Math.floor(actors.length / 2);
    width -= crowdingPenalty;
  }

  // If there are large creatures, they occupy more lateral space
  const largeUnits = actors.filter((a) => {
    const size = getCreatureSizeCategory(a);
    return size === "LARGE" || size === "HUGE" || size === "GIANT";
  }).length;

  width -= largeUnits * 2;

  // Adjust for obstacles if provided
  if (options.obstacles && options.obstacles.length > 0) {
    // Each obstacle reduces available width
    width -= options.obstacles.length * 0.5;
  }

  // Apply formation spacing multiplier (if provided)
  // Formation spacing > 1 means wider formation = more width needed
  const formationSpacing = options.formationSpacing || 1;
  if (formationSpacing > 1) {
    width *= formationSpacing;
  }

  // Never below minimum functional width (3 feet minimum for combat)
  if (width < 3) width = 3;

  return Math.round(width * 10) / 10; // Round to 1 decimal place
}

/**
 * Get dynamic height clearance
 * @param {string} terrain - Terrain type key
 * @param {Array} actors - Array of combatants
 * @returns {number} Effective height in feet
 */
export function getDynamicHeight(terrain, actors = []) {
  const base = TERRAIN_TYPES[terrain];

  if (!base) return 10;

  let height = base.clearance?.height || 10;
  const density = base.density || 0;

  // Dense terrain reduces vertical clearance
  height -= density * 2;

  // Large creatures may need more vertical space
  const tallUnits = actors.filter((a) => {
    const size = getCreatureSizeCategory(a);
    return size === "LARGE" || size === "HUGE" || size === "GIANT";
  }).length;

  height -= tallUnits * 1;

  // Minimum height (4 feet for crawling)
  if (height < 4) height = 4;

  return Math.round(height * 10) / 10;
}

/**
 * Check if terrain is considered "tight" (narrow width)
 * @param {string} terrain - Terrain type
 * @param {Array} actors - Combatants in area
 * @param {Object} options - Additional options
 * @returns {boolean} True if width <= 6 feet
 */
export function isTightTerrain(terrain, actors = [], options = {}) {
  const width = getDynamicWidth(terrain, actors, options);
  return width <= 6;
}

/**
 * Check if terrain is considered "very tight" (very narrow width)
 * @param {string} terrain - Terrain type
 * @param {Array} actors - Combatants in area
 * @param {Object} options - Additional options
 * @returns {boolean} True if width <= 4 feet
 */
export function isVeryTightTerrain(terrain, actors = [], options = {}) {
  const width = getDynamicWidth(terrain, actors, options);
  return width <= 4;
}

/**
 * Get width category for combat modifiers
 * @param {number} width - Width in feet
 * @returns {string} Category: "OPEN", "NORMAL", "TIGHT", "VERY_TIGHT"
 */
export function getWidthCategory(width) {
  if (width >= 8) return "OPEN";
  if (width >= 6) return "NORMAL";
  if (width >= 4) return "TIGHT";
  return "VERY_TIGHT";
}

/**
 * Get all actors in proximity to a position
 * @param {Object} position - Position {x, y}
 * @param {Array} allActors - All combatants
 * @param {Object} positions - Position map {actorId: {x, y}}
 * @param {number} radius - Proximity radius in grid cells (default: 3)
 * @returns {Array} Actors within radius
 */
export function getActorsInProximity(
  position,
  allActors,
  positions,
  radius = 3
) {
  return allActors.filter((actor) => {
    const actorPos = positions[actor.id];
    if (!actorPos) return false;

    const dx = Math.abs(actorPos.x - position.x);
    const dy = Math.abs(actorPos.y - position.y);
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance <= radius;
  });
}
