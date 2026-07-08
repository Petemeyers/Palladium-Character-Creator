import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

const selectedIndex = source.indexOf("enemy out-of-range target selected for approach");
const plannerIndex = source.indexOf("enemy approach branch entering movement planner");
const committedIndex = source.indexOf("enemy approach movement committed");
const runFinalizerIndex = source.indexOf('source=${approachFinalizerSource}', selectedIndex);
const fallbackFinalizerIndex = source.indexOf('"enemy-ai-no-move-fallback"', selectedIndex);
const unresolvedFinalizerIndex = source.indexOf('"enemy-ai-unresolved-turn-fallback"', selectedIndex);

assert.notEqual(selectedIndex, -1, "selected approach target diagnostic should exist");
assert.ok(
  plannerIndex > selectedIndex,
  "selected out-of-range target must enter the movement planner afterward",
);
assert.ok(
  committedIndex > plannerIndex,
  "movement planner path should have an approach movement commit diagnostic",
);
assert.ok(
  [runFinalizerIndex, fallbackFinalizerIndex, unresolvedFinalizerIndex].some((index) => index > selectedIndex),
  "selected approach target must lead to movement or a safe finalizer source",
);

assert.match(
  source,
  /enemy at \(32,15\)[\s\S]*party target at \(8,15\)|enemy out-of-range target selected for approach/,
  "browser case coverage should be represented by this selected-target guard",
);

console.log("selected approach target enters movement/finalizer tests passed");
