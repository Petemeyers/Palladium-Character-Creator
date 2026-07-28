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
await send("Browser.grantPermissions", {
  origin: "http://127.0.0.1:5173",
  permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
}).catch(() => {});
const evaluated = await send("Runtime.evaluate", {
  expression: `(async () => {
    const copy = [...document.querySelectorAll('button')].find((button) => button.innerText.trim() === 'Copy Entire Log' && !button.disabled);
    if (copy) copy.click();
    await new Promise((resolve) => setTimeout(resolve, 200));
    const log = await navigator.clipboard.readText().catch(() => '');
    const lines = log.split(/\\r?\\n/);
    const defenses = lines.filter((line) => line.includes('/defense_resolution/'));
    const count = (pattern) => lines.filter((line) => line.includes(pattern)).length;
    return {
      route: location.pathname,
      battleOutcome: /Victory|Defeat|Combat Over|wins the battle|battle has ended/i.test(document.body.innerText + '\\n' + log),
      defenseCount: defenses.length,
      neutralCount: defenses.filter((line) => line.includes('parry_neutral')).length,
      advantageCount: defenses.filter((line) => line.includes('parry_advantage')).length,
      dominantCount: defenses.filter((line) => line.includes('parry_dominant')).length,
      failedCount: defenses.filter((line) => line.includes('parry_failed')).length,
      staleDefenseBlocked: count('stale-defense-resolution-blocked'),
      staleCombatRollBlocked: count('stale combat roll blocked'),
      noTurnToken: count('no-turn-token'),
      duplicateDefenseEvents: new Set(defenses).size !== defenses.length,
      roundTransitions: lines.filter((line) => /Combat Round \\d+ complete/.test(line)).length,
      sample: defenses.slice(0, 8),
    };
  })()`,
  awaitPromise: true,
  returnByValue: true,
  userGesture: true,
});
if (evaluated.exceptionDetails) {
  throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text);
}
const report = evaluated.result.value;
assert.equal(report.route, "/combat");
assert.equal(report.battleOutcome, true);
assert.equal(report.staleDefenseBlocked, 0);
assert.equal(report.staleCombatRollBlocked, 0);
assert.equal(report.noTurnToken, 0);
assert.equal(report.duplicateDefenseEvents, false);
console.log(JSON.stringify(report, null, 2));
socket.close();
