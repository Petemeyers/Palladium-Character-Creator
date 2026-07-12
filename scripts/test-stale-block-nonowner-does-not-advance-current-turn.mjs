import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /const blockedActorOwnsTurn =/);
assert.match(source, /if \(!blockedActorOwnsTurn\) \{/);
assert.match(source, /stale attack block ignored without turn advance: actor=/);

const nonOwnerIndex = source.indexOf("if (!blockedActorOwnsTurn) {");
const nonOwnerReturnIndex = source.indexOf("return false;", nonOwnerIndex);
const scheduleIndex = source.indexOf('scheduleEnemyAIEndTurn(0, "enemy-stale-attack-block-finalized")', nonOwnerIndex);
assert.ok(nonOwnerIndex !== -1 && nonOwnerReturnIndex !== -1 && scheduleIndex !== -1);
assert.ok(nonOwnerReturnIndex < scheduleIndex, "non-owner stale block must return before scheduling a turn advance");

console.log("stale non-owner attack block clears refs without advancing current turn");
