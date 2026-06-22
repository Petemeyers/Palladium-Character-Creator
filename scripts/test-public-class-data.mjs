import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_BACKGROUNDS } from "../src/data/publicBackgrounds.js";
import { PUBLIC_CLASSES } from "../src/data/publicClasses.js";
import { PUBLIC_SKILLS } from "../src/data/publicSkills.js";
import {
  createPublicCharacterDefaults,
  getPublicBackgroundById,
  getPublicBackgrounds,
  getPublicClassById,
  getPublicClassByName,
  getPublicClasses,
  getPublicSkillById,
  getPublicSkills,
} from "../src/utils/publicClassAdapter.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const checkedFiles = [
  "src/data/publicClasses.js",
  "src/data/publicSkills.js",
  "src/data/publicBackgrounds.js",
  "src/utils/publicClassAdapter.js",
];

const blockedTerms = [
  "pro" + "fession",
  "occu" + "pation",
  "O." + "C.C.",
  "Hand" + " to " + "Hand",
  "W." + "P.",
  "P" + "PE",
  "I" + "SP",
  "S" + "DC",
  "M" + "DC",
];

const blockedImports = [
  "skillProgression",
  "skillBonuses",
  "originalGameData",
  "pro" + "fessionSkills",
  "pro" + "fessionSkillMapper",
  "skillSystem",
  "savingThrowsSystem",
  "statusEffectSystem",
  "unifiedAbilities",
];

function assertClassShape(entry) {
  assert.equal(typeof entry.id, "string");
  assert.equal(typeof entry.name, "string");
  assert.equal(typeof entry.hitDie, "string");
  assert.equal(Array.isArray(entry.primaryAbilities), true);
  assert.equal(Array.isArray(entry.savingThrowProficiencies), true);
  assert.equal(typeof entry.skillChoices, "object");
  assert.equal(Array.isArray(entry.fixedSkills), true);
  assert.equal(Array.isArray(entry.weaponProficiencies), true);
  assert.equal(Array.isArray(entry.armorTraining), true);
  assert.equal(Array.isArray(entry.toolProficiencies), true);
  assert.equal(Array.isArray(entry.startingEquipmentOptions), true);
  assert.ok(entry.startingEquipmentOptions.length > 0, `${entry.name} must have starting equipment options`);
  assert.equal(
    new Set(entry.startingEquipmentOptions.map((option) => option.id)).size,
    entry.startingEquipmentOptions.length,
    `${entry.name} equipment option ids must be unique`,
  );
  for (const option of entry.startingEquipmentOptions) {
    assert.equal(typeof option.id, "string");
    assert.equal(typeof option.label, "string");
    assert.equal(Array.isArray(option.items), true);
    assert.equal(typeof option.gold, "number");
    for (const item of option.items) {
      assert.equal(typeof item, "string");
    }
  }
  assert.equal(Array.isArray(entry.startingEquipmentTags), true);
  assert.equal(Array.isArray(entry.levelOneFeatures), true);
  assert.equal(entry.ruleset, "core-d20");
}

function assertSkillShape(entry) {
  assert.equal(typeof entry.id, "string");
  assert.equal(typeof entry.name, "string");
  assert.equal(typeof entry.ability, "string");
  assert.equal(typeof entry.description, "string");
}

function assertBackgroundShape(entry) {
  assert.equal(typeof entry.id, "string");
  assert.equal(typeof entry.name, "string");
  assert.equal(Array.isArray(entry.skillProficiencies), true);
  assert.equal(typeof entry.feature, "string");
}

async function assertNoBlockedTermsOrLegacyImports() {
  for (const file of checkedFiles) {
    const text = await readFile(resolve(repoRoot, file), "utf8");
    for (const term of blockedTerms) {
      assert.equal(
        text.toLowerCase().includes(term.toLowerCase()),
        false,
        `${file} contains blocked public-data term ${term}`,
      );
    }
    for (const importName of blockedImports) {
      assert.equal(
        text.includes(importName),
        false,
        `${file} imports or names inactive public-data source ${importName}`,
      );
    }
  }
}

function testPublicClasses() {
  const expectedClasses = [
    "Barbarian",
    "Bard",
    "Cleric",
    "Druid",
    "Fighter",
    "Monk",
    "Paladin",
    "Ranger",
    "Rogue",
    "Sorcerer",
    "Warlock",
    "Wizard",
  ];
  assert.equal(PUBLIC_CLASSES.length, 12);
  assert.deepEqual(PUBLIC_CLASSES.map((entry) => entry.name), expectedClasses);
  assert.equal(new Set(PUBLIC_CLASSES.map((entry) => entry.id)).size, PUBLIC_CLASSES.length);
  for (const removedName of ["Scholar", "Healer", "Guardian", "Adept"]) {
    assert.equal(
      PUBLIC_CLASSES.some((entry) => entry.name === removedName),
      false,
      `${removedName} should not be a public class option`,
    );
  }
  PUBLIC_CLASSES.forEach(assertClassShape);
}

function testPublicSkills() {
  assert.equal(PUBLIC_SKILLS.length, 14);
  PUBLIC_SKILLS.forEach(assertSkillShape);
  assert.equal(getPublicSkillById("animal-handling").name, "Animal Handling");
}

function testPublicBackgrounds() {
  assert.equal(PUBLIC_BACKGROUNDS.length, 8);
  PUBLIC_BACKGROUNDS.forEach(assertBackgroundShape);
  for (const background of PUBLIC_BACKGROUNDS) {
    assert.equal(Array.isArray(background.equipmentTags), true);
    assert.ok(background.equipmentTags.length > 0, `${background.name} must have equipment tags`);
  }
}

function testAdapterLookups() {
  assert.equal(getPublicClasses().length, 12);
  assert.equal(getPublicSkills().length, 14);
  assert.equal(getPublicBackgrounds().length, 8);
  assert.equal(getPublicClassById("fighter").name, "Fighter");
  assert.equal(getPublicClassById("wizard").name, "Wizard");
  assert.equal(getPublicClassByName("Fighter").id, "fighter");
  assert.equal(getPublicClassByName("Barbarian").id, "barbarian");
  assert.equal(getPublicClassById("missing"), null);
  assert.equal(getPublicBackgroundById("soldier").name, "Soldier");
  assert.equal(getPublicBackgroundById("missing"), null);
}

function testCharacterDefaults() {
  assert.deepEqual(createPublicCharacterDefaults("fighter", "soldier"), {
    ruleset: "core-d20",
    sizePolicy: "legacy-compatible",
    legacyCompatibility: true,
    classId: "fighter",
    className: "Fighter",
    backgroundId: "soldier",
    backgroundName: "Soldier",
    skillProficiencies: ["athletics", "intimidation"],
    savingThrowProficiencies: ["str", "con"],
    hitDie: "d10",
    features: ["fighting-style", "second-wind", "Military Bearing"],
    equipmentTags: ["martial-weapons", "shield", "medium-armor", "uniform", "trophy", "travel-gear"],
  });
}

async function run() {
  testPublicClasses();
  testPublicSkills();
  testPublicBackgrounds();
  testAdapterLookups();
  testCharacterDefaults();
  await assertNoBlockedTermsOrLegacyImports();

  console.log("public class data tests passed");
}

run();
