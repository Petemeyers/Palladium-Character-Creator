const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

export function runEnemyApproachPlanner({
  planner,
  actor,
  target,
  origin = null,
  targetPosition = null,
  beforeDistance = null,
  executionKey = null,
  initiativeTurnId = null,
  authorityAccepted = true,
  getDistance,
} = {}) {
  const base = {
    accepted: false,
    result: null,
    actorId: actor?.id || null,
    targetId: target?.id || null,
    origin,
    destination: null,
    beforeDistance: finite(beforeDistance),
    afterDistance: null,
    enteredRange: false,
    tacticalPositionImproved: false,
    reason: null,
    executionKey,
    initiativeTurnId,
    plan: null,
    error: null,
  };
  if (!actor?.id) return { ...base, result: "rejected", reason: "actor-invalid" };
  if (!target?.id) return { ...base, result: "rejected", reason: "target-invalid" };
  if (!authorityAccepted) return { ...base, result: "rejected", reason: "stale-authority" };
  if (typeof planner !== "function") return { ...base, result: "rejected", reason: "planner-unavailable" };

  try {
    const plan = planner();
    const destination = plan?.position || null;
    const afterDistance = destination && targetPosition && typeof getDistance === "function"
      ? finite(getDistance(destination, targetPosition))
      : null;
    const normalizedBefore = finite(beforeDistance);
    return {
      ...base,
      accepted: true,
      result: destination
        ? "movement-selected"
        : plan?.type === "hold"
          ? "no-legal-path"
          : "already-in-legal-range",
      destination,
      afterDistance,
      enteredRange: plan?.enteredRange === true,
      tacticalPositionImproved: normalizedBefore !== null && afterDistance !== null &&
        afterDistance < normalizedBefore,
      reason: plan?.invalidReason || null,
      plan,
    };
  } catch (error) {
    return {
      ...base,
      result: "error",
      reason: "planner-exception",
      error,
    };
  }
}

export default runEnemyApproachPlanner;
