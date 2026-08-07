import { calculateDistance } from "../../data/movementRules.js";
import {
  buildTacticalOverwatchExecutionKey, createTacticalOverwatchIntent,
  transitionTacticalOverwatchIntent,
} from "./tacticalOverwatchIntent.js";
import {
  createTacticalOverwatchWindow, submitTacticalOverwatchChoice,
  TACTICAL_OVERWATCH_CHOICES, transitionTacticalOverwatchWindow,
} from "./tacticalOverwatchWindow.js";
import { resolveTacticalOverwatchAttack } from "./resolveTacticalOverwatchAttack.js";

const idOf = (actor) => String(actor?.id ?? actor?._id ?? actor?.actorId ?? "");
const positionOf = (actor, positions = {}) => positions[idOf(actor)] || actor?.position || actor?.hex || actor;
const keyOf = (point) => `${Number(point?.x)},${Number(point?.y)}`;
const capable = (actor) => Boolean(actor && !actor.dead && !actor.isDead && !actor.unconscious && !actor.isUnconscious && actor.conscious !== false && !actor.defeated && !actor.isDefeated && !actor.routed && actor.canAct !== false);
const terminalWindow = (window) => ["resolved", "declined", "expired", "canceled", "invalidated"].includes(window?.state);
const event = (eventType, intent, pulseIndex, data = {}) => ({ eventType, actorId: intent?.actorId || null,
  generationId: intent?.generationId, combatSession: intent?.combatSession, pulseIndex,
  data: { generationId: intent?.generationId, combatSession: intent?.combatSession, pulseIndex,
    overwatchIntentId: intent?.overwatchIntentId, actionIntentId: intent?.actionIntentId,
    actorId: intent?.actorId, weaponId: intent?.weaponId, techniqueId: intent?.techniqueId, triggerPolicy: intent?.triggerPolicy, ...data } });

const retain = (runtime, list, value, limit = runtime.maxTerminalHistory) => {
  list.push(value); while (list.length > limit) list.shift();
};
const claim = (runtime, set, order, key) => {
  if (!key || set.has(key)) return false;
  set.add(key); order.push(key);
  while (order.length > runtime.maxClaimHistory) set.delete(order.shift());
  return true;
};
const replace = (map, value) => map.set(String(value.actorId), value);
const findActor = (fighters, actorId) => fighters.find((actor) => idOf(actor) === String(actorId));

export function createTacticalOverwatchRuntime({ generationId = 0, combatSession = 0, maxTerminalHistory = 42, maxClaimHistory = 64 } = {}) {
  return {
    generationId: Number(generationId), combatSession: Number(combatSession), overwatchByActor: new Map(),
    windowsById: new Map(), windowByActor: new Map(), recoveryByActor: new Map(), terminalOverwatch: [], terminalWindows: [],
    triggerClaims: new Set(), triggerClaimOrder: [], passedEventClaims: new Set(), passedEventOrder: [],
    releaseClaims: new Set(), releaseClaimOrder: [], projectileClaims: new Set(), projectileClaimOrder: [],
    executionClaims: new Set(), executionClaimOrder: [], projectileIdentities: [],
    maxTerminalHistory: Math.max(16, Number(maxTerminalHistory) || 42), maxClaimHistory: Math.max(24, Number(maxClaimHistory) || 64),
    postTerminalReleasesBlocked: 0, postTerminalAttacksBlocked: 0, closed: false, cleanupCompleted: false, lastCleanup: null,
  };
}

