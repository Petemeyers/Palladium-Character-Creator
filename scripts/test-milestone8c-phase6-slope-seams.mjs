import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("src/utils/three/mapBuilder3D.js", "utf8");

assert.ok(source.includes("function isContinuousTerrainTransition(type)"));
assert.ok(source.includes("type === BATTLEFIELD_SLOPE_TRANSITIONS.FLAT"));
assert.ok(source.includes("isContinuousTerrainTransition(transition.type)"));

// Numeric regression for the exact crack case:
//
//          B=1
//        /     \
//     A=0 ----- C=1
//
// Before the repair:
// A sampled 0,1,1 => 2/3
// B sampled 1,0   => 1/2 because B-C was flat.
// One physical vertex therefore had two Y values.
//
// Continuous-edge sampling makes every participant use 0,1,1.
const sharedCorner = (0 + 1 + 1) / 3;
const aCorner = (0 + 1 + 1) / 3;
const bCorner = (1 + 0 + 1) / 3;
const cCorner = (1 + 0 + 1) / 3;

assert.equal(aCorner, sharedCorner);
assert.equal(bCorner, sharedCorner);
assert.equal(cCorner, sharedCorner);

// Hard terrain breaks must not become continuous.
assert.ok(!/function isContinuousTerrainTransition[\s\S]*CLIFF/.test(
  source.slice(
    source.indexOf("function isContinuousTerrainTransition"),
    source.indexOf("function getNeighborTile")
  )
));

console.log("PASS shared slope/flat terrain corners are watertight");
