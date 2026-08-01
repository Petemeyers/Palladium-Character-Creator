import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(
  combatPage,
  /const commitTurnEndingActionExhaustion = useCallback[\s\S]*?remainingActions:\s*0[\s\S]*?eventType:\s*"turn-ending-action-exhaustion-committed"/,
  "turn-ending action exhaustion helper should synchronously commit remainingActions=0 and log it.",
);

assert.match(
  combatPage,
  /eventType:\s*"turn-ending-effect-actions-remain"[\s\S]*?commitTurnEndingActionExhaustion\(/,
  "completion arbiter should force remaining actions to zero for explicit turn-ending effects.",
);

assert.match(
  combatPage,
  /const completeTurnEndingFumble = \(\) => \{[\s\S]*?cancelRemainingActionContinuationsForActor\([\s\S]*?reason:\s*"critical-miss"[\s\S]*?commitTurnEndingActionExhaustion\([\s\S]*?reason:\s*"critical-miss-post-impact"[\s\S]*?resolveCombatActionCompletion\(/,
  "natural-1 fumble should cancel continuations and commit zero actions immediately before completion arbitration.",
);

assert.match(
  combatPage,
  /const fumbleHandoffVerified =[\s\S]*?fumbleCompletionDecision\?\.accepted === true[\s\S]*?fumbleCoordinateMatches[\s\S]*?initiativeTurnAdvanced[\s\S]*?!continuationRemains/,
  "fumble handoff should require an accepted completion, matching coordinate, advanced turn identity, and no continuation.",
);
assert.match(
  combatPage,
  /eventType:\s*"fumble-turn-handoff-completed"[\s\S]*?accepted:\s*fumbleHandoffVerified/,
  "fumble completion must report the canonical handoff verification result.",
);

console.log("✅ Phase 3B1 fumble exhaustion source checks passed");
