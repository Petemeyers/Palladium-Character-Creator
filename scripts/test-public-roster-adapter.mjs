import assert from "node:assert/strict";
import { adaptPublicCharacterToRosterEntry } from "../src/utils/publicRosterAdapter.js";

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
assert.equal(rosterEntry.publicClassName, "Fighter", "Public class label should be preserved");
assert.equal(rosterEntry.publicSpeciesName, "Human", "Public species label should be preserved");
assert.equal(rosterEntry.publicBackgroundName, "Soldier", "Public background label should be preserved");
assert.deepEqual(rosterEntry.publicAbilityScores, savedCharacter.finalAbilityScores, "Public score display metadata should be preserved");
assert.deepEqual(rosterEntry.publicAbilityModifiers, savedCharacter.abilityModifiers, "Public modifier display metadata should be preserved");
assert.equal(rosterEntry.compatibilityAttributes.PS, 17, "Compatibility attributes should exist for internal preview use");
assert.equal(rosterEntry.attribute_dice.PS, "17", "Fixed compatibility roll input should be created");
assert.equal(rosterEntry.autoRollReady, true, "Complete public character should be ready for preview");
assert.deepEqual(savedCharacter, snapshot, "Roster adapter should not mutate source character");

console.log("Public roster adapter tests passed.");
