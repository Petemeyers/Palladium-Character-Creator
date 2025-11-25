/**
 * Terrain System
 * Manages terrain data, line of sight, and terrain effects
 * Handles obstacles, cover, and movement modifiers
 *
 * TODO: Implement terrain system
 */

// Terrain type constants with full data structure
export const TERRAIN_TYPES = {
  OPEN_GROUND: {
    name: "Open Ground",
    movementModifier: 1.0,
    visibilityModifier: 1.0,
    cover: 0,
    density: 0.1,
  },
  DENSE_FOREST: {
    name: "Dense Forest",
    movementModifier: 0.5,
    visibilityModifier: 0.3,
    cover: 2,
    density: 0.8,
  },
  LIGHT_FOREST: {
    name: "Light Forest",
    movementModifier: 0.75,
    visibilityModifier: 0.6,
    cover: 1,
    density: 0.4,
  },
  ROCKY_TERRAIN: {
    name: "Rocky Terrain",
    movementModifier: 0.6,
    visibilityModifier: 0.8,
    cover: 1,
    density: 0.3,
  },
  SWAMP_MARSH: {
    name: "Swamp/Marsh",
    movementModifier: 0.4,
    visibilityModifier: 0.5,
    cover: 0,
    density: 0.2,
  },
  CAVE_INTERIOR: {
    name: "Cave Interior",
    movementModifier: 0.7,
    visibilityModifier: 0.4,
    cover: 1,
    density: 0.2,
  },
  URBAN: {
    name: "Urban",
    movementModifier: 0.9,
    visibilityModifier: 0.7,
    cover: 2,
    density: 0.6,
  },
  NORMAL: {
    name: "Normal",
    movementModifier: 1.0,
    visibilityModifier: 1.0,
    cover: 0,
    density: 0.1,
  },
  DIFFICULT: {
    name: "Difficult",
    movementModifier: 0.5,
    visibilityModifier: 0.8,
    cover: 0,
    density: 0.2,
  },
  ROUGH: {
    name: "Rough",
    movementModifier: 0.25,
    visibilityModifier: 0.9,
    cover: 0,
    density: 0.1,
  },
  WATER: {
    name: "Water",
    movementModifier: 0.33,
    visibilityModifier: 0.6,
    cover: 0,
    density: 0.0,
  },
  ROAD: {
    name: "Road",
    movementModifier: 1.5,
    visibilityModifier: 1.0,
    cover: 0,
    density: 0.0,
  },
  FOREST: {
    name: "Forest",
    movementModifier: 0.75,
    visibilityModifier: 0.6,
    cover: 1,
    density: 0.4,
  },
  GRASS: {
    name: "Grass",
    movementModifier: 0.9,
    visibilityModifier: 0.95,
    cover: 0,
    density: 0.1,
  },
  ROCK: {
    name: "Rock",
    movementModifier: 0.6,
    visibilityModifier: 0.8,
    cover: 1,
    density: 0.2,
  },
  SAND: {
    name: "Sand",
    movementModifier: 0.7,
    visibilityModifier: 1.0,
    cover: 0,
    density: 0.0,
  },
  HILL: {
    name: "Hill",
    movementModifier: 0.8,
    visibilityModifier: 0.9,
    cover: 1,
    density: 0.1,
  },
};

// Lighting condition constants with full data structure
export const LIGHTING_CONDITIONS = {
  BRIGHT_DAYLIGHT: {
    name: "Bright Daylight",
    visibilityBonus: 0,
    prowlModifier: 0,
  },
  MOONLIGHT: {
    name: "Moonlight",
    visibilityBonus: -20,
    prowlModifier: +10,
  },
  TORCHLIGHT: {
    name: "Torchlight",
    visibilityBonus: -40,
    prowlModifier: +20,
  },
  DARKNESS: {
    name: "Darkness",
    visibilityBonus: -80,
    prowlModifier: +30,
  },
};

/**
 * Calculate line of sight between two points
 * @param {Object} startPos - Starting position {x, y}
 * @param {Object} endPos - End position {x, y}
 * @param {Object} options - Options {obstacles, terrain}
 * @returns {Object} LOS result {hasLineOfSight: boolean, blockedBy: Object|null}
 */
