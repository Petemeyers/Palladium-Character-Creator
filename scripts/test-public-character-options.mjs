import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_ALIGNMENTS } from "../src/data/publicAlignment.js";
import { PUBLIC_BACKGROUNDS } from "../src/data/publicBackgrounds.js";
import { PUBLIC_LANGUAGES } from "../src/data/publicLanguages.js";
import { PUBLIC_SPECIES } from "../src/data/publicSpecies.js";
import {
  getPublicAlignments,
  getPublicLanguages,
  getPublicSpecies,
  getPublicSpeciesById,
} from "../src/utils/publicSpeciesAdapter.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const checkedFiles = [
  "src/data/publicSpecies.js",
  "src/data/publicLanguages.js",
  "src/data/publicAlignment.js",
];

const expectedSpecies = [
  "Dragonborn",
  "Dwarf",
  "Elf",
  "Gnome",
  "Goliath",
  "Halfling",
  "Human",
  "Orc",
  "Tiefling",
];

const expectedLanguages = [
  "Common",
  "Common Sign Language",
  "Draconic",
  "Dwarvish",
  "Elvish",
  "Giant",
  "Gnomish",
  "Goblin",
  "Halfling",
  "Orc",
];

const blockedTerms = [
  "Aasimar",
  "Animal",
  "Beast",
  "Monster",
  "Wolf",
  "Bear",
  "Horse",
  "NPC",
  "O." + "C.C.",
  "W." + "P.",
  "P" + "PE",
  "I" + "SP",
];

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must be unique`);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsBlockedTerm(text, term) {
  if (/^[A-Za-z]+$/.test(term)) {
    return new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(text);
  }

  return text.toLowerCase().includes(term.toLowerCase());
}

function testPublicSpecies() {
  assert.deepEqual(PUBLIC_SPECIES.map((entry) => entry.name), expectedSpecies);
  assert.equal(getPublicSpecies().length, 9);
  assertUnique(PUBLIC_SPECIES.map((entry) => entry.id), "public species ids");

  for (const entry of PUBLIC_SPECIES) {
    assert.equal(typeof entry.id, "string");
    assert.equal(typeof entry.name, "string");
    assert.equal(entry.creatureType, "Humanoid");
    assert.equal(Array.isArray(entry.sizeOptions), true);
    assert.equal(typeof entry.speed, "number");
    assert.equal(Array.isArray(entry.traits), true);
    assert.equal(entry.ruleset, "core-d20");
  }

  assert.equal(getPublicSpeciesById("human").name, "Human");
  assert.equal(getPublicSpeciesById("aasimar"), null);
  assert.equal(getPublicSpeciesById("animal"), null);
  assert.equal(getPublicSpeciesById("missing"), null);
}

function testPublicLanguages() {
  assert.deepEqual(PUBLIC_LANGUAGES.map((entry) => entry.name), expectedLanguages);
  assert.equal(getPublicLanguages().length, 10);
  assertUnique(PUBLIC_LANGUAGES.map((entry) => entry.id), "public language ids");
  assert.equal(PUBLIC_LANGUAGES.some((entry) => entry.id === "common"), true);

  for (const entry of PUBLIC_LANGUAGES) {
    assert.equal(entry.category, "standard");
    assert.equal(entry.ruleset, "core-d20");
  }
}

function testPublicAlignment() {
  assert.equal(PUBLIC_ALIGNMENTS.length, 10);
  assertUnique(PUBLIC_ALIGNMENTS.map((entry) => entry.id), "public alignment ids");
  assert.deepEqual(PUBLIC_ALIGNMENTS.map((entry) => entry.name), [
    "None / Unselected",
    "Lawful Good",
    "Neutral Good",
    "Chaotic Good",
    "Lawful Neutral",
    "True Neutral",
    "Chaotic Neutral",
    "Lawful Evil",
    "Neutral Evil",
    "Chaotic Evil",
  ]);
  assert.equal(getPublicAlignments()[0].value, "");
  assert.deepEqual(getPublicAlignments().slice(1).map((entry) => entry.value), [
    "lawful-good", "neutral-good", "chaotic-good", "lawful-neutral", "true-neutral",
    "chaotic-neutral", "lawful-evil", "neutral-evil", "chaotic-evil",
  ]);
}

function testPublicBackgroundEquipmentTags() {
  assert.equal(PUBLIC_BACKGROUNDS.length, 8);
  assertUnique(PUBLIC_BACKGROUNDS.map((entry) => entry.id), "public background ids");

  for (const background of PUBLIC_BACKGROUNDS) {
    const tags = background.startingEquipmentTags || background.equipmentTags;
    assert.equal(Array.isArray(tags), true);
    assert.ok(tags.length > 0, `${background.name} must have starting equipment tags`);
    assert.equal(Array.isArray(background.equipmentTags), true);
    assert.ok(background.equipmentTags.length > 0, `${background.name} must keep equipment tags`);
    for (const tag of [...tags, ...background.equipmentTags]) {
      for (const term of blockedTerms) {
        assert.equal(
          containsBlockedTerm(String(tag), term),
          false,
          `${background.name} equipment tag contains blocked public option term ${term}`,
        );
      }
    }
  }
}

async function assertNoBlockedTerms() {
  for (const file of checkedFiles) {
    const text = await readFile(resolve(repoRoot, file), "utf8");
    for (const term of blockedTerms) {
      assert.equal(
        containsBlockedTerm(text, term),
        false,
        `${file} contains blocked public option term ${term}`,
      );
    }
  }
}

async function run() {
  testPublicSpecies();
  testPublicLanguages();
  testPublicAlignment();
  testPublicBackgroundEquipmentTags();
  await assertNoBlockedTerms();

  console.log("public character option tests passed");
}

run();
