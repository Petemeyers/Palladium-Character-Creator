import assert from "node:assert/strict";
import {
  auditTacticalOverwatchOwnership, cleanupTacticalOverwatchRuntime, createAuthoritativeOverwatchTriggerEvent,
  createTacticalOverwatchRuntime, detectTacticalOverwatchTriggers, progressTacticalOverwatch,
  registerTacticalOverwatch, resolveTacticalOverwatchWindows, selectDeterministicOverwatchAIResponse,
  submitTacticalOverwatchResponse,
} from "../src/utils/combat/tacticalOverwatchRuntime.js";
import { getOverwatchCapabilities } from "../src/utils/combat/tacticalOverwatchIntent.js";

export const bow = Object.freeze({ id: "weapon.longbow", weaponId: "weapon.longbow", name: "Longbow", weaponFamily: "longbow", isRanged: true,
  rangeProfile: { normal: 150, long: 600 }, ammunitionType: "arrow", ammunitionPerAttack: 1,
  overwatchCapabilities: { canOverwatch: true, supportedTriggerPolicies: ["enters-guarded-zone", "crosses-guarded-edge", "leaves-cover", "begins-charge"], maximumHeldPulses: 6, maximumGuardedHexes: 12 } });
export const crossbow = Object.freeze({ ...bow, id: "weapon.crossbow", weaponId: "weapon.crossbow", name: "Crossbow", weaponFamily: "crossbow", ammunitionType: "bolt",
  overwatchCapabilities: { ...bow.overwatchCapabilities, requiresLoadedState: true } });
export const actor = (id, team, controlMode = "ai", weapon = bow) => ({ id, name: id, team, controlMode, currentHP: 20, currentStamina: 20,
  position: { x: id === "ow" ? 0 : 3, y: 0 }, attacks: [weapon], weaponProfiles: [weapon], selectedAttack: weapon,
  ammunitionState: { weaponId: weapon.id, ammunitionType: weapon.ammunitionType, current: 6, chambered: weapon.weaponFamily === "crossbow", reloadState: weapon.weaponFamily === "crossbow" ? "loaded" : "ready" } });

export function makeContext({ controlMode = "manual", weapon = bow, policy = "enters-guarded-zone", guardedHexes = [{ x: 2, y: 0 }], guardedActors = [], vectors = [] } = {}) {
  const overwatcher = actor("ow", "party", controlMode, weapon); const target = actor("target", "enemy");
  const runtime = createTacticalOverwatchRuntime({ generationId: 1, combatSession: 2, maxTerminalHistory: 42, maxClaimHistory: 48 });
  const input = { overwatchIntentId: "ow-intent", actionIntentId: "action-intent", generationId: 1, combatSession: 2,
    actorId: "ow", weaponId: weapon.id, weapon, timingKey: weapon.weaponFamily === "crossbow" ? "loadedCrossbowShot" : "longbowRushedShot",
    declaredAtPulse: 1, triggerPolicy: policy, guardedHexes, guardedActors, guardedApproachVectors: vectors, maximumHeldPulses: 6 };
  return { runtime, overwatcher, target, fighters: [overwatcher, target], positions: { ow: { x: 0, y: 0 }, target: { x: 3, y: 0 } }, input };
}

export function hold(context, pulse = 3, validateOverwatch) {
  const registration = registerTacticalOverwatch(context.runtime, context.input, { fighters: context.fighters, validateOverwatch });
  assert.equal(registration.accepted, true);
  const progressed = progressTacticalOverwatch({ runtime: context.runtime, pulseIndex: pulse, fighters: context.fighters, positions: context.positions, validateOverwatch });
  assert.equal(progressed.accepted, true);
  return context.runtime.overwatchByActor.get("ow");
}

export function movementEvent({ id = "move-1", from = { x: 3, y: 0 }, to = { x: 2, y: 0 }, actorId = "target", pulse = 3, kind = "movement-committed", authoritative = true, extra = {} } = {}) {
  return createAuthoritativeOverwatchTriggerEvent({ triggerEventId: id, generationId: 1, combatSession: 2, pulseIndex: pulse,
    kind, actorId, from, to, movementOwnershipKey: `movement:${id}`, authoritative, ...extra });
}

