import assert from "node:assert/strict";
import {
  normalizeCombatLogEntry,
  selectDeveloperCombatEvents,
  selectPlayerCombatEvents,
} from "../src/utils/combat/combatLogEvents.js";

const legacy = normalizeCombatLogEntry("executionKey=abc123 stale callback", {
  sequence: 1,
  explicitTypeProvided: false,
});

assert.equal(legacy.audience, "developer");
assert.equal(legacy.channel, "system");
assert.equal(legacy.eventType, "legacy-message");
assert.equal(selectPlayerCombatEvents([legacy]).length, 0);
assert.equal(selectDeveloperCombatEvents([legacy]).length, 1);

console.log("legacy string combat logs default to developer visibility");
