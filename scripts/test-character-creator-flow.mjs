import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ANIMAL_ATTRIBUTE_DICE,
  DEFAULT_HUMAN_ATTRIBUTE_DICE,
  resolveSpeciesAttributeDiceProfile,
} from "../src/data/simulatorAttributeDice.js";
import { SIMULATOR_ATTRIBUTE_DEFINITIONS } from "../src/data/simulatorAttributes.js";
import {
  calculateBackgroundAttributeBonuses,
  calculateFinalSimulatorAttributes,
  calculateSimulatorAttributeModifier,
  convertSimulatorToCompatibilityAttributes,
  getCreatorSectionOrder,
  getSimulatorAttributeLabel,
  hasBaseSimulatorAttributes,
  rollSimulatorBaseAttributes,
  rollSimulatorBaseAttributesFromProfile,
  ROLLABLE_SIMULATOR_ATTRIBUTE_KEYS,
} from "../src/utils/simulatorCreatorAttributes.js";
import { PUBLIC_BACKGROUNDS } from "../src/data/publicBackgrounds.js";

const creatorSource = readFileSync(
  resolve("src/components/CharacterCreator.jsx"),
  "utf8",
);
const creatorAttrsSource = readFileSync(
  resolve("src/utils/simulatorCreatorAttributes.js"),
  "utf8",
);
const actorSheetSource = readFileSync(
  resolve("src/utils/actorSheetDisplay.js"),
  "utf8",
);

assert.doesNotMatch(creatorAttrsSource, /actorSheetDisplay/, "rules module should not import display/UI files");
assert.match(actorSheetSource, /from "\.\.\/data\/simulatorAttributes\.js"/, "display should import shared attribute definitions from data");

assert.equal(calculateSimulatorAttributeModifier(8), -1);
assert.equal(calculateSimulatorAttributeModifier(10), 0);
assert.equal(calculateSimulatorAttributeModifier(15), 2);
assert.equal(
  calculateSimulatorAttributeModifier(undefined),
  Math.floor((10 - 10) / 2),
  "modifier should use corrected precedence with fallback score 10",
);

const sectionOrder = getCreatorSectionOrder();
assert.ok(sectionOrder.attributes < sectionOrder.background, "attributes section should render before background");
assert.ok(sectionOrder.background < sectionOrder.derivedStats, "background should render before derived stats");

const attributesIndex = creatorSource.indexOf('section-title">Attributes</h2>');
const backgroundIndex = creatorSource.indexOf('section-title">Determine Origin: Background</h2>');
const derivedIndex = creatorSource.indexOf('section-title">Derived Combat Stats</h2>');
assert.ok(attributesIndex > -1, "Attributes section should exist");
assert.ok(backgroundIndex > attributesIndex, "Attributes should appear before background in source");
assert.ok(derivedIndex > backgroundIndex, "Derived stats should appear after background in source");

const deterministicRoll = (notation) => {
  const match = String(notation).match(/^(\d*)d(\d+)$/i);
  const count = Number(match?.[1] || 1);
  return count * 2;
};

const defaultProfile = resolveSpeciesAttributeDiceProfile({});
assert.deepEqual(defaultProfile, { ...DEFAULT_HUMAN_ATTRIBUTE_DICE });

const defaultRolled = rollSimulatorBaseAttributesFromProfile({
  rollNotation: deterministicRoll,
});
assert.equal(Object.keys(defaultRolled).length, ROLLABLE_SIMULATOR_ATTRIBUTE_KEYS.length);
for (const key of ROLLABLE_SIMULATOR_ATTRIBUTE_KEYS) {
  assert.equal(typeof defaultRolled[key], "number", `default roll should populate ${key}`);
}

const animalProfile = resolveSpeciesAttributeDiceProfile({ species: "ANIMAL" });
assert.equal(animalProfile.PS, ANIMAL_ATTRIBUTE_DICE.PS);
assert.equal(animalProfile.PE, ANIMAL_ATTRIBUTE_DICE.PE);

