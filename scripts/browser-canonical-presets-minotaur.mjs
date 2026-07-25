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
  const handler = pending.get(message.id);
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
    const techniques = await import('/src/utils/combat/minotaurTechniqueResolver.js');
    const turns = await import('/src/utils/combat/failedAutomatedActionTurn.js');
    const actors = await import('/src/data/canonicalCombatActors.js');
    const minotaur = { ...structuredClone(actors.getCanonicalCombatActorDefinition('minotaur')), id: 'm' };
    const knight = { ...structuredClone(actors.getCanonicalCombatActorDefinition('knight')), id: 'k' };
    const crush = techniques.createCanonicalMinotaurTechniqueIntent({ techniqueKey: 'crush', actor: minotaur, target: knight });
    const wrap = turns.resolveFailedAutomatedActionTurn({
      fighters: [{ id: 'm', remainingActions: 0, actionsPerRound: 2 }, { id: 'k', remainingActions: 1, actionsPerRound: 2 }],
      activeIndex: 1, round: 2, actorId: 'k'
    });
    return {
      quickStartVisible: document.body.innerText.includes('Quick Start'),
      savedPresetsVisible: document.body.innerText.includes('Saved Presets'),
      crushReason: crush.reason,
      wrapRound: wrap.round,
      wrapIndex: wrap.nextIndex,
      minotaurAttackCount: minotaur.attacks.length,
      flatSixCount: minotaur.attacks.filter((attack) => Number(attack.attackBonus) === 6).length,
    };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text);
const result = evaluated.result.value;
assert.equal(result.quickStartVisible, false);
assert.equal(result.savedPresetsVisible, true);
assert.equal(result.crushReason, "crush-control-required");
assert.equal(result.wrapRound, 3);
assert.equal(result.wrapIndex, 0);
assert.ok(result.minotaurAttackCount >= 14);
assert.equal(result.flatSixCount, 0);
console.log("browser canonical preset/Minotaur smoke passed", result);
socket.close();
