import {
  WATER_TRAVERSAL_REASONS,
  describeWaterTraversalFailure,
  resolveBattlefieldWaterTraversalStep,
} from "./waterTraversalAuthority.js";
import {
  BATTLEFIELD_SLOPE_TRANSITIONS,
  getBattlefieldMapCell,
  getBattlefieldNeighborOffset,
  resolveBattlefieldSlopeTraversal,
} from "./battlefieldSlopeAuthority.js";

const toFinite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

const normalizeMode = (value) =>
  String(value ?? "walk").trim().toLowerCase().replace(/[\s_]+/g, "-");

export const BATTLEFIELD_TRAVERSAL_CELL_FEET = 5;

export const BATTLEFIELD_TRAVERSAL_REASONS = Object.freeze({
  BOUNDARY: "battlefield-boundary",
  CLIFF_REQUIRES_CLIMB: "cliff-requires-climb",
  WALL_REQUIRES_CLIMB: "wall-requires-climb",
  STEEP_REQUIRES_WALK: "steep-slope-requires-walk",
  CHARGE_BLOCKED: "charge-blocked-by-slope",
  ILLEGAL_HEX: "illegal-hex",
  OCCUPIED_HEX: "occupied-hex",
  NON_ADJACENT: "non-adjacent-traversal-step",
  NO_PATH: "no-legal-terrain-path",
  BUDGET: "movement-budget-exceeded",
  STALE_POSITION: "stale-position",
  STALE_BATTLEFIELD: "stale-battlefield",
  STALE_PLAN_CONTEXT: "stale-plan-context",
  SWIM_REQUIRED: WATER_TRAVERSAL_REASONS.SWIM_REQUIRED,
  WATER_FAST_MODE_BLOCKED: WATER_TRAVERSAL_REASONS.FAST_MODE_BLOCKED,
  WATER_CHARGE_BLOCKED: WATER_TRAVERSAL_REASONS.CHARGE_BLOCKED,
});

export const battlefieldTraversalHexKey = (position = {}) =>
  `${Number(position?.x)},${Number(position?.y)}`;

const sameTraversalPosition = (left, right) => Boolean(left && right) &&
  Number(left.x) === Number(right.x) &&
  Number(left.y) === Number(right.y);

const traversalCellSignature = (cell = {}) => JSON.stringify({
  terrain: cell?.terrain ?? null,
  terrainType: cell?.terrainType ?? null,
  visualTerrain: cell?.visualTerrain ?? null,
  type: cell?.type ?? null,
  height: cell?.height ?? null,
  elevation: cell?.elevation ?? null,
  elev: cell?.elev ?? null,
  edgeTransitions: cell?.edgeTransitions ?? cell?.edgeTransitionOverrides ?? null,
  slopeEdges: cell?.slopeEdges ?? cell?.edges ?? null,
  waterDepthFeet: cell?.waterDepthFeet ?? cell?.water?.depthFeet ?? cell?.waterEnvironment?.depthFeet ?? null,
  water: cell?.water ?? cell?.waterEnvironment ?? null,
});

export function createBattlefieldTraversalExecutionSnapshot({
  mapDefinition = null,
  actorId = null,
  from = null,
  to = null,
  path = [],
  movementMode = "walk",
} = {}) {
  const normalizedPath = normalizePath({ from, to, path });
  const cells = [from, ...normalizedPath]
    .filter(Boolean)
    .map((position) => ({
      position: { x: Number(position.x), y: Number(position.y) },
      signature: traversalCellSignature(getBattlefieldMapCell(mapDefinition, position) || {}),
    }));
  return Object.freeze({
    actorId: actorId == null ? null : String(actorId),
    from: from ? { x: Number(from.x), y: Number(from.y) } : null,
    to: to ? { x: Number(to.x), y: Number(to.y) } : null,
    movementMode: normalizeMode(movementMode),
    mapGeneration:
      mapDefinition?.generationId ??
      mapDefinition?.mapGeneration ??
      mapDefinition?.revision ??
      mapDefinition?.version ??
      null,
    cells,
  });
}

