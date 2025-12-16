/**
 * Bee-line pathfinding algorithm for hex grids
 * Finds a direct path between two hex coordinates, avoiding obstacles
 *
 * @param {Object} start - Starting hex coordinate {q, r}
 * @param {Object} end - Ending hex coordinate {q, r}
 * @param {Function} isObstacle - Function that takes a hex {q, r} and returns true if it's an obstacle
 * @returns {Array} Array of hex coordinates {q, r} representing the path, or null if no path found
 */
export function findBeePath(start, end, isObstacle) {
  if (!start || !end) return null;

  // Helper function to get hex key
  const hexKey = (hex) => `${hex.q},${hex.r}`;

  // Helper function to get hex distance (axial)
  const hexDistance = (a, b) =>
    (Math.abs(a.q - b.q) +
      Math.abs(a.q + a.r - b.q - b.r) +
      Math.abs(a.r - b.r)) / 2;

  // Hex directions (axial coordinates)
  const directions = [
    { q: +1, r: 0 },
    { q: +1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: +1 },
    { q: 0, r: +1 },
  ];

  const getNeighbors = (hex) =>
    directions.map((dir) => ({ q: hex.q + dir.q, r: hex.r + dir.r }));

  const startKey = hexKey(start);
  const endKey = hexKey(end);

  // A* (uniform step cost = 1)
  const openSet = [
    { hex: start, g: 0, h: hexDistance(start, end), f: hexDistance(start, end) },
  ];
  const cameFrom = new Map();
  const gScore = new Map([[startKey, 0]]);
  const closedSet = new Set();

  while (openSet.length > 0) {
    // lowest f first
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();
    const currentKey = hexKey(current.hex);

    // If we already processed a better instance of this node, skip
    if (closedSet.has(currentKey)) continue;

    // Goal reached
    if (currentKey === endKey) {
      const path = [];
      let node = current.hex;
      path.push(node);

      while (cameFrom.has(hexKey(node))) {
        node = cameFrom.get(hexKey(node));
        path.unshift(node);
      }

      return path.length > 0 ? path : null;
    }

    closedSet.add(currentKey);

    for (const neighbor of getNeighbors(current.hex)) {
      const neighborKey = hexKey(neighbor);

      if (closedSet.has(neighborKey)) continue;
      if (isObstacle && isObstacle(neighbor)) continue;

      const currentG = gScore.get(currentKey) ?? Number.POSITIVE_INFINITY;
      const tentativeG = currentG + 1;

      const bestKnownNeighborG =
        gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY;

      if (tentativeG < bestKnownNeighborG) {
        cameFrom.set(neighborKey, current.hex);
        gScore.set(neighborKey, tentativeG);

        const h = hexDistance(neighbor, end);
        const f = tentativeG + h;

        const existingIndex = openSet.findIndex(
          (n) => hexKey(n.hex) === neighborKey
        );

        if (existingIndex >= 0) {
          openSet[existingIndex] = { hex: neighbor, g: tentativeG, h, f };
        } else {
          openSet.push({ hex: neighbor, g: tentativeG, h, f });
        }
      }
    }
  }

  return null;
}

export default {
  findBeePath
};