export function calculateLineOfSight(startPos, endPos, options = {}) {
  // TODO: Calculate line of sight using Bresenham's line algorithm
  // Check for obstacles blocking the path

  if (!startPos || !endPos) {
    return { hasLineOfSight: false, blockedBy: null };
  }

  const { obstacles = [] } = options;

  // TODO: Check each cell along the line for obstacles
  // If obstacle found, return blocked

  return {
    hasLineOfSight: true,
    blockedBy: null,
  };
}

/**
 * Apply lighting effects to visibility
 * @param {number} distance - Distance in feet
 * @param {string} lighting - Lighting condition
 * @param {boolean} hasInfravision - Does observer have infravision?
 * @returns {Object} Lighting result {canSee: boolean, modifier: number}
 */
export function applyLightingEffects(
  distance,
  lighting = "BRIGHT_DAYLIGHT",
  hasInfravision = false
) {
  // TODO: Apply lighting modifiers to visibility
  // Different lighting conditions affect visibility range

  const lightingRanges = {
    BRIGHT_DAYLIGHT: 120,
    MOONLIGHT: 60,
    TORCHLIGHT: 30,
    DARKNESS: hasInfravision ? 90 : 0,
  };

  const maxRange = lightingRanges[lighting] || 60;

  return {
    canSee: distance <= maxRange,
    modifier: distance > maxRange ? -10 : 0,
  };
}

/**
 * Get terrain type at position
 * @param {Object} terrain - Terrain data
 * @param {Object} position - Position {x, y} or {q, r}
 * @returns {string} Terrain type
 */
export function getTerrainType(terrain, position) {
  // TODO: Get terrain type at specific position
  if (!terrain || !position) return "normal";

  // TODO: Look up terrain in grid
  // if (terrain.grid && terrain.grid[position.y] && terrain.grid[position.y][position.x]) {
  //   return terrain.grid[position.y][position.x].type;
  // }

  return "normal"; // Default
}

/**
 * Get movement modifier for terrain
 * @param {string} terrainType - Type of terrain
 * @returns {number} Movement modifier (multiplier)
 */
export function getMovementModifier(terrainType) {
  // TODO: Return movement modifier based on terrain
  const modifiers = {
    normal: 1.0,
    difficult: 0.5,
    rough: 0.25,
    water: 0.33,
    road: 1.5,
  };

  return modifiers[terrainType] || 1.0;
}

/**
 * Get cover bonus from terrain/obstacles
 * @param {Object} position - Position to check
 * @param {Object} targetPosition - Target position
 * @param {Object} terrain - Terrain data
 * @param {Array} obstacles - Array of obstacle objects
 * @returns {number} Cover bonus (typically 0-4)
 */
export function getCoverBonus(
  position,
  targetPosition,
  terrain = {},
  obstacles = []
) {
  // TODO: Calculate cover bonus based on terrain and obstacles
  if (!position || !targetPosition) return 0;

  // Placeholder - would check line of sight and obstacles
  // 0 = no cover, 1 = partial cover, 2-4 = increasing cover
  return 0;
}

/**
 * Calculate perception check based on terrain and lighting
 * @param {Object} observer - Observer character
 * @param {Object} target - Target position or object
 * @param {Object} options - Options {terrain, lighting, distance}
 * @returns {Object} Perception check result
 */
export function calculatePerceptionCheck(observer, target, options = {}) {
  // TODO: Calculate perception check with terrain and lighting modifiers
  const { terrain, lighting = "BRIGHT_DAYLIGHT", distance = 0 } = options;

  let modifier = 0;

  // Lighting modifiers
  const lightingModifiers = {
    BRIGHT_DAYLIGHT: 0,
    MOONLIGHT: -2,
    TORCHLIGHT: -4,
    DARKNESS: -10,
  };
  modifier += lightingModifiers[lighting] || 0;

  // Distance modifier (every 10 feet = -1)
  modifier -= Math.floor(distance / 10);

  // Terrain modifier (if blocked by terrain)
  if (terrain && terrain.blocksVision) {
    modifier -= 4;
  }

  const perception = (observer.perception || observer.IQ || 10) + modifier;

  return {
    base: observer.perception || observer.IQ || 10,
    modifier,
    total: perception,
    canSee:
      perception > 0 && distance <= (lighting === "BRIGHT_DAYLIGHT" ? 120 : 60),
  };
}

export default {
  calculateLineOfSight,
  applyLightingEffects,
  getTerrainType,
  getMovementModifier,
};
