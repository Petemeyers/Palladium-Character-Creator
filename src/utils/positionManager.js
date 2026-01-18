/**
 * Position Manager
 * Manages character and entity positions on the tactical map
 * Handles position updates, validation, and coordinate conversions
 * 
 * TODO: Implement position management system
 */

/**
 * Calculate distance between two positions
 * @param {Object} pos1 - First position {x, y} or {q, r} for hex
 * @param {Object} pos2 - Second position {x, y} or {q, r} for hex
 * @param {string} gridType - "hex" or "square"
 * @returns {number} Distance in grid units
 */
export function getDistanceBetween(pos1, pos2, gridType = "hex") {
  if (!pos1 || !pos2) return Infinity;
  
  if (gridType === "hex") {
    // Support BOTH axial {q,r} and offset {x,y} (odd-r) coordinates.
    if (
      pos1.q !== undefined && pos1.r !== undefined &&
      pos2.q !== undefined && pos2.r !== undefined
    ) {
      const dq = pos2.q - pos1.q;
      const dr = pos2.r - pos1.r;
      return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
    }

    // Offset {x,y} -> cube distance (odd-r horizontal layout)
    if (
      pos1.x !== undefined && pos1.y !== undefined &&
      pos2.x !== undefined && pos2.y !== undefined
    ) {
      const offsetToCube = (col, row) => {
        const x = col - (row - (row & 1)) / 2;
        const z = row;
        const y = -x - z;
        return { x, y, z };
      };
      const a = offsetToCube(pos1.x, pos1.y);
      const b = offsetToCube(pos2.x, pos2.y);
      return (
        (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z)) / 2
      );
    }

    return Infinity;
  } else {
    // Square grid distance (Manhattan or Euclidean)
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

/**
 * Validate position is within bounds
 * @param {Object} position - Position to validate
 * @param {Object} bounds - Bounds {minX, maxX, minY, maxY} or {minQ, maxQ, minR, maxR}
 * @returns {boolean} True if position is valid
 */
export function isValidPosition(position, bounds = {}) {
  // TODO: Validate position is within map bounds
  if (!position) return false;
  
  if (position.q !== undefined && position.r !== undefined) {
    // Hex coordinates
    return (
      position.q >= (bounds.minQ || 0) &&
      position.q <= (bounds.maxQ || 100) &&
      position.r >= (bounds.minR || 0) &&
      position.r <= (bounds.maxR || 100)
    );
  } else {
    // Square coordinates
    return (
      position.x >= (bounds.minX || 0) &&
      position.x <= (bounds.maxX || 100) &&
      position.y >= (bounds.minY || 0) &&
      position.y <= (bounds.maxY || 100)
    );
  }
}

/**
 * Convert hex coordinates to pixel coordinates
 * @param {Object} hexPos - Hex position {q, r}
 * @param {number} hexSize - Size of hex in pixels
 * @returns {Object} Pixel position {x, y}
 */
export function hexToPixel(hexPos, hexSize = 50) {
  // TODO: Convert hex coordinates to pixel coordinates
  if (!hexPos || hexPos.q === undefined || hexPos.r === undefined) {
    return { x: 0, y: 0 };
  }
  
  const x = hexSize * (Math.sqrt(3) * hexPos.q + (Math.sqrt(3) / 2) * hexPos.r);
  const y = hexSize * ((3 / 2) * hexPos.r);
  
  return { x, y };
}

/**
 * Convert pixel coordinates to hex coordinates
 * @param {Object} pixelPos - Pixel position {x, y}
 * @param {number} hexSize - Size of hex in pixels
 * @returns {Object} Hex position {q, r}
 */
export function pixelToHex(pixelPos, hexSize = 50) {
  // TODO: Convert pixel coordinates to hex coordinates
  if (!pixelPos) return { q: 0, r: 0 };
  
  const q = ((2 / 3) * pixelPos.x) / hexSize;
  const r = ((-1 / 3) * pixelPos.x + (Math.sqrt(3) / 3) * pixelPos.y) / hexSize;
  
  return { q: Math.round(q), r: Math.round(r) };
}

/**
 * Get adjacent positions
 * @param {Object} position - Current position
 * @param {string} gridType - "hex" or "square"
 * @returns {Array} Array of adjacent positions
 */
export function getAdjacentPositions(position, gridType = "hex") {
  // TODO: Get all adjacent positions
  if (!position) return [];
  
  if (gridType === "hex") {
    // Hex grid has 6 neighbors
    const directions = [
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 },
    ];
    
    return directions.map((dir) => ({
      q: position.q + dir.q,
      r: position.r + dir.r,
    }));
  } else {
    // Square grid has 4 or 8 neighbors (cardinal or diagonal)
    return [
      { x: position.x + 1, y: position.y },
      { x: position.x - 1, y: position.y },
      { x: position.x, y: position.y + 1 },
      { x: position.x, y: position.y - 1 },
    ];
  }
}

