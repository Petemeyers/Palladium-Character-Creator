// src/engine/pathfinding.cjs
// A* pathfinding for hex grid using gridState

const { neighbors, distance, key } = require("./hex.cjs");

/**
 * A* pathfinding on hex grid
 * @param {Object} params
 * @param {{x:number,y:number}} params.start - Starting position
 * @param {{x:number,y:number}} params.goal - Goal position
 * @param {Object} params.gridState - GridState instance
 * @param {string} params.moverId - Entity ID of the mover (for occupancy checks)
 * @param {Object} params.mover - Mover entity with moveCaps (for capability-aware blocking)
 * @param {number} params.maxCost - Maximum path cost (movement points/actions)
 * @param {Function} params.terrainCost - Function (pos) => cost for that hex (default: 1)
 * @param {Function} params.canEnterOccupied - Function (pos, occupantId) => boolean (default: false, except for goal)
 * @returns {Array<{x:number,y:number}>|null} Path from start to goal, or null if unreachable
 */
function aStar({
  start,
  goal,
  gridState,
  moverId,
  mover = null,
  maxCost = Infinity,
  terrainCost = () => 1,
  canEnterOccupied = null, // Custom function to check if can enter occupied hex
}) {
  const open = new Map();
  const closed = new Set();
  const cameFrom = new Map();

  const gScore = new Map();
  const fScore = new Map();

  const startKey = key(start);
  gScore.set(startKey, 0);
  fScore.set(startKey, distance(start, goal));
  open.set(startKey, start);

  while (open.size > 0) {
    // Find node with lowest fScore
    let currentKey = null;
    let current = null;
    let bestF = Infinity;

    for (const [k, p] of open.entries()) {
      const f = fScore.get(k) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        currentKey = k;
        current = p;
      }
    }

    if (!current) break;

    // Check if we reached the goal
    if (current.x === goal.x && current.y === goal.y) {
      return reconstructPath(cameFrom, current);
    }

    open.delete(currentKey);
    closed.add(currentKey);

    // Check all neighbors
    for (const nb of neighbors(current)) {
      const nbKey = key(nb);
      if (closed.has(nbKey)) continue;

      // Check if blocked (mover-aware)
      if (gridState.isBlocked(nb.x, nb.y, mover)) continue;

      // Check occupancy
      const occupantId = gridState.getOccupant(nb.x, nb.y);
      const isGoal = nb.x === goal.x && nb.y === goal.y;
      
      // Allow entering goal hex if occupied (for close-to-melee), otherwise block
      if (occupantId && occupantId !== moverId) {
        if (!isGoal || !canEnterOccupied || !canEnterOccupied(nb, occupantId)) {
          continue;
        }
      }

      // Calculate cost to reach this neighbor (terrainCost already closes over mover)
      const stepCost = terrainCost(nb);
      const tentativeG = (gScore.get(currentKey) ?? Infinity) + stepCost;

      // Skip if exceeds max cost
      if (tentativeG > maxCost) continue;

      // Update if this is a better path
      if (!open.has(nbKey) || tentativeG < (gScore.get(nbKey) ?? Infinity)) {
        cameFrom.set(nbKey, current);
        gScore.set(nbKey, tentativeG);
        fScore.set(nbKey, tentativeG + distance(nb, goal));
        open.set(nbKey, nb);
      }
    }
  }

  return null; // No path found
}

/**
 * Reconstruct path from cameFrom map
 */
function reconstructPath(cameFrom, current) {
  const path = [current];
  let curKey = key(current);
  while (cameFrom.has(curKey)) {
    const prev = cameFrom.get(curKey);
    path.unshift(prev);
    curKey = key(prev);
  }
  return path;
}

module.exports = { aStar };

