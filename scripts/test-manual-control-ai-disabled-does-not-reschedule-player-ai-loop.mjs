import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shouldRetryPlayerAiActiveFighterMismatch } from "../src/utils/playerAiTurnStartRetry.js";

assert.equal(shouldRetryPlayerAiActiveFighterMismatch({
  reason: "effect-turn-advance",
  aiControlEnabled: false,
  isPartyActor: true,
  combatActive: true,
}), false);

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.doesNotMatch(source, /player AI start blocked: reason=ai-disabled/);
assert.match(source, /is waiting for manual player control/);

console.log("AI-disabled player retry-loop tests passed");
