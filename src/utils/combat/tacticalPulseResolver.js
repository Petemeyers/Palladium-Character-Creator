import { commitPositionAuthoritySnapshot } from "./positionAuthorityAudit.js";
import { getCombatActorId } from "../combatActorIdentity.js";
import {
  abortTacticalPulseClock,
  completeTacticalPulseClock,
  createTacticalPulseClock,
  createTacticalPulseOwnership,
  TACTICAL_PULSE_STATES,
  transitionTacticalPulseClock,
} from "./tacticalPulseClock.js";
import {
  createTacticalMovementIntent,
  downgradeTacticalMovementMode,
  planDefaultTacticalMovement,
  TACTICAL_ANIMATION_DURATION_MS,
  TACTICAL_HEXES_PER_PULSE,
  TACTICAL_MOVEMENT_PRIORITY,
  TACTICAL_STAMINA_PER_PULSE,
  tacticalHexKey,
  validateTacticalMovementPath,
} from "./tacticalMovementIntent.js";
import {
  advanceTacticalActionRuntime,
  cancelTacticalAction,
  completeTacticalRecoveryBoundaries,
  createTacticalActionRuntime,
  getTacticalActorOwnership,
  registerTacticalAction,
} from "./tacticalActionRuntime.js";
import { planDefaultTacticalAction } from "./tacticalActionPlanning.js";

