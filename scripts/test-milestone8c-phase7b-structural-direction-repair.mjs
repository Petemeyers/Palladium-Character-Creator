import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("src/utils/three/mapBuilder3D.js", "utf8");

assert.ok(source.includes("return ((edgeIndex % 6) + 6) % 6;"));
assert.ok(!source.includes("return (edgeIndex + 1) % 6;"));
assert.ok(source.includes("((cornerIndex - 1) % 6 + 6) % 6"));
assert.ok(source.includes("((cornerIndex % 6) + 6) % 6"));
assert.ok(source.includes("function isContinuousTerrainTransition(type)"));
assert.ok(source.includes("isContinuousTerrainTransition(transition.type)"));
assert.ok(source.includes("mesh.rotation.y = Math.PI / 6"));

// Verify the six geometry edges face the six battlefield neighbor directions.
const normalize = (angle) => ((angle % 360) + 360) % 360;
const rad = (deg) => deg * Math.PI / 180;
const deg = (radValue) => radValue * 180 / Math.PI;

function physicalCornerAngle(index) {
  // +30 degrees around Three.js Y is -30 in X/Z atan2(z,x) convention.
  return normalize(index * 60 - 30);
}

function midpointAngle(a, b) {
  const x = Math.cos(rad(a)) + Math.cos(rad(b));
  const z = Math.sin(rad(a)) + Math.sin(rad(b));
  return normalize(deg(Math.atan2(z, x)));
}

const expected = [0, 60, 120, 180, 240, 300];
for (let edge = 0; edge < 6; edge += 1) {
  const actual = midpointAngle(
    physicalCornerAngle(edge),
    physicalCornerAngle((edge + 1) % 6)
  );
  const delta = Math.min(
    Math.abs(actual - expected[edge]),
    360 - Math.abs(actual - expected[edge])
  );
  assert.ok(delta < 0.0001, `edge ${edge}: ${actual} != ${expected[edge]}`);
}

const expectedPairs = [
  [5, 0],
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
];

for (let corner = 0; corner < 6; corner += 1) {
  assert.deepEqual(
    [((corner - 1) % 6 + 6) % 6, corner % 6],
    expectedPairs[corner]
  );
}

console.log("PASS 8C-7B structural hex edge/corner alignment");
