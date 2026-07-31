const fighterId = (fighter) => fighter?.id || fighter?._id || null;

export function getCanonicalGrappleOpponentId(fighter = {}) {
  return fighter?.grappleState?.opponent || fighter?.grappleState?.opponentId || null;
}

export function hasNonNeutralGrappleState(fighter = {}) {
  const state = String(fighter?.grappleState?.state || "neutral").trim().toLowerCase();
  return Boolean(state && state !== "neutral");
}

export function hasReciprocalGrapplePair(actor = {}, target = {}) {
  const actorId = fighterId(actor);
  const targetId = fighterId(target);
  if (!actorId || !targetId) return false;
  if (!hasNonNeutralGrappleState(actor) || !hasNonNeutralGrappleState(target)) return false;
  return (
    String(getCanonicalGrappleOpponentId(actor) || "") === String(targetId) &&
    String(getCanonicalGrappleOpponentId(target) || "") === String(actorId)
  );
}

export function getNonReciprocalGrappleMetadata(actor = {}, target = {}) {
  const actorId = fighterId(actor);
  const targetId = fighterId(target);
  if (!actorId || !targetId || hasReciprocalGrapplePair(actor, target)) return null;
  const actorOpponentId = getCanonicalGrappleOpponentId(actor);
  const targetOpponentId = getCanonicalGrappleOpponentId(target);
  const actorActive = hasNonNeutralGrappleState(actor);
  const targetActive = hasNonNeutralGrappleState(target);
  const mismatched = Boolean(
    (actorActive && actorOpponentId && String(actorOpponentId) !== String(targetId)) ||
    (targetActive && targetOpponentId && String(targetOpponentId) !== String(actorId)) ||
    (actorActive && String(actorOpponentId || "") === String(targetId) && String(targetOpponentId || "") !== String(actorId)) ||
    (targetActive && String(targetOpponentId || "") === String(actorId) && String(actorOpponentId || "") !== String(targetId))
  );
  if (!mismatched) return null;
  return Object.freeze({
    actorId,
    targetId,
    actorOpponentId: actorOpponentId || null,
    targetOpponentId: targetOpponentId || null,
    actorState: String(actor?.grappleState?.state || "neutral"),
    targetState: String(target?.grappleState?.state || "neutral"),
  });
}