const event = (eventType, ownership, data = {}, actorId = data.actorId ?? null) => ({
  eventType, actorId, generationId: ownership.generationId, combatSession: ownership.combatSession,
  pulseIndex: ownership.pulseIndex, cycleIndex: ownership.cycleIndex,
  data: { generationId: ownership.generationId, combatSession: ownership.combatSession, pulseIndex: ownership.pulseIndex, cycleIndex: ownership.cycleIndex, ...data },
});
const actorIdOf = (actor) => String(getCombatActorId(actor) ?? "");
const staminaOf = (actor) => Number(actor?.currentStamina ?? actor?.currentstamina ?? actor?.stamina ?? 0) || 0;
const canAct = (actor) => Boolean(actor && !actor.dead && !actor.isDead && !actor.unconscious && !actor.isUnconscious && !actor.defeated && !actor.isDefeated && actor.canAct !== false);
const positionOf = (value) => {
  const x = Number(value?.x ?? value?.position?.x ?? value?.hex?.x);
  const y = Number(value?.y ?? value?.position?.y ?? value?.hex?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
};

export function getTacticalInitiativePriority(actor = {}) {
  const initiativeTotal = Number(
    actor.currentInitiativeTotal ?? actor.initiativeTotal ?? actor.currentInitiative ?? actor.initiative ?? 0,
  ) || 0;
  const rankValue = Number(actor.currentInitiativeRank ?? actor.initiativeRank);
  return {
    initiativeTotal,
    initiativeRank: Number.isFinite(rankValue) ? rankValue : Number.POSITIVE_INFINITY,
  };
}

const MAX_COMPLETED_OWNERSHIP_HISTORY = 12;

export function createTacticalPulseRuntime({ generationId = 0, combatSession = 0, clock = createTacticalPulseClock() } = {}) {
  return {
    generationId: Number(generationId),
    combatSession: Number(combatSession),
    clock,
    ownership: null,
    completedOwnershipKeys: new Set(),
    staminaChargeKeys: new Set(),
    actionRuntime: createTacticalActionRuntime({ generationId, combatSession }),
  };
}

export function defaultTacticalPulseStaminaSpend({ actor, amount } = {}) {
  const previousStamina = staminaOf(actor);
  if (previousStamina < amount) return { accepted: false, reason: "insufficient-stamina", previousStamina, nextStamina: previousStamina, spent: 0, updated: actor };
  const nextStamina = previousStamina - amount;
  return { accepted: true, previousStamina, nextStamina, spent: amount, updated: { ...actor, currentStamina: nextStamina, currentstamina: nextStamina, stamina: nextStamina } };
}

const ownershipKey = (owner) => `${owner.generationId}:${owner.combatSession}:${owner.pulseIndex}:${owner.cycleIndex}`;
const ownsCurrentPulse = (runtime, owner) => Boolean(
  owner && runtime.generationId === owner.generationId && runtime.combatSession === owner.combatSession && runtime.ownership === owner,
);

export async function resolveTacticalPulse({
  runtime,
  fighters = [],
  positions = {},
  committedPositions = positions,
  planIntent = planDefaultTacticalMovement,
  planActionIntent = planDefaultTacticalAction,
  isCombatCapable = canAct,
  isHexLegal,
  spendStamina = defaultTacticalPulseStaminaSpend,
  commitPosition,
  readPositionAuthorities,
  validateActionIntent,
  executeCanonicalAttack,
  spendCanonicalAmmunition,
  combatActive = true,
  getInitiativePriority = getTacticalInitiativePriority,
  transitionClock = transitionTacticalPulseClock,
  completeClock = completeTacticalPulseClock,
  abortClock = abortTacticalPulseClock,
  commitInternalPosition = commitPositionAuthoritySnapshot,
  onEvent,
} = {}) {
  if (!runtime || runtime.ownership) return { accepted: false, reason: "pulse-ownership-overlap", events: [] };
  const ownerResult = createTacticalPulseOwnership({ clock: runtime.clock, generationId: runtime.generationId, combatSession: runtime.combatSession });
  if (!ownerResult.accepted) return { accepted: false, reason: ownerResult.reason, events: [] };
  const owner = ownerResult.ownership;
  const key = ownershipKey(owner);
  if (runtime.completedOwnershipKeys.has(key)) return { accepted: false, reason: "duplicate-pulse-callback", events: [] };
  runtime.staminaChargeKeys.clear();
  runtime.ownership = owner;
  const events = [];
  const emit = (entry) => { events.push(entry); onEvent?.(entry); };
  emit(event("tactical-pulse-started", owner, { state: "planning" }));
  const maturedRecovery = completeTacticalRecoveryBoundaries({
    runtime: runtime.actionRuntime,
    pulseIndex: owner.pulseIndex,
    onEvent: (entry) => emit(event(entry.eventType, owner, entry.data, entry.actorId)),
  });
  if (!maturedRecovery.accepted) {
    runtime.ownership = null;
    return { accepted: false, reason: maturedRecovery.reason, events };
  }
  let state = {
    fighters: fighters.map((actor) => ({ ...actor })),
    positions: Object.fromEntries(Object.entries(positions).map(([id, value]) => [id, { ...value }])),
    committedPositions: Object.fromEntries(Object.entries(committedPositions).map(([id, value]) => [id, { ...value }])),
  };
  const snapshot = Object.freeze({
    fighters: Object.freeze(state.fighters.map((actor) => Object.freeze({ ...actor }))),
    positions: Object.freeze(Object.fromEntries(Object.entries(state.positions).map(([id, value]) => [id, Object.freeze({ ...value })]))),
  });
  const intents = new Map();
  const actionIntentsCreated = [];
  const abortPulse = (reason, details = {}) => {
    for (const action of actionIntentsCreated) {
      cancelTacticalAction(runtime.actionRuntime, action.actorId, reason);
    }
    for (const intent of intents.values()) {
      if (!["completed", "blocked", "canceled", "expired"].includes(intent.state)) {
        intent.state = "canceled";
        emit(event("tactical-movement-intent-canceled", owner, {
          actorId: intent.actorId,
          intentId: intent.intentId,
          reason,
        }, intent.actorId));
      }
    }
    const aborted = abortClock(runtime.clock);
    if (aborted?.accepted) runtime.clock = aborted.clock;
    runtime.staminaChargeKeys.clear();
    if (runtime.ownership === owner) runtime.ownership = null;
    emit(event("tactical-pulse-aborted", owner, {
      reason,
      state: runtime.clock?.state,
      elapsedSeconds: runtime.clock?.elapsedSeconds,
      ...details,
    }));
    return {
      accepted: false,
      reason,
      ownership: owner,
      clock: runtime.clock,
      events,
      intents: [...intents.values()],
    };
  };
  const transitionTo = (nextState) => {
    const transition = transitionClock(runtime.clock, nextState);
    if (!transition?.accepted) {
      return abortPulse(transition?.reason || "invalid-pulse-state-transition", { requestedState: nextState });
    }
    runtime.clock = transition.clock;
    return null;
  };
  try {
    for (const actor of snapshot.fighters.filter(isCombatCapable)) {
      const actorId = actorIdOf(actor);
      const actionOwnership = getTacticalActorOwnership(runtime.actionRuntime, actorId);
      let createdAction = null;
      let actionPlan = null;
      if (actionOwnership.state === "unowned") {
        actionPlan = await planActionIntent?.({
          actor,
          fighters: snapshot.fighters,
          positions: snapshot.positions,
          pulseIndex: owner.pulseIndex,
          generationId: owner.generationId,
          combatSession: owner.combatSession,
        });
        if (actionPlan?.accepted && actionPlan.intent) {
          const registered = registerTacticalAction(runtime.actionRuntime, actionPlan.intent, {
            releaseRequested: actionPlan.releaseRequested !== false,
          });
          if (registered.accepted) {
            createdAction = registered.intent;
            actionIntentsCreated.push(createdAction);
            emit(event("tactical-action-intent-created", owner, { ...createdAction }, actorId));
            emit(event("tactical-action-preparation-started", owner, {
              ...createdAction,
              previousState: "planned",
              nextState: "preparing",
            }, actorId));
          } else {
            emit(event("tactical-action-intent-rejected", owner, {
              actorId,
              reason: registered.reason,
            }, actorId));
          }
        }
      }
      const busyWithAction = createdAction || actionOwnership.state !== "unowned";
      const manualHold = actionPlan?.forceHold === true;
      const planned = (busyWithAction || manualHold)
        ? createTacticalMovementIntent({
          intentId: `${owner.generationId}:${owner.pulseIndex}:${actorId}:movement`,
          generationId: owner.generationId,
          actorId,
          mode: "hold",
          reason: createdAction ? "attack-preparation" : manualHold ? "manual-hold" : `action-${actionOwnership.state}`,
          targetActorId: createdAction?.targetActorId || actionOwnership.action?.targetActorId || null,
          createdAtPulse: owner.pulseIndex,
        })
        : await planIntent({ actor, fighters: snapshot.fighters, positions: snapshot.positions, pulseIndex: owner.pulseIndex, generationId: owner.generationId, isHexLegal });
      const result = planned?.intent ? planned : createTacticalMovementIntent(planned || {});
      if (!result?.accepted) continue;
      const intent = result.intent;
      const occupied = new Set(Object.entries(snapshot.positions).filter(([id]) => id !== actorId).map(([, value]) => tacticalHexKey(value)));
      const validity = intent.mode === "hold" ? { valid: true } : validateTacticalMovementPath({ from: snapshot.positions[actorId], path: intent.path, occupied, isHexLegal, allowOccupiedDestination: true });
      if (!validity.valid) {
        emit(event("tactical-step-blocked", owner, { actorId, intentId: intent.intentId, reason: validity.reason }, actorId));
        continue;
      }
      intents.set(actorId, { ...intent });
      emit(event("tactical-movement-intent-created", owner, { ...intent }, actorId));
      if (planned?.attackOpportunity) emit(event("tactical-attack-opportunity-detected", owner, { actorId, targetActorId: intent.targetActorId, intentId: intent.intentId }, actorId));
    }
    emit(event("tactical-pulse-planning-completed", owner, { eligibleActorCount: snapshot.fighters.filter(isCombatCapable).length, intentCount: intents.size }));
    let rejectedLifecycle = transitionTo(TACTICAL_PULSE_STATES.INTENTIONS_LOCKED);
    if (rejectedLifecycle) return rejectedLifecycle;
    for (const intent of intents.values()) {
      intent.state = "active";
      emit(event("tactical-movement-intent-locked", owner, { ...intent }, intent.actorId));
    }
    rejectedLifecycle = transitionTo(TACTICAL_PULSE_STATES.MOVEMENT_RESOLVING);
    if (rejectedLifecycle) return rejectedLifecycle;

    for (const [actorId, intent] of intents) {
      const index = state.fighters.findIndex((actor) => actorIdOf(actor) === actorId);
      const actor = state.fighters[index];
      const downgrade = downgradeTacticalMovementMode({ mode: intent.mode, currentStamina: staminaOf(actor), pathLength: intent.path.length });
      if (downgrade.downgraded) {
        emit(event("tactical-movement-mode-downgraded", owner, { actorId, intentId: intent.intentId, requestedMode: intent.mode, movementMode: downgrade.mode, reason: downgrade.reason }, actorId));
        intent.mode = downgrade.mode;
      }
      const amount = TACTICAL_STAMINA_PER_PULSE[intent.mode];
      const chargeKey = `${key}:${actorId}`;
      if (amount === 0) {
        emit(event("tactical-movement-stamina-evaluated", owner, {
          actorId, intentId: intent.intentId, movementMode: intent.mode, amount, chargeKey,
          result: "zero-cost",
        }, actorId));
        continue;
      }
      if (!runtime.staminaChargeKeys.has(chargeKey)) {
        runtime.staminaChargeKeys.add(chargeKey);
        emit(event("tactical-movement-stamina-spend-requested", owner, {
          actorId, intentId: intent.intentId, movementMode: intent.mode, amount, chargeKey,
        }, actorId));
        const spent = await spendStamina({ actor, actorId, amount, pulseIndex: owner.pulseIndex, movementMode: intent.mode, intentId: intent.intentId });
        if (spent?.accepted === false) {
          intent.mode = intent.path.length ? "walk" : "hold";
          emit(event("tactical-movement-stamina-spend-rejected", owner, {
            actorId, intentId: intent.intentId, movementMode: intent.mode, amount, chargeKey,
            reason: spent.reason || "stamina-rejected",
          }, actorId));
          emit(event("tactical-movement-mode-downgraded", owner, { actorId, intentId: intent.intentId, requestedMode: downgrade.mode, movementMode: intent.mode, reason: spent.reason || "stamina-rejected" }, actorId));
        } else {
          emit(event("tactical-movement-stamina-spend-resolved", owner, {
            actorId, intentId: intent.intentId, movementMode: intent.mode, amount,
            spent: Number(spent?.spent || 0), previousStamina: spent?.previousStamina ?? null,
            nextStamina: spent?.nextStamina ?? null, chargeKey,
          }, actorId));
          if (spent?.updated && index >= 0) state.fighters[index] = spent.updated;
        }
      }
    }

    const movedActorIds = new Set();
    for (let stepPass = 1; stepPass <= 3; stepPass += 1) {
      if (!ownsCurrentPulse(runtime, owner)) return abortPulse("stale-pulse-ownership");
      const proposals = [];
      for (const [actorId, intent] of intents) {
        if (intent.state !== "active" || stepPass > TACTICAL_HEXES_PER_PULSE[intent.mode]) continue;
        const from = state.positions[actorId];
        const to = intent.path[intent.nextStepIndex];
        if (!from || !to) { intent.state = "completed"; continue; }
        const proposal = { actorId, intent, from: { ...from }, to: { ...to }, stepPass };
        proposals.push(proposal);
        emit(event("tactical-step-proposed", owner, { actorId, intentId: intent.intentId, from: proposal.from, to: proposal.to, movementMode: intent.mode, stepPass }, actorId));
      }
      const claims = new Map();
      for (const proposal of proposals) {
        const claimKey = tacticalHexKey(proposal.to);
        if (!claims.has(claimKey)) claims.set(claimKey, []);
        claims.get(claimKey).push(proposal);
      }
      const occupiedBy = new Map(Object.entries(state.positions).map(([id, value]) => [tacticalHexKey(value), id]));
      const accepted = [];
      for (const [claimKey, candidates] of claims) {
        const occupantId = occupiedBy.get(claimKey);
        const swapping = candidates.some((candidate) => {
          if (!occupantId || occupantId === candidate.actorId) return false;
          const occupantProposal = proposals.find((proposal) => proposal.actorId === occupantId);
          return !occupantProposal || tacticalHexKey(occupantProposal.to) === tacticalHexKey(candidate.from);
        });
        candidates.sort((left, right) => {
          const leftActor = state.fighters.find((actor) => actorIdOf(actor) === left.actorId);
          const rightActor = state.fighters.find((actor) => actorIdOf(actor) === right.actorId);
          const leftInitiative = getInitiativePriority(leftActor);
          const rightInitiative = getInitiativePriority(rightActor);
          return rightInitiative.initiativeTotal - leftInitiative.initiativeTotal
            || leftInitiative.initiativeRank - rightInitiative.initiativeRank
            || TACTICAL_MOVEMENT_PRIORITY[right.intent.mode] - TACTICAL_MOVEMENT_PRIORITY[left.intent.mode]
            || left.actorId.localeCompare(right.actorId);
        });
        const winner = swapping ? null : candidates[0];
        if (candidates.length > 1 || swapping) emit(event("tactical-step-conflict", owner, { destination: candidates[0].to, stepPass, claimantActorIds: candidates.map((candidate) => candidate.actorId), winnerActorId: winner?.actorId || null, reason: swapping ? "occupied-or-hostile-swap" : "contested-destination" }));
        for (const candidate of candidates) {
          if (candidate === winner) accepted.push(candidate);
          else {
            candidate.intent.state = "blocked";
            emit(event("tactical-step-blocked", owner, { actorId: candidate.actorId, intentId: candidate.intent.intentId, from: candidate.from, to: candidate.to, movementMode: candidate.intent.mode, stepPass, reason: swapping ? "occupied-or-hostile-swap" : "contested-destination" }, candidate.actorId));
          }
        }
      }
      for (const proposal of accepted) {
        if (!ownsCurrentPulse(runtime, owner)) return abortPulse("stale-generation-step-blocked");
        emit(event("tactical-step-accepted", owner, { actorId: proposal.actorId, intentId: proposal.intent.intentId, from: proposal.from, to: proposal.to, movementMode: proposal.intent.mode, stepPass }, proposal.actorId));
        const internal = commitInternalPosition({ ...state, actorId: proposal.actorId, position: proposal.to });
        if (!internal?.accepted) {
          emit(event("tactical-step-commit-rejected", owner, {
            actorId: proposal.actorId,
            intentId: proposal.intent.intentId,
            reason: internal?.reason || "internal-position-commit-rejected",
            stepPass,
          }, proposal.actorId));
          return abortPulse(internal?.reason || "internal-position-commit-rejected");
        }
        state = { fighters: internal.fighters, positions: internal.positions, committedPositions: internal.committedPositions };
        const external = await commitPosition?.({ actorId: proposal.actorId, from: proposal.from, to: proposal.to, movementMode: proposal.intent.mode, pulseIndex: owner.pulseIndex, stepPass, intentId: proposal.intent.intentId, ownership: owner });
        if (external?.accepted === false) return abortPulse(external.reason || "external-position-commit-rejected");
        proposal.intent.nextStepIndex += 1;
        movedActorIds.add(proposal.actorId);
        emit(event("tactical-step-committed", owner, { actorId: proposal.actorId, intentId: proposal.intent.intentId, from: proposal.from, to: proposal.to, movementMode: proposal.intent.mode, stepPass, animationDurationMs: TACTICAL_ANIMATION_DURATION_MS[proposal.intent.mode], path: proposal.intent.path }, proposal.actorId));
        if (proposal.intent.nextStepIndex >= proposal.intent.path.length) proposal.intent.state = "completed";
      }
    }
    for (const intent of intents.values()) {
      if (intent.state === "active") intent.state = intent.nextStepIndex > 0 ? "completed" : "blocked";
      if (intent.state === "completed") emit(event("tactical-movement-intent-completed", owner, { ...intent }, intent.actorId));
    }
    rejectedLifecycle = transitionTo(TACTICAL_PULSE_STATES.ACTION_PREPARATION);
    if (rejectedLifecycle) return rejectedLifecycle;
    const actionProgress = await advanceTacticalActionRuntime({
      runtime: runtime.actionRuntime,
      pulseIndex: owner.pulseIndex,
      fighters: state.fighters,
      combatActive,
      validateAction: validateActionIntent,
      executeCanonicalAttack,
      spendCanonicalAmmunition,
      onEvent: (entry) => emit(event(entry.eventType, owner, entry.data, entry.actorId)),
    });
    if (!actionProgress.accepted) return abortPulse(actionProgress.reason || "tactical-action-progress-rejected");
    rejectedLifecycle = transitionTo(TACTICAL_PULSE_STATES.ACTIONS_READY);
    if (rejectedLifecycle) return rejectedLifecycle;
    rejectedLifecycle = transitionTo(TACTICAL_PULSE_STATES.ATTACK_RESOLVING);
    if (rejectedLifecycle) return rejectedLifecycle;
    rejectedLifecycle = transitionTo(TACTICAL_PULSE_STATES.REACTIONS_PENDING);
    if (rejectedLifecycle) return rejectedLifecycle;
    const audits = [];
    for (const actorId of movedActorIds) {
      const actor = state.fighters.find((candidate) => actorIdOf(candidate) === actorId);
      if (typeof readPositionAuthorities === "function") {
        const authorities = await readPositionAuthorities({ actorId, ownership: owner });
        const fighterPosition = positionOf(authorities?.fighterPosition);
        const positionsRefPosition = positionOf(authorities?.positionsRefPosition);
        const renderedStatePosition = positionOf(authorities?.renderedStatePosition);
        const committedPosition = positionOf(authorities?.committedPosition);
        const candidates = [fighterPosition, positionsRefPosition, renderedStatePosition, committedPosition];
        const matches = Boolean(committedPosition) && candidates.every((candidate) => (
          candidate?.x === committedPosition.x && candidate?.y === committedPosition.y
        ));
        audits.push({ actorId, authorityScope: "external", fighterPosition, positionsRefPosition, renderedStatePosition, committedPosition, matches });
      } else {
        const resolverFighterPosition = positionOf(actor);
        const resolverPosition = positionOf(state.positions[actorId]);
        const resolverCommittedPosition = positionOf(state.committedPositions[actorId]);
        const matches = Boolean(resolverCommittedPosition) && [resolverFighterPosition, resolverPosition].every((candidate) => (
          candidate?.x === resolverCommittedPosition.x && candidate?.y === resolverCommittedPosition.y
        ));
        audits.push({ actorId, authorityScope: "resolver-internal", resolverFighterPosition, resolverPosition, resolverCommittedPosition, matches });
      }
    }
    emit(event("tactical-pulse-position-authority-audit", owner, {
      movedActorCount: movedActorIds.size,
      authorityScope: typeof readPositionAuthorities === "function" ? "external" : "resolver-internal",
      matches: audits.every((audit) => audit.matches),
      actors: audits,
    }));
    rejectedLifecycle = transitionTo(TACTICAL_PULSE_STATES.COMPLETED);
    if (rejectedLifecycle) return rejectedLifecycle;
    const completed = completeClock(runtime.clock);
    if (!completed?.accepted) return abortPulse(completed?.reason || "pulse-not-completed");
    runtime.clock = completed.clock;
    runtime.completedOwnershipKeys.add(key);
    while (runtime.completedOwnershipKeys.size > MAX_COMPLETED_OWNERSHIP_HISTORY) {
      runtime.completedOwnershipKeys.delete(runtime.completedOwnershipKeys.values().next().value);
    }
    runtime.staminaChargeKeys.clear();
    emit(event("tactical-pulse-completed", owner, { elapsedSeconds: runtime.clock.elapsedSeconds, completedPulseIndex: runtime.clock.pulseIndex, nextCycleIndex: runtime.clock.cycleIndex }));
    return { accepted: true, ownership: owner, clock: runtime.clock, fighters: state.fighters, positions: state.positions, committedPositions: state.committedPositions, intents: [...intents.values()], actionIntents: actionIntentsCreated, actionAudit: actionProgress.audit, events, movedActorIds: [...movedActorIds] };
  } catch (error) {
    return abortPulse("tactical-pulse-execution-threw", {
      errorName: error?.name || "Error",
      errorMessage: error?.message || String(error),
    });
  } finally {
    if (runtime.ownership === owner) runtime.ownership = null;
  }
}