export function detect(context, triggerEvent, options = {}) {
  return detectTacticalOverwatchTriggers({ runtime: context.runtime, triggerEvent, fighters: context.fighters, positions: context.positions,
    getControlMode: (fighter) => fighter.controlMode, ...options });
}

export async function runLifecycleSuite() {
  const context = makeContext(); let ammoCalls = 0;
  const registered = registerTacticalOverwatch(context.runtime, context.input, { fighters: context.fighters });
  assert.equal(registered.accepted, true); assert.equal(context.runtime.overwatchByActor.get("ow").state, "preparing"); assert.equal(ammoCalls, 0);
  progressTacticalOverwatch({ runtime: context.runtime, pulseIndex: 1, fighters: context.fighters, positions: context.positions });
  assert.equal(context.runtime.overwatchByActor.get("ow").state, "preparing");
  progressTacticalOverwatch({ runtime: context.runtime, pulseIndex: 2, fighters: context.fighters, positions: context.positions });
  assert.equal(context.runtime.overwatchByActor.get("ow").state, "preparing");
  progressTacticalOverwatch({ runtime: context.runtime, pulseIndex: 3, fighters: context.fighters, positions: context.positions });
  const held = context.runtime.overwatchByActor.get("ow"); assert.equal(held.state, "held"); assert.equal(held.readyAtPulse, 3); assert.equal(ammoCalls, 0);
  assert.equal(Object.isFrozen(held.guardedHexes), true); assert.equal(Object.isFrozen(held.guardedHexes[0]), true);
  assert.equal(registerTacticalOverwatch(context.runtime, { ...context.input, overwatchIntentId: "duplicate" }, { fighters: context.fighters }).accepted, false);
  const changedWeapon = context.fighters.map((fighter) => fighter.id === "ow" ? { ...fighter, attacks: [], weaponProfiles: [] } : fighter);
  progressTacticalOverwatch({ runtime: context.runtime, pulseIndex: 4, fighters: changedWeapon, positions: context.positions,
    validateOverwatch: ({ actor: current }) => ({ valid: current.attacks.length > 0, reason: "held-weapon-changed" }) });
  assert.equal(context.runtime.overwatchByActor.size, 0); assert.equal(context.runtime.terminalOverwatch.at(-1).invalidationReason, "held-weapon-changed");
  const incapable = makeContext(); hold(incapable); incapable.fighters[0] = { ...incapable.overwatcher, unconscious: true };
  progressTacticalOverwatch({ runtime: incapable.runtime, pulseIndex: 4, fighters: incapable.fighters, positions: incapable.positions });
  assert.equal(incapable.runtime.overwatchByActor.size, 0);
  const empty = makeContext(); hold(empty); empty.fighters[0] = { ...empty.overwatcher, ammunitionState: { ...empty.overwatcher.ammunitionState, current: 0 } };
  progressTacticalOverwatch({ runtime: empty.runtime, pulseIndex: 4, fighters: empty.fighters, positions: empty.positions,
    validateOverwatch: ({ actor: current }) => ({ valid: current.ammunitionState.current > 0, reason: "ammunition-empty" }) });
  assert.equal(empty.runtime.terminalOverwatch.at(-1).invalidationReason, "ammunition-empty");
  const duration = makeContext(); hold(duration); progressTacticalOverwatch({ runtime: duration.runtime, pulseIndex: 10, fighters: duration.fighters, positions: duration.positions });
  assert.equal(duration.runtime.terminalOverwatch.at(-1).state, "expired");
  assert.equal(getOverwatchCapabilities({}).canOverwatch, false);
  return 13;
}

