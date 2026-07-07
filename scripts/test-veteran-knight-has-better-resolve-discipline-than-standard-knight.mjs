import assert from "node:assert/strict";
import { humanFighters } from "../src/data/humanFighters.js";
import { getSelectableActorById } from "../src/data/selectableActors.js";

const standard = humanFighters.find((actor) => actor.id === "knight");
const veteran = getSelectableActorById("veteran-knight");
assert.ok(veteran.attributes.resolve > standard.attributes.resolve);
assert.ok(veteran.attributes.discipline > standard.attributes.discipline);

console.log("Veteran Knight morale attribute comparison tests passed");
