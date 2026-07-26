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
    const { runPhase3C4A1BrowserScenarios } = await import('/src/utils/combat/phase3c4a1LiveScenarios.js');
    const result = runPhase3C4A1BrowserScenarios();
    const forbidden = new Set([
      'hawk-quadruped-body-plan','avian-wing-anatomy-missing','hawk-humanoid-quarry',
      'hawk-oversized-quarry','narrated-flight-without-position-commit',
      'wildlife-generic-routing-before-intent','boar-run-to-range-without-aggression',
      'boar-humanoid-unarmed-fallback','wildlife-universal-hostility','hide-no-prowl-hard-gate',
      'hidden-without-concealment','global-hidden-state-used',
      'observer-visibility-divergence-invalid','sneak-without-concealment',
      'sneak-position-bypass','duplicate-aim','stale-aim','aim-wrong-target',
      'aim-wrong-weapon','range-band-missing','range-modifier-missing',
      'beyond-range-attack','modifier-component-sum-mismatch',
      'misleading-fatigue-component','stale-wildlife-callback',
      'stale-concealment-callback','stale-position-mutation','stale-altitude-mutation',
      'unresolved-continuation','duplicate completion','duplicate finalizer',
      'round rollback','turn-key-mismatch','previous-turn-busy terminal stall',
      'busy-start-block terminal stall','post-outcome movement','post-outcome attack',
      'attack-resolution error'
    ]);
    return {
      route: location.pathname,
      scenarios: result.scenarios.map((scenario) => ({
        key: scenario.key,
        eventCount: scenario.events.length,
        encounterOverCount: scenario.encounterOverCount,
        goal: scenario.routing?.selectedGoal || null,
        moved: scenario.waypoint?.allowed || scenario.escape?.allowed || scenario.result?.positionCommitted || false,
      })),
      authorityErrorCount: result.authorityDiagnostics.filter((entry) => forbidden.has(entry.eventType)).length,
      diagnosticCount: result.authorityDiagnostics.length,
      encounterOverCount: result.encounterOverCount,
    };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text);
const report = evaluated.result.value;
assert.equal(report.route, "/combat");
assert.equal(report.scenarios.length, 12);
assert.ok(report.scenarios.every((scenario) => scenario.encounterOverCount === 1));
assert.equal(report.authorityErrorCount, 0);
assert.equal(report.diagnosticCount, 0);
assert.equal(report.encounterOverCount, 1);
console.log(JSON.stringify(report, null, 2));
socket.close();
