import assert from "node:assert/strict";

import { resolveArmoredCombatAction } from "../src/utils/ai/resolveArmoredCombatAction.js";
import {
  resolveGrappleTurnAction,
} from "../src/utils/ai/resolveGrappleTurnAction.js";

const logs = [];
let rngCalls = 0;

const attacker = {
  id: "knight-a",
  name: "Knight A",
  remainingActions: 1,
  grappleState: { state: "clinch", opponent: "knight-b" },
};
const defender = {
  id: "knight-b",
  name: "Knight B",
  armorProfile: { armorClass: "plate", rigidCoverage: true },
  grappleState: { state: "clinch", opponent: "knight-a" },
};
const longSword = { id: "long-sword-a", name: "Long Sword", reach: 5 };

const action = resolveArmoredCombatAction({
  attacker,
  defender,
  selectedWeapon: longSword,
  distance: 5,
  remainingActions: 1,
  generationId: "combat-g",
  round: 2,
  initiativeIndex: 4,
  turnToken: "turn-token-a",
  getTacticalMemory: () => {
    throw new Error("standing selector memory should not be read while grapple obligation is active");
  },
  rng: () => {
    rngCalls += 1;
    return 0.01;
  },
  source: "test-active-grapple",
  addLog: (entry) => logs.push(entry),
});

assert.equal(action.actionType, "grapple-obligation");
assert.equal(action.suppressed, false, "active grapple routing is not action completion");
assert.equal(action.handled, false, "standing selector should hand off to the grapple adapter");
assert.equal(rngCalls, 0, "standing armored selector must not roll/rng while grapple is active");

const eventTypes = logs.map((entry) => entry?.eventType);
assert.ok(eventTypes.includes("combat-obligation-routed"));
assert.ok(eventTypes.includes("grapple-state-read"));
assert.ok(eventTypes.includes("standing-armored-selector-suppressed"));
assert.equal(eventTypes.includes("armored-selector-invoked"), false);
assert.equal(eventTypes.includes("armored-memory-read"), false);
assert.equal(eventTypes.includes("armored-technique-candidates"), false);

const route = resolveGrappleTurnAction({
  actor: attacker,
  opponent: defender,
  remainingActions: 1,
  generationId: "combat-g",
  turnToken: "turn-token-a",
  source: "test-active-grapple",
});

assert.equal(route.handled, true);
assert.equal(route.actionAccepted, true);
assert.equal(route.actionSpent, false, "adapter only routes; grapple handler owns action spending");
assert.equal(route.staminaSpent, 0, "adapter must not spend stamina directly");
assert.equal(route.stateChanged, false, "adapter must not mutate grapple state directly");
assert.match(route.executionKey, /turn-token-a/);

console.log("✅ Phase 3B1 active grapple routing tests passed");
