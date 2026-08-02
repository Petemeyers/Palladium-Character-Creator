import { getCombatActorId } from "../combatActorIdentity.js";

const normalizePosition = (value) => {
  const x = Number(value?.x ?? value?.position?.x ?? value?.hex?.x);
  const y = Number(value?.y ?? value?.position?.y ?? value?.hex?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
};

export function commitPositionAuthoritySnapshot({
  fighters = [],
  positions = {},
  committedPositions = {},
  actorId,
  position,
} = {}) {
  const nextPosition = normalizePosition(position);
  if (!actorId || !nextPosition) return { accepted: false, reason: "invalid-position" };
  const normalizedActorId = String(actorId ?? "");
  const nextFighters = fighters.map((fighter) => String(getCombatActorId(fighter) ?? "") === normalizedActorId
    ? {
        ...fighter,
        x: nextPosition.x,
        y: nextPosition.y,
        position: { ...nextPosition },
        hex: fighter.hex ? { ...nextPosition } : fighter.hex,
      }
    : fighter);
  const nextPositions = { ...positions, [actorId]: { ...nextPosition } };
  const nextCommittedPositions = { ...committedPositions, [actorId]: { ...nextPosition } };
  const fighterPosition = normalizePosition(nextFighters.find((fighter) => (
    String(getCombatActorId(fighter) ?? "") === normalizedActorId
  )));
  const positionsRefPosition = normalizePosition(nextPositions[actorId]);
  const committedPosition = normalizePosition(nextCommittedPositions[actorId]);
  const statePosition = { ...nextPosition };
  const matches = [fighterPosition, positionsRefPosition, committedPosition, statePosition].every((candidate) => (
    candidate?.x === nextPosition.x && candidate?.y === nextPosition.y
  ));
  return {
    accepted: true,
    position: nextPosition,
    fighters: nextFighters,
    positions: nextPositions,
    committedPositions: nextCommittedPositions,
    audit: { actorId, committedPosition, fighterPosition, positionsRefPosition, statePosition, matches },
  };
}

export default commitPositionAuthoritySnapshot;
