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
    const { runAllPhase3C3CBrowserScenarios } = await import('/src/utils/combat/phase3c3cMountedFlightScenarios.js');
    const scenarios = runAllPhase3C3CBrowserScenarios();
    const forbidden = new Set([
      'invalid-flying-mounted-link','flying-mount-profile-missing','overloaded-flying-mount',
      'rider-altitude-divergence','rider-independent-movement','duplicate-takeoff','duplicate-landing',
      'duplicate-aerial-separation','duplicate-linked-fall','stale-mounted-flight-callback',
      'stale-linked-fall-callback','mount-rider-hp-merge','mount-rider-stamina-merge',
      'rider-weapon-on-mount','mount-natural-attack-on-rider','action-after-linked-fall',
      'unresolved-mounted-flight-continuation','turn-key-mismatch','round rollback',
      'previous-turn-busy','busy-start-block','duplicate completion','duplicate finalizer',
      'post-outcome movement','post-outcome attack','unknown authoritative actor','attack-resolution error'
    ]);
    const diagnostics = Object.values(scenarios).flatMap((scenario) => scenario.diagnostics || []);
    return {
      route: location.pathname,
      takeoffMovementLanding: {
        takeoff: scenarios.takeoffMovementLanding.takeoff.execution.accepted,
        movement: scenarios.takeoffMovementLanding.movement.execution.accepted,
        landing: scenarios.takeoffMovementLanding.landing.execution.accepted,
        finalAltitude: scenarios.takeoffMovementLanding.mount.altitudeFeet,
      },
      aerialRiderRanged: {
        accepted: scenarios.aerialRiderRanged.attack.accepted,
        ammunitionSpent: scenarios.aerialRiderRanged.attack.ammunition.spent,
      },
      targeting: {
        rider: scenarios.targeting.riderTarget.accepted,
        mount: scenarios.targeting.mountTarget.accepted,
      },
      linkedFall: {
        accepted: scenarios.linkedFall.fall.accepted,
        riderAltitude: scenarios.linkedFall.fall.rider.altitudeFeet,
        mountAltitude: scenarios.linkedFall.fall.mount.altitudeFeet,
        impacts: scenarios.linkedFall.fall.linkedFall.impactCount,
      },
      intelligentCommand: {
        accepted: scenarios.intelligentCommand.accepted.outcome,
        refused: scenarios.intelligentCommand.refused.outcome,
      },
      authorityErrorCount: diagnostics.filter((entry) => forbidden.has(entry.eventType)).length,
      combatOverCount: diagnostics.filter((entry) => entry.eventType === 'combat-over').length,
    };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text);
const report = evaluated.result.value;
assert.equal(report.route, "/combat");
assert.equal(report.takeoffMovementLanding.takeoff, true);
assert.equal(report.takeoffMovementLanding.movement, true);
assert.equal(report.takeoffMovementLanding.landing, true);
assert.equal(report.takeoffMovementLanding.finalAltitude, 0);
assert.equal(report.aerialRiderRanged.accepted, true);
assert.equal(report.aerialRiderRanged.ammunitionSpent, 1);
assert.equal(report.targeting.rider, true);
assert.equal(report.targeting.mount, true);
assert.equal(report.linkedFall.accepted, true);
assert.equal(report.linkedFall.riderAltitude, 0);
assert.equal(report.linkedFall.mountAltitude, 0);
assert.equal(report.linkedFall.impacts, 2);
assert.equal(report.intelligentCommand.accepted, "accepted");
assert.equal(report.intelligentCommand.refused, "refused");
assert.equal(report.authorityErrorCount, 0);
assert.equal(report.combatOverCount, 1);
console.log(JSON.stringify(report, null, 2));
socket.close();
