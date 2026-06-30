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
        attackHexes.push({ ...next, preferred: preferred.has(hexKey(position)) });
      }
      queue.push(next);
    }
  }

  return attackHexes.sort((left, right) => (
    Number(right.preferred) - Number(left.preferred) ||
    left.steps - right.steps ||
    left.position.x - right.position.x ||
    left.position.y - right.position.y
  ));
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
      steps: null,
      reason: best.approach.reason,
      rankedTargets,
    };
  }
  return { type: "hold", target: best.target, position: null, rankedTargets };
}

export default chooseEnemyMovementFallback;
