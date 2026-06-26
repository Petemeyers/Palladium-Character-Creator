import assert from "node:assert/strict";

import {
  applyPendingDefensiveSelection,
  canUseDefensiveReserveForReaction,
  getCombatPosture,
  getDefensiveReserve,
} from "../src/utils/combatPosture.js";
import { endManualTurnActions } from "../src/utils/combatCommandStateCleanup.js";

const baseFighter = {
  id: "fighter-1",
  name: "Nava",
  team: "party",
  type: "player",
  remainingActions: 2,
};
const snapshot = JSON.stringify(baseFighter);

const cases = [
  { action: { id: "evade", type: "evade", enabled: true, costActions: 1 }, reserve: "evade", posture: "evading" },
  { action: { id: "block", type: "block", enabled: true, costActions: 1 }, reserve: "block", posture: "blocking" },
  { action: null, legacy: { name: "Defend/Hold" }, reserve: "defend", posture: "defending" },
];

for (const testCase of cases) {
  const resolved = applyPendingDefensiveSelection(baseFighter, {
    selectedCombatAction: testCase.action,
    selectedLegacyAction: testCase.legacy,
    round: 2,
    turnIndex: 1,
  });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.applied, true);
  assert.equal(resolved.updated.remainingActions, 1, "selected defense spends one action before End Turn");
  assert.equal(getCombatPosture(resolved.updated)?.type, testCase.posture);

  const afterEndTurn = endManualTurnActions([resolved.updated], resolved.updated)[0];
  assert.equal(afterEndTurn.remainingActions, 0);
  assert.deepEqual(getDefensiveReserve(afterEndTurn), {
    active: true,
    type: testCase.reserve,
    actions: 1,
  });
  assert.equal(
    canUseDefensiveReserveForReaction(afterEndTurn, testCase.reserve),
    true,
    `${testCase.reserve} remains held after End Turn`
  );
}

const unavailable = applyPendingDefensiveSelection(
  { ...baseFighter, remainingActions: 0 },
  { selectedCombatAction: cases[0].action }
);
assert.equal(unavailable.ok, false, "End Turn must block rather than discard an unresolved defense");
assert.equal(unavailable.applied, false);

assert.equal(JSON.stringify(baseFighter), snapshot, "pending defense helper does not mutate the fighter");

console.log("pending defense End Turn tests passed");