export function registerTacticalOverwatch(runtime, input, { fighters = [], validateOverwatch } = {}) {
  if (!runtime) return { accepted: false, reason: "overwatch-runtime-required", events: [] };
  if (runtime.closed) { runtime.postTerminalReleasesBlocked += 1; return { accepted: false, reason: "overwatch-runtime-closed", events: [] }; }
  const created = input?.state ? { accepted: true, intent: input } : createTacticalOverwatchIntent(input);
  if (!created.accepted) return { ...created, events: [] };
  let intent = created.intent;
  if (intent.generationId !== runtime.generationId || intent.combatSession !== runtime.combatSession) return { accepted: false, reason: "stale-overwatch-coordinates", events: [] };
  if (runtime.overwatchByActor.has(intent.actorId) || runtime.recoveryByActor.has(intent.actorId)) return { accepted: false, reason: "duplicate-overwatch-ownership", events: [] };
  const actor = findActor(fighters, intent.actorId);
  if (!capable(actor)) return { accepted: false, reason: "overwatch-actor-incapable", events: [] };
  const validation = validateOverwatch?.({ intent, actor, fighters, phase: "register" });
  if (validation?.valid === false || validation?.accepted === false) return { accepted: false, reason: validation.reason || "overwatch-invalid", events: [] };
  intent = transitionTacticalOverwatchIntent(intent, "preparing").intent;
  replace(runtime.overwatchByActor, intent);
  return { accepted: true, intent, events: [event("tactical-overwatch-intent-created", intent, intent.declaredAtPulse), event("tactical-overwatch-preparation-started", intent, intent.declaredAtPulse, { previousState: "planned", nextState: "preparing" })] };
}

export function cancelTacticalOverwatch(runtime, actorId, reason = "manual-cancel") {
  const intent = runtime?.overwatchByActor.get(String(actorId));
  if (!intent) return { accepted: false, reason: "overwatch-not-found", events: [] };
  const terminal = transitionTacticalOverwatchIntent(intent, "canceled", { invalidationReason: reason }).intent;
  runtime.overwatchByActor.delete(String(actorId)); retain(runtime, runtime.terminalOverwatch, terminal);
  const windowId = runtime.windowByActor.get(String(actorId));
  if (windowId) settleWindow(runtime, runtime.windowsById.get(windowId), "canceled", reason, intent.declaredAtPulse);
  return { accepted: true, intent: terminal, events: [event("tactical-overwatch-invalidated", terminal, intent.declaredAtPulse, { terminalReason: reason })] };
}

function settleWindow(runtime, window, state, reason, pulseIndex, result = null) {
  if (!window || terminalWindow(window)) return window;
  const transitioned = transitionTacticalOverwatchWindow(window, state, { terminalReason: reason, resolvedAtPulse: Number(pulseIndex), result });
  const terminal = transitioned.accepted ? transitioned.window : window;
  runtime.windowsById.delete(window.overwatchWindowId); runtime.windowByActor.delete(window.overwatcherId);
  retain(runtime, runtime.terminalWindows, terminal); return terminal;
}

