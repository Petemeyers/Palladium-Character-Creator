/**
 * Visibility Calculator for Fog of War
 * Calculates which cells are visible from a given position
 * Integrates with stealthSystem.js, terrainSystem.js, and terrainAwareness.js
 */

import { calculateLineOfSight, applyLightingEffects } from "./terrainSystem.js";
import { calculateLineOfSight as calculateLOSWithCover } from "./terrainAwareness.js";
import { calculateDistance } from "../data/movementRules.js";
import { GRID_CONFIG } from "../data/movementRules.js";

/**
 * Calculate all visible cells from a given observer position
 * @param {Object} observerPos - Observer position {x, y}
 * @param {number} visibilityRange - Maximum visibility range in feet (default 60)
 * @param {Object} options - Additional options
 * @param {Object} options.terrain - Terrain data with grid and obstacles
 * @param {string} options.lighting - Lighting condition
 * @param {boolean} options.hasInfravision - Does observer have infravision?
 * @param {boolean} options.isProwling - Is observer successfully prowling?
 * @param {Array} options.terrainObstacles - Array of obstacle positions [{x, y}, ...]
 * @param {string} options.mapType - "hex" or "square"
 * @returns {Array} Array of visible cell positions [{x, y}, ...]
 */
export function calculateVisibleCells(
  observerPos,
  visibilityRange = 60,
  options = {}
) {
  const {
    terrain = null,
    lighting = "BRIGHT_DAYLIGHT",
    hasInfravision = false,
    isProwling = false,
    terrainObstacles = [],
    mapType = "hex",
  } = options;

  if (!observerPos || !observerPos.x || !observerPos.y) {
    return [];
  }

  const visibleCells = [];
  const gridWidth = GRID_CONFIG?.GRID_WIDTH || 50;
  const gridHeight = GRID_CONFIG?.GRID_HEIGHT || 50;
  const cellSize = GRID_CONFIG?.CELL_SIZE || 5; // 5 feet per cell

  // Convert visibility range from feet to grid cells
  const maxCells = Math.ceil(visibilityRange / cellSize);

  // Prowling reduces visibility range (sneaking means not looking around as much)
  const effectiveRange = isProwling
    ? Math.floor(visibilityRange * 0.7)
    : visibilityRange;
  const effectiveMaxCells = isProwling ? Math.ceil(maxCells * 0.7) : maxCells;

  // OPTIMIZATION: Only check cells within range, not entire grid
  // Calculate bounding box around observer position
  const minX = Math.max(0, Math.floor(observerPos.x - effectiveMaxCells));
  const maxX = Math.min(
    gridWidth - 1,
    Math.ceil(observerPos.x + effectiveMaxCells)
  );
  const minY = Math.max(0, Math.floor(observerPos.y - effectiveMaxCells));
  const maxY = Math.min(
    gridHeight - 1,
    Math.ceil(observerPos.y + effectiveMaxCells)
  );

  // Check only cells within range (dramatically reduces iterations from 2500 to ~100-400)
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const cellPos = { x, y };

      // Quick distance check using Manhattan distance first (much faster)
      const manhattanDist =
        Math.abs(x - observerPos.x) + Math.abs(y - observerPos.y);
      if (manhattanDist > effectiveMaxCells * 1.5) {
        continue; // Quick skip for cells definitely out of range
      }

      // Calculate actual distance only for cells that might be in range
      const distanceInCells = calculateDistance(observerPos, cellPos);
      const distanceInFeet = distanceInCells * cellSize;

      // Skip if beyond effective range
      if (distanceInFeet > effectiveRange) {
        continue;
      }

      // Check lighting effects
      const lightingResult = applyLightingEffects(
        distanceInFeet,
        lighting,
        hasInfravision
      );
      if (!lightingResult.canSee) {
        continue; // Too dark or too far
      }

      // Check line of sight (check for obstacles blocking path)
      let hasLOS = true;

      // Use terrain obstacles if available
      if (terrainObstacles.length > 0) {
        const losResult = calculateLineOfSight(observerPos, cellPos, {
          obstacles: terrainObstacles,
        });
        hasLOS = losResult.hasLineOfSight;
      } else if (terrain?.grid) {
        // Use grid-based LOS if terrain grid is available
        const losResult = calculateLOSFromGrid(
          observerPos,
          cellPos,
          terrain.grid
        );
        hasLOS = losResult.hasLineOfSight;
      }

      // If we have LOS and lighting allows, cell is visible
      if (hasLOS && lightingResult.canSee) {
        visibleCells.push(cellPos);
      }
    }
  }

  return visibleCells;
}