export async function runGeometrySuite() {
  const inside = makeContext(); hold(inside);
  assert.equal(detect(inside, movementEvent().triggerEvent).windows.length, 1);
  assert.equal(detect(inside, movementEvent().triggerEvent).windows.length, 0);
  const proposed = makeContext(); hold(proposed); assert.equal(detect(proposed, { ...movementEvent({ authoritative: false }).triggerEvent, authoritative: false }).accepted, false);
  const friendly = makeContext(); friendly.target.team = "party"; hold(friendly); assert.equal(detect(friendly, movementEvent().triggerEvent).windows.length, 0);
  const outside = makeContext(); hold(outside); assert.equal(detect(outside, movementEvent({ to: { x: 4, y: 0 } }).triggerEvent).windows.length, 0);
  const edge = makeContext({ policy: "crosses-guarded-edge", guardedHexes: [], vectors: [{ from: { x: 3, y: 0 }, to: { x: 2, y: 0 } }] }); hold(edge);
  assert.equal(detect(edge, movementEvent().triggerEvent).windows.length, 1);
  const cover = makeContext({ policy: "leaves-cover", guardedHexes: [], guardedActors: ["target"] }); hold(cover);
  assert.equal(detect(cover, movementEvent({ kind: "cover-change", extra: { coverBefore: true, coverAfter: false } }).triggerEvent).windows.length, 1);
  const charge = makeContext({ policy: "begins-charge", guardedHexes: [] }); hold(charge);
  assert.equal(detect(charge, movementEvent({ kind: "charge-committed" }).triggerEvent).windows.length, 1);
  const run = makeContext({ policy: "begins-charge", guardedHexes: [] }); hold(run);
  assert.equal(detect(run, movementEvent({ kind: "movement-committed", extra: { movementMode: "run" } }).triggerEvent).windows.length, 0);
  return 9;
}

export async function runSelectionSuite() {
  const manual = makeContext(); hold(manual); const window = detect(manual, movementEvent().triggerEvent).windows[0];
  assert.equal(manual.runtime.windowsById.get(window.overwatchWindowId).selectedResponse, null);
  assert.equal(submitTacticalOverwatchResponse(manual.runtime, { overwatchWindowId: window.overwatchWindowId, overwatcherId: "ow", choice: "release", pulseIndex: 4 }).accepted, true);
  const pass = makeContext(); hold(pass); const passWindow = detect(pass, movementEvent({ id: "pass" }).triggerEvent).windows[0];
  submitTacticalOverwatchResponse(pass.runtime, { overwatchWindowId: passWindow.overwatchWindowId, choice: "let-pass", pulseIndex: 3 });
  await resolveTacticalOverwatchWindows({ runtime: pass.runtime, pulseIndex: 3, fighters: pass.fighters });
  assert.equal(pass.runtime.overwatchByActor.get("ow").state, "held"); assert.equal(pass.runtime.projectileClaims.size, 0);
  assert.equal(detect(pass, movementEvent({ id: "pass" }).triggerEvent).windows.length, 0);
  const expiry = makeContext(); hold(expiry); detect(expiry, movementEvent({ id: "expire" }).triggerEvent);
  await resolveTacticalOverwatchWindows({ runtime: expiry.runtime, pulseIndex: 5, fighters: expiry.fighters });
  assert.equal(expiry.runtime.overwatchByActor.get("ow").state, "held"); assert.equal(expiry.runtime.projectileClaims.size, 0);
  assert.equal(selectDeterministicOverwatchAIResponse({ actor: { ammunitionState: { current: 1 } }, target: { threatScore: 1 }, distance: 10 }), "let-pass");
  assert.equal(selectDeterministicOverwatchAIResponse({ actor: { ammunitionState: { current: 5 } }, target: { threatScore: 9 }, distance: 10 }), "release");
  return 10;
}

