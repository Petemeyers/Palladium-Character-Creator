import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

const canonicalStart = source.indexOf("const completeCanonicalEnemyAction = ({");
assert.ok(canonicalStart > 0, "canonical enemy action completion gate should exist");
const canonicalEnd = source.indexOf("const scheduleEnemyAIEndTurn", canonicalStart);
assert.ok(canonicalEnd > canonicalStart, "scheduleEnemyAIEndTurn should follow canonical gate");
const canonicalBlock = source.slice(canonicalStart, canonicalEnd);

assert.match(canonicalBlock, /remainingActions > 0/);
assert.match(canonicalBlock, /authoritativeActive/);
assert.match(canonicalBlock, /combatActiveRef\.current/);
assert.match(canonicalBlock, /canFighterStartTurn\(latestFighter\)/);
assert.match(canonicalBlock, /!explicitPass/);
assert.match(canonicalBlock, /!turnEndingEffect/);
assert.match(canonicalBlock, /!fighterIncapacitated/);
assert.match(canonicalBlock, /scheduleCanonicalEnemyContinuation\(\{/);

const continuationStart = source.indexOf("const scheduleCanonicalEnemyContinuation = ({");
const continuationEnd = source.indexOf("const completeCanonicalEnemyAction", continuationStart);
const continuationBlock = source.slice(continuationStart, continuationEnd);
assert.match(continuationBlock, /enemyContinuationRequestsRef\.current\.get\(continuationKey\)/);
assert.match(continuationBlock, /enemy continuation deduped: actor=/);
assert.match(continuationBlock, /enemyContinuationRequestsRef\.current\.set\(continuationKey/);
assert.match(continuationBlock, /enemyPendingActionContinuationRef\.current = \{/);
assert.match(continuationBlock, /handleEnemyTurnRef\.current\?\.\(latestFighter, "remaining-action-continuation"/);

const commitStart = source.indexOf("function commitEnemyAction(reason)");
const commitEnd = source.indexOf("const commitOneEnemyAction", commitStart);
const commitBlock = source.slice(commitStart, commitEnd);
assert.match(commitBlock, /enemy duplicate pre-action rejected without turn advance: actor=/);
assert.doesNotMatch(
  commitBlock,
  /finishEnemyActionSafely\("enemy-action-blocked-before-resolution"\)/,
  "duplicate pre-action blocks must not finalize or advance the turn",
);

const diveLabel = 'await commitOneEnemyAction("predator-dive-attack", async () => {';
const diveStart = source.indexOf(diveLabel);
assert.ok(diveStart > 0, "predator dive action branch should exist");
const diveBlock = source.slice(diveStart, source.indexOf("return;", diveStart));
assert.match(diveBlock, /const predatorDiveGrant = createAttackActionGrant/);
assert.match(diveBlock, /const predatorDiveExecutionKey = createAttackExecutionKey/);
assert.ok(
  diveBlock.indexOf("const predatorDiveGrant = createAttackActionGrant") >
    diveBlock.indexOf(diveLabel),
  "predator dive must create its attack grant only after the action is claimed",
);

assert.match(source, /scheduleEnemyAIEndTurn\(getMoveDurationMs\(distanceMoved\), "enemy-flight-glide"\)/);
assert.match(source, /scheduleEnemyAIEndTurn\(getMoveDurationMs\(5\), "enemy-flight-circle"\)/);
assert.match(source, /scheduleEnemyAIEndTurn\(getMoveDurationMs\(5\), "enemy-flight-scout"\)/);
assert.match(source, /canonical player AI action completion: actor=/);
assert.match(source, /queuePlayerAIContinuationAfterOwnerRelease\(executionOwnership\.executionKey\)/);
assert.match(source, /handlePlayerAITurnRef\.current\?\.\(liveActor, \{/);
assert.doesNotMatch(source, /completePlayerAIContinuation\("player-ai-remaining-action-continuation-start"\)/);

console.log("canonical action continuation and recovery dedupe tests passed");
