/**
 * Terrain Awareness System for AI
 * Provides AI with understanding of cover, elevation, obstacles, and tactical positioning
 */

// Terrain types and their tactical properties
export const TERRAIN_TYPES = {
  OPEN: {
    name: "Open Ground",
    cover: 0,
    movementCost: 1,
    visibility: 100,
    description: "Clear terrain with no cover",
  },
  LIGHT_COVER: {
    name: "Light Cover",
    cover: 1,
    movementCost: 1,
    visibility: 80,
    description: "Bushes, small trees, low walls",
  },
  HEAVY_COVER: {
    name: "Heavy Cover",
    cover: 2,
    movementCost: 1.5,
    visibility: 60,
    description: "Large trees, stone walls, boulders",
  },
  FULL_COVER: {
    name: "Full Cover",
    cover: 3,
    movementCost: 2,
    visibility: 0,
    description: "Solid walls, buildings, large obstacles",
  },
  DIFFICULT: {
    name: "Difficult Terrain",
    cover: 0,
    movementCost: 2,
    visibility: 90,
    description: "Mud, rubble, thick vegetation",
  },
  ELEVATED: {
    name: "Elevated Position",
    cover: 1,
    movementCost: 1.5,
    visibility: 120,
    description: "Hills, platforms, stairs",
  },
  WATER: {
    name: "Water",
    cover: 0,
    movementCost: 3,
    visibility: 100,
    description: "Rivers, ponds, swamps",
  },
};

// Elevation levels and their tactical advantages
export const ELEVATION_LEVELS = {
  GROUND: { level: 0, name: "Ground Level", advantage: 0 },
  LOW: { level: 1, name: "Low Elevation", advantage: 1 },
  MEDIUM: { level: 2, name: "Medium Elevation", advantage: 2 },
  HIGH: { level: 3, name: "High Elevation", advantage: 3 },
};

// Line of sight calculation
export function calculateLineOfSight(startPos, endPos, terrainMap) {
  const path = getPathBetweenPositions(startPos, endPos);
  let totalCover = 0;
  let blocked = false;

  for (const pos of path) {
    const terrain = getTerrainAtPosition(pos, terrainMap);
    if (terrain.type === TERRAIN_TYPES.FULL_COVER) {
      blocked = true;
      break;
    }
    totalCover += terrain.cover;
  }

  return {
    blocked,
    totalCover,
    visibility: blocked ? 0 : Math.max(0, 100 - totalCover * 20),
  };
}

/**
 * Check if a character can charge in the given terrain
 * Based on Reach, Clearance & Charge Dynamics rules
 * @param {Object} attacker - Attacking character
 * @param {string} terrain - Terrain type key from terrainSystem.js
 * @returns {Object} {canCharge: boolean, reason: string}
 */
export function canCharge(attacker, terrain) {
  // Import terrain types from terrainSystem (avoiding circular dependency)
  // Using inline definition to match current terrain values
  const TERRAIN_TYPES = {
    OPEN_GROUND: { clearance: { width: 20, height: 15 }, density: 0.1 },
    DENSE_FOREST: {
      clearance: { width: 6, height: 10 },
      density: 0.8,
      hasObstructions: true,
    },
    LIGHT_FOREST: { clearance: { width: 8, height: 12 }, density: 0.5 },
    ROCKY_TERRAIN: {
      clearance: { width: 8, height: 10 },
      density: 0.6,
      hasObstructions: true,
    },
    URBAN: {
      clearance: { width: 5, height: 12 },
      density: 0.7,
      hasObstructions: true,
    },
    SWAMP_MARSH: { clearance: { width: 8, height: 8 }, density: 0.4 },
    CAVE_INTERIOR: {
      clearance: { width: 5, height: 7 },
      density: 0.9,
      hasObstructions: true,
    },
  };

  const t = TERRAIN_TYPES[terrain] || TERRAIN_TYPES.OPEN_GROUND;
  const requiredWidth =
    attacker.size === "LARGE" ||
    attacker.size === "HUGE" ||
    (attacker.weight || 150) > 300
      ? 4
      : 2;
  const requiredWidthTotal = requiredWidth * 2; // Need 2x creature width for charge
  const requiredLength = 20; // feet needed for full charge (20ft minimum)

  if (t.clearance.width < requiredWidthTotal) {
    return {
      canCharge: false,
      reason: `Insufficient space (${t.clearance.width}ft width < ${requiredWidthTotal}ft required)`,
    };
  }

  if (t.density > 0.8) {
    return {
      canCharge: false,
      reason: "Dense terrain prevents charging",
    };
  }

  return {
    canCharge: true,
    reason: "Open path available for charge",
  };
}

