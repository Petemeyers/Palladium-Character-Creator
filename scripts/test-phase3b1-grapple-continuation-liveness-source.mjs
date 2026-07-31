import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");
const playerTurnAI = fs.readFileSync("src/utils/ai/playerTurnAI.js", "utf8");
const enemyTurnAI = fs.readFileSync("src/utils/ai/enemyTurnAI.js", "utf8");
const armoredResolver = fs.readFileSync("src/utils/ai/resolveArmoredCombatAction.js", "utf8");

assert.match(
  armoredResolver,
  /if\s*\(\s*hasReciprocalGrapplePair\(attacker,\s*defender\)\s*\)[\s\S]*eventType:\s*"combat-obligation-routed"[\s\S]*eventType:\s*"standing-armored-selector-suppressed"[\s\S]*return\s*{[\s\S]*actionType:\s*"grapple-obligation"/,
  "active grapple should route before standing armored selector selection",
);
assert.match(
  armoredResolver,
  /return\s*{[\s\S]*actionType:\s*"grapple-obligation"[\s\S]*suppressed:\s*false[\s\S]*handled:\s*false/,
  "active grapple routing must not masquerade as completed action suppression",
);

assert.match(playerTurnAI, /resolveGrappleTurnAction\(/, "player AI should use the shared grapple turn adapter");
assert.match(enemyTurnAI, /resolveGrappleTurnAction\(/, "enemy AI should use the shared grapple turn adapter");
assert.match(
  playerTurnAI,
  /dispatchGrappleTurnAction\(\s*player,\s*target,\s*grappleRoute\.grappleAction\?\.actionType \|\| grappleRoute\.actionType,\s*null,\s*\{[\s\S]{0,300}?continuationAuthorization/,
  "player AI active-grapple route should enter the existing grapple handler",
);
assert.match(
  enemyTurnAI,
  /executeGrapple\(grappleDecisionActor,\s*grappleDecisionTarget,\s*grappleRoute\.grappleAction\?\.actionType \|\| grappleRoute\.actionType,\s*null,\s*\{[\s\S]{0,500}continuationAuthorization:/,
  "enemy AI active-grapple route should dispatch the sanitized reciprocal decision snapshots",
);

assert.match(
  combatPage,
  /markArmoredActionPlanDispatched\([\s\S]*markArmoredActionPlanTerminal\([\s\S]*"consumed"/,
  "CombatPage should consume accepted grapple/armored plans before opposed rolls resolve",
);
assert.match(
  combatPage,
  /eventType:\s*"armored-action-plan-consumed"/,
  "CombatPage should log consumed armored action plans",
);
assert.match(
  combatPage,
  /eventType:\s*"combat-action-no-progress"/,
  "CombatPage should diagnose no-progress routing/completion attempts",
);
assert.match(
  combatPage,
  /suppressed\|routing-only-no-action\|no-progress/,
  "suppression/no-progress sources should be treated as pass/terminal rather than continued same-fighter progress",
);
assert.match(
  combatPage,
  /eventType:\s*"turn-start-suppressed"[\s\S]*continuation-pending/,
  "effect turn advance should be suppressed when a canonical continuation owns the same fighter",
);
assert.match(
  combatPage,
  /fireActionContinuationReceipt\(entry\)[\s\S]*continuationAuthorization[\s\S]*handleEnemyTurnRef\.current/,
  "enemy continuation should retain a fired registry record and deliver its authorization receipt",
);
assert.match(
  combatPage,
  /enemyContinuationRequestsRef\.current\.delete\(continuationKey\)[\s\S]*blockStaleAction\(latestFighter,\s*turnToken,\s*"enemy-remaining-action-continuation"\)/,
  "stale enemy continuations should be removed before stale ownership validation can return",
);

console.log("✅ Phase 3B1 grapple continuation/liveness source tests passed");
