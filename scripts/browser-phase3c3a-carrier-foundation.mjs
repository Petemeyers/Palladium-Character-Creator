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
await send("Runtime.enable");
const evaluated = await send("Runtime.evaluate", {
  expression: `(async () => {
    const { runPhase3C3ABrowserScenarios } = await import('/src/utils/combat/phase3c3aCarrierScenarios.js');
    const result = runPhase3C3ABrowserScenarios();
    return {
      route: location.pathname,
      hawkPrey: {
        controlAccepted: result.hawkPrey.control.accepted,
        linkAccepted: result.hawkPrey.linked.accepted,
        carrierId: result.hawkPrey.linked.link.carrierId,
        passengerId: result.hawkPrey.linked.link.passengerId,
        linkId: result.hawkPrey.linked.link.linkId,
        movementAccepted: result.hawkPrey.movement.accepted,
        movement: result.hawkPrey.movement.passenger.position,
        releaseAccepted: result.hawkPrey.released.accepted,
        releaseState: result.hawkPrey.released.link.state,
        fallAccepted: result.hawkPrey.fall.accepted,
        fallState: result.hawkPrey.fall.fallState.state,
      },
      knightWarhorse: {
        mountAccepted: result.knightWarhorse.mounted.accepted,
        carrierId: result.knightWarhorse.mounted.link.carrierId,
        passengerId: result.knightWarhorse.mounted.link.passengerId,
        movementAccepted: result.knightWarhorse.movement.accepted,
        mountAction: result.knightWarhorse.beforeCatalog.some((entry) => entry.actionKey === 'mount'),
        dismountAction: result.knightWarhorse.duringCatalog.some((entry) => entry.actionKey === 'dismount'),
        riderMovementRejected: result.knightWarhorse.riderMove.reason,
        dismountAccepted: result.knightWarhorse.dismounted.accepted,
        finalPositions: {
          knight: result.knightWarhorse.knight.position,
          warhorse: result.knightWarhorse.warhorse.position,
        },
      },
      staleCallback: result.expectedNegativeDiagnostics,
      authorityErrorCount: result.authorityErrorCount,
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
assert.equal(report.hawkPrey.controlAccepted, true);
assert.equal(report.hawkPrey.linkAccepted, true);
assert.equal(report.hawkPrey.movementAccepted, true);
assert.equal(report.hawkPrey.releaseAccepted, true);
assert.equal(report.hawkPrey.fallAccepted, true);
assert.equal(report.knightWarhorse.mountAccepted, true);
assert.equal(report.knightWarhorse.movementAccepted, true);
assert.equal(report.knightWarhorse.mountAction, true);
assert.equal(report.knightWarhorse.dismountAction, true);
assert.equal(report.knightWarhorse.riderMovementRejected, "passenger-independent-movement");
assert.equal(report.knightWarhorse.dismountAccepted, true);
assert.deepEqual(report.staleCallback, [
  "stale-carrier-callback-rejected",
  "stale-carrier-callback-rejected",
]);
assert.equal(report.authorityErrorCount, 0);
console.log(JSON.stringify(report, null, 2));
socket.close();
