import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /applyEquipmentSelection/);
assert.match(source, /Right Hand/);
assert.match(source, /Left Hand Weapon/);
assert.match(source, /Padding \/ Arming Layer/);
assert.match(source, /Mail Layer/);
assert.match(source, /Plate Layer/);
assert.match(source, /Every slot is explicit/);
assert.doesNotMatch(source, /Use default weapon assignment/);
assert.doesNotMatch(source, /Select armor \(optional\)/);
assert.doesNotMatch(source, /Select weapon \(optional\)/);
console.log("equipment source contract passed");
