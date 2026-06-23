import assert from "node:assert/strict";
import {
  getDefaultStamina,
  getFatigueLabel,
  getStaminaState,
  initializeStamina,
  spendStamina,
} from "../src/utils/combatStamina.js";

const defaultCombatant = { id: "default", name: "Default Fighter" };
const defaultSnapshot = JSON.stringify(defaultCombatant);

assert.equal(getDefaultStamina(defaultCombatant), 10, "Default max stamina should be 10");
assert.equal(getDefaultStamina({ abilityModifiers: { con: 2 } }), 12, "Constitution modifier should increase max stamina");
assert.equal(getDefaultStamina({ publicAbilityModifiers: { con: -2 } }), 8, "Negative Constitution modifier should reduce max stamina");
assert.equal(getDefaultStamina({ publicAbilityModifiers: { con: -20 } }), 1, "Max stamina should not drop below 1");
assert.equal(getDefaultStamina({ finalAbilityScores: { con: 14 } }), 12, "Constitution score should derive a modifier");
assert.equal(getDefaultStamina({ compatibilityAttributes: { PE: 14 } }), 12, "Compatibility PE should derive a fallback modifier");
assert.equal(getDefaultStamina({ abilityModifiers: { con: true }, compatibilityAttributes: { PE: "bad" } }), 10, "Malformed fields should default safely");

const initialized = initializeStamina(defaultCombatant);
assert.equal(initialized.maxStamina, 10, "Initialized max stamina should default to 10");
assert.equal(initialized.currentStamina, 10, "Initialized current stamina should start full");
assert.equal(initialized.fatigueLabel, "Fresh", "Initialized fatigue should be Fresh");
assert.equal(JSON.stringify(defaultCombatant), defaultSnapshot, "Initialize should not mutate the original object");

const spent = spendStamina(initialized, 1);
assert.equal(spent.ok, true, "Spending stamina with stamina available should succeed");
assert.equal(spent.currentStamina, 9, "Spending 1 stamina from 10 should leave 9");
assert.equal(spent.updated.currentStamina, 9, "Updated copy should carry current stamina");
assert.equal(spent.updated.fatigueLabel, "Fresh", "9 of 10 stamina should remain Fresh");

const winded = spendStamina({ maxStamina: 10, currentStamina: 6 }, 1);
assert.equal(winded.currentStamina, 5, "Spending to half stamina should leave 5");
assert.equal(winded.fatigueLabel, "Winded", "Half stamina should be Winded");

const exhausted = spendStamina({ maxStamina: 10, currentStamina: 1 }, 2);
assert.equal(exhausted.currentStamina, 0, "Stamina should not go below 0");
assert.equal(exhausted.fatigueLabel, "Exhausted", "0 stamina should be Exhausted");

const noStamina = spendStamina({ maxStamina: 10, currentStamina: 0 }, 1);
assert.equal(noStamina.ok, false, "Spending at 0 stamina should fail");
assert.equal(noStamina.currentStamina, 0, "Failed spend should stay at 0");

assert.equal(getFatigueLabel(6, 10), "Fresh", "Above half stamina should be Fresh");
assert.equal(getFatigueLabel(5, 10), "Winded", "Half stamina should be Winded");
assert.equal(getFatigueLabel(0, 10), "Exhausted", "Zero stamina should be Exhausted");

const state = getStaminaState({ maxStamina: 10, currentStamina: 4 });
assert.deepEqual(state, {
  maxStamina: 10,
  currentStamina: 4,
  fatigueLabel: "Winded",
}, "Stamina state should normalize values and label fatigue");

console.log("Combat stamina tests passed.");
