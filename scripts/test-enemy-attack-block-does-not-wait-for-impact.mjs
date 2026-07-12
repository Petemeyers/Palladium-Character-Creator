import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

const blockIndex = source.indexOf("if (attackResult?.blocked) {");
const blockReturnIndex = source.indexOf("return false;", blockIndex);
const waitingIndex = source.indexOf("waiting for impact finalizer", blockIndex);
assert.ok(blockIndex !== -1 && blockReturnIndex !== -1, "blocked attack result must return before normal impact wait");
assert.ok(waitingIndex !== -1 && blockReturnIndex < waitingIndex, "blocked attack must not log waiting-for-impact");

assert.match(source, /if \(!activeAttackActionIdRef\.current && !activeTechniqueImpactRef\.current\) \{/);
assert.match(source, /scheduleEnemyAIEndTurn\(0, "enemy-attack-no-active-impact-fallback"\)/);
assert.match(source, /reason=no-active-impact-after-block/);

const entryBlockIndex = source.indexOf('const entryAttackBlock = getAttackRollOwnershipBlockReason("attack-entry-pre-roll")');
const blockedResultIndex = source.indexOf("return makeBlockedAttackResult(entryAttackBlock.reason, attackActionId)", entryBlockIndex);
assert.ok(entryBlockIndex !== -1 && blockedResultIndex !== -1 && entryBlockIndex < blockedResultIndex);

console.log("enemy blocked attack does not wait for missing impact finalizer");
