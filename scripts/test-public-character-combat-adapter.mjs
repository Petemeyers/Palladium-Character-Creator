import assert from "node:assert/strict";
import {
  adaptPublicCharacterForAutoRoll,
  buildCompatibilityAttributesFromPublicCharacter,
  getPlayableCharacterImportLogLines,
  isSavedCharacterCombatData,
} from "../src/utils/publicCharacterCombatAdapter.js";

const sampleCharacter = {
  _id: "sample-public-character",
  name: "Ada",
  publicClassName: "Barbarian",
  publicSpeciesName: "Human",
  publicBackgroundName: "Soldier",
  publicLanguages: ["Common", "Dwarvish"],
  alignment: "Neutral",
  publicSkillProficiencies: ["perception"],
  finalAbilityScores: {
    str: 16,
    dex: 14,
    con: 14,
    int: 10,
    wis: 12,
    cha: 8,
  },
  abilityModifiers: {
    str: 3,
    dex: 2,
    con: 2,
    int: 0,
    wis: 1,
    cha: -1,
  },
  publicDerivedStats: {
    hitPoints: 14,
    hitDie: "d12",
    baseArmorClass: 12,
    initiative: 2,
    passivePerception: 13,
    proficiencyBonus: 2,
  },
  speed: 30,
};

const originalSnapshot = JSON.parse(JSON.stringify(sampleCharacter));
const attributes = buildCompatibilityAttributesFromPublicCharacter(sampleCharacter);

assert.equal(attributes.PS, 16, "Strength should map to PS");
assert.equal(attributes.PP, 14, "Dexterity should map to PP");
assert.equal(attributes.PE, 14, "Constitution should map to PE");
assert.equal(attributes.IQ, 10, "Intelligence should map to IQ");
assert.equal(attributes.ME, 12, "Wisdom should map to ME");
assert.equal(attributes.MA, 8, "Charisma should map to MA");
assert.equal(attributes.PB, 8, "PB should receive a safe compatibility value");
assert.equal(attributes.Spd, 30, "Speed should map to Spd");

const adaptation = adaptPublicCharacterForAutoRoll(sampleCharacter);

assert.equal(adaptation.ready, true, "Complete public character should be ready for auto-roll");
assert.deepEqual(adaptation.missingRequiredFields, [], "Ready character should not report missing fields");
assert.equal(adaptation.combatCharacter.attribute_dice.PS, "16", "Generated attribute dice should preserve the fixed score");
assert.equal(adaptation.combatCharacter.HP, 14, "Public HP should be preserved");
assert.equal(adaptation.combatCharacter.guardRating, 12, "Public base AC should be preserved");
assert.equal(adaptation.combatCharacter.Spd, 30, "Public speed should be preserved");
assert.equal(adaptation.combatCharacter.publicClassName, "Barbarian", "Public class display data should be preserved");
assert.equal(adaptation.combatCharacter.publicSpeciesName, "Human", "Public species display data should be preserved");
assert.deepEqual(
  adaptation.combatCharacter.finalAbilityScores,
  sampleCharacter.finalAbilityScores,
  "Public ability scores should be preserved"
);
assert.deepEqual(
  adaptation.combatCharacter.abilityModifiers,
  sampleCharacter.abilityModifiers,
  "Public ability modifiers should be preserved"
);
assert.deepEqual(
  adaptation.combatCharacter.publicAbilityScores,
  sampleCharacter.finalAbilityScores,
  "Display metadata should keep public scores separate from compatibility attributes"
);
assert.deepEqual(
  adaptation.combatCharacter.publicAbilityModifiers,
  sampleCharacter.abilityModifiers,
  "Display metadata should keep public modifiers separate from compatibility attributes"
);
assert.equal(adaptation.combatCharacter.publicDisplaySource, "saved-character", "Public display source should be marked");
assert.equal(adaptation.combatCharacter.source, "saved-character", "Combat character should mark saved character source");
assert.equal(adaptation.combatCharacter.sourceCharacterId, "sample-public-character", "Combat character should preserve saved character id");
assert.equal(adaptation.combatCharacter.generated, false, "Saved character combat data should not be marked generated");
assert.equal(adaptation.combatCharacter.class, "Barbarian", "Class compatibility field should be set at the adapter boundary");
assert.equal(isSavedCharacterCombatData(adaptation.combatCharacter), true, "Saved combat data should be detected");
assert.deepEqual(
  getPlayableCharacterImportLogLines(adaptation.combatCharacter, "Ada"),
  ["Loaded saved character Ada.", "Loaded saved character attributes from Character List."],
  "Saved character import log wording should not say Auto-rolled"
);
assert.deepEqual(sampleCharacter, originalSnapshot, "Adapter should not mutate the original character");

const publicScoresFallback = adaptPublicCharacterForAutoRoll({
  name: "Fallback",
  publicClassName: "Fighter",
  publicSpeciesName: "Human",
  publicAbilityScores: {
    str: 18,
    dex: 13,
    con: 12,
    int: 10,
    wis: 9,
    cha: 8,
  },
  publicDerivedStats: {
    hitPoints: 10,
    baseArmorClass: 11,
  },
  speed: 25,
});
assert.equal(publicScoresFallback.ready, true, "publicAbilityScores fallback should produce ready combat data");
assert.equal(publicScoresFallback.combatCharacter.attributes.PS, 18, "publicAbilityScores should map to compatibility attributes");
assert.equal(publicScoresFallback.combatCharacter.Spd, 25, "saved speed should map to combat speed");

assert.equal(
  getPlayableCharacterImportLogLines({ source: "autoroll", generated: true }, "New Fighter")[0],
  "Auto-rolled New Fighter:",
  "Generated characters keep AutoRoll wording"
);

const incompleteAdaptation = adaptPublicCharacterForAutoRoll({
  name: "Incomplete",
  publicClassName: "Wizard",
});

assert.equal(incompleteAdaptation.ready, false, "Incomplete public character should remain disabled");
assert.equal(incompleteAdaptation.combatCharacter, null, "Incomplete character should not produce roll input");
assert.ok(incompleteAdaptation.missingRequiredFields.includes("species"), "Missing species should be reported");
assert.ok(
  incompleteAdaptation.missingRequiredFields.some((field) => field.startsWith("attribute ")),
  "Missing attributes should be reported"
);

console.log("Public character combat adapter baseline passed.");
