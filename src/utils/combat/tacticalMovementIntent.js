import { calculateDistance, getHexNeighbors, isValidPosition } from "../../data/movementRules.js";
import { getCombatActorId } from "../combatActorIdentity.js";

export const TACTICAL_MOVEMENT_MODES = Object.freeze(["hold", "walk", "run", "sprint", "charge"]);
export const TACTICAL_INTENT_STATES = Object.freeze(["planned", "active", "completed", "blocked", "canceled", "expired"]);
export const TACTICAL_HEXES_PER_PULSE = Object.freeze({ hold: 0, walk: 1, run: 2, sprint: 3, charge: 3 });
export const TACTICAL_STAMINA_PER_PULSE = Object.freeze({ hold: 0, walk: 0, run: 1, sprint: 2, charge: 2 });
export const TACTICAL_ANIMATION_DURATION_MS = Object.freeze({ hold: 0, walk: 625, run: 375, sprint: 275, charge: 275 });
export const TACTICAL_MOVEMENT_PRIORITY = Object.freeze({ hold: 0, walk: 1, run: 2, sprint: 3, charge: 4 });

const point = (value) => {
  const x = Number(value?.x);
  const y = Number(value?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
};
export const tacticalHexKey = (value) => `${Number(value?.x)},${Number(value?.y)}`;
export const areTacticalHexesAdjacent = (a, b) => Boolean(
  point(a) && point(b) && getHexNeighbors(a.x, a.y).some((candidate) => candidate.x === b.x && candidate.y === b.y),
);

export function buildTacticalPath({ from, destination, occupied = new Set(), isHexLegal, maxVisited = 5000 } = {}) {
  const start = point(from);
  const goal = point(destination);
  if (!start || !goal) return [];
  const legal = typeof isHexLegal === "function"
    ? isHexLegal
    : (hex) => isValidPosition(hex.x, hex.y);
  const startKey = tacticalHexKey(start);
  const queue = [start];
  const prior = new Map([[startKey, null]]);
  let best = start;
  let bestDistance = calculateDistance(start, goal);
  while (queue.length > 0 && prior.size <= maxVisited) {
    const current = queue.shift();
    for (const neighbor of getHexNeighbors(current.x, current.y)) {
      const key = tacticalHexKey(neighbor);
      if (prior.has(key) || !legal(neighbor)) continue;
      const occupiedHex = occupied.has(key);
      if (occupiedHex) continue;
      prior.set(key, current);
      const distance = calculateDistance(neighbor, goal);
      if (distance < bestDistance) {
        best = neighbor;
        bestDistance = distance;
      }
      if (key !== tacticalHexKey(goal)) queue.push(neighbor);
      if (distance === 0) {
        best = neighbor;
        queue.length = 0;
        break;
      }
    }
  }
  if (tacticalHexKey(best) === startKey) return [];
  const reversed = [];
  let cursor = best;
  while (cursor && tacticalHexKey(cursor) !== startKey) {
    reversed.push({ ...cursor });
    cursor = prior.get(tacticalHexKey(cursor));
  }
  return reversed.reverse();
}

export function validateTacticalMovementPath({ from, path, occupied = new Set(), isHexLegal, allowOccupiedDestination = false } = {}) {
  const origin = point(from);
  if (!origin || !Array.isArray(path)) return { valid: false, reason: "path-required" };
  const legal = typeof isHexLegal === "function" ? isHexLegal : (hex) => isValidPosition(hex.x, hex.y);
  let previous = origin;
  for (let index = 0; index < path.length; index += 1) {
    const step = point(path[index]);
    if (!step) return { valid: false, reason: "invalid-path-step", stepIndex: index };
    if (!areTacticalHexesAdjacent(previous, step)) return { valid: false, reason: "non-adjacent-path-step", stepIndex: index };
    if (tacticalHexKey(previous) === tacticalHexKey(step)) return { valid: false, reason: "duplicate-immediate-step", stepIndex: index };
    if (!legal(step)) return { valid: false, reason: "illegal-path-step", stepIndex: index };
    if (occupied.has(tacticalHexKey(step)) && !(allowOccupiedDestination && index === path.length - 1)) {
      return { valid: false, reason: "occupied-path-step", stepIndex: index };
    }
    previous = step;
  }
  return { valid: true };
}

export function createTacticalMovementIntent({
  intentId,
  generationId,
  actorId,
  groupId = null,
  orderId = null,
  formationSlotId = null,
  commandSourceActorId = null,
  mode = "hold",
  reason = "hold",
  targetActorId = null,
  destination = null,
  path = [],
  createdAtPulse = 0,
  commitmentUntilPulse = createdAtPulse,
} = {}) {
  const normalizedMode = TACTICAL_MOVEMENT_MODES.includes(mode) ? mode : null;
  if (!intentId || !actorId || !normalizedMode) return { accepted: false, reason: "invalid-intent-identity" };
  if (normalizedMode !== "hold" && (!point(destination) || !Array.isArray(path) || path.length === 0)) {
    return { accepted: false, reason: "voluntary-movement-path-required" };
  }
  const intent = Object.freeze({
    intentId: String(intentId), generationId: Number(generationId), actorId: String(actorId),
    groupId, orderId, formationSlotId, commandSourceActorId,
    mode: normalizedMode, reason, targetActorId, destination: point(destination),
    path: Object.freeze((path || []).map((step) => Object.freeze({ ...point(step) }))),
    nextStepIndex: 0, createdAtPulse: Number(createdAtPulse),
    commitmentUntilPulse: Number(commitmentUntilPulse), state: "planned",
  });
  return { accepted: true, intent };
}

export function downgradeTacticalMovementMode({ mode, currentStamina = 0, pathLength = 0 } = {}) {
  const available = Number(currentStamina) || 0;
  const requested = TACTICAL_MOVEMENT_MODES.includes(mode) ? mode : "hold";
  if (available >= TACTICAL_STAMINA_PER_PULSE[requested]) return { mode: requested, downgraded: false, reason: null };
  const fallback = requested === "sprint" && available >= TACTICAL_STAMINA_PER_PULSE.run && pathLength > 1
    ? "run"
    : pathLength > 0
      ? "walk"
      : "hold";
  return { mode: fallback, downgraded: requested !== fallback, reason: "insufficient-stamina" };
}

export function getActorTacticalAttackRange(actor = {}) {
  const attacks = [...(actor.attacks || []), ...(actor.weaponProfiles || [])];
  return Math.max(5, ...attacks.map((attack) => Number(
    attack?.rangeProfile?.normal ?? attack?.normalRangeFeet ?? attack?.rangeFeet ?? attack?.reachFeet ?? attack?.reach ?? 0,
  ) || 0));
}

export function planDefaultTacticalMovement({ actor, fighters = [], positions = {}, pulseIndex, generationId, isHexLegal } = {}) {
  const actorId = String(getCombatActorId(actor) ?? "");
  const from = point(positions[actorId] || actor?.position || actor);
  const hostiles = fighters.filter((candidate) => {
    const candidateId = String(getCombatActorId(candidate) ?? "");
    return candidateId && candidateId !== actorId && candidate?.team !== actor?.team && positions[candidateId];
  });
  hostiles.sort((left, right) => {
    const leftId = String(getCombatActorId(left) ?? "");
    const rightId = String(getCombatActorId(right) ?? "");
    const distanceDelta = calculateDistance(from, positions[leftId]) - calculateDistance(from, positions[rightId]);
    return distanceDelta || leftId.localeCompare(rightId);
  });
  const target = hostiles[0] || null;
  const targetActorId = target ? String(getCombatActorId(target) ?? "") : null;
  const targetPosition = targetActorId ? point(positions[targetActorId]) : null;
  const intentId = `${generationId}:${pulseIndex}:${actorId}:movement`;
  if (!from || !target || !targetPosition) return createTacticalMovementIntent({ intentId, generationId, actorId, mode: "hold", createdAtPulse: pulseIndex });
  if (calculateDistance(from, targetPosition) <= getActorTacticalAttackRange(actor)) {
    const result = createTacticalMovementIntent({ intentId, generationId, actorId, mode: "hold", reason: "attack-opportunity", targetActorId, createdAtPulse: pulseIndex });
    return { ...result, attackOpportunity: true };
  }
  const occupied = new Set(Object.entries(positions).filter(([id]) => id !== actorId).map(([, position]) => tacticalHexKey(position)));
  const path = buildTacticalPath({ from, destination: targetPosition, occupied, isHexLegal });
  const mode = path.length > 0 ? "walk" : "hold";
  return createTacticalMovementIntent({
    intentId, generationId, actorId, mode, reason: "approach", targetActorId,
    destination: targetPosition, path, createdAtPulse: pulseIndex, commitmentUntilPulse: pulseIndex,
  });
}
