import { selectEnemyClosingMovementHex } from "./enemyClosingMovement.js";

const hexKey = (hex) => `${hex.x},${hex.y}`;
const sameHex = (left, right) => (
  Boolean(left && right) && left.x === right.x && left.y === right.y
);

export function isValidEnemyMovementTarget(target, { isHostile } = {}) {
  if (!target) return false;
  const hp = Number(target.currentHP ?? target.HP ?? target.hp);
  const status = String(target.status || target.state || "").toLowerCase();
  const controlMode = String(target.controlMode || "").toLowerCase();
  const aiRole = String(target.aiRole || "").toLowerCase();
  if (Number.isFinite(hp) && hp <= 0) return false;
  if (target.dead || target.isDead || target.defeated || target.fled || target.hasFled) return false;
  if (target.unconscious || target.isUnconscious) return false;
  if (["dead", "defeated", "fled", "unconscious", "dying"].includes(status)) return false;
  if (controlMode === "passive" || aiRole === "passive" || target.passive === true) return false;
  return typeof isHostile === "function" ? Boolean(isHostile(target)) : true;
}

export function findReachableAttackHexes({
  currentPosition,
  target,
  targetPosition,
  maxHexes,
  getNeighbors,
  isLegalCenter,
  canAttackFrom,
  getDistance,
  preferredAttackHexes = [],
} = {}) {
  if (
    !currentPosition || !targetPosition || !target ||
    typeof getNeighbors !== "function" ||
    typeof isLegalCenter !== "function" ||
    typeof canAttackFrom !== "function"
  ) return [];

  const maxSteps = Math.max(0, Math.floor(Number(maxHexes) || 0));
  const preferred = new Set((preferredAttackHexes || []).map(hexKey));
  const queue = [{ position: currentPosition, steps: 0, path: [currentPosition] }];
  const visited = new Set([hexKey(currentPosition)]);
  const attackHexes = [];

  while (queue.length > 0) {
    const entry = queue.shift();
    if (entry.steps >= maxSteps) continue;
    for (const position of getNeighbors(entry.position.x, entry.position.y) || []) {
      if (!position || visited.has(hexKey(position))) continue;
      visited.add(hexKey(position));
      if (!isLegalCenter(position)) continue;
      const next = {
        position: { ...position },
        steps: entry.steps + 1,
        path: [...entry.path, { ...position }],
      };
      if (canAttackFrom(position, target, targetPosition)) {
        const attackDistance = typeof getDistance === "function"
          ? getDistance(position, targetPosition)
          : null;
        attackHexes.push({
          ...next,
          attackDistance: Number.isFinite(Number(attackDistance)) ? Number(attackDistance) : null,
          preferred: preferred.has(hexKey(position)),
        });
      }
      queue.push(next);
    }
  }

  return attackHexes.sort((left, right) => (
    Number(right.preferred) - Number(left.preferred) ||
    (left.attackDistance ?? Infinity) - (right.attackDistance ?? Infinity) ||
    left.steps - right.steps ||
    left.position.x - right.position.x ||
    left.position.y - right.position.y
  ));
}

export function diagnoseReachableAttackHexRejections({
  currentPosition,
  target,
  targetPosition,
  maxHexes,
  getNeighbors,
  isLegalCenter,
  canAttackFrom,
  getDistance,
  classifyCandidate,
} = {}) {
  const summary = {
    legal: 0,
    rejectedOccupied: 0,
    rejectedBlocked: 0,
    rejectedReach: 0,
    rejectedPath: 0,
    rejectedOutOfBounds: 0,
    rejectedSameSideOccupied: 0,
    rejectedReserved: 0,
    rejectedUnknown: 0,
  };
  const rejections = [];

  if (
    !currentPosition || !targetPosition || !target ||
    typeof getNeighbors !== "function" ||
    typeof isLegalCenter !== "function" ||
    typeof canAttackFrom !== "function"
  ) {
    return { summary, rejections };
  }

  const maxSteps = Math.max(0, Math.floor(Number(maxHexes) || 0));
  const queue = [{ position: currentPosition, steps: 0 }];
  const visited = new Set([hexKey(currentPosition)]);

  const record = (position, reason, distance = null) => {
    const normalizedReason = reason || "unknown";
    rejections.push({
      position: { ...position },
      reason: normalizedReason,
      distance,
    });
    if (normalizedReason === "occupied") summary.rejectedOccupied += 1;
    else if (normalizedReason === "same-side-occupied") summary.rejectedSameSideOccupied += 1;
    else if (normalizedReason === "blocked") summary.rejectedBlocked += 1;
    else if (normalizedReason === "out-of-bounds") summary.rejectedOutOfBounds += 1;
    else if (normalizedReason === "not-in-reach") summary.rejectedReach += 1;
    else if (normalizedReason === "not-reachable") summary.rejectedPath += 1;
    else if (normalizedReason === "reserved") summary.rejectedReserved += 1;
    else summary.rejectedUnknown += 1;
  };

  while (queue.length > 0) {
    const entry = queue.shift();
    if (entry.steps >= maxSteps) continue;
    for (const position of getNeighbors(entry.position.x, entry.position.y) || []) {
      if (!position || visited.has(hexKey(position))) continue;
      visited.add(hexKey(position));
      const classified = typeof classifyCandidate === "function"
        ? classifyCandidate(position, { target, targetPosition, steps: entry.steps + 1 })
        : null;
      const classifierReason = classified?.reason || null;
      const legal = classifierReason ? false : Boolean(isLegalCenter(position));
      const distance = typeof getDistance === "function"
        ? getDistance(position, targetPosition)
        : null;

      if (!legal) {
        record(position, classifierReason || "unknown", distance);
        continue;
      }

      if (!canAttackFrom(position, target, targetPosition)) {
        record(position, "not-in-reach", distance);
        queue.push({ position: { ...position }, steps: entry.steps + 1 });
        continue;
      }

      summary.legal += 1;
      queue.push({ position: { ...position }, steps: entry.steps + 1 });
    }
  }

  return { summary, rejections };
}

