import assert from "node:assert/strict";
import {
  normalizeCombatLogEntry,
  selectDeveloperCombatEvents,
  selectPlayerCombatEvents,
} from "../src/utils/combat/combatLogEvents.js";

const executionDiagnostic = normalizeCombatLogEntry({
  audience: "developer",
  channel: "execution",
  eventType: "execution-key-created",
  level: "debug",
  message: "attack key registry created",
  data: { executionKey: "attack-round-4-turn-2" },
}, { sequence: 1 });

assert.equal(selectPlayerCombatEvents([executionDiagnostic]).length, 0);
assert.deepEqual(selectDeveloperCombatEvents([executionDiagnostic]), [executionDiagnostic]);

console.log("player log hides execution diagnostics");
