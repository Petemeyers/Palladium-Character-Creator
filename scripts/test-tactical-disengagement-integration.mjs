import assert from "node:assert/strict";
import { getLegalControlledDisengagementDestinations } from "../src/utils/combat/dominantOpeningResolution.js";
const legal = getLegalControlledDisengagementDestinations({ origin: { x: 1, y: 1 }, target: { x: 2, y: 1 }, adjacentHexes: [{ x: 0, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }], isOccupied: (x, y) => x === 1 && y === 2 });
assert.deepEqual(legal, [{ x: 0, y: 1 }]);
assert.ok(Math.hypot(legal[0].x - 2, legal[0].y - 1) > 1);
console.log("tactical disengagement integration tests passed");
