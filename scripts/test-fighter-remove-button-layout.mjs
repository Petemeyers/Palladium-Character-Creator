import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(source, /const fighterCardLayoutProps = \{[\s\S]*w: "100%"[\s\S]*maxW: "100%"[\s\S]*minW: 0[\s\S]*boxSizing: "border-box"/);
assert.match(source, /aria-label=\{`Remove \$\{fighter\?\.name \|\| "fighter"\}`\}/);
assert.match(source, /title="Remove fighter"/);
assert.match(source, /minW="34px"[\s\S]*h="34px"[\s\S]*flexShrink=\{0\}/);
assert.doesNotMatch(source, /<Button[^>]+onClick=\{\(\) => removeFighter\(fighter\.id\)\}/);
assert.ok((source.match(/renderRemoveFighterButton\(fighter\)/g) || []).length >= 5);

console.log("fighter remove button layout tests passed");
