import assert from "node:assert/strict";
import {
  createTacticalReactionRuntime,
  openTacticalReactionWindow,
  progressTacticalReactionWindows,
  submitTacticalReactionResponse,
} from "../src/utils/combat/tacticalReactionWindow.js";
import { fighter, reactionIntent } from "./tactical-reaction-test-helpers.mjs";

const fighters = [fighter("attacker", "party"), fighter("defender", "enemy", { controlMode: "manual" })];
const runtime = createTacticalReactionRuntime({ generationId: 1, combatSession: 1 });
const opened = openTacticalReactionWindow({ runtime, intent: reactionIntent(), executionKey: "manual:1", pulseIndex: 4, fighters, getControlMode: (actor) => actor.controlMode });
assert.equal(opened.manual, true);
assert.equal(opened.window.selectedPrimaryResponse, null);
progressTacticalReactionWindows({ runtime, pulseIndex: 4, fighters });
assert.equal(runtime.activeWindows.get(opened.window.reactionWindowId).state, "awaiting-responses");
const submitted = submitTacticalReactionResponse({ runtime, reactionWindowId: opened.window.reactionWindowId, responderId: "defender", responseType: "dodge", pulseIndex: 4, expected: { generationId: 1, combatSession: 1, sourceActionIntentId: "reaction-attack" } });
assert.equal(submitted.accepted, true);
assert.equal(submitTacticalReactionResponse({ runtime, reactionWindowId: opened.window.reactionWindowId, responderId: "defender", responseType: "parry", pulseIndex: 4 }).reason, "duplicate-reaction-response");
progressTacticalReactionWindows({ runtime, pulseIndex: 5, fighters });
assert.equal(runtime.activeWindows.get(opened.window.reactionWindowId).state, "locked");
assert.equal(submitTacticalReactionResponse({ runtime, reactionWindowId: opened.window.reactionWindowId, responderId: "defender", responseType: "decline", pulseIndex: 5 }).reason, "reaction-window-not-awaiting-responses");

const boundaryRuntime = createTacticalReactionRuntime({ generationId: 1, combatSession: 1 });
const boundary = openTacticalReactionWindow({ runtime: boundaryRuntime, intent: reactionIntent({ actionIntentId: "deadline-boundary" }), executionKey: "manual:deadline", pulseIndex: 6, fighters, getControlMode: (actor) => actor.controlMode });
assert.equal(boundary.window.responseDeadlinePulse, 7);
assert.equal(submitTacticalReactionResponse({ runtime: boundaryRuntime, reactionWindowId: boundary.window.reactionWindowId, responderId: "defender", responseType: "parry", pulseIndex: 7 }).accepted, true, "response submitted exactly at P + 1 is accepted before locking");
progressTacticalReactionWindows({ runtime: boundaryRuntime, pulseIndex: 7, fighters });
assert.equal(boundaryRuntime.activeWindows.get(boundary.window.reactionWindowId).selectedPrimaryResponse.responseType, "parry");

const lateRuntime = createTacticalReactionRuntime({ generationId: 1, combatSession: 1 });
const late = openTacticalReactionWindow({ runtime: lateRuntime, intent: reactionIntent({ actionIntentId: "late-boundary" }), executionKey: "manual:late", pulseIndex: 6, fighters, getControlMode: (actor) => actor.controlMode });
assert.equal(submitTacticalReactionResponse({ runtime: lateRuntime, reactionWindowId: late.window.reactionWindowId, responderId: "defender", responseType: "parry", pulseIndex: 8 }).reason, "reaction-response-after-deadline");
console.log("tactical manual reaction tests passed");
