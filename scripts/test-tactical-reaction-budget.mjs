import assert from "node:assert/strict";
import {
  createTacticalReactionRuntime,
  getTacticalReactionBudget,
  lockTacticalReactionWindow,
  openTacticalReactionWindow,
  submitTacticalReactionResponse,
} from "../src/utils/combat/tacticalReactionWindow.js";
import { fighter, reactionIntent } from "./tactical-reaction-test-helpers.mjs";

const fighters = [fighter("attacker", "party"), fighter("defender", "enemy", { controlMode: "manual" })];
const runtime = createTacticalReactionRuntime({ generationId: 1, combatSession: 1 });
const first = openTacticalReactionWindow({ runtime, intent: reactionIntent(), executionKey: "budget:1", pulseIndex: 1, fighters, getControlMode: (actor) => actor.controlMode });
assert.equal(submitTacticalReactionResponse({ runtime, reactionWindowId: first.window.reactionWindowId, responderId: "defender", responseType: "parry", pulseIndex: 1 }).accepted, true);
assert.equal(getTacticalReactionBudget(runtime, "defender", 1).remaining, 1, "submission does not consume before lock");
assert.equal(lockTacticalReactionWindow({ runtime, reactionWindowId: first.window.reactionWindowId, pulseIndex: 2 }).accepted, true);
assert.equal(getTacticalReactionBudget(runtime, "defender", 2).remaining, 0);
assert.equal(lockTacticalReactionWindow({ runtime, reactionWindowId: first.window.reactionWindowId, pulseIndex: 2 }).reason, "reaction-window-not-awaiting-responses");

const runtime2 = createTacticalReactionRuntime({ generationId: 1, combatSession: 1 });
const declined = openTacticalReactionWindow({ runtime: runtime2, intent: reactionIntent(), executionKey: "budget:decline", pulseIndex: 1, fighters, getControlMode: (actor) => actor.controlMode });
submitTacticalReactionResponse({ runtime: runtime2, reactionWindowId: declined.window.reactionWindowId, responderId: "defender", responseType: "decline", pulseIndex: 1 });
lockTacticalReactionWindow({ runtime: runtime2, reactionWindowId: declined.window.reactionWindowId, pulseIndex: 2 });
assert.equal(getTacticalReactionBudget(runtime2, "defender", 2).remaining, 1, "decline does not consume budget");
assert.equal(getTacticalReactionBudget(runtime, "defender", 7).remaining, 1, "budget resets once at the next six-pulse cycle");

const rolloverRuntime = createTacticalReactionRuntime({ generationId: 1, combatSession: 1 });
const rollover = openTacticalReactionWindow({ runtime: rolloverRuntime, intent: reactionIntent({ actionIntentId: "cycle-rollover" }), executionKey: "budget:rollover", pulseIndex: 6, fighters, getControlMode: (actor) => actor.controlMode });
submitTacticalReactionResponse({ runtime: rolloverRuntime, reactionWindowId: rollover.window.reactionWindowId, responderId: "defender", responseType: "parry", pulseIndex: 6 });
const selectedIdentity = rolloverRuntime.activeWindows.get(rollover.window.reactionWindowId).selectedPrimaryResponse.reactionResponseId;
lockTacticalReactionWindow({ runtime: rolloverRuntime, reactionWindowId: rollover.window.reactionWindowId, pulseIndex: 7 });
assert.equal(getTacticalReactionBudget(rolloverRuntime, "defender", 6).remaining, 0, "pulse-6 response consumes the one-based cycle-1 budget");
assert.equal(getTacticalReactionBudget(rolloverRuntime, "defender", 7).remaining, 1, "cycle 2 starts at pulse 7 with a fresh budget");
assert.equal(rolloverRuntime.activeWindows.get(rollover.window.reactionWindowId).selectedPrimaryResponse.reactionResponseId, selectedIdentity, "cycle reset does not alter a locked response");
console.log("tactical reaction budget tests passed");
