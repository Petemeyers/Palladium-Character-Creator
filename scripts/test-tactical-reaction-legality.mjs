import assert from "node:assert/strict";
import { createTacticalReactionRuntime, getTacticalReactionBudget, openTacticalReactionWindow, submitTacticalReactionResponse } from "../src/utils/combat/tacticalReactionWindow.js";
import { fighter, reactionIntent } from "./tactical-reaction-test-helpers.mjs";

const attacker = fighter("attacker", "party");
const unarmed = fighter("defender", "enemy", { controlMode: "manual", attacks: [], weaponSlots: {} });
const runtime = createTacticalReactionRuntime({ generationId: 1, combatSession: 1 });
const window = openTacticalReactionWindow({ runtime, intent: reactionIntent(), executionKey: "legal:1", pulseIndex: 1, fighters: [attacker, unarmed], getControlMode: (actor) => actor.controlMode }).window;
assert.equal(submitTacticalReactionResponse({ runtime, reactionWindowId: window.reactionWindowId, responderId: "defender", responseType: "parry", pulseIndex: 1 }).reason, "Weapon cannot parry this attack");
assert.equal(submitTacticalReactionResponse({ runtime, reactionWindowId: window.reactionWindowId, responderId: "defender", responseType: "shield-block", pulseIndex: 1 }).reason, "No shield equipped");
assert.equal(getTacticalReactionBudget(runtime, "defender", 1).remaining, 1, "rejected responses do not consume budget");
assert.equal(submitTacticalReactionResponse({ runtime, reactionWindowId: window.reactionWindowId, responderId: "defender", responseType: "decline", pulseIndex: 1, expected: { generationId: 2 } }).reason, "stale-generation");
assert.equal(submitTacticalReactionResponse({ runtime, reactionWindowId: window.reactionWindowId, responderId: "defender", responseType: "decline", pulseIndex: 1, expected: { combatSession: 2 } }).reason, "stale-combat-session");
assert.equal(submitTacticalReactionResponse({ runtime, reactionWindowId: window.reactionWindowId, responderId: "defender", responseType: "riposte", pulseIndex: 1 }).reason, "future-reaction-not-enabled");
assert.equal(submitTacticalReactionResponse({ runtime, reactionWindowId: window.reactionWindowId, responderId: "defender", responseType: "decline", pulseIndex: 1 }).accepted, true);
console.log("tactical reaction legality tests passed");
