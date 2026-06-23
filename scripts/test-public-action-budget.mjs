import assert from "node:assert/strict";
import {
  getDefaultActionBudget,
  initializeActionBudget,
  resetActionBudgetForTurn,
  spendAction,
} from "../src/utils/publicActionBudget.js";

const defaultCombatant = { id: "default", name: "Default Fighter" };
const defaultSnapshot = JSON.stringify(defaultCombatant);

assert.equal(getDefaultActionBudget(defaultCombatant), 1, "Default action budget should be 1");
assert.equal(getDefaultActionBudget({ maxActions: 2 }), 2, "Numeric maxActions should be respected");
assert.equal(getDefaultActionBudget({ actions: true }), 1, "Boolean actions should not become an action count");
assert.equal(getDefaultActionBudget({ attacks: [{ name: "Spear" }, { name: "Dagger" }] }), 1, "Attack list length should not become an action count");

const initialized = initializeActionBudget(defaultCombatant);
assert.equal(initialized.maxActions, 1, "Initialized maxActions should default to 1");
assert.equal(initialized.remainingActions, 1, "Initialized remainingActions should default to maxActions");
assert.equal(JSON.stringify(defaultCombatant), defaultSnapshot, "Initialize should not mutate the original object");

const twoActions = initializeActionBudget({ id: "two", maxActions: 2 });
const spentOnce = spendAction(twoActions, 1);
assert.equal(spentOnce.ok, true, "Spending with actions available should succeed");
assert.equal(spentOnce.remainingActions, 1, "Spending 1 action from 2 should leave 1");
assert.equal(spentOnce.updated.remainingActions, 1, "Updated copy should carry remaining action count");

const spentPastZero = spendAction({ ...twoActions, remainingActions: 0 }, 1);
assert.equal(spentPastZero.ok, false, "Spending at 0 actions should fail");
assert.equal(spentPastZero.remainingActions, 0, "Spending cannot go below 0");
assert.equal(spentPastZero.updated.remainingActions, 0, "Updated copy should stay at 0");

const reset = resetActionBudgetForTurn({ id: "spent", maxActions: 2, remainingActions: 0 });
assert.equal(reset.remainingActions, 2, "Reset should restore remainingActions to maxActions");
assert.equal(reset.maxActions, 2, "Reset should preserve numeric maxActions");

console.log("Public action budget tests passed.");
