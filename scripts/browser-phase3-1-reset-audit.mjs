import assert from "node:assert/strict";
import WebSocket from "ws";

const targets = await fetch("http://127.0.0.1:9223/json").then((response) => response.json());
const target = targets.find((entry) => entry.type === "page" && entry.url.includes("/combat"));
assert.ok(target?.webSocketDebuggerUrl, "combat page CDP target must be available");

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
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "browser evaluation failed");
  return result.result?.value;
};
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const waitFor = async (expression, timeoutMs = 15000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return true;
    await delay(150);
  }
  return false;
};
const clickMountedButton = async (label) => {
  const clicked = await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).reverse().find(
      (entry) => entry.innerText.trim() === ${JSON.stringify(label)} && !entry.disabled
    );
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert.equal(clicked, true, `enabled ${label} button must exist`);
};
const clickVisibleButton = async (label) => {
  const clicked = await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).reverse().find(
      (entry) => entry.innerText.trim() === ${JSON.stringify(label)} &&
        !entry.disabled && entry.offsetParent !== null
    );
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert.equal(clicked, true, `visible enabled ${label} button must exist`);
};
const visibleLog = () => evaluate(`document.body?.innerText || ''`);
const selectDeveloperEvents = () => evaluate(`(() => {
  const select = Array.from(document.querySelectorAll('select')).find(
    (entry) => Array.from(entry.options).some((option) => option.textContent.trim() === 'Developer Events')
  );
  const option = select && Array.from(select.options).find(
    (entry) => entry.textContent.trim() === 'Developer Events'
  );
  if (!select || !option) return false;
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, option.value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);

assert.equal(await selectDeveloperEvents(), true, "developer event filter must exist");
await delay(100);
const priorLog = await visibleLog();
const priorGenerations = Array.from(
  priorLog.matchAll(/initiativeTurnId=(\d+):/g),
  (match) => Number(match[1]),
);
const priorGeneration = priorGenerations.at(-1);
assert.ok(Number.isInteger(priorGeneration), "current combat initiative generation must be visible");

await clickVisibleButton("Reset Combat");
assert.equal(await waitFor(`document.body?.innerText.includes('combat reset coordinate audit: generation=')`), true);
if (await evaluate(`document.body?.innerText.includes('Step 1 of 3: Choose Both Sides')`)) {
  await clickVisibleButton("Close");
}
assert.equal(
  await waitFor(`Array.from(document.querySelectorAll('button')).some(
    (entry) => entry.innerText.trim() === 'Start Battle' && !entry.disabled && entry.offsetParent !== null
  )`),
  true,
  "visible second-combat start button must be ready",
);
await clickVisibleButton("Start Battle");
assert.equal(await selectDeveloperEvents(), true, "developer event filter must survive reset");
assert.equal(
  await waitFor(`document.body?.innerText.includes('initiative turn created:')`, 15000),
  true,
  "second combat must create its first initiative turn",
);

const secondLog = await visibleLog();
const createdTurns = Array.from(secondLog.matchAll(
  /initiative turn created:[^\n]*initiativeTurnId=(\d+):(\d+):(\d+):([^:\s]+):(\d+)/g,
));
const createdTurn = createdTurns.at(-1);
assert.ok(createdTurn, "second combat first initiative turn must be logged");
const firstTurn = {
  generationId: Number(createdTurn[1]),
  round: Number(createdTurn[2]),
  initiativeIndex: Number(createdTurn[3]),
  actorId: createdTurn[4],
  initiativeTurnId: createdTurn[0].match(/initiativeTurnId=(\S+)/)?.[1] || null,
};

const report = {
  priorGeneration,
  secondGeneration: firstTurn.generationId,
  resetRound: firstTurn.round,
  resetTurn: secondLog.includes('"turnCounter": 0') ? 0 : null,
  resetInitiativeIndex: firstTurn.initiativeIndex,
  resetMatches: firstTurn.round === 1 &&
    firstTurn.initiativeIndex === 0 &&
    secondLog.includes('"turnCounter": 0'),
  firstTurn,
  staleCoordinateReferences: secondLog.includes("matches=false") ? 1 : 0,
};

assert.equal(report.secondGeneration, report.priorGeneration + 1);
assert.equal(report.resetRound, 1);
assert.equal(report.resetTurn, 0);
assert.equal(report.resetInitiativeIndex, 0);
assert.equal(report.resetMatches, true);
assert.equal(report.firstTurn.generationId, report.secondGeneration);
assert.equal(report.firstTurn.round, 1);
assert.equal(report.firstTurn.initiativeIndex, 0);
assert.equal(report.staleCoordinateReferences, 0);
console.log(JSON.stringify(report, null, 2));
socket.close();
