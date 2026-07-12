import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /clearAttackExecutionState\(`scheduleEndTurn:\$\{diagnosticSource\}`\)/);
assert.match(source, /diagnosticSource === "horror-action-consumed"/);
assert.match(source, /attackActionGrantRegistryRef\.current\.clear\(\)/);
assert.match(source, /delayed-callback-scheduled-token-stale/);
assert.match(source, /enemy-dive-attack-callback/);
assert.match(source, /enemy-flank-attack-callback/);
assert.match(source, /enemy-grapple-finish-callback/);
assert.match(source, /enemy-grapple-maul-callback/);

console.log("horror-consumed delayed enemy callbacks keep captured stale keys and block");
