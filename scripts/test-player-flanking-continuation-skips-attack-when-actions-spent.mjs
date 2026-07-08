import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");

const skipIndex = source.indexOf("flanking continuation skipped attack: no actions remaining after movement");
const attackIndex = source.indexOf("flanking continuation calling attack");

assert.ok(skipIndex >= 0, "flanking continuation should log skipped attack when movement spent final action");
assert.ok(attackIndex > skipIndex, "no-actions guard should run before flanking continuation calls attack");
assert.match(source, /remainingActionsAfterMovement <= 0/);
assert.match(source, /completePlayerAIContinuation\?\.\("player-ai-flanking-move-only"\)/);

console.log("player flanking continuation no-actions skip tests passed");
