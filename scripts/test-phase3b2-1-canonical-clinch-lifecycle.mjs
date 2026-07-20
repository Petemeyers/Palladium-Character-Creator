import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeCanonicalD20Roll } from "../src/utils/combat/normalizeCanonicalD20Roll.js";
import { transitionCanonicalGrappleExecutionRecord } from "../src/utils/combat/canonicalGrappleExecution.js";
import {
  consumeActionContinuationReceipt,
  createActionContinuationReceipt,
  fireActionContinuationReceipt,
  validateActionContinuationAdmission,
} from "../src/utils/combat/actionContinuationReceipt.js";

let grappleSource = fs.readFileSync(new URL("../src/utils/grapplingSystem.js", import.meta.url), "utf8");
grappleSource = grappleSource.replace(/^import[\s\S]*?;\s*$/gm, "");
let normalizeSource = fs.readFileSync(new URL("../src/utils/combat/normalizeCanonicalD20Roll.js", import.meta.url), "utf8");
normalizeSource = normalizeSource
  .replace("export function normalizeCanonicalD20Roll", "function normalizeCanonicalD20Roll")
  .replace(/export default normalizeCanonicalD20Roll;?/, "");
const prelude = `
const STAMINA_COSTS = { NORMAL_COMBAT: 1, GRAPPLING: 1 };
const drainStamina = (fighter, _cost, amount) => { fighter.currentStamina = (fighter.currentStamina ?? 0) - amount; };
const getCombinedGrappleModifiers = () => ({ autoGrapple: false });
const getSizeCategory = () => "medium";
const assessGrappleSizeOutcome = () => ({});
const canLiftAndThrow = () => ({ canThrow: true });
const getLeveragePenalty = () => 0;
const canCarryTarget = () => true;
const calculateArmorDamage = () => ({ armorHit: false, damageToCharacter: 1 });
const linkCombinedBodies = () => null;
const COMBINED_ROLES = {};
const COMBINED_MODES = {};
const canFly = () => false;
const isFlying = () => false;
const getAltitude = () => 0;
`;
const grappleModuleUrl = `data:text/javascript;base64,${Buffer.from(`${prelude}${normalizeSource}${grappleSource}`).toString("base64")}`;
const { breakFree, groundAttack, GRAPPLE_STATES } = await import(grappleModuleUrl);

const admission = Object.freeze({
  generationId: "generation-1",
  initiativeTurnId: "turn-1",
  actionToken: "turn-1:1",
  actionSequence: 1,
  actorId: "actor",
  opponentId: "opponent",
  executionKey: "execution-1",
});
const canonicalRoller = (values, rollKind = "break-free-opposed-roll") => {
  let index = 0;
  const roller = () => values[index++];
  Object.defineProperties(roller, {
    canonicalAdmission: { value: admission },
    canonicalActionToken: { value: admission.actionToken },
    canonicalExecutionKey: { value: admission.executionKey },
    canonicalRollKind: { value: rollKind },
  });
  return { roller, calls: () => index };
};
const clinchedPair = () => {
  const actor = {
    id: "actor", name: "Actor", PS: 10, remainingActions: 2,
    currentStamina: 20,
    grappleState: { state: GRAPPLE_STATES.CLINCH, positionState: "standing", opponent: "opponent", isAttacker: false },
  };
  const opponent = {
    id: "opponent", name: "Opponent", PS: 10, remainingActions: 2,
    currentStamina: 20,
    grappleState: { state: GRAPPLE_STATES.CLINCH, positionState: "standing", opponent: "actor", isAttacker: true },
  };
  return { actor, opponent };
};

// Supported canonical d20 shapes remain explicit and finite.
assert.deepEqual(
  normalizeCanonicalD20Roll(12, { modifier: -1 }).ok,
  true,
);
assert.deepEqual(
  normalizeCanonicalD20Roll({ naturalRoll: 13 }, { modifier: 2 }).total,
  15,
);
assert.deepEqual(
  normalizeCanonicalD20Roll({ individualRolls: [9], total: 9 }, { modifier: 0 }).naturalRoll,
  9,
);
assert.equal(normalizeCanonicalD20Roll({ individualRolls: [9], total: 9 }, { modifier: 2 }).total, 11);
assert.equal(normalizeCanonicalD20Roll({ total: 17 }, { modifier: 0 }).ok, false, "a total-only object must not invent a natural roll");

// Valid failed escape: both rolls finite, one claim owns two RNG calls, grapple remains.
{
  const { actor, opponent } = clinchedPair();
  const dice = canonicalRoller([4, 15]);
  const result = breakFree(actor, opponent, dice.roller);
  assert.equal(result.success, false);
  assert.equal(result.invalidRoll, undefined);
  assert.equal(result.characterRollBreakdown.naturalRoll, 4);
  assert.equal(result.opponentRollBreakdown.naturalRoll, 15);
  assert.equal(Number.isFinite(result.characterRoll), true);
  assert.equal(Number.isFinite(result.opponentRoll), true);
  assert.equal(actor.grappleState.state, GRAPPLE_STATES.CLINCH);
  assert.equal(dice.calls(), 2);
}

