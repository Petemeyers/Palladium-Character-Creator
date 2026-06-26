import assert from "node:assert/strict";

import {
  buildClearedLegacyDefensiveActionState,
  getLegacyDefensiveDuplicateMessage,
  getLegacyDefensivePosture,
  getLegacyDefensiveRemainingActionMessage,
  isDuplicateLegacyDefensiveAction,
  isLegacyDefensiveAction,
} from "../src/utils/combatCommandStateCleanup.js";

const state = {
  selectedAction: { name: "Block" },
  selectedTarget: { id: "target-1" },
  selectedWeapon: { id: "weapon-1" },
  selectedAttackWeapon: { id: "weapon-2" },
  selectedMovementMode: "move",
  selectedMovementFighter: "fighter-1",
  selectedMovementHex: { x: 1, y: 2 },
};
const snapshot = JSON.stringify(state);

assert.equal(isLegacyDefensiveAction("Defend/Hold"), true, "Defend/Hold is a legacy defensive action");
assert.equal(isLegacyDefensiveAction({ name: "Block" }), true, "Block is a legacy defensive action");
assert.equal(isLegacyDefensiveAction({ name: "Evade" }), true, "Evade is a legacy defensive action");

assert.equal(getLegacyDefensivePosture("Defend/Hold"), "Defend", "Defend/Hold maps to Defend posture");
assert.equal(getLegacyDefensivePosture("Block"), "Block", "Block maps to Block posture");
assert.equal(getLegacyDefensivePosture("Evade"), "Evade", "Evade maps to Evade posture");

assert.equal(
  isDuplicateLegacyDefensiveAction({ actionName: "Block", currentPosture: "Block" }),
  true,
  "duplicate Block is detected"
);
assert.equal(
  isDuplicateLegacyDefensiveAction({ actionName: "Evade", currentPosture: "Evade" }),
  true,
  "duplicate Evade is detected"
);
assert.equal(
  isDuplicateLegacyDefensiveAction({ actionName: "Defend/Hold", currentPosture: "Defend" }),
  true,
  "duplicate Defend/Hold is detected"
);
assert.equal(
  isDuplicateLegacyDefensiveAction({ actionName: "Block", currentPosture: "Evade" }),
  false,
  "changing from Evade to Block remains allowed"
);

assert.equal(
  getLegacyDefensiveDuplicateMessage({ actorName: "Kara", actionName: "Block" }),
  "Already blocking. Choose another action or End Turn."
);
assert.equal(
  getLegacyDefensiveDuplicateMessage({ actorName: "Kara", actionName: "Evade" }),
  "Already evading. Choose another action or End Turn."
);
assert.equal(
  getLegacyDefensiveDuplicateMessage({ actorName: "Kara", actionName: "Defend/Hold" }),
  "Already defending. Choose another action or End Turn."
);
assert.equal(
  getLegacyDefensiveRemainingActionMessage({ actorName: "Kara", remainingActions: 1 }),
  "Kara has 1 action remaining. Choose another action or End Turn."
);
assert.equal(
  getLegacyDefensiveRemainingActionMessage({ actorName: "Kara", remainingActions: 2 }),
  "Kara has 2 actions remaining. Choose another action or End Turn."
);

const cleared = buildClearedLegacyDefensiveActionState(state);
assert.equal(cleared.selectedAction, null, "legacy defensive cleanup clears selectedAction");
assert.equal(cleared.selectedTarget, null, "legacy defensive cleanup clears selectedTarget");
assert.equal(cleared.selectedAttackWeapon, null, "legacy defensive cleanup clears selectedAttackWeapon");
assert.deepEqual(cleared.movementMode, { active: false, isRunning: false }, "legacy cleanup clears movement mode");
assert.equal(JSON.stringify(state), snapshot, "cleanup helper does not mutate input");

assert.doesNotThrow(() => isDuplicateLegacyDefensiveAction(null), "malformed duplicate check does not throw");
assert.doesNotThrow(() => getLegacyDefensiveDuplicateMessage({ actionName: null }), "malformed duplicate message does not throw");
assert.doesNotThrow(() => getLegacyDefensiveRemainingActionMessage({ remainingActions: "bad" }), "malformed remaining message does not throw");

console.log("legacy defensive flow tests passed");
