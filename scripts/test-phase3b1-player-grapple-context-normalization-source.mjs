import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");
const playerTurnAI = fs.readFileSync("src/utils/ai/playerTurnAI.js", "utf8");
const dispatcherRuntime = fs.readFileSync("src/utils/ai/playerGrappleDispatcher.js", "utf8");

assert.match(
  combatPage,
  /const normalizePlayerCombatAIContext = useCallback[\s\S]*?normalizePlayerGrappleDispatcherContext\(rawContext\)[\s\S]*?eventType:\s*"player-ai-context-normalized"/,
  "CombatPage should normalize player AI context and expose dispatchGrappleTurnAction.",
);

assert.match(
  combatPage,
  /const rawContext = \{[\s\S]*?dispatchGrappleTurnAction:\s*executePlayerAIGrapple[\s\S]*?context = normalizePlayerCombatAIContext\(rawContext, startReason\)/,
  "handlePlayerAITurn should normalize context immediately before runPlayerTurnAI consumption.",
);

assert.match(
  combatPage,
  /isFighterInActiveGrapple\(latestPlayer[\s\S]*?typeof context\.dispatchGrappleTurnAction !== "function"[\s\S]*?recoverMissingPlayerGrappleDispatcher/,
  "active-grapple player AI entry should validate the normalized dispatcher property.",
);

assert.doesNotMatch(
  playerTurnAI,
  /executeGrappleFromContext|handleGrappleAction|dispatchGrappleAction|grappleDispatcher|executeGrappleAction/,
  "runPlayerTurnAI should not consume grapple dispatcher aliases after normalization.",
);

assert.match(
  playerTurnAI,
  /const grappleResult = dispatchGrappleTurnAction\(/,
  "runPlayerTurnAI should invoke only dispatchGrappleTurnAction.",
);

assert.match(
  playerTurnAI,
  /eventType:\s*"player-grapple-terminal-return-propagated"[\s\S]*?terminal:\s*true[\s\S]*?routeType:\s*"grapple-terminal"/,
  "player active-grapple dispatch should return terminally.",
);

assert.match(
  dispatcherRuntime,
  /actionType:\s*"pass"[\s\S]*?actionSpent[\s\S]*?"player-grapple-missing-dispatcher-recovery-completed"/,
  "missing player grapple dispatcher recovery should spend a legal pass action.",
);

console.log("✅ Phase 3B1 player grapple context normalization source tests passed");
