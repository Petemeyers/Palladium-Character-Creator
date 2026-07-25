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
  /fumbleHandoffVerified =[\s\S]*?meleeRoundRef\.current[\s\S]*?turnIndexRef\.current[\s\S]*?turnCounterRef\.current[\s\S]*?activeAfterFumble\?\.id === fumbleCompletionDecision\.nextActorId/,
  "fumble completion should verify round, index, counter, and next actor before accepted=true.",
);

console.log("✅ Phase 3B1 round-wrap fumble handoff source tests passed");
