const actorIsTerminal = (actor = {}) => Boolean(
  actor.dead ||
  actor.isDead ||
  actor.unconscious ||
  actor.isUnconscious ||
  actor.defeated ||
  actor.isCaptured ||
  actor.hasSurrendered ||
  ["accepted", "captured", "released", "executed"].includes(
    String(actor.surrenderState?.status || actor.surrenderState || "").toLowerCase(),
  )
);

export function dispatchOwnedSurvivalAction({
  actor,
  actionToken,
  activeActionToken,
  source = "survival-action",
  dispatch,
} = {}) {
  const base = {
    accepted: false,
    actorId: actor?.id || null,
    actionToken: actionToken || null,
    source,
    result: null,
    reason: null,
  };
  if (!actor?.id) return { ...base, reason: "actor-invalid" };
  if (actorIsTerminal(actor)) return { ...base, reason: "actor-terminal" };
  if (!actionToken || !activeActionToken || actionToken !== activeActionToken) {
    return { ...base, reason: "stale-action-token" };
  }
  if (typeof dispatch !== "function") return { ...base, reason: "dispatcher-missing" };
  const result = dispatch();
  if (!result) return { ...base, reason: "survival-action-not-produced" };
  return {
    ...base,
    accepted: true,
    result,
  };
}

export default dispatchOwnedSurvivalAction;