export function progressTacticalOverwatch({ runtime, pulseIndex, fighters = [], positions = {}, validateOverwatch, onEvent } = {}) {
  if (!runtime || runtime.closed) return { accepted: false, reason: "overwatch-runtime-unavailable", events: [] };
  const events = []; const emit = (entry) => { events.push(entry); onEvent?.(entry); };
  for (const [actorId, current] of [...runtime.overwatchByActor]) {
    const actor = findActor(fighters, actorId);
    const validation = capable(actor) ? validateOverwatch?.({ intent: current, actor, fighters, positions, phase: "pulse" }) : { valid: false, reason: "overwatch-actor-incapable" };
    if (!capable(actor) || validation?.valid === false || validation?.accepted === false) {
      const reason = validation?.reason || "overwatch-actor-incapable";
      const invalid = transitionTacticalOverwatchIntent(current, "invalidated", { invalidationReason: reason }).intent;
      runtime.overwatchByActor.delete(actorId); retain(runtime, runtime.terminalOverwatch, invalid);
      const windowId = runtime.windowByActor.get(actorId); if (windowId) settleWindow(runtime, runtime.windowsById.get(windowId), "invalidated", reason, pulseIndex);
      emit(event("tactical-overwatch-invalidated", invalid, pulseIndex, { previousState: current.state, nextState: "invalidated", rejectionReason: reason })); continue;
    }
    let intent = current;
    if (intent.state === "preparing" && Number(pulseIndex) < intent.readyAtPulse) emit(event("tactical-overwatch-preparation-progress", intent, pulseIndex, { readyAtPulse: intent.readyAtPulse }));
    if (intent.state === "preparing" && Number(pulseIndex) >= intent.readyAtPulse) {
      intent = transitionTacticalOverwatchIntent(intent, "ready").intent;
      emit(event("tactical-overwatch-ready", intent, pulseIndex, { previousState: "preparing", nextState: "ready" }));
      intent = transitionTacticalOverwatchIntent(intent, "held", { heldAtPulse: Number(pulseIndex) }).intent;
      emit(event("tactical-overwatch-held", intent, pulseIndex, { previousState: "ready", nextState: "held", guardedHexes: intent.guardedHexes }));
      replace(runtime.overwatchByActor, intent);
    }
    if (intent.state === "held" && Number(pulseIndex) > intent.heldAtPulse + intent.maximumHeldPulses) {
      const expired = transitionTacticalOverwatchIntent(intent, "expired", { invalidationReason: "maximum-held-duration" }).intent;
      runtime.overwatchByActor.delete(actorId); retain(runtime, runtime.terminalOverwatch, expired);
      emit(event("tactical-overwatch-invalidated", expired, pulseIndex, { terminalReason: "maximum-held-duration" }));
    }
  }
  for (const [actorId, recovery] of [...runtime.recoveryByActor]) if (Number(pulseIndex) >= recovery.recoveryUntilPulse) {
    const completed = transitionTacticalOverwatchIntent(recovery, "completed", { result: recovery.result }).intent;
    runtime.recoveryByActor.delete(actorId); retain(runtime, runtime.terminalOverwatch, completed);
    emit(event("tactical-overwatch-recovery-completed", completed, pulseIndex, { previousState: "recovering", nextState: "completed" }));
  }
  return { accepted: true, events };
}

const guarded = (intent, triggerEvent) => {
  const hexes = new Set(intent.guardedHexes.map(keyOf)); const fromKey = keyOf(triggerEvent.from); const toKey = keyOf(triggerEvent.to || triggerEvent.position);
  if (intent.guardedActors.length && !intent.guardedActors.includes(String(triggerEvent.actorId))) return false;
  if (intent.triggerPolicy === "enters-guarded-zone") return !hexes.has(fromKey) && hexes.has(toKey);
  if (intent.triggerPolicy === "crosses-guarded-edge") return intent.guardedApproachVectors.some((edge) => keyOf(edge.from) === fromKey && keyOf(edge.to) === toKey);
  if (intent.triggerPolicy === "leaves-cover") return triggerEvent.kind === "cover-change" && triggerEvent.coverBefore === true && triggerEvent.coverAfter === false;
  if (intent.triggerPolicy === "begins-charge") return triggerEvent.kind === "charge-committed";
  return false;
};

export function createAuthoritativeOverwatchTriggerEvent(input = {}) {
  if (!input.triggerEventId || !input.actorId || input.authoritative !== true) return { accepted: false, reason: "authoritative-overwatch-trigger-required" };
  return { accepted: true, triggerEvent: Object.freeze({ ...input, triggerEventId: String(input.triggerEventId), actorId: String(input.actorId), pulseIndex: Number(input.pulseIndex), authoritative: true }) };
}

