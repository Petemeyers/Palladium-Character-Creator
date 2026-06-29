import assert from "node:assert/strict";

import {
  applyBonus,
  evaluateDice,
  getAverageDiceRoll,
} from "../src/utils/diceExpression.js";
import {
  CHARACTER_SAVE_AUTH_MESSAGE,
  CHARACTER_SAVE_NETWORK_MESSAGE,
  CHARACTER_SAVE_REAUTH_MESSAGE,
  CHARACTER_SAVE_SERVER_MESSAGE,
  CHARACTER_SAVE_SUCCESS_MESSAGE,
  CHARACTER_SAVE_VALIDATION_MESSAGE,
  getCharacterSaveToken,
  normalizeCharacterSavePayload,
  saveCharacterWithAuth,
} from "../src/utils/characterSave.js";
import { getStatsForLevel } from "../src/utils/levelProgression.js";
import {
  clearStoredAuthState,
  getStoredAuthDisplayName,
  hasStoredAuthToken,
} from "../src/utils/authStorage.js";

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

const createStorage = (initialValues = {}) => {
  const values = new Map(Object.entries(initialValues));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values,
  };
};
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
    storage: createStorage({ user: JSON.stringify({ name: "Stale Player" }) }),
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
    storage: createStorage({ token: "existing-token" }),
    onSave: async (input, options) => {
      saveCalls += 1;
      assert.equal(input.name, character.name);
      assert.equal(input.profession, "General");
      assert.equal(options.suppressAuthPrompt, true);
      return { ...input, id: "saved-1" };
    },
  });
  assert.equal(authenticatedResult.saved, true);
  assert.equal(authenticatedResult.message, CHARACTER_SAVE_SUCCESS_MESSAGE);
  assert.equal(authenticatedResult.character.id, "saved-1");
  assert.equal(saveCalls, 1);
  assert.equal(getCharacterSaveToken(createStorage({ token: "existing-token" })), "existing-token");

  const rejectedStorage = createStorage({
    token: "rejected-token",
    user: JSON.stringify({ name: "Stale Player" }),
    role: "player",
    currentUser: "stale",
    authToken: "legacy-token",
  });
  const rejectedResult = await saveCharacterWithAuth({
    character,
    storage: rejectedStorage,
    onSave: async () => {
      throw { status: 401, message: "No authentication token" };
    },
  });
  assert.equal(rejectedResult.authRequired, true);
  assert.equal(rejectedResult.message, CHARACTER_SAVE_REAUTH_MESSAGE);
  assert.equal(hasStoredAuthToken(rejectedStorage), false);
  assert.equal(rejectedStorage.values.size, 0, "rejected save clears all stale auth keys");
} finally {
  globalThis.alert = originalAlert;
  globalThis.confirm = originalConfirm;
}

const requiredPayload = normalizeCharacterSavePayload({ name: "Alden", species: "HUMAN", class: "Knight" });
[
  "name", "species", "class", "profession", "attributes", "level", "hp", "origin",
  "socialBackground", "age", "disposition", "hostility", "gender",
].forEach((field) => assert.notEqual(requiredPayload[field], undefined, `payload includes ${field}`));

const failureCases = [
  [{ status: 400, message: "bad" }, CHARACTER_SAVE_VALIDATION_MESSAGE],
  [{ status: 422, message: "bad" }, CHARACTER_SAVE_VALIDATION_MESSAGE],
  [{ status: 500, message: "bad" }, CHARACTER_SAVE_SERVER_MESSAGE],
  [{ name: "NetworkError", message: "no response" }, CHARACTER_SAVE_NETWORK_MESSAGE],
];
for (const [failure, expectedMessage] of failureCases) {
  const result = await saveCharacterWithAuth({
    character,
    storage: createStorage({ token: "existing-token" }),
    onSave: async () => { throw failure; },
  });
  assert.equal(result.saved, false);
  assert.equal(result.message, expectedMessage);
}

const staleUserStorage = createStorage({ user: JSON.stringify({ name: "Stale Player" }) });
assert.equal(hasStoredAuthToken(staleUserStorage), false);
assert.equal(getStoredAuthDisplayName(staleUserStorage), "", "header has no Player badge without token");
const staleLogoutStorage = createStorage({
  user: "stale",
  username: "Player",
  role: "player",
  currentUser: "stale",
  authToken: "legacy-token",
});
clearStoredAuthState(staleLogoutStorage);
assert.equal(staleLogoutStorage.values.size, 0, "logout clears stale auth even without token");

const originalLocalStorage = globalThis.localStorage;
const axiosStorage = createStorage({ token: "request-token" });
globalThis.localStorage = axiosStorage;
try {
  const axiosInstance = (await import("../src/utils/axios.js")).default;
  let capturedConfig = null;
  const response = await axiosInstance.post("/characters", requiredPayload, {
    suppressAuthPrompt: true,
    adapter: async (config) => {
      capturedConfig = config;
      return {
        data: { ...requiredPayload, _id: "saved-character" },
        status: 201,
        statusText: "Created",
        headers: {},
        config,
        request: {},
      };
    },
  });
  assert.equal(response.status, 201);
  assert.equal(capturedConfig.baseURL, "http://localhost:5000/api/v1");
  assert.equal(capturedConfig.url, "/characters");
  assert.equal(capturedConfig.headers.Authorization, "Bearer request-token");
} finally {
  globalThis.localStorage = originalLocalStorage;
}

console.log("character creator save and dice tests passed");
