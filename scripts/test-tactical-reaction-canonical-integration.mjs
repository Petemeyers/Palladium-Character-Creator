import assert from "node:assert/strict";
import { createTacticalActionIntent } from "../src/utils/combat/tacticalActionIntent.js";
import { advanceTacticalActionRuntime, createTacticalActionRuntime, registerTacticalAction } from "../src/utils/combat/tacticalActionRuntime.js";
import { submitTacticalReactionResponse } from "../src/utils/combat/tacticalReactionWindow.js";
import { fighter, shield } from "./tactical-reaction-test-helpers.mjs";

async function resolveWith(responseType, { ranged = false, shielded = false } = {}) {
  const runtime = createTacticalActionRuntime({ generationId: 1, combatSession: 1 });
  const defender = fighter("defender", "enemy", {
    controlMode: "manual",
    hasShield: shielded,
    weaponSlots: { rightHand: { id: "sword", name: "Sword", canParry: true }, leftHand: shielded ? shield : null },
  });
  const fighters = [fighter("attacker", "party"), defender];
  const intent = createTacticalActionIntent({
    actionIntentId: `integration-${responseType}`,
    generationId: 1,
    combatSession: 1,
    actorId: "attacker",
    targetActorId: "defender",
    weaponId: ranged ? "longbow" : "longsword",
    actionType: ranged ? "ranged-attack" : "melee-attack",
    timingKey: "daggerAttack",
    createdAtPulse: 1,
  }).intent;
  registerTacticalAction(runtime, intent);
  const admissions = [];
  let ammunitionCallbacks = 0;
  const events = [];
  const advance = (pulseIndex) => advanceTacticalActionRuntime({
    runtime,
    pulseIndex,
    fighters,
    getReactionControlMode: (actor) => actor.controlMode,
    spendCanonicalAmmunition: () => { ammunitionCallbacks += 1; return { accepted: true, spent: 1, projectileAuthorized: true }; },
    executeCanonicalAttack: (admission) => {
      admissions.push(admission);
      return {
        accepted: true,
        ammunitionSpent: ranged ? 1 : 0,
        projectileReleased: ranged,
        defenseResult: admission.reactionAdmission.responseType === "parry"
          ? Object.freeze({ parryAttempted: true, parrySucceeded: true, parryQuality: "parry_dominant", dominant: true })
          : null,
      };
    },
    onEvent: (event) => events.push(event),
  });
  await advance(2);
  const window = [...runtime.reactionRuntime.activeWindows.values()][0];
  assert.ok(window, "reaction window opens before canonical execution");
  assert.equal(admissions.length, 0);
  assert.equal(submitTacticalReactionResponse({ runtime: runtime.reactionRuntime, reactionWindowId: window.reactionWindowId, responderId: "defender", responseType, pulseIndex: 2 }).accepted, true);
  await advance(3);
  return { runtime, admissions, ammunitionCallbacks, events };
}

for (const [responseType, options] of [["dodge", {}], ["parry", {}], ["shield-block", { shielded: true }], ["decline", {}]]) {
  const result = await resolveWith(responseType, options);
  assert.equal(result.admissions.length, 1);
  assert.equal(result.admissions[0].reactionAdmission.responseType, responseType);
  assert.equal(Object.isFrozen(result.admissions[0].reactionAdmission), true);
  assert.equal(result.admissions[0].reactionAdmission.responderId, "defender");
  assert.equal(result.admissions[0].reactionAdmission.protectedActorId, "defender");
  if (responseType === "parry") {
    assert.equal(result.runtime.reactionRuntime.terminalHistory.at(-1).resolution.defenseResult.parryQuality, "parry_dominant");
  }
}
const ranged = await resolveWith("dodge", { ranged: true });
assert.equal(ranged.ammunitionCallbacks, 1, "ammunition admission occurs exactly once across the reaction window");
assert.equal(ranged.runtime.ammunitionReleaseKeys.size, 1, "projectile release identity is claimed exactly once");
const rangedOrder = ranged.events.map((event) => event.eventType);
assert.ok(rangedOrder.indexOf("tactical-attack-resolution-admitted") < rangedOrder.indexOf("tactical-ranged-release"));
assert.ok(rangedOrder.indexOf("tactical-ranged-release") < rangedOrder.indexOf("tactical-reaction-window-created"));
const releaseEvent = ranged.events.find((event) => event.eventType === "tactical-ranged-release");
const windowEvent = ranged.events.find((event) => event.eventType === "tactical-reaction-window-created");
assert.equal(releaseEvent.data.executionKey, windowEvent.data.sourceExecutionKey, "projectile and reaction window share the source execution key");

const thrownRuntime = createTacticalActionRuntime({ generationId: 1, combatSession: 1 });
const thrownIntent = createTacticalActionIntent({ actionIntentId: "ranged-throw", generationId: 1, combatSession: 1, actorId: "attacker", targetActorId: "defender", weaponId: "longbow", actionType: "ranged-attack", timingKey: "daggerAttack", createdAtPulse: 1 }).intent;
registerTacticalAction(thrownRuntime, thrownIntent);
const thrownFighters = [fighter("attacker", "party"), fighter("defender", "enemy")];
let thrownAmmo = 0;
const thrownAdvance = (pulseIndex) => advanceTacticalActionRuntime({
  runtime: thrownRuntime,
  pulseIndex,
  fighters: thrownFighters,
  spendCanonicalAmmunition: () => { thrownAmmo += 1; return { accepted: true, spent: 1, projectileAuthorized: true }; },
  executeCanonicalAttack: () => { throw new Error("canonical adapter failed"); },
});
await thrownAdvance(2);
await thrownAdvance(3);
assert.equal(thrownAmmo, 1, "adapter failure does not refund or duplicate an already released projectile");
assert.equal(thrownRuntime.ammunitionReleaseKeys.size, 1);
assert.equal(thrownRuntime.reactionRuntime.activeWindows.size, 0);
assert.equal(thrownRuntime.recoveryByActor.size, 0);
assert.equal(thrownRuntime.terminalHistory.at(-1).invalidationReason, "canonical-attack-callback-threw");
console.log("tactical reaction canonical integration tests passed");
