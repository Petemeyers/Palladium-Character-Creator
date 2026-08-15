import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { getActionCost } from "../src/utils/actionEconomy.js";
import { MOVEMENT_ACTIONS } from "../src/data/movementRules.js";
import { resolveManualGroundMovementActionBudget } from "../src/utils/combatMovementCommand.js";

const combat = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const catalog = readFileSync(new URL("../src/utils/combatActionCatalog.js", import.meta.url), "utf8");

assert.equal(getActionCost("CHARGE"), 1, "canonical Charge action cost is 1");
assert.equal(MOVEMENT_ACTIONS.CHARGE.actionCost, 1, "movement-rule Charge action cost is 1");
assert.match(
  catalog,
  /id: "charge"[\s\S]*?costActions: 1[\s\S]*?previewSummary: "Fast advance; attack follow-through pending\."/,
  "catalog Charge remains one combined action with follow-through pending",
);

const remainingBefore = 5;
const chargeBudget = resolveManualGroundMovementActionBudget({
  movementMode: "charge",
  remainingActions: remainingBefore,
});
const remainingAfterMovement = remainingBefore - chargeBudget.actionCost;
assert.equal(chargeBudget.partOfCombinedAction, true);
assert.equal(chargeBudget.finalizeAfterMovement, false);
assert.equal(remainingAfterMovement, remainingBefore, "Charge movement must not independently zero the action budget");
assert.notEqual(remainingAfterMovement, 0);

const walkBudget = resolveManualGroundMovementActionBudget({
  movementMode: "walk",
  remainingActions: remainingBefore,
});
assert.equal(walkBudget.actionCost, 1);
assert.equal(walkBudget.finalizeAfterMovement, true);
assert.equal(walkBudget.fullCommitment, false);

const runBudget = resolveManualGroundMovementActionBudget({
  movementMode: "run",
  remainingActions: remainingBefore,
});
assert.equal(runBudget.actionCost, remainingBefore);
assert.equal(runBudget.fullCommitment, true);
assert.equal(runBudget.finalizeAfterMovement, true);

const handleMoveSelectStart = combat.indexOf("const handleMoveSelect = useCallback((x, y) => {");
const handleMoveSelectEnd = combat.indexOf("const settleManualWeaponEntryChoice = useCallback", handleMoveSelectStart);
assert.ok(handleMoveSelectStart >= 0 && handleMoveSelectEnd > handleMoveSelectStart);
const handleMoveSelect = combat.slice(handleMoveSelectStart, handleMoveSelectEnd);

assert.match(
  handleMoveSelect,
  /resolveManualGroundMovementActionBudget\(/,
  "manual movement uses the shared Charge/Walk/Run action-budget helper",
);
assert.match(
  handleMoveSelect,
  /combinedChargeAction/,
  "Charge is treated as a combined action rather than a full-commitment run",
);
assert.doesNotMatch(
  handleMoveSelect,
  /selectedGroundMode === "run" \|\| selectedGroundMode === "charge"/,
  "Charge must not share Run's remaining-action wipe",
);
assert.match(
  handleMoveSelect,
  /source: "charge-follow-through"/,
  "Charge movement schedules the existing attack() follow-through",
);
assert.match(
  handleMoveSelect,
  /attackRef\.current\(liveCharger, liveTarget\.id/,
  "Charge follow-through calls attack() exactly through the canonical attack authority",
);
assert.match(
  handleMoveSelect,
  /damageMultiplier: 2/,
  "Charge follow-through preserves the existing charge damage multiplier",
);
assert.match(
  handleMoveSelect,
  /charge-follow-through-scheduled/,
  "Charge follow-through is logged before any turn finalizer",
);

const chargeFinalizeBlock = handleMoveSelect.slice(
  handleMoveSelect.indexOf("if (combinedChargeAction)"),
  handleMoveSelect.indexOf("turnActionResolvingRef.current = false;\n      executingActionRef.current = false;\n      pendingTurnAdvanceRef.current = true;"),
);
assert.ok(chargeFinalizeBlock.includes("if (combinedChargeAction)"));
assert.doesNotMatch(
  chargeFinalizeBlock,
  /scheduleEndTurn\(350, "manual-initiative-action-move-finalized"\)/,
  "successful Charge movement must not use the ordinary initiative-move finalizer",
);
assert.doesNotMatch(
  chargeFinalizeBlock,
  /scheduleEndTurn\(350, "manual-move-finalized"\)/,
  "successful Charge movement must not use the ordinary move finalizer",
);
assert.match(
  chargeFinalizeBlock,
  /pendingTurnAdvanceRef\.current = false/,
  "Charge movement keeps turn ownership until attack follow-through",
);
assert.match(
  chargeFinalizeBlock,
  /allTimeoutsRef\.current\.push\(followThroughTimer\)/,
  "Charge follow-through uses one delayed attack callback",
);

const ordinaryFinalizeBlock = handleMoveSelect.slice(
  handleMoveSelect.indexOf("addLog(\"manual move finalized; movement state cleared\""),
);
assert.match(
  ordinaryFinalizeBlock,
  /scheduleEndTurn\(350, "manual-initiative-action-move-finalized"\)/,
  "ordinary Walk/Run still finalize in Initiative Actions",
);
assert.match(
  ordinaryFinalizeBlock,
  /scheduleEndTurn\(350, "manual-move-finalized"\)/,
  "ordinary movement still finalizes when the action budget is exhausted",
);

assert.match(
  combat,
  /actionCost: chargeBudget\.partOfCombinedAction\s*\?[\s\S]*?0/,
  "Charge targeting must not spend the combined action at destination selection",
);
assert.match(
  combat,
  /followThroughTargetId: chargeBudget\.partOfCombinedAction \? \(chargeTarget\?\.id \|\| null\) : null/,
  "Charge targeting stores the follow-through target before movement",
);
assert.match(
  combat,
  /createAttackExecutionKeyRef\.current = createAttackExecutionKey/,
  "Charge follow-through mints a canonical in-turn execution key",
);

console.log("charge follow-through action-budget regression: passed");
