import assert from "node:assert/strict";
import {
  computeBattlefieldReachability,
  findBattlefieldTraversalPath,
  resolveBattlefieldPathTraversal,
  resolveBattlefieldTraversalStep,
} from "../src/utils/maps/battlefieldTraversalAuthority.js";

const makeMap = (heights) => ({
  width: heights[0].length,
  height: heights.length,
  grid: heights.map((row) => row.map((height) => ({
    terrain: "grass",
    terrainType: "grass",
    height,
    elevation: height,
  }))),
});

const flat = makeMap([[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
const gentle = makeMap([[0, 1, 2], [0, 0, 0], [0, 0, 0]]);
const steep = makeMap([[0, 2, 2], [0, 0, 0], [0, 0, 0]]);
const cliff = makeMap([[0, 3, 0], [0, 0, 0], [0, 0, 0]]);

{
  const result = resolveBattlefieldTraversalStep({
    mapDefinition: gentle,
    from: { x: 0, y: 0 },
    to: { x: 1, y: 0 },
    movementMode: "walk",
  });
  assert.equal(result.accepted, true);
  assert.equal(result.uphill, true);
  assert.equal(result.effectiveDistanceFeet, 7.5);
}

{
  const walk = resolveBattlefieldTraversalStep({
    mapDefinition: steep,
    from: { x: 0, y: 0 },
    to: { x: 1, y: 0 },
    movementMode: "walk",
  });
  assert.equal(walk.accepted, true);
  assert.equal(walk.staminaCost, 1);
  assert.equal(walk.effectiveDistanceFeet, 10);

  const run = resolveBattlefieldTraversalStep({
    mapDefinition: steep,
    from: { x: 0, y: 0 },
    to: { x: 1, y: 0 },
    movementMode: "run",
  });
  assert.equal(run.accepted, false);
  assert.equal(run.reason, "steep-slope-requires-walk");
}

{
  const result = resolveBattlefieldTraversalStep({
    mapDefinition: cliff,
    from: { x: 0, y: 0 },
    to: { x: 1, y: 0 },
    movementMode: "walk",
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "cliff-requires-climb");
}

{
  const result = resolveBattlefieldPathTraversal({
    mapDefinition: gentle,
    from: { x: 0, y: 0 },
    path: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
    movementMode: "walk",
    maxDistanceFeet: 15,
  });
  assert.equal(result.accepted, true);
  assert.equal(result.baseDistanceFeet, 10);
  assert.equal(result.extraDistanceFeet, 5);
  assert.equal(result.effectiveDistanceFeet, 15);
}

{
  const reach = computeBattlefieldReachability({
    mapDefinition: flat,
    origin: { x: 0, y: 1 },
    movementMode: "walk",
    maxDistanceFeet: 10,
  });
  assert.equal(reach.accepted, true);
  assert.ok(reach.hexes.some((hex) => hex.x === 2 && hex.y === 1));
}

{
  const path = findBattlefieldTraversalPath({
    mapDefinition: cliff,
    from: { x: 0, y: 0 },
    destination: { x: 2, y: 0 },
    movementMode: "walk",
    maxDistanceFeet: 30,
  });
  assert.equal(path.accepted, true);
  assert.equal(path.exact, true);
  assert.ok(path.path.length >= 2);
  assert.notDeepEqual(path.path[0], { x: 1, y: 0 }, "path should route around cliff edge");
}

console.log("PASS battlefield traversal authority");

{
  const result = resolveBattlefieldTraversalStep({
    mapDefinition: gentle,
    from: { x: 1, y: 0 },
    to: { x: 0, y: 0 },
    movementMode: "walk",
  });
  assert.equal(result.accepted, true);
  assert.equal(result.downhill, true);
  assert.equal(result.effectiveDistanceFeet, 5);
}

{
  const gentleCharge = resolveBattlefieldTraversalStep({
    mapDefinition: gentle,
    from: { x: 0, y: 0 },
    to: { x: 1, y: 0 },
    movementMode: "charge",
  });
  assert.equal(gentleCharge.accepted, true);

  const steepCharge = resolveBattlefieldTraversalStep({
    mapDefinition: steep,
    from: { x: 0, y: 0 },
    to: { x: 1, y: 0 },
    movementMode: "charge",
  });
  assert.equal(steepCharge.accepted, false);
  assert.equal(steepCharge.reason, "charge-blocked-by-slope");
}

{
  const result = resolveBattlefieldTraversalStep({
    mapDefinition: cliff,
    from: { x: 0, y: 0 },
    to: { x: 1, y: 0 },
    movementMode: "flight",
  });
  assert.equal(result.accepted, true);
  assert.equal(result.effectiveDistanceFeet, 5);
  assert.equal(result.staminaCost, 0);
}

console.log("PASS battlefield traversal charge/flight/downhill coverage");
