const TERMINAL_STATES = new Set(["consumed", "rejected", "stale", "canceled"]);

function getPlanId(plan = {}) {
  return plan?.planId || plan?.selectionId || null;
}

function normalizePlan(plan = {}) {
  const planId = getPlanId(plan);
  const sourceWeaponSnapshot = plan.sourceWeaponSnapshot
    ? Object.freeze({
        ...plan.sourceWeaponSnapshot,
        armorContactTraits: plan.sourceWeaponSnapshot.armorContactTraits
          ? Object.freeze({ ...plan.sourceWeaponSnapshot.armorContactTraits })
          : null,
      })
    : null;
  const attackSnapshot = plan.attackSnapshot
    ? Object.freeze({ ...plan.attackSnapshot })
    : null;
  return {
    ...plan,
    planId,
    selectionId: plan.selectionId || planId,
    planExecutionKey: plan.planExecutionKey || plan.armoredPlanExecutionKey || plan.executionKey || null,
    actorId: plan.actorId || plan.attackerId || null,
    targetId: plan.targetId || plan.defenderId || null,
    actionToken: plan.actionToken || plan.turnToken || null,
    sourceWeaponSnapshot,
    attackSnapshot,
    selectionSource: plan.selectionSource || plan.source || "unknown",
  };
}

function valuesMatch(expected, actual) {
  if (expected == null || actual == null) return true;
  return String(expected) === String(actual);
}

export function createAuthoritativeArmoredPlanTurnIdentity({
  authoritativeTurn = null,
  generationId = "default",
  round = null,
  initiativeIndex = null,
  initiativeTurnId = null,
  actionToken = null,
  turnToken = null,
} = {}) {
  const source = authoritativeTurn || {};
  const identity = {
    generationId: source.generationId ?? generationId,
    round: source.round ?? round,
    initiativeIndex: source.initiativeIndex ?? initiativeIndex,
    initiativeTurnId: source.initiativeTurnId ?? initiativeTurnId,
    actionToken: source.actionToken ?? actionToken ?? source.turnToken ?? turnToken,
    turnToken: source.turnToken ?? turnToken ?? source.actionToken ?? actionToken,
  };
  const complete = authoritativeTurn
    ? Boolean(
        identity.generationId &&
        Number.isInteger(Number(identity.round)) &&
        Number.isInteger(Number(identity.initiativeIndex)) &&
        identity.initiativeTurnId &&
        identity.actionToken
      )
    : Boolean(identity.actionToken);
  return Object.freeze({ ...identity, complete, source: authoritativeTurn ? "authoritative-turn" : "legacy-fields" });
}

export function createArmoredActionPlanRegistry() {
  return new Map();
}

export function registerArmoredActionPlan(registry, plan = {}) {
  const normalized = normalizePlan(plan);
  const planId = getPlanId(normalized);
  if (!registry?.set || !planId) {
    return { ok: false, reason: "missing-selection-id", plan };
  }
  const existing = registry.get(planId);
  if (existing && TERMINAL_STATES.has(existing.state)) {
    return { ok: false, reason: `plan-${existing.state}`, plan: existing };
  }
  const next = Object.freeze({
    ...existing,
    ...normalized,
    state: existing?.state || "created",
    createdAt: existing?.createdAt || Date.now(),
  });
  registry.set(planId, next);
  return { ok: true, plan: next };
}

export function markArmoredActionPlanDispatched(registry, selectionId, patch = {}) {
  if (!registry?.get || !selectionId) return { ok: false, reason: "missing-selection-id" };
  const existing = registry.get(selectionId);
  if (!existing) return { ok: false, reason: "unknown-selection-id" };
  if (TERMINAL_STATES.has(existing.state)) return { ok: false, reason: `plan-${existing.state}`, plan: existing };
  if (existing.state === "dispatched") {
    return { ok: true, alreadyDispatched: true, plan: existing };
  }
  if (existing.state !== "created") {
    return { ok: false, reason: "state-mismatch", fromState: existing.state || "unknown", requestedState: "dispatched", plan: existing };
  }
  const next = Object.freeze({ ...existing, ...patch, state: "dispatched", dispatchedAt: Date.now() });
  registry.set(selectionId, next);
  return { ok: true, plan: next };
}

