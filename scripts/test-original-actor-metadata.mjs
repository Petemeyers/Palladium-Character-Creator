import assert from "node:assert/strict";

import SELECTABLE_ACTORS from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { buildOriginalActorMetadata } from "../src/utils/originalActorMetadata.js";
import { summarizeOriginalActorMetadata } from "../src/utils/originalActorMetadataDisplay.js";
import { normalizeCombatant } from "../src/utils/normalizeCombatant.js";

const ATTRIBUTE_KEYS = [
  "might",
  "deftness",
  "vigor",
  "endurance",
  "mobility",
  "intellect",
  "awareness",
  "cunning",
  "resolve",
  "discipline",
  "presence",
  "renown",
  "favor",
];

const compatibilityActor = {
  name: "Compatibility Fighter",
  PS: 16,
  PP: 14,
  PE: 12,
  IQ: 13,
  ME: 11,
  MA: 9,
  Spd: 10,
  training: ["legacy technique"],
  movement: 30,
};
const compatibilitySnapshot = JSON.stringify(compatibilityActor);
const normalized = normalizeCombatant(compatibilityActor);
const normalizedSummary = summarizeOriginalActorMetadata(normalized);

assert.deepEqual(
  Object.keys(normalized.attributes).filter((key) => ATTRIBUTE_KEYS.includes(key)),
  ATTRIBUTE_KEYS,
  "normalized combatants expose all 13 original attributes",
);
assert.equal(normalized.attributes.might, 16);
assert.equal(normalized.attributes.deftness, 14);
assert.equal(normalized.attributes.vigor, 12);
assert.equal(normalized.attributes.endurance, 12);
assert.equal(normalized.attributes.mobility, 14);
assert.equal(normalized.attributes.intellect, 13);
assert.equal(normalized.attributes.awareness, 11);
assert.equal(normalized.attributes.resolve, 11);
assert.equal(normalized.attributes.presence, 9);
assert.equal(normalized.attributes.renown, 0);
assert.equal(normalized.attributes.favor, 0);
assert.deepEqual(normalized.training, ["legacy technique"], "legacy training shape remains untouched");
assert.equal(normalized.movement, 30, "legacy runtime movement remains untouched");
assert.equal(normalized.originalActorMetadata.training.formationDrill, 0);
assert.deepEqual(normalized.originalActorMetadata.traits, []);
assert.equal(normalized.originalActorMetadata.state.morale, 100);
assert.equal(normalized.originalActorMetadata.reputation.local, 0);
assert.equal(normalized.originalActorMetadata.favor.sacred, 0);
assert.equal(normalized.originalActorMetadata.behavior.instinct, 0);
assert.equal(normalized.originalActorMetadata.movement.pace, 30);
assert.equal(JSON.stringify(compatibilityActor), compatibilitySnapshot, "normalization does not mutate its source");
assert.deepEqual(
  normalizedSummary.attributes.map((attribute) => attribute.label),
  ["Might", "Deftness", "Vigor", "Endurance", "Mobility", "Intellect", "Awareness", "Cunning", "Resolve", "Discipline", "Presence", "Renown", "Favor"],
  "display helper returns all 13 original attribute names",
);
assert.equal(normalizedSummary.movement.pace, "30");
assert.equal(normalizedSummary.training.formationDrill, "0");
assert.equal(normalizedSummary.traits, "None");
assert.equal(normalizedSummary.state.morale, "100");
assert.equal(normalizedSummary.reputation.local, "0");
assert.equal(normalizedSummary.favor.sacred, "0");
assert.equal(normalizedSummary.behavior.instinct, "0");

const defaults = buildOriginalActorMetadata({});
ATTRIBUTE_KEYS.forEach((key) => {
  assert.equal(typeof defaults.attributes[key], "number", `${key} should have a numeric default`);
});
assert.deepEqual(defaults.movement.modes, ["ground"]);
assert.equal(defaults.movement.pace, 30);
assert.equal(defaults.movement.burst, 60);
assert.equal(defaults.movement.recoveryStep, 5);

SELECTABLE_ACTORS.forEach((actor) => {
  const conversion = adaptSelectableActorToCombatant(actor);
  assert.equal(conversion.ok, true, `${actor.id} should adapt`);
  ATTRIBUTE_KEYS.forEach((key) => {
    assert.equal(typeof conversion.combatant.attributes[key], "number", `${actor.id} should expose attributes.${key}`);
  });
  assert.ok(conversion.combatant.training && !Array.isArray(conversion.combatant.training));
  assert.ok(Array.isArray(conversion.combatant.traits));
  assert.ok(conversion.combatant.state);
  assert.ok(conversion.combatant.reputation);
  assert.ok(conversion.combatant.favor);
  assert.ok(conversion.combatant.behavior);
  assert.ok(conversion.combatant.originalActorMetadata.movement);
});

const getActor = (id) => SELECTABLE_ACTORS.find((actor) => actor.id === id);
const longbowman = adaptSelectableActorToCombatant(getActor("longbowman")).combatant;
const longbowmanSummary = summarizeOriginalActorMetadata(longbowman);
assert.equal(longbowman.aiRole, "archer");
assert.equal(longbowman.modelKey, "longbowman");
assert.equal(longbowman.attacks[0].name, "Longbow Shot");
assert.equal(longbowman.attacks[0].rangeProfile.normal, 150);
assert.equal(longbowmanSummary.attributes.length, 13);
assert.equal(longbowmanSummary.movement.modes, "ground");

const hawk = adaptSelectableActorToCombatant(getActor("hawk")).combatant;
const hawkSummary = summarizeOriginalActorMetadata(hawk);
assert.equal(hawk.movement.flying, 60, "legacy flight speed remains available");
assert.ok(hawk.movement.modes.includes("flying"));
assert.equal(hawk.originalActorMetadata.movement.flying.pace, 60);
assert.equal(hawk.abilities.movement.flight.active, true);
assert.equal(hawkSummary.movement.modes, "ground, flying");

const minotaur = adaptSelectableActorToCombatant(getActor("minotaur")).combatant;
const minotaurSummary = summarizeOriginalActorMetadata(minotaur);
assert.equal(minotaur.name, "Minotaur");
assert.equal(minotaur.modelKey, "minotaur");
assert.equal(minotaur.category, "mythic");
assert.equal(minotaur.aiRole, "brute");
assert.equal(minotaurSummary.attributes.find((attribute) => attribute.key === "might").value, "19");

console.log("original actor metadata tests passed");