export function validateBattlefieldTraversalExecutionSnapshot({
  snapshot = null,
  mapDefinition = null,
  actorId = null,
  from = null,
  to = null,
  movementMode = "walk",
} = {}) {
  if (!snapshot) return { accepted: true, stale: false, reason: null };
  if (
    snapshot.actorId != null &&
    actorId != null &&
    String(snapshot.actorId) !== String(actorId)
  ) {
    return { accepted: false, stale: true, reason: BATTLEFIELD_TRAVERSAL_REASONS.STALE_PLAN_CONTEXT };
  }
  if (!sameTraversalPosition(snapshot.from, from)) {
    return { accepted: false, stale: true, reason: BATTLEFIELD_TRAVERSAL_REASONS.STALE_POSITION };
  }
  if (
    !sameTraversalPosition(snapshot.to, to) ||
    normalizeMode(snapshot.movementMode) !== normalizeMode(movementMode)
  ) {
    return { accepted: false, stale: true, reason: BATTLEFIELD_TRAVERSAL_REASONS.STALE_PLAN_CONTEXT };
  }
  const currentGeneration =
    mapDefinition?.generationId ??
    mapDefinition?.mapGeneration ??
    mapDefinition?.revision ??
    mapDefinition?.version ??
    null;
  if (
    snapshot.mapGeneration != null &&
    currentGeneration != null &&
    String(snapshot.mapGeneration) !== String(currentGeneration)
  ) {
    return { accepted: false, stale: true, reason: BATTLEFIELD_TRAVERSAL_REASONS.STALE_BATTLEFIELD };
  }
  const changedCell = (snapshot.cells || []).find((entry) => (
    traversalCellSignature(getBattlefieldMapCell(mapDefinition, entry.position) || {}) !== entry.signature
  ));
  if (changedCell) {
    return {
      accepted: false,
      stale: true,
      reason: BATTLEFIELD_TRAVERSAL_REASONS.STALE_BATTLEFIELD,
      changedCell: changedCell.position,
    };
  }
  return { accepted: true, stale: false, reason: null };
}

export function getBattlefieldTraversalHexDistanceSteps(left = {}, right = {}) {
  const toCube = (position) => {
    const row = toFinite(position?.y, 0);
    const col = toFinite(position?.x, 0);
    const q = col - ((row - (row & 1)) / 2);
    const r = row;
    return { x: q, z: r, y: -q - r };
  };
  const a = toCube(left);
  const b = toCube(right);
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.z - b.z),
  );
}

export function getBattlefieldTraversalHexDistanceFeet(left = {}, right = {}) {
  return getBattlefieldTraversalHexDistanceSteps(left, right) * BATTLEFIELD_TRAVERSAL_CELL_FEET;
}

function sameHex(left, right) {
  return Boolean(left && right) &&
    Number(left.x) === Number(right.x) &&
    Number(left.y) === Number(right.y);
}

function isFlightMode(mode) {
  return /(^|-)fly|flight|airborne/.test(normalizeMode(mode));
}

function isFastGroundMode(mode) {
  return /run|sprint|dash/.test(normalizeMode(mode));
}

function isChargeMode(mode) {
  return /charge/.test(normalizeMode(mode));
}

function isMapPositionLegal(mapDefinition, position) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) return false;
  const width = Number(
    mapDefinition?.width ??
    mapDefinition?.size?.width ??
    mapDefinition?.mapSize?.width ??
    mapDefinition?.grid?.[0]?.length
  );
  const height = Number(
    mapDefinition?.height ??
    mapDefinition?.size?.height ??
    mapDefinition?.mapSize?.height ??
    mapDefinition?.grid?.length
  );
  if (Number.isFinite(width) && x >= width) return false;
  if (Number.isFinite(height) && y >= height) return false;
  return Boolean(getBattlefieldMapCell(mapDefinition, { x, y }));
}

