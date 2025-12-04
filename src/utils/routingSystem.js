// src/utils/routingSystem.js

/**
 * Get a list of hex positions for threats (enemies to the router).
 */
export function getThreatPositionsForFighter(fighter, fighters, positions) {
  if (!fighter || !Array.isArray(fighters) || !positions) return [];

  const sameSideType = fighter.type;

  return fighters
    .filter(
      (f) =>
        f.id !== fighter.id &&
        f.type !== sameSideType &&
        !f.isDead &&
        !f.isKO &&
        !f.moraleState?.hasFled
    )
    .map((f) => positions[f.id])
    .filter(Boolean);
}

/**
 * Factory to create an occupancy checker, ignoring a specific fighter id.
 */
export function makeIsHexOccupied(positions, ignoreId = null) {
  return (x, y, ignore = ignoreId) =>
    Object.entries(positions).some(([id, pos]) => {
      if (ignore && String(id) === String(ignore)) return false;
      if (!pos) return false;
      return pos.x === x && pos.y === y;
    });
}

/**
 * Simple "at edge" check for treating a routed fighter as off-board.
 */
export function isAtMapEdge(pos, gridWidth, gridHeight) {
  if (!pos) return false;

  return (
    pos.x === 0 ||
    pos.y === 0 ||
    pos.x === gridWidth - 1 ||
    pos.y === gridHeight - 1
  );
}

/**
 * Generic retreat path finder.
 *
 * You can directly re-export your existing CombatPage findRetreatDestination logic into here,
 * or call this wrapper from that function.
 */
export function findBestRetreatHex({
  currentPos,
  threatPositions,
  maxSteps,
  isHexOccupied,
  getHexNeighbors,
  isValidPosition,
  calculateDistance,
}) {
  if (
    !currentPos ||
    !Array.isArray(threatPositions) ||
    threatPositions.length === 0 ||
    !maxSteps ||
    maxSteps <= 0
  ) {
    return null;
  }

  const minDistanceToThreats = (position) =>
    threatPositions.reduce((closest, threatPos) => {
      if (!threatPos) return closest;
      const distance = calculateDistance(position, threatPos);
      return Math.min(closest, distance);
    }, Number.POSITIVE_INFINITY);

  const startingScore = minDistanceToThreats(currentPos);
  let bestPosition = currentPos;
  let bestScore = startingScore;
  let workingPosition = currentPos;
  let stepsTaken = 0;

  for (let step = 0; step < maxSteps; step += 1) {
    const neighbors = getHexNeighbors(workingPosition.x, workingPosition.y)
      .filter((hex) => isValidPosition(hex.x, hex.y))
      .filter((hex) => !isHexOccupied(hex.x, hex.y));

    if (neighbors.length === 0) break;

    let selectedNeighbor = null;
    let selectedScore = bestScore;

    neighbors.forEach((hex) => {
      const score = minDistanceToThreats(hex);
      if (score > selectedScore + 0.01) {
        selectedNeighbor = hex;
        selectedScore = score;
      }
    });

    if (!selectedNeighbor) break;

    workingPosition = selectedNeighbor;
    bestPosition = selectedNeighbor;
    bestScore = selectedScore;
    stepsTaken += 1;
  }

  if (stepsTaken === 0 || bestScore <= startingScore) {
    return null;
  }

  return {
    position: bestPosition,
    stepsMoved: stepsTaken,
    distanceFeet: calculateDistance(currentPos, bestPosition),
    safetyScore: bestScore,
  };
}

