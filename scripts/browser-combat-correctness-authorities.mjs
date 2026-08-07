import assert from "node:assert/strict";
import WebSocket from "ws";

const targets = await fetch("http://127.0.0.1:9223/json").then((response) => response.json());
const target = targets.find((entry) => entry.type === "page" && entry.url.includes("/combat"));
assert.ok(target?.webSocketDebuggerUrl, "combat browser target must be available");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
let sequence = 0;
const pending = new Map();
socket.on("message", (raw) => {
  const response = JSON.parse(String(raw));
  const request = pending.get(response.id);
  if (!request) return;
  pending.delete(response.id);
  response.error ? request.reject(new Error(response.error.message)) : request.resolve(response.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluated = await send("Runtime.evaluate", {
  expression: `(async () => {
    const module = await import('/src/utils/combat/combatCorrectnessBrowserScenario.js');
    return { route: location.pathname, bodyRendered: document.body.innerText.length > 0, scenario: module.runCombatCorrectnessBrowserScenario() };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text);
const report = evaluated.result.value;
assert.equal(report.route, "/combat");
assert.equal(report.bodyRendered, true);
assert.equal(report.scenario.actorCount, 20);
assert.equal(report.scenario.identityAudit.matches, true);
assert.equal(report.scenario.routedTargetExcluded, true);
assert.deepEqual(report.scenario.ammunitionCounts, [19, 18]);
assert.equal(report.scenario.finalAmmunition, 18);
assert.equal(report.scenario.projectileReleaseCount, 2);
assert.equal(report.scenario.movementAccepted, true);
assert.ok(report.scenario.movementStaminaSpent > 0);
assert.deepEqual(report.scenario.movementPosition, { x: 3, y: 0 });
console.log(JSON.stringify(report, null, 2));
socket.close();
