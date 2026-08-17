import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("src/utils/three/mapBuilder3D.js", "utf8");

assert.ok(source.includes("return ((edgeIndex % 6) + 6) % 6;"));
assert.ok(!source.includes("return (edgeIndex + 1) % 6;"));
assert.ok(source.includes("((cornerIndex - 1) % 6 + 6) % 6"));
assert.ok(source.includes("((cornerIndex % 6) + 6) % 6"));
assert.ok(source.includes("mesh.rotation.y = Math.PI / 6"));

// Mathematical regression for the actual Three.js X/Z orientation.
// Authoring corner theta becomes theta - 30 degrees under +30-degree Y rotation.
// Edge midpoint angles must line up with E,SE,SW,W,NW,NE.
const deg = (radians) => radians * 180 / Math.PI;
const normalize = (angle) => ((angle % 360) + 360) % 360;
const physicalCornerAngle = (index) => normalize(index * 60 - 30);
const midpointAngle = (a, b) => {
  const ar = a * Math.PI / 180;
  const br = b * Math.PI / 180;
  const x = Math.cos(ar) + Math.cos(br);
  const z = Math.sin(ar) + Math.sin(br);
  return normalize(deg(Math.atan2(z, x)));
};

const expectedDirections = [0, 60, 120, 180, 240, 300];
for (let edge = 0; edge < 6; edge += 1) {
  const a = physicalCornerAngle(edge);
  const b = physicalCornerAngle((edge + 1) % 6);
  const midpoint = midpointAngle(a, b);
  assert.ok(
    Math.abs(midpoint - expectedDirections[edge]) < 0.0001 ||
    Math.abs(Math.abs(midpoint - expectedDirections[edge]) - 360) < 0.0001,
    `edge ${edge}: expected ${expectedDirections[edge]} degrees, got ${midpoint}`
  );
}

// Physical corner i sits between direction i-1 and i.
const expectedCornerNeighborPairs = [
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
    expectedCornerNeighborPairs[corner]
  );
}

console.log("PASS terrain mesh edge/corner directions align with axial world geometry");
