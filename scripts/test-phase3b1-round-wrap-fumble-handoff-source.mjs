import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(
  combatPage,
  /const commitAuthoritativeTurnHandoff = useCallback[\s\S]*?const isLastInitiativeSlot[\s\S]*?roundAfter = isLastInitiativeSlot \? roundBefore \+ 1 : roundBefore[\s\S]*?turnCounterAfter = turnCounterBefore \+ 1/,
  "authoritative handoff should atomically calculate round wrap and turn counter increment.",
);

assert.match(
  combatPage,
  /eventType:\s*"authoritative-turn-handoff-committed"[\s\S]*?eventType:\s*"generic-handoff-suppressed"/,
  "authoritative handoff should log commit and generic handoff suppression.",
);

assert.match(
  combatPage,
  /const fumbleCompletionDecision = commitAuthoritativeTurnHandoff\(\{[\s\S]*?reason:\s*"fumble-handoff-owned"[\s\S]*?explicitTurnEndingEffect:\s*true/,
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
