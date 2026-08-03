import assert from "node:assert/strict";
import {
  cleanupTacticalReactionRuntime,
  createTacticalReactionRuntime,
  openTacticalReactionWindow,
  progressTacticalReactionWindows,
  submitTacticalReactionResponse,
} from "../src/utils/combat/tacticalReactionWindow.js";
import { fighter, reactionIntent } from "./tactical-reaction-test-helpers.mjs";

const runtime = createTacticalReactionRuntime({ generationId: 1, combatSession: 1 });
const fighters = [fighter("attacker", "party"), fighter("defender", "enemy", { controlMode: "manual" })];
const opened = openTacticalReactionWindow({ runtime, intent: reactionIntent(), executionKey: "cleanup:1", pulseIndex: 1, fighters, getControlMode: (actor) => actor.controlMode });
const cleanup = cleanupTacticalReactionRuntime(runtime, "combat-ended", { pulseIndex: 1 });
assert.equal(cleanup.accepted, true);
assert.equal(cleanup.data.openWindowCount, 1);
assert.equal(cleanup.data.awaitingResponseCount, 1);
assert.equal(cleanup.data.matches, true);
assert.equal(runtime.activeWindows.size, 0);
assert.equal(runtime.responderOwnership.size, 0);
assert.equal(submitTacticalReactionResponse({ runtime, reactionWindowId: opened.window.reactionWindowId, responderId: "defender", responseType: "decline", pulseIndex: 2 }).reason, "tactical-reaction-runtime-closed");
assert.equal(runtime.postTerminalResponsesBlocked, 1);
assert.equal(progressTacticalReactionWindows({ runtime, pulseIndex: 2, fighters, combatActive: false }).reason, "tactical-reaction-runtime-closed");
assert.equal(cleanupTacticalReactionRuntime(runtime).reason, "tactical-reaction-cleanup-already-completed");

const staleRuntime = createTacticalReactionRuntime({ generationId: 2, combatSession: 3 });
assert.equal(openTacticalReactionWindow({ runtime: staleRuntime, intent: reactionIntent({ generationId: 1, combatSession: 3 }), executionKey: "stale:g", pulseIndex: 1, fighters }).reason, "stale-generation");
assert.equal(openTacticalReactionWindow({ runtime: staleRuntime, intent: reactionIntent({ generationId: 2, combatSession: 2 }), executionKey: "stale:s", pulseIndex: 1, fighters }).reason, "stale-combat-session");
for (const terminalActor of ["attacker", "defender"]) {
  const terminalRuntime = createTacticalReactionRuntime({ generationId: 1, combatSession: 1 });
  const terminalFighters = [fighter("attacker", "party"), fighter("defender", "enemy", { controlMode: "manual" })];
  const terminalWindow = openTacticalReactionWindow({ runtime: terminalRuntime, intent: reactionIntent(), executionKey: `terminal:${terminalActor}`, pulseIndex: 1, fighters: terminalFighters, getControlMode: (actor) => actor.controlMode });
  const endedFighters = terminalFighters.map((actor) => actor.id === terminalActor ? { ...actor, currentHP: 0, dead: true } : actor);
  progressTacticalReactionWindows({ runtime: terminalRuntime, pulseIndex: 2, fighters: endedFighters });
  assert.equal(terminalRuntime.activeWindows.size, 0, `${terminalActor} terminal state invalidates the window`);
  assert.match(terminalRuntime.terminalHistory.at(-1).terminalReason, new RegExp(`${terminalActor}-not-combat-capable`));
  assert.equal(submitTacticalReactionResponse({ runtime: terminalRuntime, reactionWindowId: terminalWindow.window.reactionWindowId, responderId: "defender", responseType: "decline", pulseIndex: 2 }).reason, "reaction-window-not-active");
}
console.log("tactical reaction terminal cleanup tests passed");
