import assert from "node:assert/strict";
import {
  admitTacticalReactionResolution,
  createTacticalReactionRuntime,
  lockTacticalReactionWindow,
  openTacticalReactionWindow,
  submitTacticalReactionResponse,
} from "../src/utils/combat/tacticalReactionWindow.js";
import { fighter, reactionIntent } from "./tactical-reaction-test-helpers.mjs";

const runtime = createTacticalReactionRuntime({ generationId: 1, combatSession: 1 });
const fighters = [fighter("attacker", "party"), fighter("defender", "enemy", { controlMode: "manual" })];
const opened = openTacticalReactionWindow({ runtime, intent: reactionIntent(), executionKey: "idem:1", pulseIndex: 1, fighters, getControlMode: (actor) => actor.controlMode });
assert.equal(submitTacticalReactionResponse({ runtime, reactionWindowId: opened.window.reactionWindowId, responderId: "defender", responseType: "parry", pulseIndex: 1 }).accepted, true);
assert.equal(submitTacticalReactionResponse({ runtime, reactionWindowId: opened.window.reactionWindowId, responderId: "defender", responseType: "parry", pulseIndex: 1 }).reason, "duplicate-reaction-response");
lockTacticalReactionWindow({ runtime, reactionWindowId: opened.window.reactionWindowId, pulseIndex: 2 });
assert.equal(submitTacticalReactionResponse({ runtime, reactionWindowId: opened.window.reactionWindowId, responderId: "defender", responseType: "decline", pulseIndex: 2 }).reason, "reaction-window-not-awaiting-responses");
assert.equal(admitTacticalReactionResolution({ runtime, reactionWindowId: opened.window.reactionWindowId, pulseIndex: 2 }).accepted, true);
assert.equal(admitTacticalReactionResolution({ runtime, reactionWindowId: opened.window.reactionWindowId, pulseIndex: 2 }).reason, "duplicate-canonical-defense-resolution");
console.log("tactical reaction idempotence tests passed");
