import { assert, actor, spear } from "./tactical-charge-brace-test-helpers.mjs";
import { claimTacticalChargeMovementStamina, completeTacticalChargeStep, createTacticalChargeBraceRuntime, registerTacticalCharge, auditTacticalChargeBraceOwnership, cleanupTacticalChargeBraceRuntime, invalidateTacticalCharge, progressTacticalChargeBracePreparation, resolveTacticalChargeStepBoundary } from "../src/utils/combat/tacticalChargeBraceRuntime.js";
const runtime = createTacticalChargeBraceRuntime({ generationId: 1, combatSession: 1, maxTerminalHistory: 42, maxClaimHistory: 48 }); const fighters = [];
for (let index = 0; index < 42; index += 1) { const a = actor(`a-${index}`, "party", { x: 0, y: index }); const b = actor(`b-${index}`, "enemy", { x: 3, y: index }); fighters.push(a, b); const result = registerTacticalCharge(runtime, { generationId: 1, combatSession: 1, chargerId: a.id, targetActorId: b.id, weaponId: spear.id, weapon: spear, declaredAtPulse: 1, plannedPath: [{ x: 1, y: index }, { x: 2, y: index }], startingPosition: a.position }, { fighters }); assert.equal(result.accepted, true); }
assert.equal(runtime.chargesByActor.size, 42); assert.equal(auditTacticalChargeBraceOwnership(runtime).matches, true); cleanupTacticalChargeBraceRuntime(runtime);
assert.equal(runtime.terminalCharges.length, 42); assert.equal(runtime.movementClaims.size, 0); assert.equal(runtime.triggerClaims.size, 0); assert.equal(runtime.interceptionExecutionClaims.size, 0); assert.equal(runtime.contactExecutionClaims.size, 0);
const bounded = createTacticalChargeBraceRuntime({ generationId: 5, combatSession: 6, maxTerminalHistory: 42, maxClaimHistory: 48 });
for (let index = 0; index < 60; index += 1) {
  const a = actor(`cycle-a-${index}`, "party", { x: 0, y: index }); const b = actor(`cycle-b-${index}`, "enemy", { x: 3, y: index }); const roster = [a, b];
  registerTacticalCharge(bounded, { generationId: 5, combatSession: 6, chargerId: a.id, targetActorId: b.id, weaponId: spear.id, weapon: spear, declaredAtPulse: 1, plannedPath: [{ x: 1, y: index }, { x: 2, y: index }], startingPosition: a.position }, { fighters: roster });
  progressTacticalChargeBracePreparation({ runtime: bounded, pulseIndex: 2, fighters: roster, positions: { [a.id]: a.position, [b.id]: b.position } });
  const charge = bounded.chargesByActor.get(a.id); const boundary = await resolveTacticalChargeStepBoundary({ runtime: bounded, charge, from: a.position, to: { x: 1, y: index }, stepIndex: 0, pulseIndex: 2, fighters: roster });
  completeTacticalChargeStep({ runtime: bounded, actorId: a.id, from: a.position, to: { x: 1, y: index }, stepIndex: 0, stepClaimKey: boundary.stepClaimKey, movementClaim: boundary.movementClaim, pulseIndex: 2 });
  claimTacticalChargeMovementStamina(bounded, `stamina:${index}`); invalidateTacticalCharge(bounded, a.id, "fixture-cycle-complete", 2);
}
assert.equal(bounded.terminalCharges.length, 42); assert.equal(bounded.movementClaims.size, 48); assert.equal(bounded.movementClaimRecords.size, 48); assert.equal(bounded.movementStaminaClaims.size, 48);
console.log("tactical 42 actor charge brace runtime: 52/52 passed");
