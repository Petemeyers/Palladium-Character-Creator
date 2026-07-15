import assert from "node:assert/strict";
import {
  normalizeCombatLogEntry,
  selectCombatEventsByAudience,
  selectCombatEventsByChannel,
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
const playerMode = selectCombatEventsByAudience(canonicalEvents, "player");
const developerMode = selectCombatEventsByAudience(canonicalEvents, "developer");
const allMode = selectCombatEventsByAudience(canonicalEvents, "all");
const developerExecution = selectCombatEventsByChannel(developerMode, "execution");

assert.equal(player.length, 2);
assert.equal(developer.length, 2);
assert.strictEqual(player[1], canonicalEvents[2]);
assert.strictEqual(developer[1], canonicalEvents[2]);
assert.deepEqual(playerMode.map((event) => event.message), ["Attack roll.", "Round 2."]);
assert.deepEqual(developerMode.map((event) => event.message), ["Registry check.", "Round 2."]);
assert.deepEqual(allMode.map((event) => event.message), ["Attack roll.", "Registry check.", "Round 2."]);
assert.equal(developerExecution.length, 1);
assert.equal(developerExecution[0].message, "Registry check.");

console.log("player and developer views are derived from one canonical event stream");
