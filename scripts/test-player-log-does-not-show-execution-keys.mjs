import assert from "node:assert/strict";
import {
  normalizeCombatLogEntry,
  selectPlayerCombatEvents,
} from "../src/utils/combat/combatLogEvents.js";

const playerAttack = normalizeCombatLogEntry({
  audience: "player",
  channel: "roll",
  eventType: "attack-roll",
  message: "Attack roll: 12 + 4 = 16 vs AC 15 — Hit.",
  data: {
    naturalRoll: 12,
    modifier: 4,
    total: 16,
    targetNumber: 15,
    executionKey: "stored-in-data-only-for-test",
  },
}, { sequence: 1 });

const [visible] = selectPlayerCombatEvents([playerAttack]);
assert.equal(visible.message.includes("executionKey"), false);
assert.equal(visible.message.includes("stored-in-data-only-for-test"), false);

console.log("player-facing messages do not show execution keys");
