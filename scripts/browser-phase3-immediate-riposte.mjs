import assert from "node:assert/strict";
import WebSocket from "ws";

const targets = await fetch("http://127.0.0.1:9223/json").then((response) => response.json());
const target = targets.find((entry) => entry.type === "page" && entry.url.includes("/combat"));
assert.ok(target?.webSocketDebuggerUrl, "combat browser target must be available");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.once("open", resolve);
  socket.once("error", reject);
});
let id = 0;
const pending = new Map();
socket.on("message", (raw) => {
  const message = JSON.parse(String(raw));
  const handler = pending.get(message.id);
  if (!handler) return;
  pending.delete(message.id);
  message.error ? handler.reject(new Error(message.error.message)) : handler.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const commandId = ++id;
  pending.set(commandId, { resolve, reject });
  socket.send(JSON.stringify({ id: commandId, method, params }));
});
const evaluated = await send("Runtime.evaluate", {
  expression: `(async () => {
    const module = await import('http://127.0.0.1:5173/src/utils/combat/phase3RiposteScenarios.js');
    const manualAccept = module.createPhase3RiposteScenario({ decision: 'accept', targetDefends: true });
    const manualDecline = module.createPhase3RiposteScenario({ decision: 'decline' });
    const dominantImpact = module.createPhase3RiposteScenario({ openingLevel: 2, targetDefends: false });
    const lethal = module.createPhase3RiposteScenario({ reactionEndsCombat: true });
    const largeBattle = module.createPhase3RiposteScenario({ largerBattle: true });
    const exhausted = module.createPhase3RiposteScenario({ stamina: 1, staminaCost: 4 });
    return {
      route: location.pathname,
      manualAccept,
      manualDecline,
      dominantImpact,
      lethal,
      largeBattle,
      exhausted,
      objectRenderingError: document.body.innerText.includes('[object Object]'),
    };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
if (evaluated.exceptionDetails) {
  throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text);
}
const report = evaluated.result.value;
assert.equal(report.route, "/combat");
assert.equal(report.manualAccept.immediateAttackCount, 1);
assert.equal(report.manualAccept.counterRiposteCount, 0);
assert.equal(report.manualAccept.maximumReactionDepth, 1);
assert.equal(report.manualAccept.events.find((event) => event.eventType === "reaction_attack_resolved").defended, true);
assert.equal(report.manualDecline.immediateAttackCount, 0);
assert.equal(report.manualDecline.sourceFinalizerCount, 1);
assert.equal(report.dominantImpact.events.find((event) => event.eventType === "reaction_attack_resolved").armorContact, true);
assert.equal(report.lethal.ordinaryTurnResumed, false);
assert.equal(report.largeBattle.nextFighterId, "knight-c");
assert.deepEqual(report.largeBattle.initiativeAfter, report.largeBattle.initiativeBefore);
assert.equal(report.exhausted.immediateAttackCount, 0);
assert.equal(report.objectRenderingError, false);
console.log(JSON.stringify({
  route: report.route,
  manualAccept: {
    events: report.manualAccept.events,
    reactionDepth: report.manualAccept.maximumReactionDepth,
    counterRiposteCount: report.manualAccept.counterRiposteCount,
    actionsBefore: report.manualAccept.defenderActionsBeforeRiposte,
    actionsAfter: report.manualAccept.defenderActionsAfterRiposte,
    staminaBefore: report.manualAccept.staminaBeforeRiposte,
    staminaAfter: report.manualAccept.staminaAfterRiposte,
  },
  manualDecline: report.manualDecline.events,
  dominantImpact: report.dominantImpact.events,
  lethalResumed: report.lethal.ordinaryTurnResumed,
  largeBattleNext: report.largeBattle.nextFighterId,
  exhaustedReason: report.exhausted.eligibility.reason,
  objectRenderingError: report.objectRenderingError,
}, null, 2));
socket.close();
