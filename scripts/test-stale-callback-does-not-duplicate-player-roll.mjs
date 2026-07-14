import assert from "node:assert/strict";
import {
  normalizeCombatLogEntry,
  selectPlayerCombatEvents,
} from "../src/utils/combat/combatLogEvents.js";

const events = [
  normalizeCombatLogEntry({
    audience: "player",
    channel: "roll",
    eventType: "attack-roll",
    actorId: "longbowman",
    targetId: "knight",
    message: "Attack roll: 14 + 3 = 17 vs AC 16 — Hit.",
    data: { executionKey: "attack-current", total: 17 },
  }, { sequence: 1 }),
  normalizeCombatLogEntry({
    audience: "developer",
    channel: "execution",
    eventType: "stale-callback-blocked",
    actorId: "longbowman",
    targetId: "knight",
    message: "Stale ranged continuation was blocked.",
    data: { executionKey: "attack-stale" },
  }, { sequence: 2 }),
];

const visibleRolls = selectPlayerCombatEvents(events).filter((event) => event.eventType === "attack-roll");
assert.equal(visibleRolls.length, 1);
assert.equal(visibleRolls[0].data.executionKey, "attack-current");

console.log("stale callback diagnostics do not duplicate player attack rolls");
