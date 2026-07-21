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
  if (!pending.has(message.id)) return;
  const callbacks = pending.get(message.id);
  pending.delete(message.id);
  message.error ? callbacks.reject(new Error(message.error.message)) : callbacks.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const commandId = ++id;
  pending.set(commandId, { resolve, reject });
  socket.send(JSON.stringify({ id: commandId, method, params }));
});
const evaluated = await send("Runtime.evaluate", {
  expression: `(async () => {
    const scenariosModule = await import('/src/utils/combat/phase3b3bSurrenderScenarios.js');
    const lifecycle = await import('/src/utils/combat/surrenderLifecycle.js');
    const selector = await import('/src/utils/behavior/selectSurrenderResolution.js');
    const scenarios = scenariosModule.runPhase3B3BSurrenderScenarios();
    return {
      knightAccepted: scenarios.knightReceivesGoblin.response.committed,
      knightResolved: scenarios.knightReceivesGoblin.resolution.committed,
      knightExecuted: scenarios.knightReceivesGoblin.resolution.events.some((entry) => entry.eventType === 'surrendered-opponent-executed'),
      goblinOutcome: scenarios.goblinReceivesKnight.resolution.resolution,
      minotaurExecuted: scenarios.minotaurReceivesSurrender.resolution.events.some((entry) => entry.eventType === 'surrendered-opponent-executed'),
      groundedPreservedThroughAcceptance: scenarios.groundedSurrender.response.fighter.grappleState.state === 'grapple_ground',
      groundedResolvedOnce: scenarios.groundedSurrender.resolution.events.filter((entry) => entry.eventType === 'surrender-resolution-committed').length,
      tokenFactoryAvailable: typeof lifecycle.createSurrenderDecisionToken === 'function',
      selectorAvailable: typeof selector.selectSurrenderResolution === 'function',
    };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text);
const result = evaluated.result.value;
assert.equal(result.knightAccepted, true);
assert.equal(result.knightResolved, true);
assert.equal(result.knightExecuted, false);
assert.ok(result.goblinOutcome);
assert.equal(result.minotaurExecuted, false);
assert.equal(result.groundedPreservedThroughAcceptance, true);
assert.equal(result.groundedResolvedOnce, 1);
assert.equal(result.tokenFactoryAvailable, true);
assert.equal(result.selectorAvailable, true);
socket.close();
console.log("Phase 3B3B browser surrender scenarios passed", result);
