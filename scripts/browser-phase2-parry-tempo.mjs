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
    const module = await import('http://127.0.0.1:5173/src/utils/combat/phase2DefenseScenarios.js');
    const report = module.createPhase2SwordDuelScenario();
    return {
      route: location.pathname,
      ...report,
      bodyHasObjectObject: document.body.innerText.includes('[object Object]'),
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
assert.deepEqual(report.outcomes, ["parry_neutral", "parry_advantage", "parry_dominant"]);
assert.deepEqual(report.openingLevels, [0, 1, 2]);
assert.deepEqual(report.finalInitiative, report.initialInitiative);
assert.deepEqual(report.finalEconomy, report.initialEconomy);
assert.equal(report.staleAccepted, false);
assert.equal(report.beforeRoundClear, 1);
assert.equal(report.afterRoundClear, 0);
assert.equal(report.immediateAttacksCreated, 0);
assert.equal(report.bodyHasObjectObject, false);
console.log(JSON.stringify(report, null, 2));
socket.close();
