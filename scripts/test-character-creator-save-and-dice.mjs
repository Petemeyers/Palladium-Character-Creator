import assert from "node:assert/strict";

import {
  applyBonus,
  evaluateDice,
  getAverageDiceRoll,
} from "../src/utils/diceExpression.js";
import {
  CHARACTER_SAVE_AUTH_MESSAGE,
  getCharacterSaveToken,
  saveCharacterWithAuth,
} from "../src/utils/characterSave.js";
import { getStatsForLevel } from "../src/utils/levelProgression.js";

assert.equal(evaluateDice("2d6+3", (sides, count) => sides * count), 15);
assert.equal(evaluateDice("+2"), 2);
assert.equal(evaluateDice("7"), 7);
assert.equal(evaluateDice(6), 6);
assert.equal(evaluateDice(null), 0);
assert.equal(evaluateDice(undefined), 0);
assert.equal(evaluateDice({ value: 4 }), 0);
assert.equal(evaluateDice([4]), 0);
assert.equal(applyBonus(10, 3), 13);
assert.equal(applyBonus("10", 3), 13);
assert.equal(getAverageDiceRoll("2d6+2"), 9);
assert.equal(getAverageDiceRoll(6), 6);
assert.equal(getAverageDiceRoll("6"), 6);
assert.equal(getAverageDiceRoll(null), 3.5);
assert.equal(getAverageDiceRoll(undefined), 3.5);
assert.equal(getAverageDiceRoll({ dice: "1d6" }), 3.5);
assert.equal(getAverageDiceRoll(["1d6"]), 3.5);

const categorizedStats = getStatsForLevel(3, "Men of Arms");
assert.equal(categorizedStats.occCategory, "Men of Arms");
assert.equal(categorizedStats.hpPerLevel, 10);
assert.equal(categorizedStats.totalHP, 40);
const missingCategoryStats = getStatsForLevel(2, null);
assert.equal(missingCategoryStats.occCategory, "Men of Arms");
assert.equal(missingCategoryStats.totalHP, 30);
assert.equal(getStatsForLevel(2, { category: "Human Arms", hpPerLevel: 6 }).totalHP, 26);
assert.equal(getStatsForLevel(2, { category: "Custom", hpPerLevel: "1d8" }).totalHP, 24.5);

const professionData = { bonuses: { PS: 2, PP: "1", PE: null }, stamina: 8, focus: undefined };
const attributes = { PS: 10, PP: 11, PE: 12 };
const updatedAttributes = { ...attributes };
Object.entries(professionData.bonuses).forEach(([attribute, bonus]) => {
  updatedAttributes[attribute] = applyBonus(updatedAttributes[attribute], bonus);
});
assert.deepEqual(updatedAttributes, { PS: 12, PP: 12, PE: 12 });
assert.equal(evaluateDice(professionData.stamina), 8);
assert.equal(evaluateDice(professionData.focus), 0);

const createStorage = (token = "") => ({
  getItem: (key) => key === "token" ? token : null,
});
const character = { id: "draft-1", name: "Alden" };
let saveCalls = 0;
let alertCalls = 0;
let confirmCalls = 0;
const originalAlert = globalThis.alert;
const originalConfirm = globalThis.confirm;
globalThis.alert = () => { alertCalls += 1; };
globalThis.confirm = () => { confirmCalls += 1; return false; };

try {
  const unauthenticatedResult = await saveCharacterWithAuth({
    character,
    storage: createStorage(),
    onSave: async () => { saveCalls += 1; },
  });
  assert.equal(unauthenticatedResult.saved, false);
  assert.equal(unauthenticatedResult.authRequired, true);
  assert.equal(unauthenticatedResult.character, character);
  assert.equal(unauthenticatedResult.message, CHARACTER_SAVE_AUTH_MESSAGE);
  assert.equal(saveCalls, 0, "missing token does not issue an API save");
  assert.equal(alertCalls, 0, "unauthenticated save does not show alerts");
  assert.equal(confirmCalls, 0, "unauthenticated save does not show confirms");

  const authenticatedResult = await saveCharacterWithAuth({
    character,
    storage: createStorage("existing-token"),
    onSave: async (input, options) => {
      saveCalls += 1;
      assert.equal(input, character);
      assert.equal(options.suppressAuthPrompt, true);
      return { ...input, id: "saved-1" };
    },
  });
  assert.equal(authenticatedResult.saved, true);
  assert.equal(authenticatedResult.character.id, "saved-1");
  assert.equal(saveCalls, 1);
  assert.equal(getCharacterSaveToken(createStorage("existing-token")), "existing-token");
} finally {
  globalThis.alert = originalAlert;
  globalThis.confirm = originalConfirm;
}

console.log("character creator save and dice tests passed");