export async function runReleaseSuite({ hit = false } = {}) {
  const context = makeContext({ controlMode: "ai" }); hold(context); let ammunition = 6; let ammoCalls = 0; let attackCalls = 0; let defenseWindows = 0;
  detect(context, movementEvent().triggerEvent, { selectAIResponse: () => "release" });
  const result = await resolveTacticalOverwatchWindows({ runtime: context.runtime, pulseIndex: 3, fighters: context.fighters,
    validateRelease: () => ({ valid: true }),
    spendCanonicalAmmunition: ({ executionKey }) => { ammoCalls += 1; ammunition -= 1; return { accepted: true, projectileAuthorized: true, spent: 1, executionKey }; },
    executeCanonicalAttack: (admission) => { attackCalls += 1; defenseWindows += 1; return { accepted: true, hit, projectileReleased: true, defensiveReactionWindow: true, admission }; } });
  assert.equal(result.accepted, true); assert.equal(ammoCalls, 1); assert.equal(ammunition, 5); assert.equal(attackCalls, 1); assert.equal(defenseWindows, 1);
  assert.equal(context.runtime.projectileClaims.size, 1); assert.match(context.runtime.projectileIdentities[0].executionKey, /^tactical-overwatch:/);
  await resolveTacticalOverwatchWindows({ runtime: context.runtime, pulseIndex: 3, fighters: context.fighters });
  assert.equal(ammoCalls, 1); assert.equal(attackCalls, 1);
  assert.equal(context.runtime.recoveryByActor.get("ow").state, "recovering");
  progressTacticalOverwatch({ runtime: context.runtime, pulseIndex: 4, fighters: context.fighters, positions: context.positions });
  assert.equal(context.runtime.recoveryByActor.size, 0);
  return 10;
}

export async function runCrossbowAndCleanupSuite() {
  const loaded = makeContext({ weapon: crossbow }); hold(loaded, 2, ({ actor: current }) => ({ valid: current.ammunitionState.chambered && current.ammunitionState.reloadState === "loaded", reason: "crossbow-not-loaded" }));
  assert.equal(loaded.runtime.overwatchByActor.get("ow").state, "held");
  const unloaded = makeContext({ weapon: crossbow }); unloaded.fighters[0] = { ...unloaded.overwatcher, ammunitionState: { ...unloaded.overwatcher.ammunitionState, chambered: false, reloadState: "reload-required" } };
  assert.equal(registerTacticalOverwatch(unloaded.runtime, unloaded.input, { fighters: unloaded.fighters, validateOverwatch: ({ actor: current }) => ({ valid: current.ammunitionState.chambered, reason: "crossbow-not-loaded" }) }).accepted, false);
  const cleanup = cleanupTacticalOverwatchRuntime(loaded.runtime); assert.equal(cleanup.accepted, true); assert.equal(cleanup.data.matches, true);
  assert.equal(cleanup.data.triggerClaimCount, 0); assert.equal(cleanup.data.releaseClaimCount, 0); assert.equal(cleanup.data.projectileClaimCount, 0);
  assert.equal(cleanupTacticalOverwatchRuntime(loaded.runtime).accepted, false);
  const delayed = await resolveTacticalOverwatchWindows({ runtime: loaded.runtime, pulseIndex: 4, fighters: loaded.fighters }); assert.equal(delayed.accepted, false); assert.equal(loaded.runtime.postTerminalReleasesBlocked, 1);
  return 9;
}

export async function runScaleSuite() {
  const runtime = createTacticalOverwatchRuntime({ generationId: 1, combatSession: 2, maxTerminalHistory: 42, maxClaimHistory: 48 });
  const fighters = [];
  for (let index = 0; index < 42; index += 1) { const current = actor(`ow-${index}`, "party"); fighters.push(current); const registered = registerTacticalOverwatch(runtime, { ...makeContext().input, overwatchIntentId: `intent-${index}`, actionIntentId: `action-${index}`, actorId: current.id }, { fighters }); assert.equal(registered.accepted, true); }
  assert.equal(runtime.overwatchByActor.size, 42); assert.equal(new Set([...runtime.overwatchByActor.keys()]).size, 42);
  progressTacticalOverwatch({ runtime, pulseIndex: 3, fighters, positions: {} });
  assert.equal(auditTacticalOverwatchOwnership(runtime).matches, true);
  cleanupTacticalOverwatchRuntime(runtime); assert.ok(runtime.terminalOverwatch.length <= 42);
  return 4;
}

export async function runAllOverwatchSuites() {
  return (await runLifecycleSuite()) + (await runGeometrySuite()) + (await runSelectionSuite()) +
    (await runReleaseSuite()) + (await runReleaseSuite({ hit: true })) + (await runCrossbowAndCleanupSuite()) + (await runScaleSuite());
}
