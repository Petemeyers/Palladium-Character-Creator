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
    const module = await import('/src/utils/presentation/combatIconAppearanceScenarios.js');
    return module.runCombatIconAppearanceScenarios();
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text);
const result = evaluated.result.value;
assert.equal(result.partyKnight.baseColor, "#2563eb");
assert.equal(result.enemyMinotaur.baseColor, "#dc2626");
assert.equal(result.activeKnight.activeTurnIndicator, true);
assert.equal(result.activeKnight.rings.some((ring) => ring.key === "active"), true);
assert.equal(result.selectedKnight.rings.some((ring) => ring.key === "selected"), true);
assert.equal(result.targetedGoblin.rings.some((ring) => ring.key === "target" && ring.style === "reticle"), true);
assert.equal(result.routedGoblin.priorityReason, "routed");
assert.equal(result.grappledKnight.rings.some((ring) => ring.key === "grappled"), true);
assert.equal(result.proneGoblin.status.marker, "▼");
assert.equal(result.pendingMinotaur.pendingSurrender, true);
assert.equal(result.surrenderedMinotaur.priorityReason, "surrendered");
assert.equal(result.capturedMinotaur.priorityReason, "captured");
assert.equal(result.unconsciousGoblin.priorityReason, "unconscious");
assert.equal(result.deadGoblin.priorityReason, "dead");
socket.close();
console.log("browser combat icon appearance scenario passed");
