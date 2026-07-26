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
    const { runPhase3C4BCarcassBrowserScenarios } = await import('/src/utils/combat/phase3c4bCarcassScenarios.js');
    const result = runPhase3C4BCarcassBrowserScenarios();
    const forbidden = new Set([
      'carcass-without-death','duplicate-carcass','escaped-quarry-carcass',
      'living-animal-harvest','harvest-before-recovery','companion-harvest-unauthorized',
      'mount-harvest-unauthorized','duplicate-hide','duplicate-tusk','resource-overharvest',
      'inventory-overcapacity','resource-lost-after-rejection','ammunition-auto-refund',
      'duplicate-projectile-recovery','stale-harvest-callback','duplicate-processing-completion',
      'competing-encounter-finalizer','turn-key-mismatch','round rollback','previous-turn-busy',
      'busy-start-block','post-processing mutation','unknown authoritative actor','harvest-resolution error'
    ]);
    return {
      route: location.pathname,
      scenarios: result.scenarios.map((scenario) => ({
        key: scenario.key,
        huntingOutcome: scenario.encounter?.outcome,
        processingOutcome: scenario.carcass?.processingOutcome || 'none',
        processingCompletionCount: scenario.events.filter((entry) => entry.eventType === 'carcass-processing-completed').length,
        carcassCreated: Boolean(scenario.carcass),
      })),
      authorityErrorCount: result.authorityDiagnostics.filter((entry) => forbidden.has(entry.eventType)).length,
      diagnosticCount: result.authorityDiagnostics.length,
    };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text);
const report = evaluated.result.value;
assert.equal(report.route, "/combat");
assert.equal(report.scenarios.length, 5);
assert.equal(report.scenarios.find((scenario) => scenario.key === "escaped-boar").carcassCreated, false);
assert.equal(report.scenarios.find((scenario) => scenario.key === "recovered-boar").processingCompletionCount, 1);
assert.equal(report.authorityErrorCount, 0);
assert.equal(report.diagnosticCount, 0);
console.log(JSON.stringify(report, null, 2));
socket.close();