export function resolveBattlefieldTraversalStep({
  mapDefinition = null,
  from = null,
  to = null,
  movementMode = "walk",
  climbAuthorized = false,
  swimAuthorized = false,
  waterProfile = null,
  fromLayer = "lower",
  toLayer = "lower",
  cellSizeFeet = BATTLEFIELD_TRAVERSAL_CELL_FEET,
} = {}) {
  if (!from || !to) {
    return {
      accepted: false,
      reason: BATTLEFIELD_TRAVERSAL_REASONS.ILLEGAL_HEX,
      from,
      to,
    };
  }

  const baseDistanceFeet = Math.max(1, toFinite(cellSizeFeet, BATTLEFIELD_TRAVERSAL_CELL_FEET));
  if (!mapDefinition?.grid) {
    return {
      accepted: true,
      type: BATTLEFIELD_SLOPE_TRANSITIONS.FLAT,
      from: { x: Number(from.x), y: Number(from.y) },
      to: { x: Number(to.x), y: Number(to.y) },
      baseDistanceFeet,
      extraDistanceFeet: 0,
      effectiveDistanceFeet: baseDistanceFeet,
      staminaCost: 0,
      uphill: false,
      downhill: false,
      requiresClimb: false,
      blocksCharge: false,
      requiresWalk: false,
    };
  }

  if (!isMapPositionLegal(mapDefinition, from) || !isMapPositionLegal(mapDefinition, to)) {
    return {
      accepted: false,
      reason: BATTLEFIELD_TRAVERSAL_REASONS.ILLEGAL_HEX,
      from,
      to,
    };
  }

  const adjacent = getBattlefieldTraversalHexDistanceSteps(from, to) === 1;
  if (!adjacent) {
    return {
      accepted: false,
      reason: BATTLEFIELD_TRAVERSAL_REASONS.NON_ADJACENT,
      from,
      to,
    };
  }

  const slope = resolveBattlefieldSlopeTraversal({
    mapDefinition,
    from,
    to,
    movementMode,
    climbAuthorized,
  });

  if (!slope?.accepted) {
    return {
      ...slope,
      accepted: false,
      from,
      to,
      baseDistanceFeet,
      effectiveDistanceFeet: baseDistanceFeet,
    };
  }

  const waterTraversal = resolveBattlefieldWaterTraversalStep({
    mapDefinition,
    from,
    to,
    movementMode,
    swimAuthorized,
    actorProfile: waterProfile || {},
    fromLayer,
    toLayer,
    baseDistanceFeet,
  });

  if (!waterTraversal?.accepted) {
    return {
      ...slope,
      ...waterTraversal,
      accepted: false,
      from,
      to,
      baseDistanceFeet,
      effectiveDistanceFeet:
        baseDistanceFeet +
        Math.max(0, Number(slope.extraDistanceFeet) || 0),
    };
  }

  const mode = normalizeMode(movementMode);
  const flight = isFlightMode(mode);
  const steep = slope.type === BATTLEFIELD_SLOPE_TRANSITIONS.STEEP_SLOPE;
  const requiresWalk =
    (steep || waterTraversal?.requiresWalk === true) &&
    !flight;
  if (requiresWalk && (isFastGroundMode(mode) || isChargeMode(mode))) {
    return {
      ...slope,
      accepted: false,
      reason: isChargeMode(mode)
        ? BATTLEFIELD_TRAVERSAL_REASONS.CHARGE_BLOCKED
        : BATTLEFIELD_TRAVERSAL_REASONS.STEEP_REQUIRES_WALK,
      from,
      to,
      baseDistanceFeet,
      effectiveDistanceFeet: baseDistanceFeet + (Number(slope.extraDistanceFeet) || 0),
      requiresWalk: true,
    };
  }

  if (!flight && isChargeMode(mode) && slope.blocksCharge) {
    return {
      ...slope,
      accepted: false,
      reason: BATTLEFIELD_TRAVERSAL_REASONS.CHARGE_BLOCKED,
      from,
      to,
      baseDistanceFeet,
      effectiveDistanceFeet: baseDistanceFeet + (Number(slope.extraDistanceFeet) || 0),
      requiresWalk,
    };
  }

  const slopeExtraDistanceFeet = Math.max(0, Number(slope.extraDistanceFeet) || 0);
  const waterExtraDistanceFeet = Math.max(0, Number(waterTraversal?.extraDistanceFeet) || 0);
  const extraDistanceFeet = slopeExtraDistanceFeet + waterExtraDistanceFeet;
  return {
    ...slope,
    accepted: true,
    from: { x: Number(from.x), y: Number(from.y) },
    to: { x: Number(to.x), y: Number(to.y) },
    baseDistanceFeet,
    extraDistanceFeet,
    effectiveDistanceFeet: baseDistanceFeet + extraDistanceFeet,
    staminaCost:
      Math.max(0, Number(slope.staminaCost) || 0) +
      Math.max(0, Number(waterTraversal?.staminaCost) || 0),
    requiresWalk,
    waterTraversal,
  };
}

