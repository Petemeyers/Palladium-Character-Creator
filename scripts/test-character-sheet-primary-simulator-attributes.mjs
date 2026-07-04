import assert from "node:assert/strict";
import { buildActorSheetDisplay, SIMULATOR_ATTRIBUTE_DEFINITIONS } from "../src/utils/actorSheetDisplay.js";

const attributes = Object.fromEntries(SIMULATOR_ATTRIBUTE_DEFINITIONS.map(([key], index) => [key, index + 1]));
const display = buildActorSheetDisplay({ attributes });
assert.equal(display.coreAttributes.entries.length, 13);
assert.deepEqual(display.coreAttributes.entries.map((entry) => entry.label), [
  "Might", "Deftness", "Vigor", "Endurance", "Mobility", "Intellect", "Awareness",
  "Cunning", "Resolve", "Discipline", "Presence", "Renown", "Favor",
]);
assert.equal(display.coreAttributes.complete, true);
console.log("character sheet simulator attribute tests passed");