const animalRolled = rollSimulatorBaseAttributesFromProfile({
  species: "ANIMAL",
  rollNotation: deterministicRoll,
});
assert.equal(animalRolled.might, 10, "animal PS 5d6 should roll with non-3d6 profile");
assert.equal(animalRolled.vigor, 8, "animal PE 4d6 should roll with non-3d6 profile");
assert.equal(animalRolled.mobility, 4, "default human Spd 2d6 should still apply on animal profile");

const rolled = rollSimulatorBaseAttributes({
  rollDie: () => 4,
});
assert.equal(Object.keys(rolled).length, ROLLABLE_SIMULATOR_ATTRIBUTE_KEYS.length);
for (const key of ROLLABLE_SIMULATOR_ATTRIBUTE_KEYS) {
  assert.equal(rolled[key], 12, `rollSimulatorBaseAttributes should populate ${key}`);
}

assert.equal(hasBaseSimulatorAttributes({}), false);
assert.equal(hasBaseSimulatorAttributes(rolled), true);

const emptyBackgroundBonuses = calculateBackgroundAttributeBonuses({
  mode: "split",
  options: ["might", "deftness", "vigor"],
  plusTwoAttribute: "might",
  plusOneAttribute: "deftness",
});
assert.deepEqual(emptyBackgroundBonuses, { might: 2, deftness: 1 });

const gatedBonuses = hasBaseSimulatorAttributes({})
  ? calculateBackgroundAttributeBonuses({
    mode: "split",
    options: ["might", "deftness", "vigor"],
    plusTwoAttribute: "might",
    plusOneAttribute: "deftness",
  })
  : {};
assert.deepEqual(gatedBonuses, {}, "background bonus should not apply before base attributes exist");

const finalWithBonuses = calculateFinalSimulatorAttributes(rolled, emptyBackgroundBonuses);
assert.equal(finalWithBonuses.might, 14);
assert.equal(finalWithBonuses.deftness, 13);

const compatibility = convertSimulatorToCompatibilityAttributes(finalWithBonuses);
for (const key of ["PS", "PP", "PE", "IQ", "ME", "MA", "PB", "Spd"]) {
  assert.equal(typeof compatibility[key], "number", `compatibility save should include ${key}`);
}

assert.match(
  creatorSource,
  /disabled=\{hp !== null \|\| !hasBaseAttributes\}/,
  "Roll HP should stay disabled until required attributes exist",
);
assert.match(
  creatorSource,
  /rollSimulatorBaseAttributesFromProfile/,
  "creator roll button should use species/profile-aware roll helper",
);
assert.doesNotMatch(creatorSource, /\b5e\b/i, "main creator UI should not mention 5e");
assert.doesNotMatch(creatorSource, /Determine Ability Scores/, "creator should not use old ability score section title");
const attributesSection = creatorSource.slice(attributesIndex, backgroundIndex);
assert.doesNotMatch(attributesSection, /Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma/, "main attributes UI should not expose classic ability names");
assert.match(creatorSource, /Roll Attributes/, "creator should expose Roll Attributes control");

for (const background of PUBLIC_BACKGROUNDS) {
  assert.equal(Array.isArray(background.attributeOptions), true);
  assert.equal(background.attributeOptions.length, 3);
  for (const attributeId of background.attributeOptions) {
    assert.equal(
      ROLLABLE_SIMULATOR_ATTRIBUTE_KEYS.includes(attributeId),
      true,
      `${background.name} has unsupported attribute option ${attributeId}`,
    );
    assert.equal(getSimulatorAttributeLabel(attributeId), getSimulatorAttributeLabel(attributeId));
  }
}

assert.equal(SIMULATOR_ATTRIBUTE_DEFINITIONS.length, 13);

console.log("character creator flow tests passed");
