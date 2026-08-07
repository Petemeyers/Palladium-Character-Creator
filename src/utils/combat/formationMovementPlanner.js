import { resolveSpatialFormationSupport } from "./formationCohesionAuthority.js";
import { FORMATION_COMMANDS } from "./formationCommandAuthority.js";

const toFinite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const getActorId = (actor) => actor?.id || actor?._id || null;
const normalizeText = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");

const getPosition = (actor, positions = {}) => {
  const actorId = getActorId(actor);
  return positions?.[actorId] || actor?.position || (
    Number.isFinite(Number(actor?.x)) && Number.isFinite(Number(actor?.y))
      ? { x: Number(actor.x), y: Number(actor.y), facing: actor?.facing }
      : null
  );
};

const getDistance = (left, right, calculateDistanceFeet) => {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  if (typeof calculateDistanceFeet === "function") {
    const distance = Number(calculateDistanceFeet(left, right));
    if (Number.isFinite(distance)) return distance;
  }
  const dx = toFinite(left.x) - toFinite(right.x);
  const dy = toFinite(left.y) - toFinite(right.y);
  return Math.hypot(dx, dy) * 5;
};

const isFormationDisruption = (entry) => normalizeText(
  typeof entry === "string" ? entry : entry?.type || entry?.id,
) === "formation-disrupted";

/**
 * Movement planning must be able to inspect where a disrupted actor could
 * rebuild support without prematurely clearing the live condition. This actor
 * exists only for candidate evaluation; resolveFormationCommand remains the
 * authority for the real state transition.
 */
const buildPlanningActor = (actor) => ({
  ...actor,
  statusEffects: (Array.isArray(actor?.statusEffects) ? actor.statusEffects : [])
    .filter((entry) => !isFormationDisruption(entry)),
  formationState: {
    ...(actor?.formationState || {}),
    status: actor?.formationState?.status === "disrupted" ? "loose" : actor?.formationState?.status,
    recoveryRequired: false,
    anchored: false,
  },
});

const getNearestAllyDistance = ({ actor, combatants, positions, calculateDistanceFeet }) => {
  const actorId = getActorId(actor);
  const actorTeam = normalizeText(actor?.team || actor?.side || actor?.armyId || actor?.type);
  const actorPosition = positions?.[actorId];
  let nearest = Number.POSITIVE_INFINITY;
  for (const candidate of Array.isArray(combatants) ? combatants : []) {
    const candidateId = getActorId(candidate);
    if (!candidateId || candidateId === actorId) continue;
    const candidateTeam = normalizeText(candidate?.team || candidate?.side || candidate?.armyId || candidate?.type);
    if (!actorTeam || actorTeam !== candidateTeam) continue;
    if (candidate.dead || candidate.defeated || candidate.unconscious || candidate.routed || candidate.hasFled) continue;
    const candidatePosition = positions?.[candidateId] || candidate?.position;
    nearest = Math.min(nearest, getDistance(actorPosition, candidatePosition, calculateDistanceFeet));
  }
  return nearest;
};

const compareCandidates = (left, right) => (
  right.score - left.score ||
  right.formation.supportBonus - left.formation.supportBonus ||
  right.formation.supporterIds.length - left.formation.supporterIds.length ||
  right.formation.cohesionScore - left.formation.cohesionScore ||
  right.targetDistanceFeet - left.targetDistanceFeet ||
  left.position.x - right.position.x ||
  left.position.y - right.position.y
);