export function findBestApproachHex({
  currentPosition,
  targetPosition,
  maxHexes,
  getNeighbors,
  isLegalCenter,
  getDistance,
  previousPosition = null,
} = {}) {
  return selectEnemyClosingMovementHex({
    currentPosition,
    targetPosition,
    maxHexes,
    getNeighbors,
    isLegalCenter,
    getDistance,
    previousPosition,
  });
}

export function rankEnemyMovementTargets({
  enemy,
  hostileCandidates = [],
  positions = {},
  currentPosition,
  maxHexes,
  getNeighbors,
  isLegalCenter,
  getDistance,
  canAttackFrom,
  isHostile,
  getPreferredAttackHexes,
  previousPosition = null,
} = {}) {
  if (!enemy || !currentPosition) return [];

  return hostileCandidates
    .filter((target) => isValidEnemyMovementTarget(target, { isHostile }))
    .map((target) => {
      const targetPosition = positions[target.id];
      if (!targetPosition) return null;
      const distance = getDistance(currentPosition, targetPosition);
      const alreadyInRange = canAttackFrom(currentPosition, target, targetPosition);
      const attackHexes = alreadyInRange ? [] : findReachableAttackHexes({
        currentPosition,
        target,
        targetPosition,
        maxHexes,
        getNeighbors,
        isLegalCenter,
        canAttackFrom,
        getDistance,
        preferredAttackHexes: getPreferredAttackHexes?.(target) || [],
      });
      const approach = alreadyInRange || attackHexes.length > 0 ? null : findBestApproachHex({
        currentPosition,
        targetPosition,
        maxHexes,
        getNeighbors,
        isLegalCenter,
        getDistance,
        previousPosition,
      });
      const tier = alreadyInRange ? 0 : attackHexes.length > 0 ? 1 : approach?.position ? 2 : 3;
      return { target, targetPosition, distance, tier, alreadyInRange, attackHexes, approach };
    })
    .filter(Boolean)
    .sort((left, right) => (
      left.tier - right.tier ||
      (left.attackHexes[0]?.steps ?? Infinity) - (right.attackHexes[0]?.steps ?? Infinity) ||
      left.distance - right.distance ||
      String(left.target.id).localeCompare(String(right.target.id))
    ));
}

export function chooseEnemyMovementFallback(options = {}) {
  const rankedTargets = rankEnemyMovementTargets(options);
  const best = rankedTargets[0] || null;
  if (!best) return { type: "hold", target: null, position: null, rankedTargets };
  if (best.alreadyInRange) {
    return { type: "attack-now", target: best.target, position: options.currentPosition, rankedTargets };
  }
  if (best.attackHexes.length > 0) {
    const attackHex = best.attackHexes[0];
    return {
      type: attackHex.preferred ? "flank" : "attack-position",
      target: best.target,
      position: attackHex.position,
      path: attackHex.path,
      steps: attackHex.steps,
      usedFlankFallback: !attackHex.preferred &&
        (options.getPreferredAttackHexes?.(best.target)?.length || 0) > 0,
      rankedTargets,
    };
  }
  if (best.approach?.position && !sameHex(best.approach.position, options.currentPosition)) {
    return {
      type: "approach",
      target: best.target,
      position: best.approach.position,
      path: best.approach.path,
      steps: null,
      reason: best.approach.reason,
      rankedTargets,
    };
  }
  return { type: "hold", target: best.target, position: null, rankedTargets };
}

