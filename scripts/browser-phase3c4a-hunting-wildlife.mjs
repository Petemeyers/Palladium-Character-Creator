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
    const { runPhase3C4ABrowserScenarios } = await import('/src/utils/combat/phase3c4aHuntingScenarios.js');
    const result = runPhase3C4ABrowserScenarios();
    const forbidden = new Set([
      'wildlife-universal-hostility','animal-intent-missing','species-morality-routing',
      'invalid-quarry-target','hawk-armored-humanoid-quarry','command-without-companion-link',
      'stale-companion-callback','companion-return-teleport','stale-detection-callback',
      'stale-pursuit-callback','duplicate-hunting-phase','duplicate-hunting-outcome',
      'escaped-quarry-carcass','harvest-before-recovery','ammunition-auto-refund',
      'competing-encounter-finalizer','unresolved-hunting-ownership','turn-key-mismatch',
      'round rollback','previous-turn-busy','busy-start-block','duplicate completion',
      'duplicate finalizer','post-outcome movement','post-outcome attack',
      'unknown authoritative actor','attack-resolution error'
    ]);
    const diagnostics = result.authorityDiagnostics || [];
    return {
      route: location.pathname,
      scenarios: result.scenarios.map((scenario) => ({
        key: scenario.key,
        outcome: scenario.encounter.outcome,
        encounterOverCount: scenario.events.filter((event) => event.eventType === 'encounter-over').length,
      })),
      authorityErrorCount: diagnostics.filter((entry) => forbidden.has(entry.eventType)).length,
      diagnosticCount: diagnostics.length,
    };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text);
const report = evaluated.result.value;
assert.equal(report.route, "/combat");
assert.equal(report.scenarios.length, 5);
assert.ok(report.scenarios.every((scenario) => scenario.encounterOverCount === 1));
assert.equal(report.authorityErrorCount, 0);
assert.equal(report.diagnosticCount, 0);
console.log(JSON.stringify(report, null, 2));
socket.close();
