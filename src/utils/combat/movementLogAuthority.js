const MOVEMENT_POSITION_RE = /^(.*?)\s+moves?\s+to\s+position\s+\((-?\d+)\s*,\s*(-?\d+)\)\s*$/i;

export const reconcileCanonicalMovementLog = ({
  message,
  actorId,
  positions = {},
} = {}) => {
  if (typeof message !== "string") return { accepted: true, message };
  const match = message.match(MOVEMENT_POSITION_RE);
  if (!match || !actorId) return { accepted: true, message };

  const canonical = positions?.[actorId];
  if (!canonical) return { accepted: true, message };

  const requested = { x: Number(match[2]), y: Number(match[3]) };
  const authoritative = { x: Number(canonical.x), y: Number(canonical.y) };
  const matches = requested.x === authoritative.x && requested.y === authoritative.y;
  if (matches) return { accepted: true, message, requested, authoritative };

  return {
    accepted: false,
    suppressed: true,
    reason: "stale-noncanonical-movement-position",
    requested,
    authoritative,
    actorLabel: match[1],
  };
};
