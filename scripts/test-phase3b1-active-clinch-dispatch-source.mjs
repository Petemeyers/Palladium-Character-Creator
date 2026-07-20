import assert from "node:assert/strict";
import fs from "node:fs";

import { resolveGrappleTurnAction } from "../src/utils/ai/resolveGrappleTurnAction.js";

const combatPage = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");
const playerTurnAI = fs.readFileSync("src/utils/ai/playerTurnAI.js", "utf8");
const enemyTurnAI = fs.readFileSync("src/utils/ai/enemyTurnAI.js", "utf8");
const resolverSource = fs.readFileSync("src/utils/ai/resolveGrappleTurnAction.js", "utf8");

const actor = {
  id: "knight-a",
  name: "Knight A",
  remainingActions: 1,
  grappleState: {
    state: "clinch",
    opponent: "knight-b",
  },
};
const opponent = {
  id: "knight-b",
  name: "Knight B",
  grappleState: {
    state: "clinch",
    opponent: "knight-a",
  },
};

const activeRoute = resolveGrappleTurnAction({
  actor,
  opponent,
  availableClinchWeapons: [{ id: "dagger", name: "Dagger" }],
  generationId: "test",
  round: 3,
  initiativeTurnId: "turn-1",
  turnToken: "token-1",
  source: "test",
});

assert.equal(activeRoute.handled, true);
assert.equal(activeRoute.routeType, "grapple-dispatch-required");
assert.equal(activeRoute.dispatchRequired, true);
assert.equal(activeRoute.actionType, "drawClinchDagger");
assert.equal(activeRoute.grappleAction.actionType, "drawClinchDagger");
assert.notEqual(activeRoute.actionType, "groundAttack", "standing clinches must not route to grounded attacks");
assert.notEqual(activeRoute.actionType, "maintain", "active clinch resolver must not pick placeholder maintain");
assert.equal(activeRoute.actionSpent, false, "authoritative handler owns grapple action spending");

const passRoute = resolveGrappleTurnAction({
  actor: { ...actor, remainingActions: 0 },
  opponent,
  source: "test",
});
assert.equal(passRoute.routeType, "legal-pass");
assert.equal(passRoute.actionType, "pass");
assert.equal(passRoute.actionSpent, true);

assert.doesNotMatch(
  resolverSource,
  /\?\s*"maintain"\s*:\s*"maintain"|actionType\s*=\s*[\s\S]{0,120}"maintain"/,
  "resolver should not default active grapple dispatch to maintain",
);

assert.match(playerTurnAI, /dispatchGrappleTurnAction/);
assert.match(enemyTurnAI, /dispatchGrappleTurnAction/);
assert.match(playerTurnAI, /recoverMissingPlayerGrappleDispatcher\?\.\(\{/);
assert.match(enemyTurnAI, /eventType:\s*"grapple-dispatch-context-missing"/);
assert.match(playerTurnAI, /return createPlayerAiActionResult\("grapple", \{[\s\S]*active-grapple-dispatched/);
assert.match(playerTurnAI, /return createPlayerAiActionResult\("grapple", \{ reason: grappleResult\.reason \|\| "adjacent-grapple-dispatched", terminal: true, grappleResult \}\)/);
assert.match(playerTurnAI, /return createPlayerAiActionResult\("grapple", \{[\s\S]*armored-grapple-dispatched/);

const flankingSuccessIndex = playerTurnAI.indexOf("player-ai-flanking-grapple-dispatched");
assert.ok(flankingSuccessIndex > 0, "flanking grapple dispatch should still be represented");
const flankingBlock = playerTurnAI.slice(flankingSuccessIndex - 250, flankingSuccessIndex + 350);
assert.doesNotMatch(
  flankingBlock,
  /scheduleEndTurn\(16,\s*"player-ai-flanking-grapple-dispatched"/,
  "successful flanking grapple dispatch must not directly schedule a second turn end",
);

assert.match(combatPage, /dispatchGrappleTurnAction:\s*executePlayerAIGrapple/);
assert.match(combatPage, /dispatchGrappleTurnAction:\s*\(actor,\s*targetActor/);
assert.match(combatPage, /eventType:\s*"active-grapple-generic-attack-blocked"/);
assert.match(combatPage, /eventType:\s*"active-grapple-generic-attack-recovery-completed"/);
assert.match(combatPage, /resolveCombatActionCompletion\(\{[\s\S]*source:\s*"active-grapple-generic-attack-recovery"/);

console.log("✅ Phase 3B1 active clinch dispatch source contract passed");
