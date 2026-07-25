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
    const { runPhase3C2BFlyingAnimalScenario } = await import('/src/utils/combat/phase3c2bFlyingAnimalScenario.js');
    const scenario = runPhase3C2BFlyingAnimalScenario();
    return {
      route: location.pathname,
      actors: scenario.roster.map(({ id, actorKey, species, team, flightState, naturalAttackProfiles }) => ({
        id, actorKey, species, team, flightState,
        attacks: naturalAttackProfiles?.map(({ attackKey, anatomySource, damageType }) => ({ attackKey, anatomySource, damageType })) || [],
      })),
      allValid: scenario.validations.every(({ valid }) => valid),
      takeoffAccepted: scenario.takeoff.accepted,
      movementAccepted: scenario.movement.accepted,
      attackAuthorized: scenario.attackGeometry.accepted,
      attackEnteredImpact: scenario.attack.accepted,
      shieldStoppedImpact: scenario.impact.bodilyDamagePermitted === false,
      completionEvent: scenario.attackCompletion.eventType,
      survivalPendingDeferred: scenario.finalizationWhilePending.defer,
      survivalCommitted: scenario.retreat.committed,
      finalizationReleased: !scenario.finalizationAfterCommit.defer,
      altitudeMarker: scenario.presentation.compactMarker,
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
assert.equal(report.takeoffAccepted, true);
assert.equal(report.movementAccepted, true);
assert.equal(report.attackAuthorized, true);
assert.equal(report.attackEnteredImpact, true);
assert.equal(report.shieldStoppedImpact, true);
assert.equal(report.completionEvent, "natural-attack-impact-completed");
assert.equal(report.survivalPendingDeferred, true);
assert.equal(report.survivalCommitted, true);
assert.equal(report.finalizationReleased, true);
assert.equal(report.combatOverCount, 1);
assert.equal(report.postOutcomeActions, 0);
assert.equal(report.authorityErrorCount, 0);
console.log(JSON.stringify(report, null, 2));
socket.close();
