/**
 * Milestone 8C-8C.3B — Structure-Aware Pathfinding & Transactional Movement
 *
 * Ground movement authority layered on top of 8C-8C.3A's renderer-independent
 * structure spatial queries.
 *
 * Responsibilities:
 *   - normalize a movement path before spatial admission;
 *   - reject the exact structure-crossing step before combat side effects;
 *   - filter neighbor expansion so existing BFS/approach planners route around
 *     walls instead of repeatedly proposing a blocked crossing;
 *   - expose a small deterministic path finder for regression tests and future
 *     movement services.
 *
 * Flying/teleport-style movement is deliberately bypassed here. Vertical
 * clearance and teleport obstruction are separate movement authorities and
 * must not inherit a ground-wall rule accidentally.
 */
import {
  describeStructureSpatialBlock,
  getCombatMovementStructureBlock,
} from "../maps/structureSpatialQueryAuthority.js";

export const STRUCTURE_AWARE_MOVEMENT_VERSION = 1;
export const STRUCTURE_AWARE_MOVEMENT_ID = "structure-aware-movement-v1";

const finiteCoordinate = (value) => Number.isFinite(Number(value));

function normalizePosition(position) {
  if (!position || !finiteCoordinate(position.x) || !finiteCoordinate(position.y)) return null;
  return {
    ...position,
    x: Number(position.x),
    y: Number(position.y),
  };
}

function samePosition(left, right) {
  return Boolean(left && right) && Number(left.x) === Number(right.x) && Number(left.y) === Number(right.y);
}

function positionKey(position) {
  return `${Number(position?.x)},${Number(position?.y)}`;
}

