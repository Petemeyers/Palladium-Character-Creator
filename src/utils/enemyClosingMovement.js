const sameHex = (left, right) => (
  Boolean(left && right) && left.x === right.x && left.y === right.y
);

const hexKey = (hex) => `${hex.x},${hex.y}`;

export function getCombatantFootprintHexes(combatant = {}, center = null) {
  if (!center) return [];
  const explicitRadius = Number(
    combatant?.footprint?.radiusHex ??
    combatant?.gridFootprint?.radiusHex ??
    combatant?.occupiedRadiusHex
  );
  const sizeRank = Number(combatant?.sizeRank ?? combatant?.attributes?.sizeRank ?? 0) || 0;
  const sizeLabel = String(combatant?.sizeCategory || combatant?.size || "").toLowerCase();
  const radiusHex = Number.isFinite(explicitRadius)
    ? Math.max(0, Math.floor(explicitRadius))
    : (sizeRank >= 1 || sizeLabel.includes("large") ? 1 : 0);

  if (radiusHex <= 0) return [{ ...center }];
  const cells = [];
  for (let dx = -radiusHex; dx <= radiusHex; dx += 1) {
    for (let dy = -radiusHex; dy <= radiusHex; dy += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dx + dy)) <= radiusHex) {
        cells.push({ x: center.x + dx, y: center.y + dy });
      }
    }
  }
  return cells;
}

export function selectEnemyClosingMovementHex({
  currentPosition,
  targetPosition,
  maxHexes,
  getNeighbors,
  isLegalCenter,
  getDistance,
  previousPosition = null,
  epsilon = 0.01,
} = {}) {
  if (
    !currentPosition ||
    !targetPosition ||
    typeof getNeighbors !== "function" ||
    typeof isLegalCenter !== "function" ||
    typeof getDistance !== "function"
  ) {
    return {
      position: null,
      currentDistance: null,
      bestCandidateDistance: null,
      reason: "invalid-movement-input",
      candidateCount: 0,
    };
  }

  const movementSteps = Math.max(0, Math.floor(Number(maxHexes) || 0));
  const currentDistance = getDistance(currentPosition, targetPosition);
  if (movementSteps <= 0 || !Number.isFinite(currentDistance)) {
    return {
      position: null,
      currentDistance,
      bestCandidateDistance: null,
      reason: "no-movement-allowance",
      candidateCount: 0,
    };
  }

  const queue = [{ position: currentPosition, steps: 0 }];
  const visited = new Set([hexKey(currentPosition)]);
  const candidates = [];

  while (queue.length > 0) {
    const entry = queue.shift();
    if (entry.steps >= movementSteps) continue;
    const neighbors = getNeighbors(entry.position.x, entry.position.y) || [];
    neighbors.forEach((position) => {
      if (!position || visited.has(hexKey(position))) return;
      visited.add(hexKey(position));
      if (!isLegalCenter(position)) return;

      const steps = entry.steps + 1;
      const targetDistance = getDistance(position, targetPosition);
      if (!Number.isFinite(targetDistance)) return;
      candidates.push({ position, steps, targetDistance });
      queue.push({ position, steps });
    });
  }

  if (candidates.length === 0) {
    return {
      position: null,
      currentDistance,
      bestCandidateDistance: null,
      reason: "no-legal-reachable-hex",
      candidateCount: 0,
    };
  }

  const withFuturePath = candidates.map((candidate) => {
    const hasCloserExit = (getNeighbors(candidate.position.x, candidate.position.y) || []).some((next) => (
      next &&
      !sameHex(next, currentPosition) &&
      isLegalCenter(next) &&
      getDistance(next, targetPosition) < candidate.targetDistance - epsilon
    ));
    return { ...candidate, hasCloserExit };
  });
  const improving = withFuturePath.filter((candidate) => (
    candidate.targetDistance < currentDistance - epsilon
  ));
  const lateral = withFuturePath.filter((candidate) => (
    Math.abs(candidate.targetDistance - currentDistance) <= epsilon && candidate.hasCloserExit
  ));
  const detours = withFuturePath.filter((candidate) => (
    candidate.targetDistance > currentDistance + epsilon
  ));
  const pool = improving.length > 0
    ? improving
    : lateral.length > 0
      ? lateral
      : detours;

  if (pool.length === 0) {
    const bestCandidateDistance = Math.min(...withFuturePath.map((candidate) => candidate.targetDistance));
    return {
      position: null,
      currentDistance,
      bestCandidateDistance,
      reason: "same-distance-candidates-do-not-improve-future-pathing",
      candidateCount: candidates.length,
    };
  }

  const nonOscillating = pool.filter((candidate) => !sameHex(candidate.position, previousPosition));
  const selectable = nonOscillating.length > 0 ? nonOscillating : pool;
  const selected = [...selectable].sort((left, right) => (
    left.targetDistance - right.targetDistance ||
    Number(right.hasCloserExit) - Number(left.hasCloserExit) ||
    right.steps - left.steps ||
    left.position.x - right.position.x ||
    left.position.y - right.position.y
  ))[0];

  return {
    position: { ...selected.position },
    currentDistance,
    bestCandidateDistance: selected.targetDistance,
    reason: improving.length > 0
      ? "closer-reachable-hex"
      : lateral.length > 0
        ? "lateral-step-opens-closer-path"
        : "detour-around-blockage",
    candidateCount: candidates.length,
    avoidedPreviousPosition: nonOscillating.length > 0 && pool.length !== nonOscillating.length,
  };
}

export default selectEnemyClosingMovementHex;
