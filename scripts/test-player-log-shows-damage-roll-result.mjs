import assert from "node:assert/strict";
import {
  normalizeCombatLogEntry,
  selectPlayerCombatEvents,
} from "../src/utils/combat/combatLogEvents.js";

const damageRoll = normalizeCombatLogEntry({
  audience: "player",
  channel: "damage",
  eventType: "damage-roll",
  level: "info",
  actorId: "knight",
  targetId: "longbowman",
  message: "Damage roll: 1d8 + 2 = 7 damage.",
  data: {
    formula: "1d8",
    modifier: 2,
    totalDamage: 7,
  },
}, { sequence: 1 });

const [visible] = selectPlayerCombatEvents([damageRoll]);
assert.equal(visible.eventType, "damage-roll");
assert.equal(visible.channel, "damage");
assert.equal(visible.data.totalDamage, 7);

console.log("player log shows structured damage roll result");
