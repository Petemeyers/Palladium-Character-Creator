import assert from "node:assert/strict";
import {
  adaptPublicCharacterToRosterEntry,
  resolveStagedSavedCharacterForImport,
} from "../src/utils/publicRosterAdapter.js";
import { buildCombatDisplayStats } from "../src/utils/combatDisplayStats.js";

const savedCharacter = {
  _id: "saved-public-1",
  name: "Rin",
  publicClassName: "Fighter",
  publicSpeciesName: "Human",
  publicBackgroundName: "Soldier",
  finalAbilityScores: {
    str: 17,
    dex: 15,
    con: 13,
    int: 12,
    wis: 10,
    cha: 8,
  },
  abilityModifiers: {
    str: 3,
    dex: 2,
    con: 1,
    int: 1,
    wis: 0,
    cha: -1,
  },
  publicDerivedStats: {
    hitPoints: 11,
    hitDie: "d10",
    baseArmorClass: 12,
    initiative: 2,
    passivePerception: 10,
    proficiencyBonus: 2,
  },
  speed: 30,
};

const snapshot = JSON.parse(JSON.stringify(savedCharacter));
const rosterEntry = adaptPublicCharacterToRosterEntry(savedCharacter);

assert.equal(rosterEntry.id, "saved-public-1", "Roster entry should preserve saved id");
assert.equal(rosterEntry.name, "Rin", "Roster entry should preserve name");
assert.equal(rosterEntry.side, "player", "Saved public character should become player-side roster metadata");
assert.equal(rosterEntry.source, "saved-character", "Roster entry should mark saved character source");
assert.equal(rosterEntry.sourceCharacterId, "saved-public-1", "Roster entry should preserve source character id");
assert.equal(rosterEntry.generated, false, "Roster entry should mark saved characters as not generated");
assert.equal(rosterEntry.publicClassName, "Fighter", "Public class label should be preserved");
assert.equal(rosterEntry.publicSpeciesName, "Human", "Public species label should be preserved");
assert.equal(rosterEntry.publicBackgroundName, "Soldier", "Public background label should be preserved");
assert.deepEqual(rosterEntry.publicAbilityScores, savedCharacter.finalAbilityScores, "Public score display metadata should be preserved");
assert.deepEqual(rosterEntry.publicAbilityModifiers, savedCharacter.abilityModifiers, "Public modifier display metadata should be preserved");
assert.equal(rosterEntry.compatibilityAttributes.PS, 17, "Compatibility attributes should exist for internal preview use");
assert.equal(rosterEntry.attribute_dice.PS, "17", "Fixed compatibility roll input should be created");
assert.equal(rosterEntry.autoRollReady, true, "Complete public character should be ready for preview");
assert.deepEqual(savedCharacter, snapshot, "Roster adapter should not mutate source character");

const staleStagedEntry = {
  id: "saved-public-1",
  name: "Old Rin",
  side: "player",
  source: "saved-character",
  publicAbilityScores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
};
const resolved = resolveStagedSavedCharacterForImport(staleStagedEntry, [savedCharacter]);
assert.equal(resolved.ok, true, "staged saved character resolves against current saved character list");
assert.equal(resolved.entry.name, "Rin", "resolved import uses fresh saved character name");
assert.equal(resolved.entry.publicAbilityScores.str, 17, "resolved import uses fresh saved ability scores");
assert.equal(resolved.entry.autoRollCharacter.attributes.PS, 17, "resolved import preserves saved compatibility attributes");
const resolvedDisplayStats = buildCombatDisplayStats(resolved.entry.autoRollCharacter);
assert.equal(resolvedDisplayStats.sourceLabel, "Saved Character", "resolved saved import should display saved source");
assert.equal(resolvedDisplayStats.abilityScores.strength, 17, "resolved saved import should display fresh saved Strength");
assert.equal(resolvedDisplayStats.movementSpeed, 30, "resolved saved import should display saved movement speed");

const missing = resolveStagedSavedCharacterForImport(staleStagedEntry, []);
assert.equal(missing.ok, false, "missing saved character is skipped safely");
assert.equal(missing.reason, "saved character no longer exists");

const enemyEntry = { id: "goblin-warrior", name: "Goblin Warrior", side: "enemy", source: "public-enemy" };
const resolvedEnemy = resolveStagedSavedCharacterForImport(enemyEntry, [savedCharacter]);
assert.equal(resolvedEnemy.ok, true, "public enemy entries pass through saved-character resolver");
assert.equal(resolvedEnemy.entry.name, "Goblin Warrior");

console.log("Public roster adapter tests passed.");
