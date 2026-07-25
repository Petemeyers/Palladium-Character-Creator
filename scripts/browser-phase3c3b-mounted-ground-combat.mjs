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
    const { runPhase3C3BMountedBrowserScenarios } = await import('/src/utils/combat/phase3c3bMountedGroundScenarios.js');
    const result = runPhase3C3BMountedBrowserScenarios();
    return {
      route: location.pathname,
      mountAndMove: {
        mounted: result.mountAndMove.mounted.accepted,
        movement: result.mountAndMove.movement.accepted,
        mountPosition: result.mountAndMove.mount.position,
        riderPosition: result.mountAndMove.rider.position,
      },
      chargeAndBrace: {
        brace: result.chargeAndBrace.brace.accepted,
        charge: result.chargeAndBrace.charge.accepted,
        order: result.chargeAndBrace.order,
        attackId: result.chargeAndBrace.claim.claim.attackId,
      },
      targeting: {
        rider: result.targeting.riderTarget.targetKind,
        mount: result.targeting.mountTarget.targetKind,
        riderArmor: result.targeting.riderArmor.profileKey,
        mountArmor: result.targeting.mountArmor.armorClass,
      },
      forcedDismount: {
        accepted: result.forcedDismount.forced.accepted,
        state: result.forcedDismount.forced.forcedDismount.state,
        riderProne: result.forcedDismount.forced.rider.prone,
        linkState: result.forcedDismount.forced.release.link.state,
      },
      authorityErrorCount: result.authorityErrorCount,
      combatOverCount: result.combatOverCount,
    };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text);
const report = evaluated.result.value;
assert.equal(report.route, "/combat");
assert.equal(report.mountAndMove.mounted, true);
assert.equal(report.mountAndMove.movement, true);
assert.deepEqual(report.mountAndMove.mountPosition, report.mountAndMove.riderPosition);
assert.equal(report.chargeAndBrace.brace, true);
assert.equal(report.chargeAndBrace.charge, true);
assert.deepEqual(report.chargeAndBrace.order, ["brace", "authorized", "impact"]);
assert.equal(report.chargeAndBrace.attackId, "shop-item:205:lance");
assert.equal(report.targeting.rider, "rider");
assert.equal(report.targeting.mount, "mount");
assert.equal(report.targeting.riderArmor, "armor.plate-harness");
assert.equal(report.targeting.mountArmor, "natural-hide");
assert.equal(report.forcedDismount.accepted, true);
assert.equal(report.forcedDismount.state, "completed");
assert.equal(report.forcedDismount.riderProne, true);
assert.equal(report.forcedDismount.linkState, "released");
assert.equal(report.authorityErrorCount, 0);
assert.equal(report.combatOverCount, 1);
console.log(JSON.stringify(report, null, 2));
socket.close();