function normalizePath({ from, to, path = [] } = {}) {
  const steps = [];
  const push = (position) => {
    if (!position || !Number.isFinite(Number(position.x)) || !Number.isFinite(Number(position.y))) return;
    const point = { x: Number(position.x), y: Number(position.y) };
    if (!steps.length && sameHex(point, from)) return;
    if (steps.length && sameHex(point, steps[steps.length - 1])) return;
    steps.push(point);
  };
  (Array.isArray(path) ? path : []).forEach(push);
  if (to && !sameHex(steps[steps.length - 1], to)) push(to);
  return steps;
}

export function resolveBattlefieldPathTraversal({
  mapDefinition = null,
  actorId = null,
  from = null,
  to = null,
  path = [],
  movementMode = "walk",
  climbAuthorized = false,
  swimAuthorized = false,
  waterProfile = null,
  traversalLayer = "lower",
  maxDistanceFeet = Number.POSITIVE_INFINITY,
  cellSizeFeet = BATTLEFIELD_TRAVERSAL_CELL_FEET,
} = {}) {
  const normalizedPath = normalizePath({ from, to, path });
  if (!from || normalizedPath.length === 0) {
    return {
      accepted: false,
      reason: BATTLEFIELD_TRAVERSAL_REASONS.NO_PATH,
      path: [],
      baseDistanceFeet: 0,
      extraDistanceFeet: 0,
      effectiveDistanceFeet: 0,
      staminaCost: 0,
    };
  }

  let cursor = { x: Number(from.x), y: Number(from.y) };
  let baseDistanceFeet = 0;
  let extraDistanceFeet = 0;
  let staminaCost = 0;
  const transitions = [];

  for (let index = 0; index < normalizedPath.length; index += 1) {
    const step = normalizedPath[index];
    const traversal = resolveBattlefieldTraversalStep({
      mapDefinition,
      from: cursor,
      to: step,
      movementMode,
      climbAuthorized,
      swimAuthorized,
      waterProfile,
      fromLayer: traversalLayer,
      toLayer: traversalLayer,
      cellSizeFeet,
    });
    transitions.push(traversal);
    if (!traversal.accepted) {
      return {
        accepted: false,
        reason: traversal.reason || BATTLEFIELD_TRAVERSAL_REASONS.NO_PATH,
        blockedStepIndex: index,
        blockedStep: step,
        transition: traversal,
        transitions,
        path: normalizedPath.slice(0, index),
        baseDistanceFeet,
        extraDistanceFeet,
        effectiveDistanceFeet: baseDistanceFeet + extraDistanceFeet,
        staminaCost,
      };
    }
    baseDistanceFeet += traversal.baseDistanceFeet;
    extraDistanceFeet += traversal.extraDistanceFeet;
    staminaCost += traversal.staminaCost;
    const effectiveDistanceFeet = baseDistanceFeet + extraDistanceFeet;
    if (effectiveDistanceFeet > Number(maxDistanceFeet) + 0.001) {
      return {
        accepted: false,
        reason: BATTLEFIELD_TRAVERSAL_REASONS.BUDGET,
        blockedStepIndex: index,
        blockedStep: step,
        transition: traversal,
        transitions,
        path: normalizedPath.slice(0, index),
        baseDistanceFeet,
        extraDistanceFeet,
        effectiveDistanceFeet,
        staminaCost,
        maxDistanceFeet: Number(maxDistanceFeet),
      };
    }
    cursor = step;
  }

  return {
    accepted: true,
    reason: null,
    path: normalizedPath,
    transitions,
    baseDistanceFeet,
    extraDistanceFeet,
    effectiveDistanceFeet: baseDistanceFeet + extraDistanceFeet,
    staminaCost,
    uphillSteps: transitions.filter((entry) => entry.uphill).length,
    downhillSteps: transitions.filter((entry) => entry.downhill).length,
    steepSteps: transitions.filter((entry) => entry.type === BATTLEFIELD_SLOPE_TRANSITIONS.STEEP_SLOPE).length,
    slopeSteps: transitions.filter((entry) => entry.type === BATTLEFIELD_SLOPE_TRANSITIONS.SLOPE).length,
    executionSnapshot: createBattlefieldTraversalExecutionSnapshot({
      mapDefinition,
      actorId,
      from,
      to: normalizedPath[normalizedPath.length - 1],
      path: normalizedPath,
      movementMode,
    }),
  };
}

function compareOpen(left, right) {
  return (
    left.costFeet - right.costFeet ||
    left.steps - right.steps ||
    left.position.x - right.position.x ||
    left.position.y - right.position.y
  );
}

