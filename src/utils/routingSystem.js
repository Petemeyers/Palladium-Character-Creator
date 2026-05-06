// src/utils/routingSystem.js

/**
 * Get a list of hex positions for threats (enemies to the router).
 */
export const HUMAN_ROUTING_PROFILE = Object.freeze({
  id: "human_panic",
  triggerStyle: "humanoid",
  exitMode: "map_edge",
  pathStyle: "panic",
  safeDistanceFt: 0,
  regroupAfterRounds: 0,
  canRally: false,
  corneredBehavior: "surrender",
  ignoresFormation: false,
  ignoresLeaderAnchor: false,
  avoidCrowds: false,
  prefersCover: false,
});

export const GIANT_PREDATOR_ROUTING_PROFILE = Object.freeze({
  id: "giant_predator",
  triggerStyle: "monster",
  exitMode: "safe_distance",
  pathStyle: "break_contact",
  safeDistanceFt: 120,
  regroupAfterRounds: 2,
  canRally: true,
  corneredBehavior: "berserk",
  ignoresFormation: true,
  ignoresLeaderAnchor: true,
  avoidCrowds: true,
  prefersCover: false,
});

export const TERRITORIAL_BEAST_ROUTING_PROFILE = Object.freeze({
  id: "territorial_beast",
  triggerStyle: "monster",
  exitMode: "safe_distance",
  pathStyle: "break_contact",
  safeDistanceFt: 90,
  regroupAfterRounds: 1,
  canRally: false,
  corneredBehavior: "fight",
  ignoresFormation: true,
  ignoresLeaderAnchor: true,
  avoidCrowds: true,
  prefersCover: false,
});

export function getRoutingProfile(fighter) {
  if (fighter?.routingProfile && typeof fighter.routingProfile === "object") {
    return {
      ...HUMAN_ROUTING_PROFILE,
      ...fighter.routingProfile,
    };
  }

  if (fighter?.aiProfile === "territorial_behemoth") {
    return GIANT_PREDATOR_ROUTING_PROFILE;
  }

  if (
    fighter?.type === "enemy" &&
    fighter?.canSurrender === false &&
    !fighter?.neverFlee &&
    fighter?.aiProfile
  ) {
    return TERRITORIAL_BEAST_ROUTING_PROFILE;
  }

  return HUMAN_ROUTING_PROFILE;
}

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

function getMinimumThreatDistance(position, threatPositions, calculateDistance) {
  if (
    !position ||
    !Array.isArray(threatPositions) ||
    threatPositions.length === 0 ||
    typeof calculateDistance !== "function"
  ) {
    return Number.POSITIVE_INFINITY;
  }

  return threatPositions.reduce((closest, threatPos) => {
    if (!threatPos) return closest;
    const distance = calculateDistance(position, threatPos);
    return Math.min(closest, distance);
  }, Number.POSITIVE_INFINITY);
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
  gridWidth,
  gridHeight,
  allowTieMoves = true,
  preferEdgeEscape = true,
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

  const EPS = 1e-6;
  const startingScore = minDistanceToThreats(currentPos);

  // --- Evaluate ALL reachable candidates within maxSteps (BFS), not greedy stepping ---
  // This prevents routed units from freezing when no single neighbor is strictly better.
  const keyOf = (p) => `${p.x},${p.y}`;
  const visited = new Map(); // key -> steps
  const queue = [{ pos: currentPos, steps: 0 }];
  visited.set(keyOf(currentPos), 0);

  while (queue.length) {
    const { pos, steps } = queue.shift();
    if (steps >= maxSteps) continue;

    const neighbors = getHexNeighbors(pos.x, pos.y)
      .filter((hex) => isValidPosition(hex.x, hex.y))
      .filter((hex) => !isHexOccupied(hex.x, hex.y));

    for (const n of neighbors) {
      const k = keyOf(n);
      if (visited.has(k)) continue;
      visited.set(k, steps + 1);
      queue.push({ pos: n, steps: steps + 1 });
    }
  }

  const isEdge =
    typeof gridWidth === "number" && typeof gridHeight === "number"
      ? (p) => isAtMapEdge(p, gridWidth, gridHeight)
      : () => false;

  let best = null;
  let bestSafety = -Infinity;
  let bestSteps = 0;
  let bestIsEdge = false;

  for (const [k, steps] of visited.entries()) {
    if (steps === 0) continue; // skip staying in place

    const [xStr, yStr] = k.split(",");
    const candidate = { x: Number(xStr), y: Number(yStr) };

    const candidateIsEdge = isEdge(candidate);
    const safety = minDistanceToThreats(candidate);

    // Tie-moves: allow equal safety scores (and tiny float noise) so units can "slide".
    const qualifies =
      (allowTieMoves && safety + EPS >= startingScore) ||
      (!allowTieMoves && safety > startingScore + EPS) ||
      (preferEdgeEscape && candidateIsEdge);

    if (!qualifies) continue;

    const edgeWins = preferEdgeEscape && candidateIsEdge && !bestIsEdge;
    const safetyWins =
      (!bestIsEdge || !preferEdgeEscape) && safety > bestSafety + EPS;
    const tieWins = Math.abs(safety - bestSafety) <= EPS && steps > bestSteps;

    if (!best || edgeWins || safetyWins || tieWins) {
      best = candidate;
      bestSafety = safety;
      bestSteps = steps;
      bestIsEdge = candidateIsEdge;
    }
  }

  if (!best) return null;

  return {
    position: best,
    stepsMoved: bestSteps,
    distanceFeet: calculateDistance(currentPos, best),
    safetyScore: bestSafety,
    reachedEdge: bestIsEdge,
  };
}

export function findRoutingDestination({
  currentPos,
  threatPositions,
  maxSteps,
  isHexOccupied,
  getHexNeighbors,
  isValidPosition,
  calculateDistance,
  gridWidth,
  gridHeight,
  routingProfile,
}) {
  const profile = {
    ...HUMAN_ROUTING_PROFILE,
    ...(routingProfile || {}),
  };

  return findBestRetreatHex({
    currentPos,
    threatPositions,
    maxSteps,
    isHexOccupied,
    getHexNeighbors,
    isValidPosition,
    calculateDistance,
    gridWidth,
    gridHeight,
    allowTieMoves: true,
    preferEdgeEscape: profile.exitMode === "map_edge",
  });
}

export function hasSatisfiedRoutingExit({
  position,
  threatPositions,
  calculateDistance,
  gridWidth,
  gridHeight,
  routingProfile,
}) {
  const profile = {
    ...HUMAN_ROUTING_PROFILE,
    ...(routingProfile || {}),
  };

  if (!position) return false;

  if (profile.exitMode === "map_edge") {
    return isAtMapEdge(position, gridWidth, gridHeight);
  }

  if (profile.exitMode === "safe_distance") {
    const minThreatDistance = getMinimumThreatDistance(
      position,
      threatPositions,
      calculateDistance
    );
    return minThreatDistance >= Math.max(5, Number(profile.safeDistanceFt) || 0);
  }

  return false;
}