/**
 * Calculate line of sight through a grid
 * @param {Object} startPos - Starting position {x, y}
 * @param {Object} endPos - End position {x, y}
 * @param {Array} grid - 2D grid array [row][col]
 * @returns {Object} {hasLineOfSight: boolean, blockedBy: Object|null}
 */
function calculateLOSFromGrid(startPos, endPos, grid) {
  if (!grid || !Array.isArray(grid)) {
    return { hasLineOfSight: true, blockedBy: null };
  }

  // Use Bresenham's line algorithm to check each cell along the path
  const dx = Math.abs(endPos.x - startPos.x);
  const dy = Math.abs(endPos.y - startPos.y);
  const sx = startPos.x < endPos.x ? 1 : -1;
  const sy = startPos.y < endPos.y ? 1 : -1;
  let err = dx - dy;

  let x = startPos.x;
  let y = startPos.y;

  while (x !== endPos.x || y !== endPos.y) {
    // Check if current cell blocks LOS (has obstacle or feature that blocks)
    if (grid[y] && grid[y][x]) {
      const cell = grid[y][x];

      // Check if cell has a blocking feature (wall, cliff, structure)
      if (
        cell.feature === "WALL" ||
        cell.feature === "CLIFF" ||
        (cell.feature === "STRUCTURE" && cell.isWalkable === false)
      ) {
        return {
          hasLineOfSight: false,
          blockedBy: { x, y, feature: cell.feature },
        };
      }
    }

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return { hasLineOfSight: true, blockedBy: null };
}

/**
 * Calculate visible cells for multiple observers (party members, etc.)
 * @param {Array} observers - Array of observer positions [{x, y}, ...]
 * @param {number} visibilityRange - Maximum visibility range in feet
 * @param {Object} options - Additional options (same as calculateVisibleCells)
 * @returns {Array} Combined array of visible cell positions
 */
export function calculateVisibleCellsMultiple(
  observers,
  visibilityRange = 60,
  options = {}
) {
  const allVisibleCells = new Set();

  observers.forEach((observerPos) => {
    if (!observerPos || !observerPos.x || !observerPos.y) return;

    const visibleCells = calculateVisibleCells(
      observerPos,
      visibilityRange,
      options
    );
    visibleCells.forEach((cell) => {
      allVisibleCells.add(`${cell.x}-${cell.y}`);
    });
  });

  // Convert back to array of {x, y} objects
  return Array.from(allVisibleCells).map((key) => {
    const [x, y] = key.split("-").map(Number);
    return { x, y };
  });
}

/**
 * Get visibility range based on lighting and special senses
 * @param {string} lighting - Lighting condition
 * @param {boolean} hasInfravision - Does observer have infravision?
 * @param {Object} character - Character object (for special senses)
 * @returns {number} Visibility range in feet
 */
export function getVisibilityRange(
  lighting = "BRIGHT_DAYLIGHT",
  hasInfravision = false,
  character = null
) {
  // Base visibility ranges by lighting
  const baseRanges = {
    BRIGHT_DAYLIGHT: 120, // Can see far in daylight
    MOONLIGHT: 60, // Moonlight visibility
    TORCHLIGHT: 30, // Torch radius
    DARKNESS: hasInfravision ? 90 : 0, // Only infravision can see in darkness
  };

  let range = baseRanges[lighting] || 60;

  // Special senses extend range
  if (character) {
    // Check for special senses in stealthSystem
    // This would need to be integrated with hasSpecialSenses from stealthSystem.js
    if (hasInfravision) {
      range = Math.max(range, 90);
    }
  }

  return range;
}

export default {
  calculateVisibleCells,
  calculateVisibleCellsMultiple,
  getVisibilityRange,
};
