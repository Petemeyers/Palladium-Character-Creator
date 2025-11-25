/**
 * Fog Memory System
 *
 * Maintains an array of previously seen (explored) cells.
 * Works alongside fogOfWarSystem.js to provide three visibility states:
 *
 * 1. Visible - Currently in line of sight (fully visible)
 * 2. Explored (Memory) - Previously seen, but not currently visible (dimmed)
 * 3. Unexplored - Never seen (full black fog)
 *
 * This system makes previously explored cells stay dimly visible even after
 * the player moves away or fog rolls back — similar to XCOM, Baldur's Gate 3,
 * or Darkest Dungeon.
 *
 * Example usage:
 *   exploredCells = updateFogMemory(exploredCells, currentVisible);
 *   TacticalMap renders explored (memory) cells as dimmed.
 */

/**
 * Add newly visible cells to memory.
 *
 * @param {Array} previousMemory - [{x, y}, ...] previously seen cells
 * @param {Array} currentVisible - [{x, y}, ...] currently visible cells
 * @returns {Array} updatedMemory - Combined array of all explored cells
 */
export function updateFogMemory(previousMemory = [], currentVisible = []) {
  // Convert previous memory to Set for fast lookup
  const memorySet = new Set(previousMemory.map((c) => `${c.x}-${c.y}`));

  // Add all currently visible cells to memory
  currentVisible.forEach((cell) => {
    if (cell && cell.x !== undefined && cell.y !== undefined) {
      memorySet.add(`${cell.x}-${cell.y}`);
    }
  });

  // Convert back to array of objects
  return Array.from(memorySet).map((id) => {
    const [x, y] = id.split("-").map(Number);
    return { x, y };
  });
}

/**
 * Add newly visible cells to memory with timestamp tracking.
 * Enhanced version that tracks when cells were last seen for decay mechanics.
 *
 * @param {Array} previousMemory - [{x, y, lastSeen?}, ...] previously seen cells
 * @param {Array} currentVisible - [{x, y}, ...] currently visible cells
 * @param {Number} turn - Current game turn (optional, for timestamp tracking)
 * @returns {Array} updatedMemory - Combined array with lastSeen timestamps
 */
export function updateFogMemoryWithTimestamps(
  previousMemory = [],
  currentVisible = [],
  turn = 0
) {
  // Convert previous memory to Map for fast lookup and timestamp preservation
  const memoryMap = new Map();
  previousMemory.forEach((cell) => {
    if (cell && cell.x !== undefined && cell.y !== undefined) {
      const key = `${cell.x}-${cell.y}`;
      memoryMap.set(key, {
        x: cell.x,
        y: cell.y,
        lastSeen: cell.lastSeen || turn,
      });
    }
  });

  // Add all currently visible cells to memory (update timestamp)
  currentVisible.forEach((cell) => {
    if (cell && cell.x !== undefined && cell.y !== undefined) {
      const key = `${cell.x}-${cell.y}`;
      memoryMap.set(key, {
        x: cell.x,
        y: cell.y,
        lastSeen: turn, // Update to current turn
      });
    }
  });

  // Convert back to array of objects
  return Array.from(memoryMap.values());
}

/**
 * Clear fog memory (new level, teleport, etc.)
 *
 * @returns {Array} Empty array
 */
export function resetFogMemory() {
  return [];
}

/**
 * Optional: Decay fog memory over time (for magical fog, storms, etc.)
 * Fades old memory cells out gradually.
 *
 * @param {Array} memory - current explored memory cells [{x, y, lastSeen?}, ...]
 * @param {Number} decayRate - number of turns before forgetting (default 20)
 * @param {Number} turn - current game turn
 * @returns {Array} Filtered memory array with old cells removed
 */
