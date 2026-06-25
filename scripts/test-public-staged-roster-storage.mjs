import assert from "node:assert/strict";

import {
  PUBLIC_ARENA_ROSTER_STORAGE_KEY,
  clearStagedRosterEntries,
  getStagedRosterEntries,
  pruneStagedRosterEntriesAgainstSavedCharacters,
  removeStagedRosterEntriesByCharacterId,
  removeStagedRosterEntry,
  saveStagedRosterEntries,
} from "../src/utils/publicStagedRosterStorage.js";

const makeStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};

global.window = { localStorage: makeStorage() };

const hasFunction = (value) => {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(hasFunction);
};

const stagedMimi = {
  id: "char-mimi",
  name: "Mimi",
  side: "player",
  source: "saved-character",
};
const stagedMimiDuplicate = {
  id: "char-mimi",
  name: "Mimi Copy",
  side: "player",
  source: "saved-character",
};
const stagedSorulwen = {
  id: "char-sorulwen",
  name: "Sorulwen",
  side: "player",
  source: "saved-character",
};
const stagedGoblin = {
  id: "goblin-warrior",
  name: "Goblin Warrior",
  side: "enemy",
  source: "public-enemy",
};

const originalEntries = [stagedMimi, stagedSorulwen, stagedGoblin];
const originalSnapshot = JSON.stringify(originalEntries);

saveStagedRosterEntries(originalEntries);
assert.equal(getStagedRosterEntries().length, 3, "valid staged entries round-trip");

const removedOne = removeStagedRosterEntry("char-sorulwen");
assert.deepEqual(removedOne.map((entry) => entry.id), ["char-mimi", "goblin-warrior"], "removeStagedRosterEntry removes one entry");

saveStagedRosterEntries([stagedMimi, stagedMimiDuplicate, stagedGoblin]);
const removedByCharacter = removeStagedRosterEntriesByCharacterId("char-mimi");
assert.deepEqual(removedByCharacter.map((entry) => entry.id), ["goblin-warrior"], "removeStagedRosterEntriesByCharacterId removes all staged entries for a deleted character");

saveStagedRosterEntries(originalEntries);
const pruned = pruneStagedRosterEntriesAgainstSavedCharacters([{ _id: "char-mimi", name: "Mimi" }]);
assert.deepEqual(pruned.map((entry) => entry.id), ["char-mimi", "goblin-warrior"], "prune removes missing saved-character entries and keeps valid/enemy entries");
assert.equal(pruned.some((entry) => entry.id === "goblin-warrior"), true, "prune keeps enemy entries");

assert.deepEqual(clearStagedRosterEntries(), [], "clearStagedRosterEntries clears all entries");
assert.deepEqual(getStagedRosterEntries(), [], "cleared storage loads as empty");

window.localStorage.setItem(PUBLIC_ARENA_ROSTER_STORAGE_KEY, "{bad json");
assert.deepEqual(getStagedRosterEntries(), [], "malformed storage returns safe empty state");

saveStagedRosterEntries([{ ...stagedMimi, helper: () => "ignored" }]);
assert.equal(hasFunction(getStagedRosterEntries()), false, "storage output contains no functions");
assert.equal(JSON.stringify(originalEntries), originalSnapshot, "helpers do not mutate input entries");

console.log("public staged roster storage tests passed");
