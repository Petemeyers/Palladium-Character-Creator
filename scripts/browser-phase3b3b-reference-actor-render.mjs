import assert from "node:assert/strict";
import WebSocket from "ws";

const targets = await fetch("http://127.0.0.1:9223/json").then((response) => response.json());
const target = targets.find((entry) => entry.type === "page" && entry.url.includes("/combat"));
assert.ok(target?.webSocketDebuggerUrl, "combat browser target must be available");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
let id = 0;
const pending = new Map();
socket.on("message", (raw) => { const message = JSON.parse(String(raw)); const callbacks = pending.get(message.id); if (!callbacks) return; pending.delete(message.id); message.error ? callbacks.reject(new Error(message.error.message)) : callbacks.resolve(message.result); });
const send = (method, params = {}) => new Promise((resolve, reject) => { const commandId = ++id; pending.set(commandId, { resolve, reject }); socket.send(JSON.stringify({ id: commandId, method, params })); });
const evaluated = await send("Runtime.evaluate", { expression: `(async () => (await import('/src/utils/presentation/phase3b3bRenderScenarios.js')).buildPhase3B3BRenderScenarios())()`, awaitPromise: true, returnByValue: true });
if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.text);
for (const scenario of evaluated.result.value) {
  assert.ok(scenario.weapons.every((label) => typeof label === "string" && label !== "[object Object]"));
  assert.ok(!/Principled|Scrupulous|Unprincipled|Anarchist|Miscreant|Aberrant|Diabolic/i.test(scenario.alignment));
}
socket.close();
console.log("Phase 3B3B browser reference actor render scenario passed");
