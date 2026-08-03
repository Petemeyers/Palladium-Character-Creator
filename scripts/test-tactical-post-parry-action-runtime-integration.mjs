import assert from "node:assert/strict";
import { createTacticalActionIntent } from "../src/utils/combat/tacticalActionIntent.js";
import { advanceTacticalActionRuntime, createTacticalActionRuntime, getTacticalActorOwnership, registerTacticalAction } from "../src/utils/combat/tacticalActionRuntime.js";
import { getTacticalReactionBudget, submitTacticalReactionResponse } from "../src/utils/combat/tacticalReactionWindow.js";
import { submitTacticalPostParryResponse } from "../src/utils/combat/tacticalPostParryWindow.js";
import { fighter } from "./tactical-reaction-test-helpers.mjs";
import { offer } from "./tactical-post-parry-test-helpers.mjs";

const runtime = createTacticalActionRuntime({ generationId: 1, combatSession: 1 });
const roster = [fighter("attacker", "party"), fighter("defender", "enemy", { controlMode: "manual" })];
const intent = createTacticalActionIntent({ actionIntentId: "post-parry-action", generationId: 1, combatSession: 1, actorId: "attacker", targetActorId: "defender", weaponId: "longsword", actionType: "melee-attack", timingKey: "daggerAttack", createdAtPulse: 5 }).intent;
registerTacticalAction(runtime, intent);
let postExecutions = 0;
const events = [];
const advance = (pulseIndex) => advanceTacticalActionRuntime({
  runtime,
  pulseIndex,
  fighters: roster,
  getReactionControlMode: (actor) => actor.controlMode,
  getPostParryControlMode: () => "manual",
  executeCanonicalAttack: (admission) => ({ accepted: true, defenseResult: { generationId: 1, combatSession: 1, reactionWindowId: admission.reactionAdmission.reactionWindowId, reactionResponseId: admission.reactionAdmission.reactionResponseId, responderId: "defender", sourceDefenderId: "defender", sourceAttackerId: "attacker", sourceActionIntentId: intent.actionIntentId, sourceExecutionKey: admission.executionKey, sourceWeaponId: "longsword", parryingWeaponId: "longsword", defenseType: "weapon", parryAttempted: true, parrySucceeded: true, parryQuality: "parry_dominant" } }),
  createCanonicalPostParryOffer: ({ executionKey }) => ({ accepted: true, canonicalOffer: offer("parry_dominant", { opportunityId: "runtime-offer", reactionId: "runtime-offer", sourceAttackExecutionKey: executionKey }) }),
  validatePostParryResponse: () => ({ valid: true }),
  executeCanonicalPostParryResponse: () => { postExecutions += 1; return { accepted: true }; },
  onEvent: (event) => events.push(event),
});
await advance(6);
const reactionWindow = [...runtime.reactionRuntime.activeWindows.values()][0];
assert.equal(submitTacticalReactionResponse({ runtime: runtime.reactionRuntime, reactionWindowId: reactionWindow.reactionWindowId, responderId: "defender", responseType: "parry", pulseIndex: 6 }).accepted, true);
await advance(7);
const postWindow = [...runtime.postParryRuntime.activeWindows.values()][0];
assert.ok(postWindow, "canonical defense result opens post-parry window after attack completion");
assert.equal(getTacticalActorOwnership(runtime, "defender").state, "post-parry-response");
assert.equal(getTacticalActorOwnership(runtime, "attacker").state, "recovering");
assert.equal(getTacticalReactionBudget(runtime.reactionRuntime, "defender", 6).remaining, 0);
assert.equal(getTacticalReactionBudget(runtime.reactionRuntime, "defender", 7).remaining, 1, "new cycle budget resets independently");
assert.equal(submitTacticalPostParryResponse({ runtime: runtime.postParryRuntime, tacticalPostParryWindowId: postWindow.tacticalPostParryWindowId, responderId: "defender", responseType: "bind", pulseIndex: 7 }).accepted, true);
await advance(8);
assert.equal(postExecutions, 1);
assert.equal(getTacticalReactionBudget(runtime.reactionRuntime, "defender", 7).remaining, 1, "post-parry execution consumes no defensive budget");
assert.equal(events.filter((event) => event.eventType === "tactical-post-parry-resolution-completed").length, 1);
console.log("tactical post-parry action runtime integration tests passed");