export function detectTacticalOverwatchTriggers({ runtime, triggerEvent, fighters = [], positions = {}, validateTrigger, getControlMode = (actor) => actor?.controlMode || "ai", selectAIResponse = selectDeterministicOverwatchAIResponse, onEvent } = {}) {
  if (!runtime || runtime.closed || !triggerEvent?.authoritative) return { accepted: false, reason: "authoritative-overwatch-trigger-required", events: [] };
  const events = []; const emit = (entry) => { events.push(entry); onEvent?.(entry); }; const target = findActor(fighters, triggerEvent.actorId);
  const candidates = [];
  for (const intent of runtime.overwatchByActor.values()) {
    if (intent.state !== "held" || runtime.windowByActor.has(intent.actorId)) continue;
    const actor = findActor(fighters, intent.actorId); const claimKey = `${intent.overwatchIntentId}:${triggerEvent.triggerEventId}`;
    const baseValid = capable(actor) && capable(target) && actor?.team !== target?.team && guarded(intent, triggerEvent) && !runtime.triggerClaims.has(claimKey) && !runtime.passedEventClaims.has(claimKey);
    const validation = baseValid ? validateTrigger?.({ intent, actor, target, triggerEvent, fighters, positions }) : null;
    if (!baseValid || validation?.valid === false || validation?.accepted === false) {
      emit(event("tactical-overwatch-trigger-rejected", intent, triggerEvent.pulseIndex, { triggerEventId: triggerEvent.triggerEventId, targetActorId: triggerEvent.actorId, rejectionReason: validation?.reason || "trigger-ineligible" })); continue;
    }
    candidates.push({ intent, actor, target, threat: Number(validation?.threat ?? target?.threatScore ?? 0), distance: Number(validation?.distance ?? calculateDistance(positionOf(actor, positions), positionOf(target, positions))) || Infinity, eventOrder: Number(triggerEvent.eventOrder) || 0 });
  }
  candidates.sort((a, b) => Number(!a.intent.guardedActors.includes(idOf(a.target))) - Number(!b.intent.guardedActors.includes(idOf(b.target))) || a.eventOrder - b.eventOrder || b.threat - a.threat || a.distance - b.distance || Number(b.target.currentInitiativeTotal || b.target.initiativeTotal || 0) - Number(a.target.currentInitiativeTotal || a.target.initiativeTotal || 0) || idOf(a.target).localeCompare(idOf(b.target)));
  const accepted = [];
  for (const candidate of candidates) {
    const claimKey = `${candidate.intent.overwatchIntentId}:${triggerEvent.triggerEventId}`;
    if (!claim(runtime, runtime.triggerClaims, runtime.triggerClaimOrder, claimKey)) continue;
    const created = createTacticalOverwatchWindow({ intent: candidate.intent, triggerEvent, targetActorId: idOf(candidate.target), pulseIndex: triggerEvent.pulseIndex });
    if (!created.accepted) continue;
    let window = created.window; runtime.windowsById.set(window.overwatchWindowId, window); runtime.windowByActor.set(candidate.intent.actorId, window.overwatchWindowId);
    let intent = transitionTacticalOverwatchIntent(candidate.intent, "triggered", { triggeredAtPulse: triggerEvent.pulseIndex, lockedTargetId: idOf(candidate.target), triggerEventId: triggerEvent.triggerEventId, triggerOwnershipKey: claimKey }).intent;
    intent = transitionTacticalOverwatchIntent(intent, "release-pending").intent; replace(runtime.overwatchByActor, intent);
    emit(event("tactical-overwatch-trigger-detected", intent, triggerEvent.pulseIndex, { triggerEventId: triggerEvent.triggerEventId, targetActorId: idOf(candidate.target), movementOwnershipKey: triggerEvent.movementOwnershipKey }));
    emit(event("tactical-overwatch-window-created", intent, triggerEvent.pulseIndex, { overwatchWindowId: window.overwatchWindowId, triggerEventId: triggerEvent.triggerEventId, targetActorId: idOf(candidate.target), responseDeadlinePulse: window.responseDeadlinePulse }));
    if (getControlMode(candidate.actor) !== "manual") {
      const choice = selectAIResponse({ intent, window, actor: candidate.actor, target: candidate.target, triggerEvent, distance: candidate.distance });
      const submitted = submitTacticalOverwatchChoice(window, { choice, pulseIndex: triggerEvent.pulseIndex });
      if (submitted.accepted) { window = submitted.window; runtime.windowsById.set(window.overwatchWindowId, window); emit(event("tactical-overwatch-choice-submitted", intent, triggerEvent.pulseIndex, { overwatchWindowId: window.overwatchWindowId, selectedResponse: choice, controlMode: "ai" })); }
    }
    accepted.push(window);
  }
  return { accepted: true, windows: accepted, events };
}

