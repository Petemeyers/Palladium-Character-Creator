import assert from "node:assert/strict";
import WebSocket from "ws";

const targets = await fetch("http://127.0.0.1:9223/json").then((response) => response.json());
const target = targets.find((entry) => entry.type === "page");
assert.ok(target?.webSocketDebuggerUrl, "browser page target must be available");
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
await send("Page.navigate", { url: "http://127.0.0.1:5173/combat" });
await new Promise((resolve) => setTimeout(resolve, 1500));
const evaluated = await send("Runtime.evaluate", {
  expression: `(async () => {
    const module = await import('/src/utils/combat/phase4ADominantScenarios.js');
    const responses = ['riposte', 'maintain_bind', 'weapon_displacement', 'grapple_entry', 'controlled_disengage', 'decline'];
    const scenarios = Object.fromEntries(responses.map((response) => [response, module.createPhase4ADominantScenario({ response })]));
    scenarios.shield_pressure = module.createPhase4ADominantScenario({ response: 'shield_pressure', defenseType: 'shield' });
    scenarios.lethal_grapple = module.createPhase4ADominantScenario({ response: 'grapple_entry', combatEnds: true });
    return {
      route: location.pathname,
      scenarios,
      objectRenderingError: document.body.innerText.includes('[object Object]'),
      pageText: document.body.innerText.slice(0, 300),
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
assert.equal(report.objectRenderingError, false);
for (const [response, scenario] of Object.entries(report.scenarios)) {
  assert.equal(scenario.consumed, true, `${response} consumes once`);
  assert.equal(scenario.sourceExchangeConsumed, true, `${response} consumes source exchange`);
  assert.equal(scenario.reactionDepth, 1, `${response} stays depth one`);
  assert.equal(scenario.sourceFinalizerCount, 1, `${response} finalizes source once`);
  assert.equal(scenario.ordinaryActionsAfter, scenario.ordinaryActionsBefore, `${response} spends no ordinary action`);
}
assert.equal(report.scenarios.maintain_bind.control.attackPenalty, -2);
assert.equal(report.scenarios.weapon_displacement.control.defensePenalty, -2);
assert.equal(report.scenarios.shield_pressure.control.attackPenalty, -2);
assert.equal(report.scenarios.controlled_disengage.movement.hexesMoved, 1);
assert.equal(report.scenarios.controlled_disengage.movement.sourceOpportunityAttack, false);
assert.equal(report.scenarios.grapple_entry.grapple.canonicalAdmission, true);
assert.equal(report.scenarios.grapple_entry.grapple.staminaSpent, 1);
assert.equal(report.scenarios.grapple_entry.grapple.counterResponseCount, 0);
assert.equal(report.scenarios.lethal_grapple.sourceResumed, false);
console.log(JSON.stringify({
  route: report.route,
  responses: Object.fromEntries(Object.entries(report.scenarios).map(([key, value]) => [key, {
    events: value.events.map((event) => event.eventType),
    reactionDepth: value.reactionDepth,
    ordinaryActions: [value.ordinaryActionsBefore, value.ordinaryActionsAfter],
    control: value.control,
    movement: value.movement,
    grapple: value.grapple,
    sourceResumed: value.sourceResumed,
  }])),
  objectRenderingError: report.objectRenderingError,
}, null, 2));
socket.close();