export function computeBattlefieldReachability({
  mapDefinition = null,
  origin = null,
  movementMode = "walk",
  maxDistanceFeet = 0,
  occupied = new Set(),
  isPositionLegal = null,
  climbAuthorized = false,
  swimAuthorized = false,
  waterProfile = null,
  traversalLayer = "lower",
  maxVisited = 5000,
} = {}) {
  const start = origin && { x: Number(origin.x), y: Number(origin.y) };
  const budget = Math.max(0, Number(maxDistanceFeet) || 0);
  if (!start || !Number.isFinite(start.x) || !Number.isFinite(start.y) || budget <= 0) {
    return { accepted: false, reason: "invalid-reachability-request", hexes: [], byKey: new Map() };
  }

  const legal = typeof isPositionLegal === "function"
    ? isPositionLegal
    : (position) => !mapDefinition?.grid || isMapPositionLegal(mapDefinition, position);

  const startKey = battlefieldTraversalHexKey(start);
  const open = [{ position: start, costFeet: 0, staminaCost: 0, steps: 0 }];
  const best = new Map([[startKey, open[0]]]);
  const prior = new Map([[startKey, null]]);

  while (open.length > 0 && best.size <= maxVisited) {
    open.sort(compareOpen);
    const current = open.shift();
    const currentKey = battlefieldTraversalHexKey(current.position);
    if (best.get(currentKey)?.costFeet !== current.costFeet) continue;

    for (let direction = 0; direction < 6; direction += 1) {
      const neighbor = getBattlefieldNeighborOffset(current.position, direction);
      if (!neighbor || !legal(neighbor)) continue;
      const neighborKey = battlefieldTraversalHexKey(neighbor);
      if (occupied.has(neighborKey) && neighborKey !== startKey) continue;

      const traversal = resolveBattlefieldTraversalStep({
        mapDefinition,
        from: current.position,
        to: neighbor,
        movementMode,
        climbAuthorized,
        swimAuthorized,
        waterProfile,
        fromLayer: traversalLayer,
        toLayer: traversalLayer,
      });
      if (!traversal.accepted) continue;

      const nextCostFeet = current.costFeet + traversal.effectiveDistanceFeet;
      if (nextCostFeet > budget + 0.001) continue;
      const nextStaminaCost = current.staminaCost + traversal.staminaCost;
      const next = {
        position: { x: Number(neighbor.x), y: Number(neighbor.y) },
        costFeet: nextCostFeet,
        staminaCost: nextStaminaCost,
        steps: current.steps + 1,
      };
      const previous = best.get(neighborKey);
      if (
        previous &&
        (
          previous.costFeet < next.costFeet - 0.001 ||
          (
            Math.abs(previous.costFeet - next.costFeet) <= 0.001 &&
            previous.staminaCost <= next.staminaCost
          )
        )
      ) continue;

      best.set(neighborKey, next);
      prior.set(neighborKey, current.position);
      open.push(next);
    }
  }

  const buildPath = (position) => {
    const reversed = [];
    let cursor = position;
    while (cursor && battlefieldTraversalHexKey(cursor) !== startKey) {
      reversed.push({ ...cursor });
      cursor = prior.get(battlefieldTraversalHexKey(cursor));
    }
    return reversed.reverse();
  };

  const byKey = new Map();
  for (const [key, entry] of best.entries()) {
    if (key === startKey) continue;
    byKey.set(key, {
      ...entry,
      path: buildPath(entry.position),
    });
  }

  const hexes = [...byKey.values()]
    .sort((left, right) => (
      left.costFeet - right.costFeet ||
      left.position.x - right.position.x ||
      left.position.y - right.position.y
    ))
    .map((entry) => ({
      ...entry.position,
      effectiveDistanceFeet: entry.costFeet,
      terrainStaminaCost: entry.staminaCost,
      path: entry.path,
    }));

  return {
    accepted: true,
    origin: start,
    movementMode: normalizeMode(movementMode),
    maxDistanceFeet: budget,
    hexes,
    byKey,
  };
}