// Valid successful escape: symmetric relationship clears once.
{
  const { actor, opponent } = clinchedPair();
  const dice = canonicalRoller([18, 3]);
  const result = breakFree(actor, opponent, dice.roller);
  assert.equal(result.success, true);
  assert.equal(actor.grappleState.state, GRAPPLE_STATES.NEUTRAL);
  assert.equal(opponent.grappleState.state, GRAPPLE_STATES.NEUTRAL);
  assert.equal(actor.grappleState.opponent, null);
  assert.equal(opponent.grappleState.opponent, null);
  assert.equal(dice.calls(), 2);
}

// Invalid actor/opponent shapes cannot become an ordinary failed escape and mutate nothing.
for (const [values, expectedCalls] of [[[{ total: 7 }, 12], 1], [[12, { total: 7 }], 2]]) {
  const { actor, opponent } = clinchedPair();
  const actorBefore = structuredClone(actor.grappleState);
  const opponentBefore = structuredClone(opponent.grappleState);
  const staminaBefore = actor.currentStamina;
  const dice = canonicalRoller(values);
  const result = breakFree(actor, opponent, dice.roller);
  assert.equal(result.invalidRoll, true);
  assert.equal(result.success, false);
  assert.equal(result.rejectionReason, "missing-or-invalid-natural-roll");
  assert.deepEqual(actor.grappleState, actorBefore);
  assert.deepEqual(opponent.grappleState, opponentBefore);
  assert.equal(actor.currentStamina, staminaBefore);
  assert.equal(dice.calls(), expectedCalls, "invalid rolls must not trigger retry or unnecessary opponent RNG");
}

// A direct standing strike without canonical execution/claim is blocked before RNG or mutation.
{
  const { actor, opponent } = clinchedPair();
  let rngCalls = 0;
  const result = groundAttack(actor, opponent, { name: "Dagger", usableInClinch: true }, () => { rngCalls += 1; return 20; }, null, "standing");
  assert.equal(result.blocked, true);
  assert.equal(result.reason, "clinch-strike-roll-without-canonical-execution-blocked");
  assert.equal(rngCalls, 0);
  assert.equal(actor.currentStamina, 20);
  assert.equal(opponent.currentStamina, 20);
}

// No-roll draw and rolling strike both have legal canonical terminal progressions.
let drawRecord = { state: "created", rollStarted: false };
for (const state of ["selected", "dispatched", "resolving", "committed", "completed"]) {
  const transition = transitionCanonicalGrappleExecutionRecord(drawRecord, state, 1);
  assert.equal(transition.ok, true);
  drawRecord = transition.record;
}
assert.equal(drawRecord.rollStarted, false);
let strikeRecord = { state: "created", rollStarted: false };
for (const state of ["selected", "dispatched", "resolving", "roll-claimed", "committed", "completed"]) {
  const transition = transitionCanonicalGrappleExecutionRecord(strikeRecord, state, 1);
  assert.equal(transition.ok, true);
  strikeRecord = transition.record;
}

// Player/enemy sequence-two draw and strike consume the exact fired receipt with the canonical token/type.
for (const actorId of ["player-knight", "enemy-knight"]) {
  for (const actionType of ["drawClinchDagger", "clinchStrike"]) {
    const continuationKey = `generation::turn::${actorId}::action-one::next-2`;
    const created = createActionContinuationReceipt({
      continuationId: continuationKey,
      continuationKey,
      generationId: "generation",
      initiativeTurnId: "turn",
      actorId,
      completedActionToken: "action-one",
      completedActionType: "breakFree",
      completedActionSequence: 1,
      remainingActions: 1,
    });
    const fired = fireActionContinuationReceipt(created.record);
    const validated = validateActionContinuationAdmission({
      record: fired.record,
      receipt: fired.record,
      generationId: "generation",
      initiativeTurnId: "turn",
      actorId,
      requestedActionSequence: 2,
      remainingActions: 1,
      combatActive: true,
      actorCapable: true,
      actionLegal: true,
      completedActionCanonical: true,
    });
    assert.equal(validated.ok, true);
    const actionToken = `turn:2:${actorId}:${actionType}`;
    const consumed = consumeActionContinuationReceipt(fired.record, { actionToken, actionType });
    assert.equal(consumed.ok, true);
    assert.equal(consumed.record.nextActionSequence, 2);
    assert.equal(consumed.record.consumedByActionToken, actionToken);
    assert.equal(consumed.record.consumedByActionType, actionType);
  }
}

const page = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const handler = fs.readFileSync(new URL("../src/utils/combatActionHandlers/grappleActions.js", import.meta.url), "utf8");
assert.match(page, /canonical-grapple-executor-entered/);
assert.match(page, /grapple-action-committed/);
assert.match(page, /grapple-action-lifecycle-audit/);
assert.match(page, /draw-clinch-dagger-followup-scheduling-blocked/);
assert.match(page, /executeCanonicalGrappleAction\(\{ actor, opponent: targetActor, actionType: requestedActionType/);
assert.match(page, /continuationAuthorization: admission\?\.continuationAuthorization/);
assert.match(handler, /draw-clinch-dagger-turn-ending-state-committed/);
assert.match(handler, /break-free-invalid-roll-blocked/);
assert.match(handler, /break-free-opposed-roll/);
assert.match(handler, /clinch-strike-attack/);
assert.match(handler, /standing-clinch-used-ground-attack-resolver-blocked/);
assert.equal(handler.includes('rollKind = /dagger|knife/i'), false, "clinch strike roll ownership must not depend on weapon-name terminology");

console.log("Phase 3B2.1 canonical break-free, dagger-draw, and clinch-strike lifecycle fixtures passed");
