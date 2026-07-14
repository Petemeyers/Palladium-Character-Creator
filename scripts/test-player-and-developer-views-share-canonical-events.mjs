import assert from "node:assert/strict";
import {
  normalizeCombatLogEntry,
  selectDeveloperCombatEvents,
  selectPlayerCombatEvents,
} from "../src/utils/combat/combatLogEvents.js";

const canonicalEvents = [
  normalizeCombatLogEntry({ audience: "player", channel: "roll", message: "Attack roll." }, { sequence: 1 }),
  normalizeCombatLogEntry({ audience: "developer", channel: "execution", message: "Registry check." }, { sequence: 2 }),
  normalizeCombatLogEntry({ audience: "both", channel: "turn", message: "Round 2." }, { sequence: 3 }),
];

const player = selectPlayerCombatEvents(canonicalEvents);
const developer = selectDeveloperCombatEvents(canonicalEvents);

assert.equal(player.length, 2);
assert.equal(developer.length, 2);
assert.strictEqual(player[1], canonicalEvents[2]);
assert.strictEqual(developer[1], canonicalEvents[2]);

console.log("player and developer views are derived from one canonical event stream");
