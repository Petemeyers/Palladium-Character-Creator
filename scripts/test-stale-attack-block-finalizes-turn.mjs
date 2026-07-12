import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /const makeBlockedAttackResult = \(reason, executionKey = bonusModifiers\?\.attackActionId \|\| null\) => \(\{/);
assert.match(source, /blocked: true,\s+stale: true,\s+reason,\s+executionKey,\s+finalized: false,/);
assert.match(source, /if \(attackResult\?\.blocked\) \{/);
assert.match(source, /stale attack block finalized turn advance: actor=/);
assert.match(source, /scheduleEnemyAIEndTurn\(0, "enemy-stale-attack-block-finalized"\)/);
assert.match(source, /attack impact wait recovered: actor=/);

const blockIndex = source.indexOf("if (attackResult?.blocked) {");
const staleLogIndex = source.indexOf("stale attack block finalized turn advance", blockIndex);
const finalizerIndex = source.indexOf('scheduleEnemyAIEndTurn(0, "enemy-stale-attack-block-finalized")', blockIndex);
assert.ok(blockIndex !== -1 && staleLogIndex !== -1 && finalizerIndex !== -1);
assert.ok(blockIndex < staleLogIndex && staleLogIndex < finalizerIndex);

assert.match(source, /turnActionResolvingRef\.current = false;\s+pendingTurnAdvanceRef\.current = false;\s+processingEnemyTurnRef\.current = false;/);

console.log("stale attack block finalizes turn advance safely");