// Get tactical advantage of a position
export function getTacticalAdvantage(position, terrainMap, enemies, allies) {
  const terrain = getTerrainAtPosition(position, terrainMap);
  let advantage = 0;

  // Cover bonus
  advantage += terrain.cover * 2;

  // Elevation bonus
  if (terrain.elevation) {
    advantage += ELEVATION_LEVELS[terrain.elevation].advantage;
  }

  // Flanking opportunities
  const flankingBonus = calculateFlankingBonus(position, enemies);
  advantage += flankingBonus;

  // Escape routes
  const escapeRoutes = countEscapeRoutes(position, terrainMap);
  advantage += escapeRoutes;

  // Distance to enemies (closer = more dangerous but better for melee)
  const avgEnemyDistance = calculateAverageDistance(position, enemies);
  if (avgEnemyDistance < 3) {
    advantage += 2; // Good for melee combat
  } else if (avgEnemyDistance > 8) {
    advantage += 1; // Safe distance
  }

  return {
    total: advantage,
    cover: terrain.cover,
    elevation: terrain.elevation
      ? ELEVATION_LEVELS[terrain.elevation].advantage
      : 0,
    flanking: flankingBonus,
    escapeRoutes,
    avgEnemyDistance,
  };
}

// Find best tactical position
export function findBestTacticalPosition(
  currentPos,
  terrainMap,
  enemies,
  allies,
  maxDistance = 5
) {
  const possiblePositions = getPositionsInRange(
    currentPos,
    maxDistance,
    terrainMap
  );
  let bestPosition = currentPos;
  let bestScore = -Infinity;

  for (const pos of possiblePositions) {
    const advantage = getTacticalAdvantage(pos, terrainMap, enemies, allies);
    const movementCost = calculateMovementCost(currentPos, pos, terrainMap);
    const score = advantage.total - movementCost;

    if (score > bestScore) {
      bestScore = score;
      bestPosition = pos;
    }
  }

  return {
    position: bestPosition,
    advantage: getTacticalAdvantage(bestPosition, terrainMap, enemies, allies),
    movementCost: calculateMovementCost(currentPos, bestPosition, terrainMap),
  };
}

// Calculate flanking bonus
function calculateFlankingBonus(position, enemies) {
  let flankingBonus = 0;

  for (const enemy of enemies) {
    // Check if we can attack from the side or rear
    const angle = calculateAttackAngle(position, enemy.position);
    if (angle > 45 && angle < 135) {
      flankingBonus += 2; // Side attack
    } else if (angle > 135) {
      flankingBonus += 3; // Rear attack
    }
  }

  return flankingBonus;
}

// Count escape routes from a position
function countEscapeRoutes(position, terrainMap) {
  const adjacentPositions = getAdjacentPositions(position);
  let escapeRoutes = 0;

  for (const adjPos of adjacentPositions) {
    const terrain = getTerrainAtPosition(adjPos, terrainMap);
    if (terrain.movementCost <= 2) {
      // Not blocked by difficult terrain
      escapeRoutes++;
    }
  }

  return escapeRoutes;
}

// Calculate average distance to enemies
function calculateAverageDistance(position, enemies) {
  if (enemies.length === 0) return 0;

  let totalDistance = 0;
  for (const enemy of enemies) {
    totalDistance += calculateDistance(position, enemy.position);
  }

  return totalDistance / enemies.length;
}

// Get terrain at specific position
function getTerrainAtPosition(position, terrainMap) {
  // Default to open terrain if not specified
  return (
    terrainMap[`${position.x},${position.y}`] || {
      type: TERRAIN_TYPES.OPEN,
      elevation: ELEVATION_LEVELS.GROUND,
    }
  );
}

// Calculate movement cost between positions
function calculateMovementCost(startPos, endPos, terrainMap) {
  const path = getPathBetweenPositions(startPos, endPos);
  let totalCost = 0;

  for (const pos of path) {
    const terrain = getTerrainAtPosition(pos, terrainMap);
    totalCost += terrain.movementCost;
  }

  return totalCost;
}

// Get positions in range
function getPositionsInRange(centerPos, range, terrainMap) {
  const positions = [];

  for (let x = centerPos.x - range; x <= centerPos.x + range; x++) {
    for (let y = centerPos.y - range; y <= centerPos.y + range; y++) {
      const distance = calculateDistance(centerPos, { x, y });
      if (distance <= range) {
        positions.push({ x, y });
      }
    }
  }

  return positions;
}