export function filterBattlefieldTraversalNeighbors({
  mapDefinition = null,
  from = null,
  neighbors = [],
  movementMode = "walk",
  climbAuthorized = false,
  swimAuthorized = false,
  waterProfile = null,
  traversalLayer = "lower",
  isPositionLegal = null,
} = {}) {
  if (!from) return { accepted: false, reason: "invalid-traversal-origin", neighbors: [], rejected: [] };
  const legal = [];
  const rejected = [];
  for (const candidate of Array.isArray(neighbors) ? neighbors : []) {
    if (!candidate) continue;
    if (typeof isPositionLegal === "function" && !isPositionLegal(candidate)) {
      rejected.push({
        position: candidate,
        traversal: { accepted: false, reason: BATTLEFIELD_TRAVERSAL_REASONS.ILLEGAL_HEX },
      });
      continue;
    }
    const traversal = resolveBattlefieldTraversalStep({
      mapDefinition,
      from,
      to: candidate,
      movementMode,
      climbAuthorized,
      swimAuthorized,
      waterProfile,
      fromLayer: traversalLayer,
      toLayer: traversalLayer,
    });
    if (traversal.accepted) legal.push(candidate);
    else rejected.push({ position: candidate, traversal });
  }
  return {
    accepted: true,
    reason: rejected.length > 0 ? "terrain-filtered" : "terrain-clear",
    neighbors: legal,
    rejected,
  };
}

export function createBattlefieldTraversalNeighborProvider({
  mapDefinition = null,
  getNeighbors,
  movementMode = "walk",
  climbAuthorized = false,
  swimAuthorized = false,
  waterProfile = null,
  traversalLayer = "lower",
  isPositionLegal = null,
} = {}) {
  if (typeof getNeighbors !== "function") return () => [];
  return (x, y) => filterBattlefieldTraversalNeighbors({
    mapDefinition,
    from: { x, y },
    neighbors: getNeighbors(x, y) || [],
    movementMode,
    climbAuthorized,
    swimAuthorized,
    waterProfile,
    traversalLayer,
    isPositionLegal,
  }).neighbors;
}

export function findBattlefieldTraversalPath({
  mapDefinition = null,
  actorId = null,
  from = null,
  destination = null,
  movementMode = "walk",
  maxDistanceFeet = Number.POSITIVE_INFINITY,
  occupied = new Set(),
  isPositionLegal = null,
  allowOccupiedDestination = false,
  allowPartial = false,
  climbAuthorized = false,
  swimAuthorized = false,
  waterProfile = null,
  traversalLayer = "lower",
  maxVisited = 5000,
} = {}) {
  const start = from && { x: Number(from.x), y: Number(from.y) };
  const goal = destination && { x: Number(destination.x), y: Number(destination.y) };
  if (!start || !goal) {
    return { accepted: false, reason: BATTLEFIELD_TRAVERSAL_REASONS.NO_PATH, path: [] };
  }

  const legal = typeof isPositionLegal === "function"
    ? isPositionLegal
    : (position) => !mapDefinition?.grid || isMapPositionLegal(mapDefinition, position);

  const startKey = battlefieldTraversalHexKey(start);
  const goalKey = battlefieldTraversalHexKey(goal);
  const open = [{ position: start, costFeet: 0, staminaCost: 0, steps: 0 }];
  const best = new Map([[startKey, open[0]]]);
  const prior = new Map([[startKey, null]]);
  let bestPartial = open[0];
  let bestPartialDistance = getBattlefieldTraversalHexDistanceSteps(start, goal);

  while (open.length > 0 && best.size <= maxVisited) {
    open.sort(compareOpen);
    const current = open.shift();
    const currentKey = battlefieldTraversalHexKey(current.position);
    if (best.get(currentKey)?.costFeet !== current.costFeet) continue;
    if (currentKey === goalKey) break;

    for (let direction = 0; direction < 6; direction += 1) {
      const neighbor = getBattlefieldNeighborOffset(current.position, direction);
      if (!neighbor || !legal(neighbor)) continue;
      const neighborKey = battlefieldTraversalHexKey(neighbor);
      const occupiedHex = occupied.has(neighborKey);
      if (occupiedHex && !(allowOccupiedDestination && neighborKey === goalKey)) continue;

      const traversal = resolveBattlefieldTraversalStep({
        mapDefinition,
        from: current.position,
        to: neighbor,
        movementMode,
        climbAuthorized,
        swimAuthorized,
        waterProfile,
        fromLayer: traversalLayer,
        toLayer: traversalLayer,
      });
      if (!traversal.accepted) continue;

      const nextCostFeet = current.costFeet + traversal.effectiveDistanceFeet;
      if (nextCostFeet > Number(maxDistanceFeet) + 0.001) continue;
      const nextStaminaCost = current.staminaCost + traversal.staminaCost;
      const next = {
        position: { x: Number(neighbor.x), y: Number(neighbor.y) },
        costFeet: nextCostFeet,
        staminaCost: nextStaminaCost,
        steps: current.steps + 1,
      };
      const previous = best.get(neighborKey);
      if (
        previous &&
        (
          previous.costFeet < next.costFeet - 0.001 ||
          (
            Math.abs(previous.costFeet - next.costFeet) <= 0.001 &&
            previous.staminaCost <= next.staminaCost
          )
        )
      ) continue;

      best.set(neighborKey, next);
      prior.set(neighborKey, current.position);
      open.push(next);

      const distanceToGoal = getBattlefieldTraversalHexDistanceSteps(neighbor, goal);
      if (
        distanceToGoal < bestPartialDistance ||
        (
          distanceToGoal === bestPartialDistance &&
          (
            next.costFeet < bestPartial.costFeet ||
            (next.costFeet === bestPartial.costFeet && next.staminaCost < bestPartial.staminaCost)
          )
        )
      ) {
        bestPartial = next;
        bestPartialDistance = distanceToGoal;
      }
    }
  }

  const exact = best.get(goalKey);
  const selected = exact || (allowPartial ? bestPartial : null);
  if (!selected || sameHex(selected.position, start)) {
    return {
      accepted: false,
      reason: BATTLEFIELD_TRAVERSAL_REASONS.NO_PATH,
      path: [],
      exact: false,
    };
  }

  const reversed = [];
  let cursor = selected.position;
  while (cursor && battlefieldTraversalHexKey(cursor) !== startKey) {
    reversed.push({ ...cursor });
    cursor = prior.get(battlefieldTraversalHexKey(cursor));
  }
  const path = reversed.reverse();

  const traversal = resolveBattlefieldPathTraversal({
    mapDefinition,
    actorId,
    from: start,
    to: selected.position,
    path,
    movementMode,
    climbAuthorized,
    swimAuthorized,
    waterProfile,
    traversalLayer,
    maxDistanceFeet,
  });

  return {
    ...traversal,
    accepted: traversal.accepted,
    exact: Boolean(exact),
    requestedDestination: goal,
    destination: { ...selected.position },
    remainingHexDistance: getBattlefieldTraversalHexDistanceSteps(selected.position, goal),
  };
}