/**
 * Initialize positions for combatants
 * @param {Array} combatants - Array of combatant objects
 * @param {Object} options - Options {gridType, spacing, startPositions}
 * @returns {Object} Map of combatant ID to position
 */
export function initializePositions(combatants = [], options = {}) {
  const { gridType = 'hex', spacing = 5, startPositions = {} } = options;
  const positions = {};
  
  combatants.forEach((combatant, index) => {
    const id = combatant.id || combatant._id || `combatant-${index}`;
    
    if (startPositions[id]) {
      positions[id] = startPositions[id];
    } else {
      // Default positioning - spread out in a line
      if (gridType === 'hex') {
        positions[id] = { q: index * spacing, r: 0 };
      } else {
        positions[id] = { x: index * spacing, y: 0 };
      }
    }
  });
  
  return positions;
}

/**
 * Update a combatant's position
 * @param {Object} positions - Current positions map
 * @param {string} combatantId - ID of combatant
 * @param {Object} newPosition - New position {x, y} or {q, r}
 * @returns {Object} Updated positions map
 */
export function updatePosition(positions = {}, combatantId, newPosition) {
  if (!combatantId || !newPosition) return positions;
  
  return {
    ...positions,
    [combatantId]: newPosition,
  };
}

/**
 * Get auto-target distance for a combatant
 * @param {Object} combatant - Combatant object
 * @param {Object} position - Combatant's position
 * @param {Array} targets - Array of target combatants
 * @param {Object} targetPositions - Map of target positions
 * @returns {Object|null} Nearest target and distance, or null
 */
export function getAutoTargetDistance(combatant, position, targets = [], targetPositions = {}) {
  if (!combatant || !position || !targets.length) return null;
  
  let nearest = null;
  let minDistance = Infinity;
  
  targets.forEach(target => {
    const targetId = target.id || target._id;
    const targetPos = targetPositions[targetId];
    
    if (!targetPos) return;
    
    const distance = getDistanceBetween(position, targetPos, 'hex');
    if (distance < minDistance) {
      minDistance = distance;
      nearest = { target, distance, position: targetPos };
    }
  });
  
  return nearest;
}

/**
 * Get all distances between a position and multiple targets
 * @param {Object} position - Source position
 * @param {Array} targets - Array of target objects
 * @param {Object} targetPositions - Map of target positions
 * @param {string} gridType - "hex" or "square"
 * @returns {Array} Array of {target, distance} objects
 */
export function getAllDistances(position, targets = [], targetPositions = {}, gridType = 'hex') {
  if (!position || !targets.length) return [];
  
  return targets.map(target => {
    const targetId = target.id || target._id;
    const targetPos = targetPositions[targetId];
    const distance = targetPos ? getDistanceBetween(position, targetPos, gridType) : Infinity;
    
    return { target, distance, position: targetPos };
  }).sort((a, b) => a.distance - b.distance);
}

export default {
  getDistanceBetween,
  isValidPosition,
  hexToPixel,
  pixelToHex,
  getAdjacentPositions,
};

