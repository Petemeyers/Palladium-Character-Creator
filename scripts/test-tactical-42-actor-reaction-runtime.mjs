import assert from "node:assert/strict";
import {
  auditTacticalReactionOwnership,
  createTacticalReactionRuntime,
  invalidateTacticalReactionWindow,
  openTacticalReactionWindow,
  submitTacticalReactionResponse,
} from "../src/utils/combat/tacticalReactionWindow.js";
import { fighter, reactionIntent } from "./tactical-reaction-test-helpers.mjs";

const runtime = createTacticalReactionRuntime({ generationId: 1, combatSession: 1, maxTerminalHistory: 16 });
const fighters = [];
for (let index = 0; index < 21; index += 1) {
  fighters.push(fighter(`party-${index}`, "party"), fighter(`enemy-${index}`, "enemy", { controlMode: "manual" }));
}
for (let index = 0; index < 21; index += 1) {
  const opened = openTacticalReactionWindow({
    runtime,
    intent: reactionIntent({ actionIntentId: `mass-${index}`, actorId: `party-${index}`, targetActorId: `enemy-${index}` }),
    executionKey: `mass-execution-${index}`,
    pulseIndex: 1,
    fighters,
    getControlMode: (actor) => actor.controlMode,
  });
  assert.equal(opened.accepted, true);
}
const audit = auditTacticalReactionOwnership(runtime);
assert.equal(audit.openWindowCount, 21);
assert.equal(audit.responderOwnershipCount, 21);
assert.equal(audit.matches, true);
assert.equal(new Set([...runtime.activeWindows.values()].map((window) => window.reactionWindowId)).size, 21);
for (const window of [...runtime.activeWindows.values()]) {
  submitTacticalReactionResponse({ runtime, reactionWindowId: window.reactionWindowId, responderId: window.primaryTargetId, responseType: "decline", pulseIndex: 1 });
  invalidateTacticalReactionWindow({ runtime, reactionWindowId: window.reactionWindowId, pulseIndex: 2, reason: "history-test" });
}
assert.equal(runtime.terminalHistory.length, 16, "reaction terminal history remains bounded");
assert.equal(runtime.responseHistory.length, 16, "reaction response history remains bounded");
console.log("tactical 42 actor reaction runtime tests passed");
