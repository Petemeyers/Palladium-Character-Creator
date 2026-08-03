import assert from "node:assert/strict";
import {
  auditTacticalChargeBraceOwnership,
  completeTacticalChargeStep,
  createTacticalChargeBraceRuntime,
  progressTacticalChargeBracePreparation,
  registerTacticalBrace,
  registerTacticalCharge,
  resolveTacticalChargeContacts,
  resolveTacticalChargeStepBoundary,
} from "../src/utils/combat/tacticalChargeBraceRuntime.js";

export { assert };
export const spear = Object.freeze({
  id: "weapon.spear",
  weaponId: "weapon.spear",
  name: "Spear",
  reachFeet: 10,
  chargeCapabilities: { canCharge: true, minimumCommittedSteps: 2, maximumStepsPerPulse: 3 },
  braceCapabilities: { canBrace: true, interceptionReachHexes: 2 },
});
export const sword = Object.freeze({ id: "weapon.sword", name: "Sword", reachFeet: 5 });

export function actor(id, team, position, weapon = spear, extra = {}) {
  return {
    id, name: id, team, position, x: position.x, y: position.y,
    currentHP: 20, currentStamina: 20, maxStamina: 20, canAct: true,
    controlMode: "ai", currentInitiativeTotal: 10, currentInitiativeRank: 1,
    heldItems: { mainHand: weapon.id }, weaponProfiles: [weapon], attacks: [weapon],
    grappleState: { state: "neutral", opponent: null }, ...extra,
  };
}

export function setup({ manualBrace = false, secondBracer = false } = {}) {
  const runtime = createTacticalChargeBraceRuntime({ generationId: 1, combatSession: 2 });
  const events = [];
  const charger = actor("charger", "party", { x: 0, y: 0 }, spear, { currentInitiativeTotal: 12 });
  const target = actor("bracer", "enemy", { x: 3, y: 0 }, spear, { controlMode: manualBrace ? "manual" : "ai", currentInitiativeTotal: 14 });
  const extra = actor("bracer-b", "enemy", { x: 3, y: 1 }, spear, { currentInitiativeTotal: 9, currentInitiativeRank: 2 });
  const fighters = secondBracer ? [charger, target, extra] : [charger, target];
  const positions = Object.fromEntries(fighters.map((entry) => [entry.id, entry.position]));
  const charge = registerTacticalCharge(runtime, {
    generationId: 1, combatSession: 2, chargerId: charger.id, targetActorId: target.id,
    weaponId: spear.id, weapon: spear, declaredAtPulse: 1,
    plannedPath: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
    startingPosition: charger.position, intendedContactPosition: { x: 2, y: 0 },
  }, { fighters });
  assert.equal(charge.accepted, true);
  events.push(...charge.events);
  const brace = registerTacticalBrace(runtime, {
    generationId: 1, combatSession: 2, bracingActorId: target.id, targetActorId: charger.id,
    weaponId: spear.id, weapon: spear, declaredAtPulse: 1,
    anchorPosition: target.position, guardedHexes: [{ x: 2, y: 0 }],
    guardedApproachVectors: [{ x: 1, y: 0 }],
  }, { fighters });
  assert.equal(brace.accepted, true);
  events.push(...brace.events);
  if (secondBracer) {
    const secondBrace = registerTacticalBrace(runtime, {
      generationId: 1, combatSession: 2, bracingActorId: extra.id, targetActorId: charger.id,
      weaponId: spear.id, weapon: spear, declaredAtPulse: 1,
      anchorPosition: extra.position, guardedHexes: [{ x: 2, y: 0 }],
      guardedApproachVectors: [{ x: 1, y: 0 }],
    }, { fighters });
    assert.equal(secondBrace.accepted, true);
    events.push(...secondBrace.events);
  }
  const progressed = progressTacticalChargeBracePreparation({ runtime, pulseIndex: 2, fighters, positions, onEvent: (entry) => events.push(entry) });
  assert.equal(progressed.accepted, true);
  return { runtime, charger, target, extra, fighters, positions, events };
}

export async function takeStep(context, { from, to, result = { accepted: true, hit: false }, pulseIndex = 2, controlMode, aiChoice, authoritativePosition } = {}) {
  const { runtime, fighters, events } = context;
  const charge = runtime.chargesByActor.get("charger");
  events.push({ eventType: "tactical-charge-step-proposed", actorId: charge.chargerId, data: { chargeIntentId: charge.chargeIntentId, actionIntentId: charge.actionIntentId, pulseIndex, pathStepIndex: charge.completedPath.length, from, to } });
  let canonicalCalls = 0;
  const boundary = await resolveTacticalChargeStepBoundary({
    runtime, charge, from, to, stepIndex: charge.completedPath.length, pulseIndex, fighters,
    getInterceptionControlMode: controlMode ? () => controlMode : undefined,
    selectAIInterception: aiChoice ? () => aiChoice : undefined,
    executeCanonicalAttack: async (request) => { canonicalCalls += 1; return { ...result, request }; },
    readCanonicalPosition: authoritativePosition ? () => authoritativePosition : undefined,
    onEvent: (entry) => events.push(entry),
  });
  if (boundary.accepted && boundary.commitStep) {
    const completed = completeTacticalChargeStep({ runtime, actorId: "charger", from, to,
      stepIndex: runtime.chargesByActor.get("charger").completedPath.length,
      stepClaimKey: boundary.stepClaimKey, movementClaim: boundary.movementClaim,
      pulseIndex, onEvent: (entry) => events.push(entry) });
    assert.equal(completed.accepted, true);
  }
  if (!boundary.accepted || !boundary.commitStep) events.push({ eventType: "tactical-charge-step-blocked", actorId: charge.chargerId, data: { chargeIntentId: charge.chargeIntentId, pulseIndex, from, to, reason: boundary.reason || boundary.continuation?.reason || (boundary.pendingInterception ? "interception-choice-pending" : "charge-stopped-before-step") } });
  return { boundary, canonicalCalls };
}

export async function resolveContact(context, result = { accepted: true, hit: true }) {
  let calls = 0;
  const resolved = await resolveTacticalChargeContacts({
    runtime: context.runtime, pulseIndex: 2, fighters: context.fighters,
    executeCanonicalAttack: async (request) => { calls += 1; return { ...result, request }; },
    onEvent: (entry) => context.events.push(entry),
  });
  return { resolved, calls };
}

export const count = (events, type) => events.filter((entry) => entry.eventType === type).length;
export { auditTacticalChargeBraceOwnership };