export function selectDeterministicOverwatchAIResponse({ actor, target, distance = Infinity } = {}) {
  const ammunition = Number(actor?.ammunitionState?.current ?? actor?.ammunitionRemaining ?? Infinity);
  const effectiveRange = Number(actor?.selectedAttack?.rangeProfile?.normal ?? actor?.selectedAttack?.normalRangeFeet ?? Infinity);
  if (ammunition <= 1 && Number(target?.threatScore || 0) < 5) return TACTICAL_OVERWATCH_CHOICES.LET_PASS;
  if (distance > effectiveRange) return TACTICAL_OVERWATCH_CHOICES.LET_PASS;
  return TACTICAL_OVERWATCH_CHOICES.RELEASE;
}

export function submitTacticalOverwatchResponse(runtime, input = {}) {
  const window = runtime?.windowsById.get(String(input.overwatchWindowId));
  const intent = window ? runtime.overwatchByActor.get(window.overwatcherId) : null;
  const submitted = submitTacticalOverwatchChoice(window, input);
  if (!submitted.accepted) return { ...submitted, events: [] };
  runtime.windowsById.set(window.overwatchWindowId, submitted.window);
  return { accepted: true, window: submitted.window, events: [event("tactical-overwatch-choice-submitted", intent, input.pulseIndex, { overwatchWindowId: window.overwatchWindowId, selectedResponse: input.choice, controlMode: "manual" })] };
}

