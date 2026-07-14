import assert from "node:assert/strict";
import {
  normalizeCombatLogEntry,
  selectDeveloperCombatEvents,
  selectPlayerCombatEvents,
} from "../src/utils/combat/combatLogEvents.js";

const aiScore = normalizeCombatLogEntry({
  audience: "developer",
  channel: "ai",
  eventType: "ai-candidate-rejected",
  level: "info",
  message: "AI rejected movement candidate.",
  data: {
    candidateScore: 71.4,
    reason: "not-reachable",
  },
}, { sequence: 1 });

assert.equal(selectPlayerCombatEvents([aiScore]).length, 0);
assert.equal(selectDeveloperCombatEvents([aiScore])[0].data.candidateScore, 71.4);

console.log("player log does not show AI candidate scores");
