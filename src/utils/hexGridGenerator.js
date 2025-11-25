/**
 * Hexagonal Grid Generator
 * Generates hexagonal terrain grids using axial coordinates (q, r)
 * Compatible with TacticalMap.jsx and HexArena3D.jsx
 */

/**
 * Terrain-weighted elevation presets
 * Different terrains have different height ranges for realistic 3D rendering
 */
const elevationPresets = {
  OPEN_GROUND: { min: 0, max: 1 },
  GRASSLAND: { min: 0, max: 1 },
  PLAINS: { min: 0, max: 2 },
  LIGHT_FOREST: { min: 0, max: 2 },
  FOREST: { min: 0, max: 3 },
  DENSE_FOREST: { min: 1, max: 4 },
  SWAMP_MARSH: { min: -1, max: 1 },
  SWAMP: { min: -1, max: 1 },
  MARSH: { min: -2, max: 1 },
  HILLS: { min: 1, max: 5 },
  ROCKY_TERRAIN: { min: 1, max: 4 },
  MOUNTAIN: { min: 4, max: 10 },
  TUNDRA: { min: 0, max: 2 },
  DESERT: { min: 0, max: 1 },
  URBAN: { min: 0, max: 2 },
  CITY: { min: 0, max: 2 },
  RUINS: { min: 0, max: 3 },
  CAVE_INTERIOR: { min: 0, max: 1 },
  ARENA: { min: 0, max: 0 },
  SMALL_ROOM: { min: 0, max: 0 },
  LARGE_ROOM: { min: 0, max: 0 },
};

/**
 * Generate a hexagonal terrain grid using axial coordinates
 * @param {number} radius - Hexagon radius (number of hexes from center to edge)
 * @param {string} terrainKey - Terrain type key (e.g., "FOREST", "OPEN_GROUND")
 * @param {Object} options - Additional options
 * @returns {Array} Array of hex cells with {q, r, elevation, terrain, feature} properties
 */
export function generateHexTerrainGrid(radius, terrainKey, options = {}) {
  const grid = [];
  const preset = elevationPresets[terrainKey] || { min: 0, max: 1 };
  const { 
    baseElevation = 0,
    elevationVariation = true,
    featureDensity = 0,
    addFeatures = false
  } = options;

  // Generate hexagonal grid using axial coordinates
  // Hexagonal grid: for each q from -radius to radius
  //   for each r from -radius to radius
  //   if |q + r| <= radius, it's within the hexagon
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      // Skip hexes outside the hexagonal boundary
      if (Math.abs(q + r) > radius) continue;

      // Calculate elevation based on terrain preset
      let elevation = baseElevation;
      if (elevationVariation) {
        elevation = preset.min + Math.floor(Math.random() * (preset.max - preset.min + 1));
      }

      // Determine features based on terrain type
      let feature = null;
      if (addFeatures && Math.random() < featureDensity) {
        feature = getFeatureForTerrain(terrainKey);
      }

      grid.push({
        q,
        r,
        elevation,
        terrain: terrainKey,
        feature,
        cover: getCoverForTerrain(terrainKey, feature),
        isWalkable: true,
        movementCost: 1.0,
      });
    }
  }

  return grid;
}

/**
 * Get appropriate feature for terrain type
 * @param {string} terrainKey - Terrain type
 * @returns {string|null} Feature type or null
 */
function getFeatureForTerrain(terrainKey) {
  const featureMap = {
    DENSE_FOREST: Math.random() < 0.9 ? "TREE_LARGE" : null,
    LIGHT_FOREST: Math.random() < 0.4 ? "TREE_LARGE" : null,
    FOREST: Math.random() < 0.6 ? "TREE_LARGE" : null,
    ROCKY_TERRAIN: Math.random() < 0.3 ? "BOULDER" : null,
    SWAMP_MARSH: Math.random() < 0.2 ? "WATER" : null,
    SWAMP: Math.random() < 0.2 ? "WATER" : null,
    MARSH: Math.random() < 0.3 ? "WATER" : null,
    URBAN: Math.random() < 0.1 ? "STRUCTURE" : null,
    CITY: Math.random() < 0.15 ? "STRUCTURE" : null,
  };

  return featureMap[terrainKey] || null;
}

/**
 * Get cover value for terrain and feature
 * @param {string} terrainKey - Terrain type
 * @param {string|null} feature - Feature type
 * @returns {number} Cover value (0-5)
 */
function getCoverForTerrain(terrainKey, feature) {
  if (feature === "TREE_LARGE") return 2;
  if (feature === "STRUCTURE") return 3;
  if (feature === "BOULDER") return 1;
  
  const terrainCover = {
    DENSE_FOREST: 3,
    FOREST: 2,
    LIGHT_FOREST: 1,
    ROCKY_TERRAIN: 1,
  };

  return terrainCover[terrainKey] || 0;
}

/**
 * Convert rectangular grid (from old system) to hexagonal grid
 * @param {Array} rectangularGrid - 2D array grid from old system
 * @param {number} radius - Target hex radius
 * @param {string} defaultTerrain - Default terrain for cells
 * @returns {Array} Hexagonal grid array
 */
export function convertRectangularToHexagonal(rectangularGrid, radius, defaultTerrain = "OPEN_GROUND") {
  if (!rectangularGrid || !Array.isArray(rectangularGrid)) {
    // If no rectangular grid, generate fresh hexagonal grid
    return generateHexTerrainGrid(radius, defaultTerrain);
  }

  const hexGrid = [];
  const height = rectangularGrid.length;
  const width = rectangularGrid[0]?.length || 0;

  // Map rectangular coordinates to hex coordinates
  // This is approximate - ideally we'd regenerate from scratch
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (Math.abs(q + r) > radius) continue;

      // Approximate mapping from hex to rectangular
      const x = Math.floor((q + (r / 2)) + (width / 2));
      const y = Math.floor(r + (height / 2));

      let cell = {
        q,
        r,
        elevation: 0,
        terrain: defaultTerrain,
        feature: null,
        cover: 0,
        isWalkable: true,
        movementCost: 1.0,
      };

      // Try to map from rectangular grid if in bounds
      if (y >= 0 && y < height && x >= 0 && x < width && rectangularGrid[y] && rectangularGrid[y][x]) {
        const rectCell = rectangularGrid[y][x];
        cell = {
          ...cell,
          elevation: rectCell.elevation || 0,
          terrain: rectCell.terrainType || defaultTerrain,
          feature: rectCell.feature || null,
          cover: rectCell.cover || 0,
          isWalkable: rectCell.isWalkable !== false,
          movementCost: rectCell.movementCost || 1.0,
        };
      }

      hexGrid.push(cell);
    }
  }

  return hexGrid;
}