export function applyFogDecay(memory, decayRate = 20, turn = 0) {
  if (!memory || memory.length === 0) {
    return [];
  }

  return memory.filter((cell) => {
    // If cell has no lastSeen timestamp, keep it (for backward compatibility)
    if (!cell.lastSeen && cell.lastSeen !== 0) {
      return true;
    }

    // Calculate how many turns ago this cell was last seen
    const turnsSinceSeen = turn - cell.lastSeen;

    // Keep cell if it was seen within decay rate
    return turnsSinceSeen <= decayRate;
  });
}

/**
 * Merge fog memory from multiple sources (e.g., multiple party members).
 * Useful for shared team vision where all allies contribute to explored area.
 *
 * @param {Array} memories - Array of memory arrays from different observers
 * @returns {Array} Merged memory array
 */
export function mergeFogMemories(memories = []) {
  if (!memories || memories.length === 0) {
    return [];
  }

  const mergedSet = new Set();

  memories.forEach((memory) => {
    if (Array.isArray(memory)) {
      memory.forEach((cell) => {
        if (cell && cell.x !== undefined && cell.y !== undefined) {
          mergedSet.add(`${cell.x}-${cell.y}`);
        }
      });
    }
  });

  return Array.from(mergedSet).map((id) => {
    const [x, y] = id.split("-").map(Number);
    return { x, y };
  });
}

/**
 * Check if a cell is in the explored memory.
 *
 * @param {Object} cell - Cell position {x, y}
 * @param {Array} exploredCells - Array of explored cells
 * @returns {boolean} True if cell is explored
 */
export function isCellExplored(cell, exploredCells = []) {
  if (!cell || cell.x === undefined || cell.y === undefined) {
    return false;
  }

  const cellKey = `${cell.x}-${cell.y}`;
  return exploredCells.some((explored) => {
    return `${explored.x}-${explored.y}` === cellKey;
  });
}

/**
 * Get memory statistics (for debugging or UI display).
 *
 * @param {Array} exploredCells - Array of explored cells
 * @param {Array} visibleCells - Array of currently visible cells
 * @returns {Object} Statistics about memory and visibility
 */
export function getFogMemoryStats(exploredCells = [], visibleCells = []) {
  const exploredSet = new Set(exploredCells.map((c) => `${c.x}-${c.y}`));
  const visibleSet = new Set(visibleCells.map((c) => `${c.x}-${c.y}`));

  const exploredCount = exploredSet.size;
  const visibleCount = visibleSet.size;

  // Cells that are visible but not in memory (shouldn't happen, but useful for debugging)
  const newCells = visibleCells.filter((cell) => {
    return !exploredSet.has(`${cell.x}-${cell.y}`);
  });

  // Cells that are in memory but not currently visible (memory-only cells)
  const memoryOnlyCells = exploredCells.filter((cell) => {
    return !visibleSet.has(`${cell.x}-${cell.y}`);
  });

  return {
    exploredCount,
    visibleCount,
    memoryOnlyCount: memoryOnlyCells.length,
    newCellsCount: newCells.length,
    coverage: exploredCount > 0 ? (visibleCount / exploredCount) * 100 : 0,
  };
}

/**
 * Filter explored cells by a bounding area (useful for performance optimization).
 *
 * @param {Array} exploredCells - Array of explored cells
 * @param {Object} bounds - Bounding area {minX, minY, maxX, maxY}
 * @returns {Array} Filtered array of cells within bounds
 */
export function filterMemoryByBounds(exploredCells = [], bounds = {}) {
  if (
    !bounds ||
    bounds.minX === undefined ||
    bounds.minY === undefined ||
    bounds.maxX === undefined ||
    bounds.maxY === undefined
  ) {
    return exploredCells;
  }

  return exploredCells.filter((cell) => {
    return (
      cell.x >= bounds.minX &&
      cell.x <= bounds.maxX &&
      cell.y >= bounds.minY &&
      cell.y <= bounds.maxY
    );
  });
}

export default {
  updateFogMemory,
  updateFogMemoryWithTimestamps,
  resetFogMemory,
  applyFogDecay,
  mergeFogMemories,
  isCellExplored,
  getFogMemoryStats,
  filterMemoryByBounds,
};