export function validateEnemyMovementPlan(plan, {
  currentPosition,
  isLegalCenter,
} = {}) {
  if (!plan || !plan.position) return { valid: false, reason: "missing-destination" };
  if (sameHex(plan.position, currentPosition)) return { valid: false, reason: "no-op-destination" };
  if (typeof isLegalCenter !== "function" || !isLegalCenter(plan.position)) {
    return { valid: false, reason: "illegal-destination" };
  }
  if (!Array.isArray(plan.path) || plan.path.length < 2) {
    return { valid: false, reason: "missing-executable-path" };
  }
  const executableSteps = plan.path.slice(1);
  if (executableSteps.length === 0 || !executableSteps.every(isLegalCenter)) {
    return { valid: false, reason: "illegal-path-step" };
  }
  const finalStep = executableSteps[executableSteps.length - 1];
  if (!sameHex(finalStep, plan.position)) {
    return { valid: false, reason: "path-destination-mismatch" };
  }
  return { valid: true, reason: "executable-movement-plan" };
}

export function hydrateEnemyFromCanonicalPosition(enemy, canonicalPositions = {}) {
  if (!enemy?.id) return enemy;
  const latestPosition = canonicalPositions[enemy.id];
  if (!latestPosition) return enemy;
  const position = { ...latestPosition };
  return {
    ...enemy,
    position,
    hex: { ...position },
    x: position.x,
    y: position.y,
  };
}

export function persistEnemyMovementPosition({
  fighterId,
  destination,
  positionsRef,
  setPositions,
  syncPositions,
} = {}) {
  if (
    !fighterId ||
    !destination ||
    !Number.isFinite(Number(destination.x)) ||
    !Number.isFinite(Number(destination.y)) ||
    !positionsRef ||
    typeof setPositions !== "function"
  ) {
    return { persisted: false, reason: "invalid-position-persistence-input" };
  }

  const previousPositions = positionsRef.current || {};
  const previousPosition = previousPositions[fighterId] || null;
  const nextPosition = {
    ...destination,
    x: Number(destination.x),
    y: Number(destination.y),
  };
  const updatedPositions = {
    ...previousPositions,
    [fighterId]: nextPosition,
  };
  const canonicalPositions = typeof syncPositions === "function"
    ? syncPositions(updatedPositions)
    : updatedPositions;

  // Future turn scheduling reads the ref synchronously, so update it before
  // mirroring the same immutable object into React state.
  positionsRef.current = canonicalPositions;
  setPositions((previousState) => ({
    ...(previousState || {}),
    ...canonicalPositions,
    [fighterId]: { ...canonicalPositions[fighterId] },
  }));

  return {
    persisted: true,
    previousPosition: previousPosition ? { ...previousPosition } : null,
    position: { ...canonicalPositions[fighterId] },
    positions: canonicalPositions,
  };
}

export function executeEnemyMovementPlan(plan, {
  commit,
  move,
  spendAction,
  hold,
  fail,
  finish,
} = {}) {
  if (!plan || typeof commit !== "function") {
    return { executed: false, committed: false, reason: "invalid-execution-input" };
  }

  let committed = false;
  let actionSpent = false;
  let executionResult = null;
  try {
    committed = Boolean(commit(plan));
    if (!committed) {
      return { executed: false, committed: false, reason: "action-commit-rejected" };
    }

    if (plan.type === "hold" || !plan.position) {
      hold?.(plan);
    } else {
      const moveResult = move?.(plan.position, plan);
      const movementAccepted = moveResult !== false && !(
        moveResult && typeof moveResult === "object" && moveResult.accepted === false
      );
      if (!movementAccepted) {
        spendAction?.(plan);
        actionSpent = true;
        executionResult = {
          executed: false,
          committed: true,
          actionSpent: true,
          movementAccepted: false,
          reason: "movement-commit-rejected",
        };
        return executionResult;
      }
    }
    spendAction?.(plan);
    actionSpent = true;
    executionResult = { executed: true, committed: true, movementAccepted: true, reason: plan.type };
    return executionResult;
  } catch (error) {
    if (committed && !actionSpent) {
      try {
        spendAction?.(plan);
        actionSpent = true;
      } catch {
        // The finish callback still releases the turn if spending also fails.
      }
    }
    fail?.(error, plan);
    executionResult = {
      executed: false,
      committed,
      reason: "movement-execution-error",
      error,
    };
    return executionResult;
  } finally {
    finish?.({
      plan,
      committed,
      executed: Boolean(executionResult?.executed),
      actionSpent,
      reason: executionResult?.reason || (committed ? "execution-failed" : "action-commit-rejected"),
    });
  }
}

export default chooseEnemyMovementFallback;
