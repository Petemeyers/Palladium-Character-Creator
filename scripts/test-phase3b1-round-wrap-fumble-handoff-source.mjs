import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(
  combatPage,
  /const commitAuthoritativeTurnHandoff = useCallback[\s\S]*?endTurnRef\.current\?\.\(\{[\s\S]*?handoffToken:[\s\S]*?const committedCoordinate = createInitiativeCoordinate/,
  "authoritative handoff should delegate the entire boundary to canonical endTurn and capture its committed coordinate.",
);

assert.match(
  combatPage,
  /eventType:\s*"authoritative-turn-handoff-committed"[\s\S]*?eventType:\s*"generic-handoff-suppressed"/,
  "authoritative handoff should log commit and generic handoff suppression.",
);

assert.match(
  combatPage,
  /const fumbleHandoffOwnership = createFumbleHandoffOwnership\(\{[\s\S]*?const fumbleCompletionDecision = commitAuthoritativeTurnHandoff\(\{[\s\S]*?reason:\s*"fumble-handoff-owned"[\s\S]*?handoffOwnership:\s*fumbleHandoffOwnership/,
  "natural-1 fumble should use the authoritative handoff helper.",
);

assert.doesNotMatch(
  combatPage,
  /source:\s*"fumble-turn-handoff"[\s\S]{0,450}?resolveCombatActionCompletion\(/,
  "fumble handoff should not route through generic completion after fumble ownership is accepted.",
);

assert.match(
  combatPage,
  /const currentFumbleCoordinate = createInitiativeCoordinate\(\{[\s\S]*?round:\s*meleeRoundRef\.current[\s\S]*?initiativeIndex:\s*turnIndexRef\.current[\s\S]*?turnCounter:\s*turnCounterRef\.current[\s\S]*?actorId:\s*activeAfterFumble\?\.id/,
  "fumble completion should capture the current canonical round, index, counter, and actor coordinate.",
);
assert.match(
  combatPage,
  /const fumbleCoordinateMatches = Boolean\([\s\S]*?currentFumbleCoordinate\.generationId[\s\S]*?currentFumbleCoordinate\.round[\s\S]*?currentFumbleCoordinate\.initiativeIndex[\s\S]*?currentFumbleCoordinate\.turnCounter[\s\S]*?currentFumbleCoordinate\.actorId[\s\S]*?currentFumbleCoordinate\.initiativeTurnId/,
  "fumble completion should compare the complete authoritative initiative coordinate before accepted=true.",
);

console.log("✅ Phase 3B1 round-wrap fumble handoff source tests passed");
