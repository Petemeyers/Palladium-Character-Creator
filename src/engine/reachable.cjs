// src/engine/reachable.cjs
// Dijkstra/flood fill to find all reachable hexes from a start position

const { neighbors, key } = require("./hex.cjs");

/**
 * Get all reachable hexes from a start position using Dijkstra/flood fill
 * @param {Object} params
 * @param {{x:number,y:number}} params.start - Starting position
 * @param {Object} params.gridState - GridState instance
 * @param {Object} params.mover - Mover entity with moveCaps
 * @param {string} params.moverId - Entity ID of the mover
 * @param {number} params.maxCost - Maximum movement cost (remaining attacks)
 * @returns {Array<{x:number,y:number,cost:number}>} Array of reachable hexes with their costs
 */
function getReachableHexes({
  start,
  gridState,
  mover,
  moverId,
  maxCost,
}) {
  const open = new Map();   // key -> { pos, cost }
  const visited = new Map(); // key -> bestCost

  const startKey = key(start);
  open.set(startKey, { pos: start, cost: 0 });
  visited.set(startKey, 0);

  while (open.size > 0) {
    // Pop lowest cost node
    let curKey = null;
    let curNode = null;
    let best = Infinity;

    for (const [k, n] of open.entries()) {
      if (n.cost < best) {
        best = n.cost;
        curKey = k;
        curNode = n;
      }
    }

    if (!curNode) break;
    open.delete(curKey);

    // Explore neighbors
    for (const nb of neighbors(curNode.pos)) {
      // Block check (mover-aware)
      if (gridState.isBlocked(nb.x, nb.y, mover)) continue;

      // Occupancy check (can't enter occupied hexes, except for close-to-melee which is handled in MOVE)
      const occ = gridState.getOccupant(nb.x, nb.y);
      if (occ && occ !== moverId) continue;

      // Calculate cost to reach this neighbor
      const stepCost = gridState.terrainMoveCost(nb.x, nb.y, mover);
      const nextCost = curNode.cost + stepCost;

      // Skip if exceeds max cost
      if (nextCost > maxCost) continue;

      const nbKey = key(nb);
      const prevBest = visited.get(nbKey);
      
      // Update if we found a better path or haven't visited yet
      if (prevBest == null || nextCost < prevBest) {
        visited.set(nbKey, nextCost);
        open.set(nbKey, { pos: nb, cost: nextCost });
      }
    }
  }

  // Return everything except the start hex
  const results = [];
  for (const [k, cost] of visited.entries()) {
    if (k === startKey) continue;
    const [x, y] = k.split(",").map(Number);
    results.push({ x, y, cost });
  }

  return results;
}

module.exports = { getReachableHexes };

