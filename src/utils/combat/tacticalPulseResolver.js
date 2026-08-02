import { commitPositionAuthoritySnapshot } from "./positionAuthorityAudit.js";
import {
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

const event = (eventType, ownership, data = {}, actorId = data.actorId ?? null) => ({
  eventType, actorId, generationId: ownership.generationId, combatSession: ownership.combatSession,
  pulseIndex: ownership.pulseIndex, cycleIndex: ownership.cycleIndex,
  data: { generationId: ownership.generationId, combatSession: ownership.combatSession, pulseIndex: ownership.pulseIndex, cycleIndex: ownership.cycleIndex, ...data },
});
const actorIdOf = (actor) => String(actor?.id ?? actor?._id ?? "");
const staminaOf = (actor) => Number(actor?.currentStamina ?? actor?.currentstamina ?? actor?.stamina ?? 0) || 0;
const canAct = (actor) => Boolean(actor && !actor.dead && !actor.isDead && !actor.unconscious && !actor.isUnconscious && !actor.defeated && !actor.isDefeated && actor.canAct !== false);

export function createTacticalPulseRuntime({ generationId = 0, combatSession = 0, clock = createTacticalPulseClock() } = {}) {
  return { generationId: Number(generationId), combatSession: Number(combatSession), clock, ownership: null, completedOwnershipKeys: new Set(), staminaChargeKeys: new Set() };
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
  isCombatCapable = canAct,
  isHexLegal,
  spendStamina = defaultTacticalPulseStaminaSpend,
  commitPosition,
  onEvent,
} = {}) {
  if (!runtime || runtime.ownership) return { accepted: false, reason: "pulse-ownership-overlap", events: [] };
  const ownerResult = createTacticalPulseOwnership({ clock: runtime.clock, generationId: runtime.generationId, combatSession: runtime.combatSession });
  if (!ownerResult.accepted) return { accepted: false, reason: ownerResult.reason, events: [] };
  const owner = ownerResult.ownership;
  const key = ownershipKey(owner);
  if (runtime.completedOwnershipKeys.has(key)) return { accepted: false, reason: "duplicate-pulse-callback", events: [] };
  runtime.ownership = owner;
  const events = [];
  const emit = (entry) => { events.push(entry); onEvent?.(entry); };
  emit(event("tactical-pulse-started", owner, { state: "planning" }));
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
  try {
    for (const actor of snapshot.fighters.filter(isCombatCapable)) {
      const actorId = actorIdOf(actor);
      const planned = await planIntent({ actor, fighters: snapshot.fighters, positions: snapshot.positions, pulseIndex: owner.pulseIndex, generationId: owner.generationId, isHexLegal });
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
    let transition = transitionTacticalPulseClock(runtime.clock, TACTICAL_PULSE_STATES.INTENTIONS_LOCKED);
    runtime.clock = transition.clock;
    for (const intent of intents.values()) {
      intent.state = "active";
      emit(event("tactical-movement-intent-locked", owner, { ...intent }, intent.actorId));
    }
    transition = transitionTacticalPulseClock(runtime.clock, TACTICAL_PULSE_STATES.MOVEMENT_RESOLVING);
    runtime.clock = transition.clock;

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
      if (!ownsCurrentPulse(runtime, owner)) return { accepted: false, reason: "stale-pulse-ownership", events };
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
          return (Number(rightActor?.initiative) || 0) - (Number(leftActor?.initiative) || 0)
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
        if (!ownsCurrentPulse(runtime, owner)) return { accepted: false, reason: "stale-generation-step-blocked", events };
        emit(event("tactical-step-accepted", owner, { actorId: proposal.actorId, intentId: proposal.intent.intentId, from: proposal.from, to: proposal.to, movementMode: proposal.intent.mode, stepPass }, proposal.actorId));
        const internal = commitPositionAuthoritySnapshot({ ...state, actorId: proposal.actorId, position: proposal.to });
        if (!internal.accepted) continue;
        state = { fighters: internal.fighters, positions: internal.positions, committedPositions: internal.committedPositions };
        const external = await commitPosition?.({ actorId: proposal.actorId, from: proposal.from, to: proposal.to, movementMode: proposal.intent.mode, pulseIndex: owner.pulseIndex, stepPass, intentId: proposal.intent.intentId, ownership: owner });
        if (external?.accepted === false) return { accepted: false, reason: external.reason || "external-position-commit-rejected", events };
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
    transition = transitionTacticalPulseClock(runtime.clock, TACTICAL_PULSE_STATES.REACTIONS_PENDING);
    runtime.clock = transition.clock;
    const audits = [...movedActorIds].map((actorId) => {
      const actor = state.fighters.find((candidate) => actorIdOf(candidate) === actorId);
      const expected = state.committedPositions[actorId];
      const fighterPosition = actor?.position || { x: actor?.x, y: actor?.y };
      const refPosition = state.positions[actorId];
      const matches = [fighterPosition, refPosition].every((candidate) => candidate?.x === expected?.x && candidate?.y === expected?.y);
      return { actorId, committedPosition: expected, fighterPosition, positionsRefPosition: refPosition, statePosition: refPosition, matches };
    });
    emit(event("tactical-pulse-position-authority-audit", owner, { movedActorCount: movedActorIds.size, matches: audits.every((audit) => audit.matches), actors: audits }));
    transition = transitionTacticalPulseClock(runtime.clock, TACTICAL_PULSE_STATES.COMPLETED);
    runtime.clock = transition.clock;
    const completed = completeTacticalPulseClock(runtime.clock);
    runtime.clock = completed.clock;
    runtime.completedOwnershipKeys.add(key);
    emit(event("tactical-pulse-completed", owner, { elapsedSeconds: runtime.clock.elapsedSeconds, completedPulseIndex: runtime.clock.pulseIndex, nextCycleIndex: runtime.clock.cycleIndex }));
    return { accepted: true, ownership: owner, clock: runtime.clock, fighters: state.fighters, positions: state.positions, committedPositions: state.committedPositions, intents: [...intents.values()], events, movedActorIds: [...movedActorIds] };
  } finally {
    if (runtime.ownership === owner) runtime.ownership = null;
  }
}
