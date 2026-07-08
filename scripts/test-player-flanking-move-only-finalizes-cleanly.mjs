import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");

const skipIndex = source.indexOf("flanking continuation skipped attack: no actions remaining after movement");
const block = source.slice(skipIndex, source.indexOf("if (turnActionResolvingRef) turnActionResolvingRef.current = true;", skipIndex));

assert.match(block, /turnActionResolvingRef\) turnActionResolvingRef\.current = false/);
assert.match(block, /pendingTurnAdvanceRef\) pendingTurnAdvanceRef\.current = false/);
assert.match(block, /processingPlayerAIRef\.current = false/);
assert.match(block, /scheduleEndTurn\(16, "player-ai-flanking-move-only"\)/);

console.log("player flanking move-only finalizer tests passed");
