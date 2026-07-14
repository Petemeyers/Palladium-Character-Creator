import assert from "node:assert/strict";
import {
  normalizeCombatLogEntry,
  selectDeveloperCombatEvents,
  selectPlayerCombatEvents,
} from "../src/utils/combat/combatLogEvents.js";

const stale = normalizeCombatLogEntry({
  audience: "developer",
  channel: "execution",
  eventType: "stale-callback-blocked",
  level: "warning",
  actorId: "longbowman",
  message: "Stale ranged continuation was blocked.",
  data: {
    source: "enemy-turn-ai-ranged-callback",
    executionKey: "attack-1",
    activeFighterId: "knight",
  },
}, { sequence: 1 });

assert.equal(selectPlayerCombatEvents([stale]).length, 0);
assert.equal(selectDeveloperCombatEvents([stale])[0].data.executionKey, "attack-1");

console.log("developer log retains stale callback diagnostic");