export function validateArmoredActionPlanIdentity(registry, planId, context = {}, stage = "unknown") {
  if (!registry?.get || !planId) {
    return { ok: false, reason: "missing-selection-id", stage };
  }
  const plan = registry.get(planId);
  if (!plan) {
    return { ok: false, reason: "unknown-selection-id", stage };
  }
  const expectedState = stage === "dispatch" ? "created" : stage === "attack-entry" ? "dispatched" : null;
  if (stage === "dispatch" && plan.state === "dispatched") {
    return { ok: true, alreadyDispatched: true, stage, plan };
  }
  if (expectedState && plan.state !== expectedState) {
    return { ok: false, reason: "state-mismatch", stage, plan };
  }
  const comparisons = [
    ["generationId", "generation-mismatch"],
    ["round", "round-mismatch"],
    ["initiativeIndex", "initiative-index-mismatch"],
    ["initiativeTurnId", "initiative-turn-mismatch"],
    ["actorId", "actor-mismatch"],
    ["targetId", "target-mismatch"],
    ["actionToken", "action-token-mismatch"],
    ["selectedTechnique", "technique-mismatch"],
    ["sourceWeaponId", "source-weapon-mismatch"],
  ];
  for (const [field, reason] of comparisons) {
    if (!valuesMatch(context[field], plan[field])) {
      return { ok: false, reason, stage, field, expected: context[field], actual: plan[field], plan };
    }
  }
  return { ok: true, stage, plan };
}

export function markArmoredActionPlanTerminal(registry, selectionId, state, patch = {}) {
  if (!TERMINAL_STATES.has(state)) return { ok: false, reason: "invalid-terminal-state" };
  if (!registry?.get || !selectionId) return { ok: false, reason: "missing-selection-id" };
  const existing = registry.get(selectionId);
  if (!existing) return { ok: false, reason: "unknown-selection-id" };
  if (TERMINAL_STATES.has(existing.state)) return { ok: false, reason: `plan-${existing.state}`, plan: existing };
  if (state === "consumed" && existing.state !== "dispatched") {
    return {
      ok: false,
      reason: "plan-not-dispatched",
      fromState: existing.state || "unknown",
      requestedState: state,
      plan: existing,
    };
  }
  const next = Object.freeze({ ...existing, ...patch, state, terminalAt: Date.now() });
  registry.set(selectionId, next);
  return { ok: true, plan: next };
}

export function staleArmoredActionPlans(registry, predicate, patch = {}) {
  if (!registry?.entries) return [];
  const staled = [];
  for (const [planId, plan] of registry.entries()) {
    if (TERMINAL_STATES.has(plan?.state)) continue;
    if (typeof predicate === "function" && !predicate(plan)) continue;
    const result = markArmoredActionPlanTerminal(registry, planId, "stale", patch);
    if (result.ok) staled.push(result.plan);
  }
  return staled;
}

export const markPlanDispatched = markArmoredActionPlanDispatched;
export const markPlanConsumed = (registry, selectionId, patch = {}) =>
  markArmoredActionPlanTerminal(registry, selectionId, "consumed", patch);
export const markPlanRejected = (registry, selectionId, patch = {}) =>
  markArmoredActionPlanTerminal(registry, selectionId, "rejected", patch);
export const markPlanStale = (registry, selectionId, patch = {}) =>
  markArmoredActionPlanTerminal(registry, selectionId, "stale", patch);
export const markPlanCanceled = (registry, selectionId, patch = {}) =>
  markArmoredActionPlanTerminal(registry, selectionId, "canceled", patch);

export function summarizeArmoredActionPlans(registry) {
  const summary = { created: 0, consumed: 0, rejected: 0, stale: 0, canceled: 0, open: 0 };
  if (!registry?.values) return summary;
  for (const plan of registry.values()) {
    summary.created += 1;
    if (plan?.state === "consumed") summary.consumed += 1;
    else if (plan?.state === "rejected") summary.rejected += 1;
    else if (plan?.state === "stale") summary.stale += 1;
    else if (plan?.state === "canceled") summary.canceled += 1;
    else summary.open += 1;
  }
  return summary;
}

export default {
  createAuthoritativeArmoredPlanTurnIdentity,
  createArmoredActionPlanRegistry,
  markArmoredActionPlanDispatched,
  markArmoredActionPlanTerminal,
  markPlanCanceled,
  markPlanConsumed,
  markPlanDispatched,
  markPlanRejected,
  markPlanStale,
  registerArmoredActionPlan,
  staleArmoredActionPlans,
  summarizeArmoredActionPlans,
  validateArmoredActionPlanIdentity,
};
