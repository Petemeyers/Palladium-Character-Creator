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
  
  // Simple bee-line pathfinding: move directly toward target
  // If obstacle encountered, try to go around it
  const path = [];
  const visited = new Set();
  
  // Helper function to get hex key
  const hexKey = (hex) => `${hex.q},${hex.r}`;
  
  // Helper function to get hex distance
  const hexDistance = (a, b) => {
    return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
  };
  
  // Hex directions (axial coordinates)
  const directions = [
    { q: +1, r: 0 },
    { q: +1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: +1 },
    { q: 0, r: +1 },
  ];
  
  // Get neighbors of a hex
  const getNeighbors = (hex) => {
    return directions.map(dir => ({
      q: hex.q + dir.q,
      r: hex.r + dir.r
    }));
  };
  
  // Simple A* pathfinding
  const openSet = [{ hex: start, g: 0, h: hexDistance(start, end), f: hexDistance(start, end) }];
  const cameFrom = new Map();
  const gScore = new Map();
  gScore.set(hexKey(start), 0);
  
  visited.add(hexKey(start));
  
  while (openSet.length > 0) {
    // Find node with lowest f score
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();
    
    // Check if we reached the goal
    if (current.hex.q === end.q && current.hex.r === end.r) {
      // Reconstruct path
      const path = [];
      let node = current.hex;
      path.push(node);
      
      while (cameFrom.has(hexKey(node))) {
        node = cameFrom.get(hexKey(node));
        path.unshift(node);
      }
      
      return path.length > 0 ? path : null;
    }
    
    // Explore neighbors
    const neighbors = getNeighbors(current.hex);
    for (const neighbor of neighbors) {
      const neighborKey = hexKey(neighbor);
      
      // Skip if already visited
      if (visited.has(neighborKey)) continue;
      
      // Check if obstacle
      if (isObstacle && isObstacle(neighbor)) continue;
      
      visited.add(neighborKey);
      
      // Calculate tentative g score
      const tentativeG = (gScore.get(hexKey(current.hex)) || Infinity) + 1;
      const currentG = gScore.get(neighborKey) || Infinity;
      
      if (tentativeG < currentG) {
        cameFrom.set(neighborKey, current.hex);
        gScore.set(neighborKey, tentativeG);
        
        const h = hexDistance(neighbor, end);
        const f = tentativeG + h;
        
        // Check if already in open set
        const existingIndex = openSet.findIndex(n => hexKey(n.hex) === neighborKey);
        if (existingIndex >= 0) {
          openSet[existingIndex] = { hex: neighbor, g: tentativeG, h, f };
        } else {
          openSet.push({ hex: neighbor, g: tentativeG, h, f });
        }
      }
    }
  }
  
  // No path found
  return null;
}

export default {
  findBeePath
};