export const buildFormationMovementCandidates = ({
  commandId,
  actor,
  target = null,
  combatants = [],
  positions = {},
  getWeapon = null,
  calculateDistanceFeet = null,
  currentRound = null,
  terrainAt = null,
  getNeighbors = null,
  isPositionLegal = null,
  isOccupied = null,
} = {}) => {
  if (!actor || ![FORMATION_COMMANDS.CLOSE_RANKS, FORMATION_COMMANDS.WITHDRAW_IN_ORDER].includes(commandId)) return [];
  const actorId = getActorId(actor);
  const actorPosition = getPosition(actor, positions);
  if (!actorId || !actorPosition || typeof getNeighbors !== "function") return [];

  const targetPosition = getPosition(target, positions);
  const currentTargetDistanceFeet = targetPosition
    ? getDistance(actorPosition, targetPosition, calculateDistanceFeet)
    : 0;
  const planningActor = buildPlanningActor(actor);
  const planningCombatants = (Array.isArray(combatants) ? combatants : []).map((entry) => (
    getActorId(entry) === actorId ? planningActor : entry
  ));
  const currentPlanningPositions = {
    ...(positions || {}),
    [actorId]: actorPosition,
  };
  const currentFormation = resolveSpatialFormationSupport({
    actor: planningActor,
    target,
    combatants: planningCombatants,
    positions: currentPlanningPositions,
    getWeapon,
    calculateDistanceFeet,
    currentRound,
    terrainAt,
  });
  const currentNearestAllyDistance = getNearestAllyDistance({
    actor: planningActor,
    combatants: planningCombatants,
    positions: currentPlanningPositions,
    calculateDistanceFeet,
  });

  const candidates = [];
  for (const rawPosition of getNeighbors(actorPosition.x, actorPosition.y) || []) {
    const position = {
      x: Number(rawPosition?.x),
      y: Number(rawPosition?.y),
      ...(Number.isFinite(Number(actorPosition?.facing)) ? { facing: Number(actorPosition.facing) } : {}),
    };
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) continue;
    if (typeof isPositionLegal === "function" && !isPositionLegal(position, actor)) continue;
    if (typeof isOccupied === "function" && isOccupied(position, actorId)) continue;

    const proposedPositions = {
      ...(positions || {}),
      [actorId]: position,
    };
    const formation = resolveSpatialFormationSupport({
      actor: planningActor,
      target,
      combatants: planningCombatants,
      positions: proposedPositions,
      getWeapon,
      calculateDistanceFeet,
      currentRound,
      terrainAt,
    });
    const targetDistanceFeet = targetPosition
      ? getDistance(position, targetPosition, calculateDistanceFeet)
      : currentTargetDistanceFeet;
    const nearestAllyDistanceFeet = getNearestAllyDistance({
      actor: planningActor,
      combatants: planningCombatants,
      positions: proposedPositions,
      calculateDistanceFeet,
    });
    const supportDelta = formation.supportBonus - currentFormation.supportBonus;
    const supporterDelta = formation.supporterIds.length - currentFormation.supporterIds.length;
    const cohesionDelta = formation.cohesionScore - currentFormation.cohesionScore;
    const targetDistanceDelta = targetDistanceFeet - currentTargetDistanceFeet;
    const allyDistanceImprovement = Number.isFinite(currentNearestAllyDistance) && Number.isFinite(nearestAllyDistanceFeet)
      ? currentNearestAllyDistance - nearestAllyDistanceFeet
      : 0;
    const terrainMovementCost = toFinite(formation?.terrainContext?.movementStaminaModifier, 0);

    if (commandId === FORMATION_COMMANDS.CLOSE_RANKS) {
      const improvesFormation = (
        supportDelta > 0 ||
        supporterDelta > 0 ||
        cohesionDelta >= 10 ||
        (currentFormation.supportBonus <= 0 && formation.supporterIds.length > 0)
      );
      if (!improvesFormation) continue;
      if (formation.supporterIds.length <= 0 && formation.supportBonus <= 0) continue;

      // Tightening a line should not casually surge ahead of its neighbors.
      // A modest retreat or lateral move is acceptable when it restores support.
      const forwardExposurePenalty = targetDistanceDelta < -5.1 ? Math.abs(targetDistanceDelta) * 6 : 0;
      const lineDepthPenalty = Math.abs(targetDistanceDelta) * 1.5;
      const score = (
        formation.supportBonus * 240 +
        formation.supporterIds.length * 95 +
        formation.cohesionScore * 2 +
        supportDelta * 180 +
        supporterDelta * 80 +
        cohesionDelta * 2 +
        allyDistanceImprovement * 5 -
        lineDepthPenalty -
        forwardExposurePenalty -
        terrainMovementCost * 12
      );
      candidates.push({
        commandId,
        position,
        path: [position],
        score,
        formation,
        currentFormation,
        targetDistanceFeet,
        currentTargetDistanceFeet,
        targetDistanceDelta,
        nearestAllyDistanceFeet,
        currentNearestAllyDistance,
        supportDelta,
        supporterDelta,
        cohesionDelta,
        preservesFacing: true,
        reason: "formation-support-improved",
      });
      continue;
    }

    if (!targetPosition) continue;
    if (currentFormation.supportBonus <= 0) continue;
    if (targetDistanceDelta <= 0.1) continue;
    if (formation.supportBonus <= 0 || formation.supporterIds.length <= 0) continue;

    const supportLoss = Math.max(0, currentFormation.supportBonus - formation.supportBonus);
    const supporterLoss = Math.max(0, currentFormation.supporterIds.length - formation.supporterIds.length);
    const score = (
      formation.supportBonus * 260 +
      formation.supporterIds.length * 100 +
      formation.cohesionScore * 2 +
      targetDistanceDelta * 18 -
      supportLoss * 220 -
      supporterLoss * 100 -
      terrainMovementCost * 12
    );
    candidates.push({
      commandId,
      position,
      path: [position],
      score,
      formation,
      currentFormation,
      targetDistanceFeet,
      currentTargetDistanceFeet,
      targetDistanceDelta,
      nearestAllyDistanceFeet,
      currentNearestAllyDistance,
      supportDelta,
      supporterDelta,
      cohesionDelta,
      preservesFacing: true,
      reason: "separation-increased-with-support",
    });
  }

  return candidates.sort(compareCandidates);
};

export const planFormationMovementCommand = (context = {}) => {
  const candidates = buildFormationMovementCandidates(context);
  const selected = candidates[0] || null;
  if (!selected) {
    return {
      accepted: false,
      commandId: context?.commandId || null,
      actorId: getActorId(context?.actor),
      reason: context?.commandId === FORMATION_COMMANDS.WITHDRAW_IN_ORDER
        ? "no-supported-withdrawal-hex"
        : "no-support-improving-hex",
      candidates: [],
    };
  }
  return {
    accepted: true,
    commandId: selected.commandId,
    actorId: getActorId(context?.actor),
    position: selected.position,
    path: selected.path,
    score: selected.score,
    reason: selected.reason,
    formationBefore: selected.currentFormation,
    formationAfter: selected.formation,
    targetDistanceBefore: selected.currentTargetDistanceFeet,
    targetDistanceAfter: selected.targetDistanceFeet,
    targetDistanceDelta: selected.targetDistanceDelta,
    supportDelta: selected.supportDelta,
    supporterDelta: selected.supporterDelta,
    cohesionDelta: selected.cohesionDelta,
    preservesFacing: selected.preservesFacing,
    candidateCount: candidates.length,
    candidates,
  };
};
