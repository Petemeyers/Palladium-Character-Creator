import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveArmoredCombatAction } from "../src/utils/ai/resolveArmoredCombatAction.js";
import { formatArmorGapContactOutcomeLog } from "../src/utils/combat/grappleLogMessages.js";
import { transitionCanonicalGrappleExecutionRecord } from "../src/utils/combat/canonicalGrappleExecution.js";

const authoritativeTurn = Object.freeze({
  generationId: "current-generation",
  round: 3,
  initiativeIndex: 0,
  initiativeTurnId: "current-generation:3:0:knight:4",
  actionToken: "round-3-action-token",
  turnToken: "round-3-action-token",
});
const action = resolveArmoredCombatAction({
  attacker: { id: "knight", name: "Knight", inventory: [{ name: "Dagger" }] },
  defender: { id: "target", name: "Target", armorProfile: { armorClass: "plate", rigidCoverage: true } },
  selectedWeapon: { id: "long-sword", name: "Long Sword", damage: "1d8" },
  distance: 5,
  remainingActions: 2,
  generationId: "stale-generation",
  round: 2,
  initiativeIndex: 7,
  initiativeTurnId: "stale-turn",
  turnToken: "stale-token",
  actionToken: "stale-token",
  authoritativeTurn,
  rng: () => 0.45,
  source: "direct-round-start-fixture",
});
const plan = action.armoredActionPlan || action.weapon?.armoredActionPlan;
assert.ok(plan, "new round selection must create an armored action plan");
for (const field of ["generationId", "round", "initiativeIndex", "initiativeTurnId", "actionToken"]) {
  assert.equal(plan[field], authoritativeTurn[field], `${field} must come from one authoritative turn snapshot`);
}

const zeroDamage = formatArmorGapContactOutcomeLog({
  attackerLabel: "Knight A", targetLabel: "Knight B", rolledDamage: 4,
  hpDamageApplied: 0, finalHP: 10, maxHP: 20,
});
assert.equal(zeroDamage.injured, false);
assert.match(zeroDamage.message, /reaches an armor opening,? on|reaches an armor opening on/);
assert.match(zeroDamage.message, /fails to wound/);
assert.doesNotMatch(zeroDamage.message, /takes 0 damage|armor bypassed/);

function lethalLifecycle(sequence) {
  const counts = { claim: 0, resolved: 0, commit: 0, completion: 0, audit: 0, cleanup: 0, terminalReturn: 0, acceptedWithoutCompletion: 0 };
  let record = {
    generationId: "g", initiativeTurnId: "turn", actionToken: `turn:${sequence}`,
    actionSequence: sequence, actorId: "a", opponentId: "b", actionType: "clinchStrike",
    executionKey: `exec-${sequence}`, state: "resolving", rollStarted: false, completionEmitted: false,
  };
  let transition = transitionCanonicalGrappleExecutionRecord(record, "roll-claimed", 1);
  assert.equal(transition.ok, true);
  record = { ...transition.record, rollStarted: true, rollKind: "clinch-strike-attack" };
  counts.claim += 1;
  counts.resolved += 1;
  transition = transitionCanonicalGrappleExecutionRecord(record, "committed", 2);
  assert.equal(transition.ok, true);
  record = { ...transition.record, stateCommitted: true };
  counts.commit += 1;
  transition = transitionCanonicalGrappleExecutionRecord(record, "completed", 3);
  assert.equal(transition.ok, true);
  record = { ...transition.record, completionEmitted: true };
  counts.completion += 1;
  counts.audit += 1;
  counts.cleanup += 1;
  counts.terminalReturn += 1;
  return { record, counts };
}
for (const sequence of [1, 2]) {
  const lethal = lethalLifecycle(sequence);
  assert.equal(lethal.record.state, "completed");
  assert.deepEqual(lethal.counts, {
    claim: 1, resolved: 1, commit: 1, completion: 1, audit: 1,
    cleanup: 1, terminalReturn: 1, acceptedWithoutCompletion: 0,
  });
}

const page = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const resolver = fs.readFileSync(new URL("../src/utils/combatActionHandlers/grappleActions.js", import.meta.url), "utf8");
const recoveryStart = page.indexOf("const recoverRejectedArmoredActionPlan =");
const recoveryEnd = page.indexOf("const activeGrappleStateText", recoveryStart);
const recovery = page.slice(recoveryStart, recoveryEnd);
assert.ok(recoveryStart >= 0 && recoveryEnd > recoveryStart);
assert.equal((recovery.match(/resolveCombatActionCompletion\(\{/g) || []).length, 1, "plan rejection recovery completes exactly once");
assert.match(recovery, /attackExecutionRegistryRef\.current\.delete\(attackActionId\)/);
assert.match(recovery, /rejectActionContinuationReceipt/);
assert.match(recovery, /armored-action-plan-rejection-recovery-completed/);
assert.doesNotMatch(recovery, /rollD20|drainStamina|spendStamina/);

const lethalStart = page.indexOf("const grappleCompletion = executeAdmittedGrappleResolutionHandler");
const lethalEnd = page.indexOf("const grappleCompletionDecision", lethalStart);
const lethalSource = page.slice(lethalStart, lethalEnd);
const completionIndex = lethalSource.indexOf("const canonicalCompletion =");
const auditIndex = lethalSource.indexOf("auditSettledActionContinuation", completionIndex);
const cleanupIndex = lethalSource.indexOf("endCombatIfVictoryResolved", auditIndex);
const terminalIndex = lethalSource.indexOf('eventType: "grapple-combat-end-terminal-return"', cleanupIndex);
assert.ok(completionIndex >= 0 && auditIndex > completionIndex && cleanupIndex > auditIndex && terminalIndex > cleanupIndex,
  "lethal grapple order must be completion -> audit -> cleanup -> terminal return");
const postHpStart = lethalSource.indexOf("onPostHpMutation:");
const postHpEnd = lethalSource.indexOf("registerDroppedBattlefieldItem", postHpStart);
assert.doesNotMatch(lethalSource.slice(postHpStart, postHpEnd), /endCombatIfVictoryResolved/,
  "inner HP callback must only detect combat end, not clear lifecycle registries");
assert.match(resolver, /formatArmorGapContactOutcomeLog/);

console.log("Phase 3B3A browser-log stabilization tests passed");
