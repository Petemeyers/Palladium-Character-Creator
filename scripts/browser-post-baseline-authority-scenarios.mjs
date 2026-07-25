import assert from "node:assert/strict";
import WebSocket from "ws";

const targets = await fetch("http://127.0.0.1:9223/json").then((response) => response.json());
const target = targets.find((entry) => entry.type === "page" && entry.url.includes("/combat"));
assert.ok(target?.webSocketDebuggerUrl, "combat browser target must be available");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
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
    const scenarios = await import('/src/utils/combat/liveBrowserAuthorityScenarios.js');
    const scenarioA = scenarios.createKnightVsMinotaurAuthorityScenario();
    const scenarioB = scenarios.createThreeFighterFumbleAuthorityScenario({ rounds: 5 });
    return {
      route: location.pathname,
      scenarioA: {
        actors: scenarioA.actors.map(({ id, name }) => ({ id, name })),
        actionSequences: scenarioA.impacts.map((entry) => entry.actionSequence),
        coverage: scenarioA.impacts.map((entry) => entry.coverage.coverageType),
        stageCounts: scenarioA.impacts.map((entry) => entry.impact.events.length),
        stageCountValid: scenarioA.impacts.map((entry) => entry.impact.stageCountValid),
      },
      scenarioB: {
        actorIds: scenarioB.fighters.map((fighter) => fighter.id),
        coordinates: scenarioB.coordinates,
        fumbleOwnershipState: scenarioB.ownership.state,
      },
    };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text);
const report = evaluated.result.value;
assert.equal(report.route, "/combat");
assert.deepEqual(report.scenarioA.actionSequences, [1, 2]);
assert.deepEqual(report.scenarioA.coverage, ["plate", "plate"]);
assert.deepEqual(report.scenarioA.stageCounts, [13, 13]);
assert.deepEqual(report.scenarioA.stageCountValid, [true, true]);
assert.deepEqual(report.scenarioB.actorIds, ["knight-a", "minotaur", "knight-b"]);
assert.deepEqual(report.scenarioB.coordinates.map((coordinate) => coordinate.round), [4, 5]);
assert.equal(report.scenarioB.fumbleOwnershipState, "released");
console.log(JSON.stringify(report, null, 2));
socket.close();
