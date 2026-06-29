import assert from "node:assert/strict";

import {
  CHARACTER_LIST_EXPIRED_MESSAGE,
  CHARACTER_LIST_LOGIN_MESSAGE,
  loadSavedCharacters,
} from "../src/utils/characterListLoader.js";

const createStorage = (initialValues = {}) => {
  const values = new Map(Object.entries(initialValues));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values,
  };
};

let requestCalls = 0;
const missingTokenStorage = createStorage({ user: JSON.stringify({ name: "Stale Player" }) });
const missingTokenResult = await loadSavedCharacters({
  storage: missingTokenStorage,
  request: async () => { requestCalls += 1; },
});
assert.equal(requestCalls, 0, "missing token skips GET /api/v1/characters");
assert.equal(missingTokenResult.skipped, true);
assert.equal(missingTokenResult.message, CHARACTER_LIST_LOGIN_MESSAGE);

const savedCharacters = [{ _id: "character-1", name: "Alden" }];
const authenticatedStorage = createStorage({ token: "valid-token" });
const successResult = await loadSavedCharacters({
  storage: authenticatedStorage,
  request: async (config) => {
    requestCalls += 1;
    assert.equal(config.suppressAuthPrompt, true);
    return { status: 200, data: savedCharacters };
  },
});
assert.equal(requestCalls, 1, "stored token permits GET /api/v1/characters");
assert.equal(successResult.ok, true);
assert.deepEqual(successResult.characters, savedCharacters);
assert.equal(successResult.message, "", "successful load clears auth messages");

const rejectedStorage = createStorage({
  token: "expired-token",
  user: JSON.stringify({ name: "Stale Player" }),
  role: "player",
  currentUser: "stale",
  authToken: "legacy-token",
});
const expiredResult = await loadSavedCharacters({
  storage: rejectedStorage,
  request: async () => {
    throw { status: 401, message: "Authentication failed" };
  },
});
assert.equal(expiredResult.ok, false);
assert.equal(expiredResult.message, CHARACTER_LIST_EXPIRED_MESSAGE);
assert.equal(rejectedStorage.values.size, 0, "401 clears stale stored auth state");

console.log("character list auth tests passed");
