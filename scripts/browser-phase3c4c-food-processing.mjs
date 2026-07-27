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
let commandId = 0;
const pending = new Map();
socket.on("message", (raw) => {
  const message = JSON.parse(String(raw));
  const handler = pending.get(message.id);
  if (!handler) return;
  pending.delete(message.id);
  message.error ? handler.reject(new Error(message.error.message)) : handler.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++commandId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
await send("Runtime.enable");
const evaluated = await send("Runtime.evaluate", {
  expression: `(async () => {
    const { runPhase3C4CFoodBrowserScenarios } = await import('/src/utils/combat/phase3c4cFoodScenarios.js');
    const result = runPhase3C4CFoodBrowserScenarios();
    return {
      route: location.pathname,
      scenarios: result.scenarios.map((scenario) => ({
        key: scenario.key,
        huntingOutcomeCount: scenario.huntingOutcomeCount,
        fireAccepted: scenario.fire?.accepted ?? scenario.sheltered?.fire?.accepted ?? null,
        processingAccepted: scenario.processing?.accepted ?? null,
        completionAccepted: scenario.completion?.accepted ?? null,
        outputState: scenario.completion?.output?.processingState ?? null,
        outputLocation: scenario.completion?.outputLocation ?? null,
        mealAccepted: scenario.meal?.accepted ?? null,
      })),
      authorityErrorCount: result.authorityDiagnostics.length,
      diagnosticCount: result.scenarioDiagnostics.length,
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
assert.ok(report.scenarios.every((scenario) => scenario.huntingOutcomeCount === 1));
assert.equal(report.authorityErrorCount, 0);
assert.equal(report.diagnosticCount, 0);
assert.equal(report.encounterOverCount, 1);
console.log(JSON.stringify(report, null, 2));
socket.close();