// Get adjacent positions
function getAdjacentPositions(position) {
  return [
    { x: position.x - 1, y: position.y },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y - 1 },
    { x: position.x, y: position.y + 1 },
    { x: position.x - 1, y: position.y - 1 },
    { x: position.x + 1, y: position.y + 1 },
  ];
}

// Calculate distance between two positions
function calculateDistance(pos1, pos2) {
  return Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2));
}

// Get path between positions (simplified)
function getPathBetweenPositions(startPos, endPos) {
  const path = [];
  const steps = Math.max(
    Math.abs(endPos.x - startPos.x),
    Math.abs(endPos.y - startPos.y)
  );

  for (let i = 0; i <= steps; i++) {
    const t = steps > 0 ? i / steps : 0;
    const x = Math.round(startPos.x + (endPos.x - startPos.x) * t);
    const y = Math.round(startPos.y + (endPos.y - startPos.y) * t);
    path.push({ x, y });
  }

  return path;
}

// Calculate attack angle
function calculateAttackAngle(attackerPos, targetPos) {
  const dx = targetPos.x - attackerPos.x;
  const dy = targetPos.y - attackerPos.y;
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

// AI terrain decision making
export function makeTerrainAwareDecision(aiUnit, terrainMap, enemies, allies) {
  const currentPos = aiUnit.position;
  const currentAdvantage = getTacticalAdvantage(
    currentPos,
    terrainMap,
    enemies,
    allies
  );

  // If in poor position, try to move to better one
  if (currentAdvantage.total < 3) {
    const bestPosition = findBestTacticalPosition(
      currentPos,
      terrainMap,
      enemies,
      allies
    );

    if (bestPosition.advantage.total > currentAdvantage.total + 2) {
      return {
        action: "MOVE_TO_POSITION",
        target: bestPosition.position,
        reason: `Moving to better tactical position (advantage: ${bestPosition.advantage.total})`,
      };
    }
  }

  // Look for cover if under attack
  const underAttack = enemies.some((enemy) => {
    const los = calculateLineOfSight(enemy.position, currentPos, terrainMap);
    return !los.blocked && los.visibility > 50;
  });

  if (underAttack && currentAdvantage.cover < 2) {
    const coverPosition = findCoverPosition(currentPos, terrainMap, enemies);
    if (coverPosition) {
      return {
        action: "TAKE_COVER",
        target: coverPosition,
        reason: "Seeking cover from enemy fire",
      };
    }
  }

  // Look for high ground
  if (currentAdvantage.elevation < 2) {
    const highGround = findHighGround(currentPos, terrainMap);
    if (highGround) {
      return {
        action: "TAKE_HIGH_GROUND",
        target: highGround,
        reason: "Moving to elevated position for tactical advantage",
      };
    }
  }

  return null; // No terrain-based action needed
}

// Find cover position
function findCoverPosition(currentPos, terrainMap, enemies) {
  const nearbyPositions = getPositionsInRange(currentPos, 3, terrainMap);

  for (const pos of nearbyPositions) {
    const terrain = getTerrainAtPosition(pos, terrainMap);
    if (terrain.cover >= 2) {
      // Check if this position provides cover from enemies
      let coveredFromAll = true;
      for (const enemy of enemies) {
        const los = calculateLineOfSight(enemy.position, pos, terrainMap);
        if (los.visibility > 30) {
          coveredFromAll = false;
          break;
        }
      }

      if (coveredFromAll) {
        return pos;
      }
    }
  }

  return null;
}

// Find high ground
function findHighGround(currentPos, terrainMap) {
  const nearbyPositions = getPositionsInRange(currentPos, 4, terrainMap);
  let bestElevation = 0;
  let bestPosition = null;

  for (const pos of nearbyPositions) {
    const terrain = getTerrainAtPosition(pos, terrainMap);
    if (terrain.elevation && terrain.elevation > bestElevation) {
      bestElevation = terrain.elevation;
      bestPosition = pos;
    }
  }

  return bestPosition;
}

// Export terrain utilities
export const TerrainUtils = {
  TERRAIN_TYPES,
  ELEVATION_LEVELS,
  calculateLineOfSight,
  getTacticalAdvantage,
  findBestTacticalPosition,
  makeTerrainAwareDecision,
};
