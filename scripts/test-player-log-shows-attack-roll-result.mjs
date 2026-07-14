import assert from "node:assert/strict";
import {
  normalizeCombatLogEntry,
  selectPlayerCombatEvents,
} from "../src/utils/combat/combatLogEvents.js";

const attackRoll = normalizeCombatLogEntry({
  audience: "player",
  channel: "roll",
  eventType: "attack-roll",
  level: "info",
  actorId: "longbowman",
  targetId: "knight",
  message: "Attack roll: 14 + 3 = 17 vs AC 16 — Hit.",
  data: {
    naturalRoll: 14,
    modifier: 3,
    total: 17,
    targetNumber: 16,
    result: "hit",
  },
}, { sequence: 1 });

const [visible] = selectPlayerCombatEvents([attackRoll]);
assert.equal(visible.eventType, "attack-roll");
assert.equal(visible.channel, "roll");
assert.equal(visible.data.total, 17);
assert.equal(visible.data.targetNumber, 16);

console.log("player log shows structured attack roll result");
