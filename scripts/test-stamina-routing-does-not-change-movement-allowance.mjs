import assert from "node:assert/strict";
import fs from "node:fs";
import { calculateRoutedMovementStaminaCost } from "../src/utils/survivalIntent.js";

assert.equal(calculateRoutedMovementStaminaCost.toString().includes("maxSteps"), false);
const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /const maxFleeHexes = Math\.max\(1, Math\.floor\(30 \/ \(GRID_CONFIG\.CELL_SIZE \|\| 5\)\)\)/);
assert.ok(source.indexOf("const maxFleeHexes") < source.indexOf("calculateRoutedMovementStaminaCost({"));
console.log("stamina routing movement-allowance isolation test passed");
