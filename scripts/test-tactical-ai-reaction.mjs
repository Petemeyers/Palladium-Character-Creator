import assert from "node:assert/strict";
import { createTacticalReactionRuntime, invalidateTacticalReactionWindow, lockTacticalReactionWindow, openTacticalReactionWindow } from "../src/utils/combat/tacticalReactionWindow.js";
import { fighter, reactionIntent, shield } from "./tactical-reaction-test-helpers.mjs";

const runtime = createTacticalReactionRuntime({ generationId: 1, combatSession: 1 });
const shielded = fighter("defender", "enemy", { hasShield: true, weaponSlots: { rightHand: { id: "sword", name: "Sword" }, leftHand: shield } });
const opened = openTacticalReactionWindow({ runtime, intent: reactionIntent(), executionKey: "ai:1", pulseIndex: 1, fighters: [fighter("attacker", "party"), shielded] });
assert.equal(opened.accepted, true);
assert.equal(opened.window.selectedPrimaryResponse.responseType, "shield-block");
assert.equal(opened.window.selectedPrimaryResponse.state, "offered", "AI selection does not roll or resolve defense");

const noLegalRuntime = createTacticalReactionRuntime({ generationId: 1, combatSession: 1 });
const noLegal = openTacticalReactionWindow({ runtime: noLegalRuntime, intent: reactionIntent({ actionIntentId: "ai-no-legal" }), executionKey: "ai:no-legal", pulseIndex: 1, fighters: [fighter("attacker", "party"), fighter("defender", "enemy", { attacks: [], weaponSlots: {}, restrained: true })] });
assert.equal(noLegal.window.selectedPrimaryResponse.responseType, "decline");
assert.equal(noLegal.window.selectedPrimaryResponse.selectionReason, "no-legal-active-reaction");

lockTacticalReactionWindow({ runtime, reactionWindowId: opened.window.reactionWindowId, pulseIndex: 2 });
invalidateTacticalReactionWindow({ runtime, reactionWindowId: opened.window.reactionWindowId, pulseIndex: 2, reason: "budget-fixture" });
const exhausted = openTacticalReactionWindow({ runtime, intent: reactionIntent({ actionIntentId: "ai-exhausted" }), executionKey: "ai:exhausted", pulseIndex: 2, fighters: [fighter("attacker", "party"), shielded] });
assert.equal(exhausted.window.selectedPrimaryResponse.responseType, "decline");
assert.equal(exhausted.window.selectedPrimaryResponse.selectionReason, "reaction-budget-exhausted");
console.log("tactical AI reaction tests passed");
