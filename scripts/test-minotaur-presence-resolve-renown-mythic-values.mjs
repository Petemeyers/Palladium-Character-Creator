import assert from "node:assert/strict";
import { getSelectableActorById } from "../src/data/selectableActors.js";

const minotaur = getSelectableActorById("minotaur");
assert.equal(minotaur.attributes.resolve, 14);
assert.equal(minotaur.attributes.discipline, 10);
assert.equal(minotaur.attributes.presence, 15);
assert.equal(minotaur.attributes.renown, 2);
assert.ok(minotaur.traits.includes("Terrifying Presence"));
assert.ok(minotaur.tags.includes("mythic"));

console.log("Minotaur mythic morale attribute tests passed");
