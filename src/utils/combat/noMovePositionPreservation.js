const POSITION_FIELDS = Object.freeze([
  "x",
  "y",
  "position",
  "hex",
  "coordinates",
  "currentPosition",
  "fromPosition",
  "startPosition",
]);

export function getCombatantGridPosition(actor) {
  if (!actor) return null;
  const source = actor.position || actor.hex || actor.coordinates || actor;
  const x = Number(source?.x);
  const y = Number(source?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

export function positionsDiffer(a, b) {
  const first = getCombatantGridPosition(a);
  const second = getCombatantGridPosition(b);
  if (!first || !second) return false;
  return first.x !== second.x || first.y !== second.y;
}

export function formatGridPosition(position) {
  const normalized = getCombatantGridPosition(position);
  return normalized ? `(${normalized.x},${normalized.y})` : "(unknown)";
}

export function normalizeMovementCommit(commit) {
  const position = getCombatantGridPosition(commit);
  if (!position) return null;
  return {
    ...(commit || {}),
    x: position.x,
    y: position.y,
  };
}

export function resolveNoMovePositionAuthority({
  lastMovementCommit = null,
  committedPosition = null,
  refPosition = null,
  latestFighter = null,
  staleActor = null,
  source = "no-move",
  actorLabel = "unknown",
  log,
} = {}) {
  const lastMove = normalizeMovementCommit(lastMovementCommit);
  const committed = getCombatantGridPosition(committedPosition);
  const positionsRef = getCombatantGridPosition(refPosition);
  const fighter = getCombatantGridPosition(latestFighter);
  const stale = getCombatantGridPosition(staleActor);
  const authority =
    lastMove ||
    committed ||
    positionsRef ||
    fighter ||
    stale ||
    null;

  if (typeof log === "function") {
    log(
      `position authority candidates: actor=${actorLabel} source=${source} lastMove=${formatGridPosition(lastMove)} committed=${formatGridPosition(committed)} positionsRef=${formatGridPosition(positionsRef)} fighter=${formatGridPosition(fighter)} stale=${formatGridPosition(stale)}`,
      "debug",
    );
  }

  if (
    lastMove &&
    stale &&
    (lastMove.x !== stale.x || lastMove.y !== stale.y) &&
    typeof log === "function"
  ) {
    log(
      `position authority repaired from last movement commit: actor=${actorLabel} from=${formatGridPosition(stale)} to=${formatGridPosition(lastMove)} source=${source}`,
      "warning",
    );
  }

  return authority
    ? {
        ...authority,
        x: Number(authority.x),
        y: Number(authority.y),
      }
    : null;
}

export function stripPositionFields(patch = {}) {
  const sanitized = { ...(patch || {}) };
  POSITION_FIELDS.forEach((field) => {
    delete sanitized[field];
  });
  return sanitized;
}

export function preserveLatestPositionForNoMove({
  latestFighter,
  staleActor,
  patch = {},
  log,
  actorLabel,
} = {}) {
  if (!latestFighter) return latestFighter;

  const sanitizedPatch = stripPositionFields(patch);
  const latestPosition = getCombatantGridPosition(latestFighter);
  const stalePosition = getCombatantGridPosition(staleActor);

  if (
    latestPosition &&
    stalePosition &&
    (latestPosition.x !== stalePosition.x || latestPosition.y !== stalePosition.y) &&
    typeof log === "function"
  ) {
    log(
      `no-move fallback preserved latest position over stale snapshot: actor=${actorLabel || latestFighter.name || latestFighter.id || "unknown"} stale=${formatGridPosition(stalePosition)} latest=${formatGridPosition(latestPosition)}`,
      "warning",
    );
  }

  return {
    ...latestFighter,
    ...sanitizedPatch,
    x: latestFighter.x,
    y: latestFighter.y,
    position: latestFighter.position,
    hex: latestFighter.hex,
    coordinates: latestFighter.coordinates,
  };
}

export function preserveLatestPositionAcrossStores({
  fighterId,
  staleActor,
  updatedFighters = [],
  positions = {},
  lastKnownPositions = {},
  patch = {},
  log,
  actorLabel,
} = {}) {
  if (!fighterId) {
    return {
      fighters: updatedFighters,
      positions,
      position: null,
    };
  }

  const latestFighter = Array.isArray(updatedFighters)
    ? updatedFighters.find((fighter) => fighter?.id === fighterId)
    : null;
  const latestPosition =
    getCombatantGridPosition(lastKnownPositions?.[fighterId]) ||
    getCombatantGridPosition(positions?.[fighterId]) ||
    getCombatantGridPosition(latestFighter);

  const sanitizedPatch = stripPositionFields(patch);
  const nextPositions = { ...(positions || {}) };
  if (latestPosition) {
    nextPositions[fighterId] = { ...latestPosition };
  }

  const nextFighters = Array.isArray(updatedFighters)
    ? updatedFighters.map((fighter) => {
        if (fighter?.id !== fighterId) return fighter;
        const latestPositionFighter = latestPosition
          ? {
              ...fighter,
              x: latestPosition.x,
              y: latestPosition.y,
              position: { ...latestPosition },
              hex: fighter.hex ? { ...latestPosition } : fighter.hex,
            }
          : fighter;
        return preserveLatestPositionForNoMove({
          latestFighter: latestPositionFighter,
          staleActor,
          patch: sanitizedPatch,
          log,
          actorLabel,
        });
      })
    : updatedFighters;

  const stalePosition = getCombatantGridPosition(staleActor);
  if (
    latestPosition &&
    stalePosition &&
    (latestPosition.x !== stalePosition.x || latestPosition.y !== stalePosition.y) &&
    typeof log === "function"
  ) {
    log(
      `no-move fallback preserved canonical position over stale snapshot: actor=${actorLabel || latestFighter?.name || fighterId} stale=${formatGridPosition(stalePosition)} latest=${formatGridPosition(latestPosition)}`,
      "warning",
    );
  }

  return {
    fighters: nextFighters,
    positions: nextPositions,
    position: latestPosition ? { ...latestPosition } : null,
  };
}
