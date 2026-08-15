import assert from "node:assert/strict";

import {
  buildMovementCommandResult,
  canExecuteMovementCommand,
  getMovementTargetingButtonState,
  getMovementCommandPreview,
  resolveManualGroundMovementActionBudget,
} from "../src/utils/combatMovementCommand.js";

const hasFunction = (value) => {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(hasFunction);
};

const hasRawObjectInPreview = (value) =>
  Object.entries(value || {}).some(([, entry]) => entry && typeof entry === "object");

const actor = {
  id: "fighter-1",
  name: "Mimi",
  remainingActions: 1,
  currentStamina: 2,
  position: { x: 0, y: 0 },
};
const target = {
  id: "target-1",
  name: "Goblin Warrior",
  position: { x: 2, y: 1 },
};
const actorSnapshot = JSON.stringify(actor);
const targetSnapshot = JSON.stringify(target);

const moveAction = {
  id: "move",
  name: "Move",
  type: "move",
  enabled: true,
  costActions: 1,
  costStamina: 0,
  previewSummary: "Standard movement command.",
  metadata: { actorId: "fighter-1" },
};
const runAction = {
  ...moveAction,
  id: "run",
  name: "Run",
  type: "run",
  costStamina: 1,
  previewSummary: "Fast movement command.",
};
const chargeAction = {
  ...moveAction,
  id: "charge",
  name: "Charge",
  type: "charge",
  costStamina: 1,
  targetRequired: true,
  previewSummary: "Fast advance; attack follow-through pending.",
};

const movePreview = getMovementCommandPreview({ actor, action: moveAction, selectedTarget: target });
assert.equal(movePreview.movementMode, "move");
assert.equal(movePreview.previewSummary, "Standard movement command.");
assert.equal(movePreview.distanceFeet, 10);
assert.equal(hasFunction(movePreview), false, "move preview contains no functions");
assert.equal(hasRawObjectInPreview(movePreview), false, "move preview contains no raw objects");

const moveButton = getMovementTargetingButtonState({
  actor,
  action: moveAction,
  currentTurnEntry: actor,
  selectedTarget: target,
  manualTurnActive: true,
  executionAvailable: true,
});
assert.equal(moveButton.enabled, true);
assert.equal(moveButton.label, "Begin Move Targeting");

const runPreview = getMovementCommandPreview({ actor, action: runAction, selectedTarget: target });
assert.equal(runPreview.movementMode, "run");
assert.equal(runPreview.previewSummary, "Fast movement command.");
assert.equal(hasFunction(runPreview), false, "run preview contains no functions");

const runButton = getMovementTargetingButtonState({
  actor,
  action: runAction,
  currentTurnEntry: actor,
  selectedTarget: target,
  manualTurnActive: true,
  executionAvailable: true,
});
assert.equal(runButton.enabled, true);
assert.equal(runButton.label, "Begin Run Targeting");

const chargePreview = getMovementCommandPreview({ actor, action: chargeAction, selectedTarget: target });
assert.equal(chargePreview.movementMode, "charge");
assert.ok(chargePreview.previewSummary.includes("Charge attack follow-through pending."), "charge preview includes follow-through pending note");

const chargeButton = getMovementTargetingButtonState({
  actor,
  action: chargeAction,
  currentTurnEntry: actor,
  selectedTarget: target,
  manualTurnActive: true,
  executionAvailable: true,
});
assert.equal(chargeButton.enabled, true);
assert.equal(chargeButton.label, "Begin Charge Targeting");

assert.doesNotThrow(() => getMovementCommandPreview({ actor: null, action: null, selectedTarget: { bad: true } }));
assert.doesNotThrow(() => canExecuteMovementCommand({ actor: null, action: null, currentTurnEntry: null }));

const noActions = canExecuteMovementCommand({
  actor,
  action: moveAction,
  currentTurnEntry: { ...actor, remainingActions: 0 },
  selectedTarget: target,
  executionAvailable: true,
});
assert.equal(noActions.ok, false);
assert.equal(noActions.reason, "No actions remaining. End Turn manually.");

const noStamina = canExecuteMovementCommand({
  actor,
  action: runAction,
  currentTurnEntry: { ...actor, currentStamina: 0 },
  selectedTarget: target,
  executionAvailable: true,
});
assert.equal(noStamina.ok, false);
assert.equal(noStamina.reason, "Not enough stamina.");

const wrongActor = canExecuteMovementCommand({
  actor,
  action: moveAction,
  currentTurnEntry: { ...actor, id: "other-fighter" },
  selectedTarget: target,
  executionAvailable: true,
});
assert.equal(wrongActor.ok, false);
assert.equal(wrongActor.reason, "Movement can only be used by the current turn combatant.");

const manualInactive = canExecuteMovementCommand({
  actor,
  action: moveAction,
  currentTurnEntry: actor,
  selectedTarget: target,
  manualTurnActive: false,
  executionAvailable: true,
});
assert.equal(manualInactive.ok, false);
assert.equal(manualInactive.reason, "Movement mode is unavailable.");

const missingTarget = canExecuteMovementCommand({
  actor,
  action: chargeAction,
  currentTurnEntry: actor,
  selectedTarget: null,
  executionAvailable: true,
});
assert.equal(missingTarget.ok, false);
assert.equal(missingTarget.reason, "Movement target or destination required.");

const notWired = canExecuteMovementCommand({
  actor,
  action: moveAction,
  currentTurnEntry: actor,
  selectedTarget: target,
  executionAvailable: false,
});
assert.equal(notWired.ok, false);
assert.equal(notWired.reason, "Movement mode is unavailable.");

const result = buildMovementCommandResult({ actor, action: moveAction, selectedTarget: target });
assert.equal(result.ok, false);
assert.equal(result.message, "Movement mode is unavailable.");
assert.equal(hasFunction(result), false, "movement result contains no functions");

assert.equal(JSON.stringify(actor), actorSnapshot, "movement helper does not mutate actor");
assert.equal(JSON.stringify(target), targetSnapshot, "movement helper does not mutate target");

const walkBudget = resolveManualGroundMovementActionBudget({
  movementMode: "walk",
  remainingActions: 5,
});
assert.equal(walkBudget.fullCommitment, false);
assert.equal(walkBudget.partOfCombinedAction, false);
assert.equal(walkBudget.actionCost, 1);
assert.equal(walkBudget.finalizeAfterMovement, true);

const runBudget = resolveManualGroundMovementActionBudget({
  movementMode: "run",
  remainingActions: 5,
});
assert.equal(runBudget.fullCommitment, true);
assert.equal(runBudget.partOfCombinedAction, false);
assert.equal(runBudget.actionCost, 5);
assert.equal(runBudget.finalizeAfterMovement, true);

const chargeBudget = resolveManualGroundMovementActionBudget({
  movementMode: "charge",
  remainingActions: 5,
});
assert.equal(chargeBudget.fullCommitment, false, "Charge must not consume the full remaining action budget");
assert.equal(chargeBudget.partOfCombinedAction, true);
assert.equal(chargeBudget.actionCost, 0, "Charge movement defers the combined action spend to attack follow-through");
assert.equal(chargeBudget.finalizeAfterMovement, false, "Charge movement must not finalize the turn");
assert.equal(chargeBudget.blocksAfterPriorMovement, true);

console.log("combat movement command tests passed");
