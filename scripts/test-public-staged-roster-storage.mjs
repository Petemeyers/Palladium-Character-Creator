import assert from "node:assert/strict";

import {
  PUBLIC_ARENA_ROSTER_STORAGE_KEY,
  clearStagedRosterEntries,
  getDuplicateStagedSavedCharacters,
  getDuplicateStagedRosterEntries,
  getMissingSavedCharacterStagedEntries,
  getStagedRosterEntries,
  hasStagedSavedCharacter,
  pruneStagedRosterEntriesAgainstSavedCharacters,
  removeDuplicateSavedCharacterEntries,
  removeDuplicateSavedCharacterEntriesFromStorage,
  removeDuplicateStagedRosterEntriesFromStorage,
  removeStagedRosterEntriesByCharacterId,
  removeStagedRosterEntry,
  saveStagedRosterEntries,
  upsertPublicArenaRosterEntry,
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
  id: "staged-copy-mimi",
  characterId: "char-mimi",
  name: "Mimi Copy",
  side: "player",
  source: "saved-character",
};
const stagedMimiSameNameDifferentId = {
  id: "char-mimi-other",
  name: "Mimi",
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
const stagedGeneratedCharacter = {
  id: "generated-ranger",
  name: "Generated Ranger",
  side: "player",
  source: "autoroll",
  generated: true,
  autoRollCharacter: { name: "Generated Ranger" },
};

const originalEntries = [stagedMimi, stagedSorulwen, stagedGoblin];
const originalSnapshot = JSON.stringify(originalEntries);

saveStagedRosterEntries(originalEntries);
assert.equal(getStagedRosterEntries().length, 3, "valid staged entries round-trip");
assert.equal(hasStagedSavedCharacter(getStagedRosterEntries(), "char-mimi"), true, "hasStagedSavedCharacter detects existing saved character id");
assert.equal(hasStagedSavedCharacter(getStagedRosterEntries(), "missing-character"), false, "hasStagedSavedCharacter returns false for absent id");

const removedOne = removeStagedRosterEntry("char-sorulwen");
assert.deepEqual(removedOne.map((entry) => entry.id), ["char-mimi", "goblin-warrior"], "removeStagedRosterEntry removes one entry");

saveStagedRosterEntries([stagedGoblin, { ...stagedGoblin }, stagedSorulwen]);
const removedOneDuplicate = removeStagedRosterEntry(stagedGoblin);
assert.deepEqual(removedOneDuplicate.map((entry) => entry.id), ["goblin-warrior", "char-sorulwen"], "removeStagedRosterEntry removes only one matching staged row");

saveStagedRosterEntries([stagedMimi, stagedMimiDuplicate, stagedGoblin]);
const removedByCharacter = removeStagedRosterEntriesByCharacterId("char-mimi");
assert.deepEqual(removedByCharacter.map((entry) => entry.id), ["goblin-warrior"], "removeStagedRosterEntriesByCharacterId removes all staged entries for a deleted character");

saveStagedRosterEntries([stagedMimi]);
const upsertDuplicate = upsertPublicArenaRosterEntry(stagedMimiDuplicate);
assert.deepEqual(upsertDuplicate.map((entry) => entry.id), ["char-mimi"], "adding same saved character twice keeps the existing staged entry");

const duplicatedEntries = [stagedMimi, stagedMimiDuplicate, stagedMimiSameNameDifferentId, stagedGoblin];
const duplicateList = getDuplicateStagedSavedCharacters(duplicatedEntries);
assert.deepEqual(duplicateList.map((entry) => entry.id), ["staged-copy-mimi"], "duplicate detection reports later saved-character duplicate only");

const deduped = removeDuplicateSavedCharacterEntries(duplicatedEntries);
assert.deepEqual(
  deduped.map((entry) => entry.id),
  ["char-mimi", "char-mimi-other", "goblin-warrior"],
  "duplicate cleanup keeps one saved-character entry per id and preserves enemies"
);
assert.equal(
  deduped.filter((entry) => entry.name === "Mimi").length,
  2,
  "duplicate cleanup does not collapse different saved characters with the same name"
);

saveStagedRosterEntries(duplicatedEntries);
const storageDeduped = removeDuplicateSavedCharacterEntriesFromStorage();
assert.deepEqual(
  storageDeduped.map((entry) => entry.id),
  ["char-mimi", "char-mimi-other", "goblin-warrior"],
  "storage duplicate cleanup keeps first saved-character entry and enemy entries"
);

const duplicatePublicActor = { id: "longbowman", name: "Longbowman", side: "enemy", source: "normalized-legacy-actor" };
saveStagedRosterEntries([stagedMimi, stagedMimiDuplicate, duplicatePublicActor, { ...duplicatePublicActor }, stagedGoblin]);
assert.equal(getDuplicateStagedRosterEntries(getStagedRosterEntries()).length, 2, "generic duplicate detection includes saved and normalized staged entries");
const allDeduped = removeDuplicateStagedRosterEntriesFromStorage();
assert.deepEqual(allDeduped.map((entry) => entry.id), ["char-mimi", "longbowman", "goblin-warrior"], "generic duplicate cleanup preserves one entry per source identity");

saveStagedRosterEntries([...originalEntries, stagedGeneratedCharacter, duplicatePublicActor]);
const pruned = pruneStagedRosterEntriesAgainstSavedCharacters([{ _id: "char-mimi", name: "Mimi" }]);
assert.deepEqual(pruned.map((entry) => entry.id), ["char-mimi", "goblin-warrior", "generated-ranger", "longbowman"], "prune removes missing saved-character entries and keeps valid public/generated/normalized entries");
assert.equal(pruned.some((entry) => entry.id === "goblin-warrior"), true, "prune keeps enemy entries");
assert.equal(pruned.some((entry) => entry.id === "generated-ranger"), true, "prune keeps generated AutoRoll entries");
assert.equal(pruned.some((entry) => entry.id === "longbowman"), true, "prune keeps normalized selectable actors");
assert.deepEqual(
  getMissingSavedCharacterStagedEntries([stagedMimi, stagedGoblin], []).map((entry) => entry.id),
  ["char-mimi"],
  "missing detection reports stale saved references when no saved characters remain"
);

assert.deepEqual(clearStagedRosterEntries(), [], "clearStagedRosterEntries clears all entries");
assert.deepEqual(getStagedRosterEntries(), [], "cleared storage loads as empty");

window.localStorage.setItem(PUBLIC_ARENA_ROSTER_STORAGE_KEY, "{bad json");
assert.deepEqual(getStagedRosterEntries(), [], "malformed storage returns safe empty state");
assert.doesNotThrow(() => getDuplicateStagedSavedCharacters([null, undefined, { side: "player" }]), "malformed duplicate detection does not throw");
assert.deepEqual(removeDuplicateSavedCharacterEntries(null), [], "malformed duplicate cleanup returns empty array");

saveStagedRosterEntries([{ ...stagedMimi, helper: () => "ignored" }]);
assert.equal(hasFunction(getStagedRosterEntries()), false, "storage output contains no functions");
assert.equal(hasFunction(removeDuplicateSavedCharacterEntries([{ ...stagedMimi, helper: () => "ignored" }])), false, "duplicate cleanup output contains no functions");
assert.equal(JSON.stringify(originalEntries), originalSnapshot, "helpers do not mutate input entries");

console.log("public staged roster storage tests passed");
