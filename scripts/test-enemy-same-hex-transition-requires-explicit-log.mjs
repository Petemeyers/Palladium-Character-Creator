import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /enemyCurrentPos\.x === targetCurrentPos\.x && enemyCurrentPos\.y === targetCurrentPos\.y/);
assert.match(source, /same-hex engagement position normalized: actor=/);
assert.match(source, /reason=\$\{sameHexReason\}/);
assert.match(source, /"clinch"/);
assert.match(source, /"grapple"/);
assert.match(source, /"cower-overlap"/);
assert.match(source, /"routing-overlap"/);
assert.match(source, /"unknown-overlap"/);

console.log("enemy same-hex transition diagnostic tests passed");