export async function resolveTacticalOverwatchWindows({ runtime, pulseIndex, fighters = [], validateRelease, spendCanonicalAmmunition, executeCanonicalAttack, combatActive = true, onEvent } = {}) {
  if (!runtime || runtime.closed || !combatActive) { if (runtime) runtime.postTerminalReleasesBlocked += 1; return { accepted: false, reason: "overwatch-runtime-closed", events: [] }; }
  const events = []; const emit = (entry) => { events.push(entry); onEvent?.(entry); };
  for (const [windowId, currentWindow] of [...runtime.windowsById]) {
    let window = currentWindow; let intent = runtime.overwatchByActor.get(window.overwatcherId);
    if (!intent) { settleWindow(runtime, window, "invalidated", "overwatch-intent-missing", pulseIndex); continue; }
    if (!window.selectedResponse && Number(pulseIndex) > window.responseDeadlinePulse) {
      const claimKey = `${intent.overwatchIntentId}:${window.triggerEventId}`; claim(runtime, runtime.passedEventClaims, runtime.passedEventOrder, claimKey);
      settleWindow(runtime, window, "expired", "response-deadline-expired", pulseIndex);
      intent = transitionTacticalOverwatchIntent(intent, "held", { lockedTargetId: null, triggerEventId: null, triggerOwnershipKey: null }).intent; replace(runtime.overwatchByActor, intent);
      emit(event("tactical-overwatch-window-expired", intent, pulseIndex, { overwatchWindowId: windowId, triggerEventId: window.triggerEventId })); continue;
    }
    if (!window.selectedResponse) continue;
    if (window.selectedResponse === TACTICAL_OVERWATCH_CHOICES.LET_PASS) {
      const claimKey = `${intent.overwatchIntentId}:${window.triggerEventId}`; claim(runtime, runtime.passedEventClaims, runtime.passedEventOrder, claimKey);
      settleWindow(runtime, window, "declined", "target-passed", pulseIndex);
      intent = transitionTacticalOverwatchIntent(intent, "held", { lockedTargetId: null, triggerEventId: null, triggerOwnershipKey: null }).intent; replace(runtime.overwatchByActor, intent);
      emit(event("tactical-overwatch-target-passed", intent, pulseIndex, { overwatchWindowId: windowId, triggerEventId: window.triggerEventId })); continue;
    }
    const validation = validateRelease?.({ intent, window, actor: findActor(fighters, intent.actorId), target: findActor(fighters, window.targetActorId), fighters });
    if (validation?.valid === false || validation?.accepted === false) {
      settleWindow(runtime, window, "invalidated", validation.reason || "overwatch-release-rejected", pulseIndex);
      const invalid = transitionTacticalOverwatchIntent(intent, "invalidated", { invalidationReason: validation.reason || "overwatch-release-rejected" }).intent;
      runtime.overwatchByActor.delete(intent.actorId); retain(runtime, runtime.terminalOverwatch, invalid);
      emit(event("tactical-overwatch-release-rejected", invalid, pulseIndex, { overwatchWindowId: windowId, rejectionReason: invalid.invalidationReason })); continue;
    }
    const executionKey = buildTacticalOverwatchExecutionKey(intent, window, 1);
    if (!claim(runtime, runtime.releaseClaims, runtime.releaseClaimOrder, executionKey) || !claim(runtime, runtime.executionClaims, runtime.executionClaimOrder, executionKey)) continue;
    window = transitionTacticalOverwatchWindow(window, "locked", { lockedAtPulse: Number(pulseIndex), executionKey }).window;
    window = transitionTacticalOverwatchWindow(window, "resolving").window; runtime.windowsById.set(windowId, window);
    intent = transitionTacticalOverwatchIntent(intent, "resolving", { projectileExecutionKey: executionKey }).intent; replace(runtime.overwatchByActor, intent);
    emit(event("tactical-overwatch-window-locked", intent, pulseIndex, { overwatchWindowId: windowId, executionKey }));
    emit(event("tactical-overwatch-release-admitted", intent, pulseIndex, { overwatchWindowId: windowId, executionKey }));
    const expenditure = await spendCanonicalAmmunition?.({ actorId: intent.actorId, targetActorId: window.targetActorId, weaponId: intent.weaponId, executionKey, source: "tactical-overwatch" });
    if (!expenditure?.accepted || expenditure.projectileAuthorized === false || Number(expenditure.spent || 0) !== 1) {
      settleWindow(runtime, window, "invalidated", expenditure?.reason || "overwatch-ammunition-rejected", pulseIndex);
      const invalid = transitionTacticalOverwatchIntent(intent, "invalidated", { invalidationReason: expenditure?.reason || "overwatch-ammunition-rejected" }).intent;
      runtime.overwatchByActor.delete(intent.actorId); retain(runtime, runtime.terminalOverwatch, invalid);
      emit(event("tactical-overwatch-release-rejected", invalid, pulseIndex, { overwatchWindowId: windowId, rejectionReason: invalid.invalidationReason })); continue;
    }
    const projectileIdentity = Object.freeze({ projectileId: `${executionKey}:projectile`, executionKey, actorId: intent.actorId, targetActorId: window.targetActorId, weaponId: intent.weaponId, triggerEventId: window.triggerEventId });
    if (!claim(runtime, runtime.projectileClaims, runtime.projectileClaimOrder, projectileIdentity.projectileId)) continue;
    retain(runtime, runtime.projectileIdentities, projectileIdentity, runtime.maxClaimHistory);
    emit(event("tactical-overwatch-projectile-released", intent, pulseIndex, { overwatchWindowId: windowId, executionKey, projectileIdentity, ammunitionSpent: expenditure.spent }));
    const result = await resolveTacticalOverwatchAttack({ admission: { intent, window, executionKey, projectileIdentity }, executeCanonicalAttack });
    if (runtime.closed || !runtime.windowsById.has(windowId)) { runtime.postTerminalAttacksBlocked += 1; continue; }
    window = settleWindow(runtime, window, "resolved", "overwatch-resolved", pulseIndex, result);
    intent = transitionTacticalOverwatchIntent(intent, "released", { releasedAtPulse: Number(pulseIndex), result }).intent;
    emit(event("tactical-overwatch-resolution-completed", intent, pulseIndex, { overwatchWindowId: windowId, executionKey, result }));
    intent = transitionTacticalOverwatchIntent(intent, "recovering", { recoveryUntilPulse: Number(pulseIndex) + intent.recoveryPulses }).intent;
    runtime.overwatchByActor.delete(intent.actorId); runtime.recoveryByActor.set(intent.actorId, intent);
    emit(event("tactical-overwatch-recovery-started", intent, pulseIndex, { recoveryUntilPulse: intent.recoveryUntilPulse }));
  }
  emit({ eventType: "tactical-overwatch-ownership-audit", actorId: null, data: auditTacticalOverwatchOwnership(runtime) });
  return { accepted: true, events };
}

