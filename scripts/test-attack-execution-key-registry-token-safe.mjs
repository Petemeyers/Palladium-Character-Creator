import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /attackExecutionRegistryRef = useRef\(new Map\(\)\)/);
assert.match(source, /const requestedExecutionKey = options\.executionKey \? String\(options\.executionKey\) : null/);
assert.match(source, /const id = requestedExecutionKey \|\| `attack-\$\{combatSessionRef\.current\}-\$\{serial\}-/);
assert.match(source, /currentTurnToken: currentTurnTokenRef\.current \|\| "no-turn-token"/);
assert.match(source, /attackExecutionRegistryRef\.current\.set\(id, metadata\)/);
assert.match(source, /const getAttackExecutionMetadata = useCallback/);
assert.match(source, /const keyMetadata = getAttackExecutionMetadata\(executionKey\)/);
assert.doesNotMatch(source, /const parts = executionKey\.split\(":"\)/);
assert.doesNotMatch(source, /parseAttackExecutionKey/);
assert.match(source, /keyMetadata\.currentTurnToken !== String\(currentTurnTokenRef\.current \|\| "no-turn-token"\)/);

console.log("attack execution key registry is token-safe for colon-delimited turn tokens");
