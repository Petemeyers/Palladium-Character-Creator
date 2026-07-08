import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /enemy out-of-range target selected for approach/);
assert.match(source, /enemy approach branch entering movement planner/);
assert.ok(
  source.indexOf("enemy approach branch entering movement planner") >
    source.indexOf("enemy out-of-range target selected for approach"),
  "approach planner entry should happen after selected-target diagnostic in the live branch",
);
assert.match(
  source,
  /if \(needsToMoveCloser && target && livePositions\[enemy\.id\] && livePositions\[target\.id\]\) \{[\s\S]*enemy approach branch entering movement planner/,
  "needsToMoveCloser branch should enter movement planner",
);

console.log("browser selected target enters movement planner tests passed");