export function describeBattlefieldTraversalFailure(reason) {
  switch (reason) {
    case BATTLEFIELD_TRAVERSAL_REASONS.CLIFF_REQUIRES_CLIMB:
      return "a cliff blocks ordinary movement";
    case BATTLEFIELD_TRAVERSAL_REASONS.WALL_REQUIRES_CLIMB:
      return "a wall blocks ordinary movement";
    case BATTLEFIELD_TRAVERSAL_REASONS.STEEP_REQUIRES_WALK:
      return "the steep slope must be crossed at a walk";
    case BATTLEFIELD_TRAVERSAL_REASONS.CHARGE_BLOCKED:
      return "the slope is too steep to charge across";
    case BATTLEFIELD_TRAVERSAL_REASONS.BUDGET:
      return "the slope-adjusted path exceeds this action's movement budget";
    case BATTLEFIELD_TRAVERSAL_REASONS.NO_PATH:
      return "no legal terrain path reaches that hex";
    case BATTLEFIELD_TRAVERSAL_REASONS.STALE_POSITION:
      return "the actor moved after this route was planned";
    case BATTLEFIELD_TRAVERSAL_REASONS.STALE_BATTLEFIELD:
      return "the battlefield changed after this route was planned";
    case BATTLEFIELD_TRAVERSAL_REASONS.STALE_PLAN_CONTEXT:
      return "the movement request no longer matches its planned route";
    case BATTLEFIELD_TRAVERSAL_REASONS.SWIM_REQUIRED:
    case BATTLEFIELD_TRAVERSAL_REASONS.WATER_FAST_MODE_BLOCKED:
    case BATTLEFIELD_TRAVERSAL_REASONS.WATER_CHARGE_BLOCKED:
      return describeWaterTraversalFailure(reason);
    default:
      return String(reason || "terrain blocks that movement");
  }
}

export default resolveBattlefieldTraversalStep;
