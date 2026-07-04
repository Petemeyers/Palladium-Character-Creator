import assert from "node:assert/strict";
import fs from "node:fs";
import { hasCrossedRoutedEscapeBoundary } from "../src/utils/routingSystem.js";

const bounds = { minX: 0, minY: 0, maxX: 39, maxY: 29 };
assert.equal(hasCrossedRoutedEscapeBoundary({ x: 0, y: 12 }, bounds), true);
assert.equal(hasCrossedRoutedEscapeBoundary({ x: -12, y: 32 }, bounds), true);
assert.equal(hasCrossedRoutedEscapeBoundary({ x: 20, y: 12 }, bounds), false);

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const start = source.indexOf("const fraidereRoutingFleeAction");
const end = source.indexOf("const preserveTrainingWithstamina", start);
const handler = source.slice(start, end);
assert.match(handler, /const mapBounds = ROUTED_ESCAPE_BOUNDS/);
assert.match(handler, /markFighterFledOffMap\(fighter\.id, fighter\.name, "routed-off-field"\)/);
assert.equal(handler.includes("expandBattlefieldForRouting("), false, "routed panic no longer expands battlefield chunks");
assert.equal(source.includes("The battlefield expands as"), false, "legacy routed expansion loop is removed");
console.log("terminal routed escape boundary test passed");
