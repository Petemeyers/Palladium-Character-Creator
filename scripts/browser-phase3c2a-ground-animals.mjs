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
await send("Runtime.enable");
const evaluated = await send("Runtime.evaluate", {
  expression: `(async () => {
    const { runPhase3C2AGroundAnimalScenario } = await import('/src/utils/combat/phase3c2aGroundAnimalScenario.js');
    const scenario = runPhase3C2AGroundAnimalScenario();
    return {
      route: location.pathname,
      actors: scenario.roster.map(({ id, actorKey, species, creatureType, team, movement, naturalAttackProfiles }) => ({
        id, actorKey, species, creatureType, team,
        canFly: movement?.canFly,
        attacks: naturalAttackProfiles?.map(({ attackKey, damageType, anatomySource }) => ({ attackKey, damageType, anatomySource })) || [],
      })),
      allValid: scenario.validations.every(({ valid }) => valid),
      duplicateWolfIdentityIndependent: scenario.duplicateWolfIdentityIndependent,
      explicitPackIdentity: scenario.explicitPackIdentity,
      biteAccepted: scenario.bite.accepted,
      biteToken: scenario.bite.actionToken,
      biteEvent: scenario.bite.events[0]?.eventType,
      biteCompletion: scenario.biteCompletion.eventType,
      tuskChargeAccepted: scenario.tuskCharge.accepted,
      survivalEvent: scenario.retreat.events[0]?.eventType,
      retreatStaminaSpent: scenario.retreat.staminaSpent,
      finalizationDeferredWhilePending: scenario.finalizationWhilePending.defer,
      finalizationDeferredAfterCommit: scenario.finalizationAfterCommit.defer,
      combatOverCount: scenario.combatOverCount,
      postOutcomeActions: scenario.postOutcomeActions,
      authorityErrorCount: scenario.authorityErrorCount,
    };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text);
const report = evaluated.result.value;
assert.equal(report.route, "/combat");
assert.equal(report.allValid, true);
assert.equal(report.duplicateWolfIdentityIndependent, true);
assert.equal(report.explicitPackIdentity, true);
assert.equal(report.biteAccepted, true);
assert.equal(report.biteEvent, "natural-attack-impact-entered");
assert.equal(report.biteCompletion, "natural-attack-impact-completed");
assert.equal(report.tuskChargeAccepted, true);
assert.equal(report.survivalEvent, "animal-retreated");
assert.equal(report.retreatStaminaSpent, 1);
assert.equal(report.finalizationDeferredWhilePending, true);
assert.equal(report.finalizationDeferredAfterCommit, false);
assert.equal(report.combatOverCount, 1);
assert.equal(report.postOutcomeActions, 0);
assert.equal(report.authorityErrorCount, 0);
assert.equal(report.actors.filter((actor) => actor.creatureType === "animal").every((actor) => actor.canFly === false), true);
console.log(JSON.stringify(report, null, 2));
socket.close();
