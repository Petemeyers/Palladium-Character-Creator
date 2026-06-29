import assert from "node:assert/strict";

import {
  getAmbiguousSavedCharacterStagedEntries,
  getMissingSavedCharacterStagedEntries,
  pruneStagedRosterEntriesAgainstSavedCharacters,
  repairStagedSavedCharacterEntriesInStorage,
  resolveSavedCharacterForStagedEntry,
  saveStagedRosterEntries,
} from "../src/utils/publicStagedRosterStorage.js";
import {
  adaptPublicCharacterToRosterEntry,
  resolveStagedSavedCharacterForImport,
} from "../src/utils/publicRosterAdapter.js";

const data = new Map();
global.window = {
  localStorage: {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  },
};

const currentCharacter = {
  _id: "current-thaolin-id",
  name: "Thaolin",
  publicClassName: "Fighter",
  publicSpeciesName: "Human",
  publicBackgroundName: "Soldier",
  finalAbilityScores: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 9 },
  publicDerivedStats: { hitPoints: 14, baseArmorClass: 13 },
  speed: 30,
};
const staleEntry = {
  id: "old-generated-thaolin-id",
  stagedEntryId: "staged-row-thaolin",
  sourceCharacterId: "old-saved-thaolin-id",
  savedCharacterId: "old-saved-thaolin-id",
  name: "Thaolin",
  publicClassName: "Fighter",
  publicSpeciesName: "Human",
  publicBackgroundName: "Soldier",
  side: "player",
  team: "party",
  controlMode: "manual",
  source: "saved-character",
};
const normalizedActors = [
  { id: "minotaur", stagedEntryId: "stage-minotaur", name: "Minotaur", side: "enemy", source: "normalized-legacy-actor", normalizedSelectableActor: true },
  { id: "goblin-warrior", stagedEntryId: "stage-goblin", name: "Goblin Warrior", side: "enemy", source: "public-enemy" },
  { id: "longbowman", stagedEntryId: "stage-longbowman", name: "Longbowman", side: "enemy", source: "normalized-legacy-actor", normalizedSelectableActor: true },
];
const staleSnapshot = JSON.stringify(staleEntry);
const characterSnapshot = JSON.stringify(currentCharacter);

const resolution = resolveSavedCharacterForStagedEntry(staleEntry, [currentCharacter]);
assert.equal(resolution.status, "repaired", "unique name and public identity repairs a stale saved-character link");
assert.equal(resolution.stableId, currentCharacter._id);
assert.equal(resolution.entry.sourceCharacterId, currentCharacter._id);
assert.equal(resolution.entry.savedCharacterId, currentCharacter._id);
assert.equal(resolution.entry.stagedEntryId, staleEntry.stagedEntryId, "staged row identity survives repair");
assert.notEqual(resolution.entry.stagedEntryId, resolution.entry.savedCharacterId, "staged and saved-character identities remain separate");
assert.equal(resolution.entry.side, "player");
assert.equal(resolution.entry.team, "party");
assert.equal(resolution.entry.controlMode, "manual");

saveStagedRosterEntries([staleEntry, ...normalizedActors]);
const persistedRepair = repairStagedSavedCharacterEntriesInStorage([currentCharacter]);
assert.equal(persistedRepair.changed, true);
assert.equal(persistedRepair.entries[0].savedCharacterId, currentCharacter._id, "repair persists the stable saved-character ID");
assert.deepEqual(persistedRepair.entries.slice(1), normalizedActors, "repair leaves normalized and public enemies untouched");

const imported = resolveStagedSavedCharacterForImport(staleEntry, [currentCharacter]);
assert.equal(imported.ok, true, "repairable staged character imports successfully");
assert.equal(imported.savedCharacterId, currentCharacter._id);
assert.equal(imported.entry.name, currentCharacter.name);
assert.equal(imported.entry.stagedEntryId, staleEntry.stagedEntryId);
assert.equal(imported.entry.controlMode, "manual");

const ambiguousCharacters = [
  currentCharacter,
  { ...currentCharacter, _id: "second-thaolin-id" },
];
const ambiguous = resolveSavedCharacterForStagedEntry(staleEntry, ambiguousCharacters);
assert.equal(ambiguous.status, "ambiguous", "duplicate safe identity matches are not guessed");
assert.equal(ambiguous.character, null);
assert.equal(getAmbiguousSavedCharacterStagedEntries([staleEntry], ambiguousCharacters).length, 1);
assert.equal(getMissingSavedCharacterStagedEntries([staleEntry], ambiguousCharacters).length, 0);

saveStagedRosterEntries([staleEntry, ...normalizedActors]);
const repairablePrune = pruneStagedRosterEntriesAgainstSavedCharacters([currentCharacter]);
assert.equal(repairablePrune.length, 4, "Remove Missing keeps repairable and non-saved staged entries");
assert.equal(repairablePrune[0].savedCharacterId, currentCharacter._id);

saveStagedRosterEntries([staleEntry, ...normalizedActors]);
const missingPrune = pruneStagedRosterEntriesAgainstSavedCharacters([]);
assert.deepEqual(missingPrune, normalizedActors, "Remove Missing removes only a truly missing saved-character entry");

const newlyStaged = adaptPublicCharacterToRosterEntry(currentCharacter);
assert.equal(newlyStaged.savedCharacterId, currentCharacter._id, "new staging stores the stable saved-character ID");
assert.notEqual(newlyStaged.stagedEntryId, newlyStaged.savedCharacterId, "new staging creates a separate staged row ID");
assert.equal(JSON.stringify(staleEntry), staleSnapshot, "repair does not mutate the staged source object");
assert.equal(JSON.stringify(currentCharacter), characterSnapshot, "repair does not mutate the Character List object");

console.log("staged saved character repair tests passed");