function normalizeMovementMode(value) {
  return String(value ?? "ground")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

export function bypassesGroundStructureMovement(movementMode) {
  const mode = normalizeMovementMode(movementMode);
  return [
    "fly",
    "flight",
    "flying",
    "teleport",
    "teleportation",
    "dimensional-teleport",
    "phase",
    "phasing",
  ].includes(mode);
}

/**
 * Produces an executable path with `from` as the first node and `to` as the
 * last node. Existing callers differ on whether `path` contains either end,
 * so the normalizer makes the contract explicit and removes adjacent dupes.
 */
export function normalizeStructureAwareMovementPath({ from, to, path = null } = {}) {
  const origin = normalizePosition(from);
  const destination = normalizePosition(to);
  if (!origin || !destination) return [];

  const normalized = [];
  const push = (candidate) => {
    const point = normalizePosition(candidate);
    if (!point) return;
    if (samePosition(normalized[normalized.length - 1], point)) return;
    normalized.push(point);
  };

  push(origin);
  if (Array.isArray(path)) {
    for (const point of path) push(point);
  }
  push(destination);
  return normalized;
}

function summarizeBlocker(blocker) {
  const segment = blocker?.segment || blocker?.structure || null;
  return {
    blockerId: segment?.id ?? null,
    blockerKind: segment?.kind || segment?.type || null,
    blockerMaterial: segment?.material || null,
    blockerOpen: segment?.open === true,
  };
}

/**
 * Canonical preflight for a combat movement transaction.
 *
 * It must run before weapon-entry, engagement-state, position, stamina, and
 * success narration mutations. A rejected result therefore means callers can
 * safely return without rolling back combat side effects.
 */
export function admitStructureAwareCombatMovement({
  mapDefinition = {},
  index = null,
  actor = null,
  from,
  to,
  path = null,
  movementMode = "ground",
} = {}) {
  const normalizedPath = normalizeStructureAwareMovementPath({ from, to, path });
  if (normalizedPath.length < 2) {
    return {
      accepted: false,
      reason: "invalid-movement-path",
      path: normalizedPath,
      blockedStepIndex: -1,
      blocker: null,
      obstacle: null,
    };
  }

  if (bypassesGroundStructureMovement(movementMode)) {
    return {
      accepted: true,
      reason: "non-ground-movement",
      path: normalizedPath,
      blockedStepIndex: -1,
      blocker: null,
      obstacle: null,
    };
  }

  const actorCanClimb = actor?.moveCaps?.canClimb === true ||
    actor?.movementProfile?.canClimb === true || actor?.canClimb === true;

  const checks = [];
  for (let stepIndex = 0; stepIndex < normalizedPath.length - 1; stepIndex += 1) {
    const stepFrom = normalizedPath[stepIndex];
    const stepTo = normalizedPath[stepIndex + 1];
    const block = getCombatMovementStructureBlock({
      mapDefinition,
      index,
      from: stepFrom,
      to: stepTo,
      actorCanClimb,
      ignorePathStart: true,
      ignorePathEnd: false,
    });
    checks.push(block);

    if (block?.blocked) {
      const blockerSummary = summarizeBlocker(block.blocker);
      return {
        accepted: false,
        reason: "structure-blocked",
        path: normalizedPath,
        blockedStepIndex: stepIndex,
        from: stepFrom,
        to: stepTo,
        blocker: block.blocker || null,
        obstacle: describeStructureSpatialBlock(block.blocker),
        requiresClimb: block.requiresClimb === true,
        canTraverseWithClimb: block.canTraverseWithClimb === true,
        requiredClimbHeightFeet: Number(block.requiredClimbHeightFeet || 0),
        checks,
        ...blockerSummary,
      };
    }
  }

  return {
    accepted: true,
    reason: "structure-clear",
    path: normalizedPath,
    blockedStepIndex: -1,
    blocker: null,
    obstacle: null,
    checks,
  };
}

/**
 * Filters a planner's already-generated neighbors by transition legality.
 * Occupancy, terrain, movement budget, and tactical scoring remain the owning
 * planner's responsibility; this function only removes structure crossings.
 */
export function filterStructureAwareCombatNeighbors({
  mapDefinition = {},
  index = null,
  actor = null,
  from,
  neighbors = [],
  movementMode = "ground",
} = {}) {
  const origin = normalizePosition(from);
  if (!origin) return { neighbors: [], rejected: [], reason: "invalid-origin" };

  const legal = [];
  const rejected = [];
  for (const candidate of Array.isArray(neighbors) ? neighbors : []) {
    const destination = normalizePosition(candidate);
    if (!destination) continue;
    const admission = admitStructureAwareCombatMovement({
      mapDefinition,
      index,
      actor,
      from: origin,
      to: destination,
      movementMode,
    });
    if (admission.accepted) legal.push(candidate);
    else rejected.push({ position: destination, admission });
  }

  return {
    neighbors: legal,
    rejected,
    reason: rejected.length > 0 ? "structure-filtered" : "structure-clear",
  };
}

export function createStructureAwareCombatNeighborProvider({
  mapDefinition = {},
  index = null,
  actor = null,
  getNeighbors,
  movementMode = "ground",
} = {}) {
  if (typeof getNeighbors !== "function") return () => [];
  return (x, y) => filterStructureAwareCombatNeighbors({
    mapDefinition,
    index,
    actor,
    from: { x, y },
    neighbors: getNeighbors(x, y) || [],
    movementMode,
  }).neighbors;
}

/**
 * Small BFS reference implementation. Production AI can keep its existing
 * scoring/path planner and simply use the filtered neighbor provider; this is
 * intentionally available for deterministic tests and future engine workers.
 */
export function findStructureAwareCombatPath({
  mapDefinition = {},
  index = null,
  actor = null,
  start,
  goal,
  getNeighbors,
  isLegalCenter = () => true,
  movementMode = "ground",
  maxSteps = 256,
} = {}) {
  const origin = normalizePosition(start);
  const destination = normalizePosition(goal);
  if (!origin || !destination || typeof getNeighbors !== "function") {
    return { found: false, reason: "invalid-pathfinding-input", path: [] };
  }
  if (samePosition(origin, destination)) {
    return { found: true, reason: "already-at-goal", path: [origin], steps: 0 };
  }

  const boundedMaxSteps = Math.max(0, Math.floor(Number(maxSteps) || 0));
  const structureNeighbors = createStructureAwareCombatNeighborProvider({
    mapDefinition,
    index,
    actor,
    getNeighbors,
    movementMode,
  });
  const queue = [{ position: origin, path: [origin], steps: 0 }];
  const visited = new Set([positionKey(origin)]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.steps >= boundedMaxSteps) continue;

    for (const nextRaw of structureNeighbors(current.position.x, current.position.y)) {
      const next = normalizePosition(nextRaw);
      if (!next) continue;
      const key = positionKey(next);
      if (visited.has(key)) continue;
      visited.add(key);
      if (!isLegalCenter(next)) continue;

      const path = [...current.path, next];
      if (samePosition(next, destination)) {
        return {
          found: true,
          reason: "path-found",
          path,
          steps: path.length - 1,
          visitedCount: visited.size,
        };
      }
      queue.push({ position: next, path, steps: current.steps + 1 });
    }
  }

  return {
    found: false,
    reason: "no-structure-aware-path",
    path: [],
    steps: null,
    visitedCount: visited.size,
  };
}

export default {
  STRUCTURE_AWARE_MOVEMENT_VERSION,
  STRUCTURE_AWARE_MOVEMENT_ID,
  bypassesGroundStructureMovement,
  normalizeStructureAwareMovementPath,
  admitStructureAwareCombatMovement,
  filterStructureAwareCombatNeighbors,
  createStructureAwareCombatNeighborProvider,
  findStructureAwareCombatPath,
};
