import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /staleAttackBlockFinalizerRef = useRef\(null\)/);
assert.match(source, /const staleBlockFinalizerKey = \[/);
assert.match(source, /if \(staleAttackBlockFinalizerRef\.current === staleBlockFinalizerKey\)/);
assert.match(source, /stale attack self-loop prevented: actor=/);
assert.match(source, /remainingActions: Math\.max\(0, \(Number\(fighter\.remainingActions \?\? 0\) \|\| 0\) - 1\)/);

const consumeIndex = source.indexOf("remainingActions: Math.max(0, (Number(fighter.remainingActions ?? 0) || 0) - 1)");
const scheduleIndex = source.indexOf('scheduleEnemyAIEndTurn(0, "enemy-stale-attack-block-finalized")');
assert.ok(consumeIndex !== -1 && scheduleIndex !== -1 && consumeIndex < scheduleIndex);

console.log("stale owner attack block consumes once and prevents self-loop finalizers");
