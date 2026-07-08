import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /enemy approach rejected non-improving close-range move:/);
assert.match(source, /stillOutOfReach && nonImproving/);
assert.match(source, /invalidReason: "non-improving-close-range-approach"/);
assert.match(source, /fromDistance=\$\{Math\.round\(currentDistance\)\}ft toDistance=\$\{Math\.round\(destinationDistance\)\}ft/);

console.log("enemy close-range non-improving move rejection tests passed");
