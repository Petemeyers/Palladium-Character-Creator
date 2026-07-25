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
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
};

const browserCommand = process.argv[2] || null;
if (browserCommand === "audit") {
  const audit = await evaluate(`(() => {
    const text = document.body.innerText;
    const count = (pattern) => (text.match(new RegExp(pattern, 'gi')) || []).length;
    const patterns = [
      'natural roll[^\\\\n]*2[1-9]',
      'stale combat roll blocked',
      'no-turn-token',
      'ammo[^\\\\n]*arrow',
      'action-completion',
      'duplicate',
      'continuation',
      'round-transition',
      'failed-action-position-preserved',
      'cower preserve position',
      'combat is over',
      'victory',
      'defeat',
      'minotaur-impact-',
      'initiative turn created',
      'Combat Round [0-9]+ complete',
      'stamina-spend-resolved',
      'arrow',
      'stale-or-completed',
      'previous-turn-busy',
      'busy-start-block',
      'duplicate completion',
      'duplicate finalizer',
      'zero progress',
      'action-key collision',
      'missing stamina ledger',
      'stale stamina',
      'impact pipeline bypass',
      'unresolved continuation',
      'retry timer',
      'post-outcome action',
      'unknown authoritative actor state',
      'Attack resolution error',
    ];
    return {
      route: location.pathname,
      textLength: text.length,
      counts: Object.fromEntries(patterns.map((pattern) => [pattern, count(pattern)])),
      logSummary: [...text.matchAll(/Full battle history retained:\\s*(\\d+) events/gi)].map((match) => Number(match[1])).at(-1) ?? null,
      roundLabels: [...new Set([...text.matchAll(/ROUND\\s+(\\d+)/g)].map((match) => Number(match[1])))],
      currentTurn: text.match(/Current Turn\\s+([^\\n]+)/)?.[1] ?? null,
      recentEventLines: text.split('\\n')
        .map((line) => line.trim())
        .filter((line) => /^\\[#\\d+/.test(line))
        .slice(-80),
      evidenceLines: text.split('\\n')
        .map((line) => line.trim())
        .filter((line) => /minotaur-impact-|stamina-spend-resolved|Combat Round \\d+ complete|Rock Throw|Heavy Axe|natural roll|duplicate|no-turn-token|stale combat roll blocked|Minotaur.*(?:attack|strike|hit|roll)|armor contact/i.test(line))
        .slice(-120),
      recentRolls: [...text.matchAll(/\\b(?:Knight|Minotaur):\\s*(\\d+)\\s*\\+\\s*(-?\\d+)\\s*=\\s*(-?\\d+)/g)]
        .slice(-20)
        .map((match) => ({ actor: match[0].split(':')[0], natural: Number(match[1]), modifier: Number(match[2]), total: Number(match[3]) })),
    };
  })()`);
  console.log(JSON.stringify(audit, null, 2));
  socket.close();
  process.exit(0);
} else if (browserCommand === "reload") {
  await send("Page.reload", { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 1200));
} else if (browserCommand?.startsWith("selectOption:")) {
  const label = browserCommand.slice("selectOption:".length);
  const selected = await evaluate(`(() => {
    const label = ${JSON.stringify(label)};
    const matches = [...document.querySelectorAll('select')]
      .map((select) => ({ select, option: [...select.options].find((entry) => entry.text === label) }))
      .filter((entry) => entry.option);
    const match = matches[matches.length - 1];
    if (!match) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter.call(match.select, match.option.value);
    match.select.dispatchEvent(new Event('change', { bubbles: true }));
    return { value: match.option.value, selectCount: matches.length };
  })()`);
  assert.ok(selected, `browser select option must exist: ${browserCommand}`);
  await new Promise((resolve) => setTimeout(resolve, 400));
} else if (browserCommand?.startsWith("select:")) {
  const [, indexText, ...labelParts] = browserCommand.split(":");
  const selected = await evaluate(`(() => {
    const index = ${Number(indexText)};
    const label = ${JSON.stringify(labelParts.join(":"))};
    const select = [...document.querySelectorAll('select')][index];
    const option = [...(select?.options || [])].find((entry) => entry.text === label);
    if (!select || !option) return false;
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(selected, true, `browser select option must exist: ${browserCommand}`);
  await new Promise((resolve) => setTimeout(resolve, 400));
} else if (browserCommand?.startsWith("click:")) {
  const index = Number(browserCommand.slice("click:".length));
  const clicked = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')][${index}];
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`);
  assert.equal(clicked, true, `enabled browser button must exist at index: ${index}`);
  await new Promise((resolve) => setTimeout(resolve, 400));
} else if (browserCommand) {
  const clickText = browserCommand;
  const clicked = await evaluate(`(() => {
    const label = ${JSON.stringify(clickText)};
    const matches = [...document.querySelectorAll('button')].filter((button) => button.innerText.trim() === label && !button.disabled);
    const button = matches[matches.length - 1];
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert.equal(clicked, true, `enabled browser button must exist: ${clickText}`);
  await new Promise((resolve) => setTimeout(resolve, 400));
}

const snapshot = await evaluate(`({
  title: document.title,
  route: location.pathname,
  text: document.body.innerText.slice(0, 12000),
  buttons: [...document.querySelectorAll('button')].map((button, index) => ({ index, text: button.innerText.trim(), disabled: button.disabled })),
  selects: [...document.querySelectorAll('select')].map((select, index) => ({
    index,
    value: select.value,
    options: [...select.options].map((option) => option.text),
  })),
  inputs: [...document.querySelectorAll('input')].map((input, index) => ({ index, type: input.type, value: input.value, checked: input.checked })),
})`);
console.log(JSON.stringify(snapshot, null, 2));
socket.close();