export function auditTacticalOverwatchOwnership(runtime) {
  const active = [...runtime.overwatchByActor.keys()];
  const overlap = active.filter((id) => runtime.recoveryByActor.has(id));
  return { preparingOverwatchCount: [...runtime.overwatchByActor.values()].filter((v) => v.state === "preparing").length,
    heldOverwatchCount: [...runtime.overwatchByActor.values()].filter((v) => v.state === "held").length,
    openOverwatchWindowCount: runtime.windowsById.size, triggerClaimCount: runtime.triggerClaims.size,
    releaseClaimCount: runtime.releaseClaims.size, projectileClaimCount: runtime.projectileClaims.size,
    recoveryCount: runtime.recoveryByActor.size, terminalOverwatchCount: runtime.terminalOverwatch.length,
    terminalWindowCount: runtime.terminalWindows.length, overlapActorIds: overlap,
    postTerminalReleasesBlocked: runtime.postTerminalReleasesBlocked, postTerminalAttacksBlocked: runtime.postTerminalAttacksBlocked,
    matches: overlap.length === 0 && runtime.windowByActor.size === runtime.windowsById.size };
}

export function cleanupTacticalOverwatchRuntime(runtime, reason = "combat-ended") {
  if (!runtime) return { accepted: false, reason: "overwatch-runtime-required" };
  if (runtime.cleanupCompleted) return { accepted: false, reason: "overwatch-cleanup-already-completed", data: runtime.lastCleanup };
  for (const intent of runtime.overwatchByActor.values()) {
    const state = intent.state === "preparing" ? "interrupted" : "invalidated";
    const terminal = transitionTacticalOverwatchIntent(intent, state, state === "interrupted" ? { interruptionReason: reason } : { invalidationReason: reason });
    if (terminal.accepted) retain(runtime, runtime.terminalOverwatch, terminal.intent);
  }
  for (const window of runtime.windowsById.values()) if (!terminalWindow(window)) retain(runtime, runtime.terminalWindows, Object.freeze({ ...window, state: "canceled", terminalReason: reason }));
  runtime.overwatchByActor.clear(); runtime.windowsById.clear(); runtime.windowByActor.clear(); runtime.recoveryByActor.clear();
  runtime.triggerClaims.clear(); runtime.triggerClaimOrder.length = 0; runtime.passedEventClaims.clear(); runtime.passedEventOrder.length = 0;
  runtime.releaseClaims.clear(); runtime.releaseClaimOrder.length = 0; runtime.projectileClaims.clear(); runtime.projectileClaimOrder.length = 0;
  runtime.executionClaims.clear(); runtime.executionClaimOrder.length = 0;
  runtime.closed = true; runtime.cleanupCompleted = true;
  runtime.lastCleanup = auditTacticalOverwatchOwnership(runtime);
  return { accepted: true, eventType: "tactical-overwatch-terminal-cleanup", data: runtime.lastCleanup };
}

export function resetTacticalOverwatchCoordinates(runtime, { generationId, combatSession } = {}) {
  const cleanup = cleanupTacticalOverwatchRuntime(runtime, "coordinate-reset");
  Object.assign(runtime, createTacticalOverwatchRuntime({ generationId, combatSession, maxTerminalHistory: runtime.maxTerminalHistory, maxClaimHistory: runtime.maxClaimHistory }));
  return cleanup;
}

export const isActorOverwatchBusy = (runtime, actorId) => Boolean(runtime?.overwatchByActor.has(String(actorId)) || runtime?.windowByActor.has(String(actorId)) || runtime?.recoveryByActor.has(String(actorId)));
