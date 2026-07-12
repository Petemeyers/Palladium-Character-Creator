import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /clearAttackExecutionState\(`new-melee-round:\$\{nextRoundNumber\}`\)/);
assert.match(source, /execution-key-round-stale/);
assert.match(source, /delayed-callback-scheduled-token-stale/);
assert.match(source, /attackExecutionRegistryRef\.current\.clear\(\)/);
assert.match(source, /attackActionGrantRegistryRef\.current\.clear\(\)/);

console.log("new-round delayed enemy callbacks cannot create fresh current-round keys");
