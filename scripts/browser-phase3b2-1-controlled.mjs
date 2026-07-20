import assert from "node:assert/strict";
import WebSocket from "ws";

const targets = await fetch("http://127.0.0.1:9223/json").then((response) => response.json());
const target = targets.find((entry) => entry.type === "page" && entry.url.includes("/combat"));
assert.ok(target?.webSocketDebuggerUrl, "combat browser target must be available");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
let id = 0;
const pending = new Map();
socket.on("message", (raw) => {
  const message = JSON.parse(String(raw));
  if (!pending.has(message.id)) return;
  const callbacks = pending.get(message.id);
  pending.delete(message.id);
  message.error ? callbacks.reject(new Error(message.error.message)) : callbacks.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const commandId = ++id;
  pending.set(commandId, { resolve, reject });
  socket.send(JSON.stringify({ id: commandId, method, params }));
});
const evaluated = await send("Runtime.evaluate", {
  expression: `(async () => {
    const grappling = await import('/src/utils/grapplingSystem.js');
    const weapons = await import('/src/utils/combat/grappleWeaponTransitions.js');
    const continuation = await import('/src/utils/combat/actionContinuationReceipt.js');
    const canonical = await import('/src/utils/combat/canonicalGrappleExecution.js');
    const admission = Object.freeze({ generationId: 'g', initiativeTurnId: 'turn', actionToken: 'turn:1', actionSequence: 1, actorId: 'actor', opponentId: 'opponent', actionType: 'breakFree', executionKey: 'exec' });
    const makeRoller = (values, rollKind, ownedAdmission = admission) => {
      let index = 0;
      const fn = () => values[index++];
      Object.defineProperties(fn, {
        canonicalAdmission: { value: ownedAdmission },
        canonicalActionToken: { value: ownedAdmission.actionToken },
        canonicalExecutionKey: { value: ownedAdmission.executionKey },
        canonicalRollKind: { value: rollKind },
      });
      return { fn, calls: () => index };
    };
    const pair = () => ({
      actor: { id: 'actor', name: 'Player Knight', PS: 10, currentStamina: 20, remainingActions: 2, grappleState: { state: grappling.GRAPPLE_STATES.CLINCH, positionState: 'standing', opponent: 'opponent', isAttacker: false } },
      opponent: { id: 'opponent', name: 'Enemy Knight', PS: 10, currentStamina: 20, remainingActions: 2, guardRating: 12, hp: 1, currentHP: 1, grappleState: { state: grappling.GRAPPLE_STATES.CLINCH, positionState: 'standing', opponent: 'actor', isAttacker: true } },
    });
    const failedPair = pair();
    const failedDice = makeRoller([5, 14], 'break-free-opposed-roll');
    const failedEscape = grappling.breakFree(failedPair.actor, failedPair.opponent, failedDice.fn);
    const successPair = pair();
    const successDice = makeRoller([18, 4], 'break-free-opposed-roll');
    const successfulEscape = grappling.breakFree(successPair.actor, successPair.opponent, successDice.fn);

    const sword = { id: 'long-sword', name: 'Long Sword', handed: 'one-handed', category: 'sword', damage: '1d8' };
    const dagger = { id: 'dagger', name: 'Dagger', handed: 'one-handed', category: 'dagger', usableInClinch: true, weaponSize: 'small', damage: '1d4' };
    const drawPair = pair();
    drawPair.actor.equistaminadWeapons = [sword, dagger];
    drawPair.actor.combatWeaponState = { readyWeaponId: null, retainedWeaponId: 'long-sword', retainedWeaponDisposition: 'retained-unusable-in-clinch', clinchWeaponId: null, clinchWeaponReady: false, droppedWeaponIds: [] };
    const draw = weapons.drawClinchDaggerTransition({ fighter: drawPair.actor, opponent: drawPair.opponent, position: { x: 1, y: 1 }, actionToken: 'turn:1' });

    const strikeAdmission = Object.freeze({ ...admission, actionType: 'clinchStrike', actionToken: 'turn:2', actionSequence: 2, executionKey: 'strike-exec' });
    const strikePair = pair();
    const strikeDice = makeRoller([20], 'clinch-strike-attack', strikeAdmission);
    let damageClaimChecks = 0;
    const strike = grappling.groundAttack(strikePair.actor, strikePair.opponent, dagger, strikeDice.fn, () => { damageClaimChecks += 1; }, 'standing');

    const key = 'g::turn::actor::one::next-2';
    const created = continuation.createActionContinuationReceipt({ continuationId: key, continuationKey: key, generationId: 'g', initiativeTurnId: 'turn', actorId: 'actor', completedActionToken: 'one', completedActionType: 'breakFree', completedActionSequence: 1, remainingActions: 1 });
    const fired = continuation.fireActionContinuationReceipt(created.record);
    const consumed = continuation.consumeActionContinuationReceipt(fired.record, { actionToken: strikeAdmission.actionToken, actionType: 'clinchStrike' });
    let record = { state: 'created', rollStarted: false };
    const lifecycle = [];
    for (const state of ['selected', 'dispatched', 'resolving', 'roll-claimed', 'committed', 'completed']) {
      const transition = canonical.transitionCanonicalGrappleExecutionRecord(record, state, 1);
      lifecycle.push(state);
      record = transition.record;
    }
    return {
      failedEscape: { success: failedEscape.success, actorNaturalRoll: failedEscape.characterRollBreakdown.naturalRoll, actorTotal: failedEscape.characterRollBreakdown.total, opponentNaturalRoll: failedEscape.opponentRollBreakdown.naturalRoll, opponentTotal: failedEscape.opponentRollBreakdown.total, grappleStillActive: failedPair.actor.grappleState.state === grappling.GRAPPLE_STATES.CLINCH, rngCalls: failedDice.calls() },
      successfulEscape: { success: successfulEscape.success, actorNaturalRoll: successfulEscape.characterRollBreakdown.naturalRoll, actorTotal: successfulEscape.characterRollBreakdown.total, opponentNaturalRoll: successfulEscape.opponentRollBreakdown.naturalRoll, opponentTotal: successfulEscape.opponentRollBreakdown.total, symmetricClear: successPair.actor.grappleState.state === grappling.GRAPPLE_STATES.NEUTRAL && successPair.opponent.grappleState.state === grappling.GRAPPLE_STATES.NEUTRAL, rngCalls: successDice.calls() },
      draw: { ok: draw.ok, remainingActions: draw.fighter.remainingActions, daggerReady: draw.combatWeaponState.clinchWeaponReady, primaryWeaponDropped: draw.primaryWeaponDropped, rngCalls: 0 },
      strike: { hit: strike.hit, naturalRoll: strike.naturalRoll, attackRoll: strike.attackRoll, damage: strike.damage, lethalAtOneHp: strike.damage >= 1, rngCalls: strikeDice.calls(), damageClaimChecks },
      receipt: { state: consumed.record.state, sequence: consumed.record.nextActionSequence, consumedByActionToken: consumed.record.consumedByActionToken, consumedByActionType: consumed.record.consumedByActionType },
      lifecycle,
      terminalState: record.state,
    };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text);
const result = evaluated.result.value;
assert.deepEqual(result.failedEscape, { success: false, actorNaturalRoll: 5, actorTotal: 5, opponentNaturalRoll: 14, opponentTotal: 14, grappleStillActive: true, rngCalls: 2 });
assert.equal(result.successfulEscape.success, true);
assert.equal(result.successfulEscape.symmetricClear, true);
assert.equal(result.draw.ok, true);
assert.equal(result.draw.remainingActions, 0);
assert.equal(result.draw.daggerReady, true);
assert.equal(result.draw.primaryWeaponDropped, true);
assert.equal(result.strike.hit, true);
assert.equal(result.strike.rngCalls, 1);
assert.equal(result.strike.damageClaimChecks, 1);
assert.equal(result.strike.lethalAtOneHp, true);
assert.deepEqual(result.receipt, { state: "consumed", sequence: 2, consumedByActionToken: "turn:2", consumedByActionType: "clinchStrike" });
assert.deepEqual(result.lifecycle, ["selected", "dispatched", "resolving", "roll-claimed", "committed", "completed"]);
assert.equal(result.terminalState, "completed");
console.log(JSON.stringify(result, null, 2));
socket.close();
