import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
for (const unsafe of [
  /Primary:\s*\{primaryWeapon\}/,
  /\{fighter\.equistaminadWeapon\}/,
  /\{w\.name \|\| w\}/,
  /\{attack\.name \|\| attack\}/,
  /\{entry\.diceInfo\.weapon\}/,
]) assert.doesNotMatch(source, unsafe);
assert.match(source, /Primary: \{getCombatDisplayLabel\(primaryWeapon/);
console.log("Combat presentation boundaries never render known structured values directly");
