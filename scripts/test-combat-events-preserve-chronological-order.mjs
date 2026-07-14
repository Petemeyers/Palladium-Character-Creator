import assert from "node:assert/strict";
import { normalizeCombatLogEntry } from "../src/utils/combat/combatLogEvents.js";

const events = [
  normalizeCombatLogEntry({ audience: "player", channel: "damage", message: "Damage." }, { sequence: 3 }),
  normalizeCombatLogEntry({ audience: "player", channel: "turn", message: "Round 1." }, { sequence: 1 }),
  normalizeCombatLogEntry({ audience: "player", channel: "roll", message: "Attack roll." }, { sequence: 2 }),
];

const ordered = [...events].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
assert.deepEqual(ordered.map((event) => event.message), ["Round 1.", "Attack roll.", "Damage."]);

console.log("combat events preserve deterministic chronological order");
