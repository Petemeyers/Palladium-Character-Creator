import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result?.value;
};
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const waitFor = async (expression, timeoutMs = 20000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return true;
    await delay(150);
  }
  return false;
};
const clickButton = async (label) => {
  const clicked = await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).reverse().find(
      (entry) => entry.innerText.trim() === ${JSON.stringify(label)} &&
        !entry.disabled && entry.offsetParent !== null
    );
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert.equal(clicked, true, `enabled ${label} button must exist`);
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
  assert.equal(clicked, true, `mounted enabled ${label} button must exist`);
};
const setControl = async (label, explicitValue, optionPattern = null) => {
  const result = await evaluate(`(() => {
    const labelNode = Array.from(document.querySelectorAll('label')).find(
      (entry) => entry.innerText.trim() === ${JSON.stringify(label)}
    );
    const control = labelNode?.parentElement?.querySelector('select');
    if (!control) return { ok: false, reason: 'missing-control' };
    const options = Array.from(control.options);
    const option = ${optionPattern
      ? `options.find((entry) => new RegExp(${JSON.stringify(optionPattern)}, 'i').test(entry.textContent))`
      : `options.find((entry) => entry.value === ${JSON.stringify(explicitValue)})`};
    if (!option) return { ok: false, reason: 'missing-option', options: options.map((entry) => entry.textContent.trim()) };
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(control, option.value);
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, value: option.value, text: option.textContent.trim() };
  })()`);
  assert.equal(result.ok, true, `${label} must be configurable: ${JSON.stringify(result)}`);
  return result;
};
const setInput = async (label, value) => {
  const changed = await evaluate(`(() => {
    const labelNode = Array.from(document.querySelectorAll('label')).find(
      (entry) => entry.innerText.trim() === ${JSON.stringify(label)}
    );
    const input = labelNode?.parentElement?.querySelector('input');
    if (!input) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `${label} input must exist`);
};
const copyLog = async () => {
  const available = await evaluate(`Array.from(document.querySelectorAll('button')).some(
    (entry) => entry.innerText.trim() === 'Copy Entire Log' && !entry.disabled
  )`);
  if (!available) return "";
  await clickButton("Copy Entire Log");
  await delay(150);
  return await evaluate(`navigator.clipboard.readText().catch(() => '')`) || "";
};

await send("Runtime.enable");
await send("Browser.grantPermissions", {
  origin: "http://127.0.0.1:5173",
  permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
}).catch(() => {});
await evaluate(`(() => {
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  location.reload();
  return true;
})()`);
await delay(800);
assert.equal(await waitFor(`document.body?.innerText.includes('Combat Arena')`), true);
if (await evaluate(`document.body?.innerText.includes('Step 1 of 3: Choose Both Sides')`)) {
  await clickButton("Close");
}

const addKnight = async (side) => {
  await clickButton("Add Fighter");
  assert.equal(await waitFor(`document.body?.innerText.includes('Select Fighter:')`), true);
  await setControl("Select Fighter:", null, "^Knight \\(");
  await setControl("Side", side);
  await setControl("Control Mode", side === "party" ? "manual" : "ai");
  await setInput("Custom Name (optional):", "Knight");
  await setControl("Armor (Humanoid Only):", null, "^None");
  await setControl(
    "Weapon (Humanoid Only):",
    null,
    side === "party" ? "long sword" : "^dagger",
  );
  await clickButton("Add to Combat");
  assert.equal(await waitFor(`!document.body?.innerText.includes('Select Fighter:')`), true);
};
await addKnight("party");
await addKnight("enemy");

await evaluate(`(async () => {
  const Dice = (await import('/src/utils/cryptoDice.js')).default;
  if (!window.__phase31OriginalDice) {
    window.__phase31OriginalDice = {
      rollD20: Dice.rollD20.bind(Dice),
      parseAndRoll: Dice.parseAndRoll.bind(Dice),
    };
  }
  let combatD20Index = 0;
  let initiativeD20Index = 0;
  Dice.rollD20 = () => {
    if (!String(new Error().stack || '').includes('roundInitiative')) {
      return window.__phase31OriginalDice.rollD20();
    }
    initiativeD20Index += 1;
    // Round one is an exact four-roll tie (two initiative rolls and two
    // tie-breakers). Later rounds put the party Knight first so it can set a
    // Block posture before the enemy acts in that same round.
    if (initiativeD20Index <= 4) return 10;
    if (initiativeD20Index <= 6) return initiativeD20Index === 5 ? 5 : 15;
    return initiativeD20Index % 2 === 1 ? 15 : 5;
  };
  Dice.parseAndRoll = (formula, bonus = 0) => {
    const cleaned = String(formula || '');
    if (/^1d1000$/i.test(cleaned.trim())) {
      return {
        individualRolls: [1],
        diceRolls: [{ result: 1 }],
        total: 1,
        totalWithBonus: 1 + Number(bonus || 0),
        bonus,
        formula: cleaned,
        description: cleaned + ' = 1',
        fullDescription: cleaned + ' = ' + (1 + Number(bonus || 0)),
      };
    }
    if (!/d20/i.test(cleaned)) return window.__phase31OriginalDice.parseAndRoll(formula, bonus);
    combatD20Index += 1;
    const natural = combatD20Index % 2 === 1 ? 14 : 20;
    const modifierMatch = cleaned.match(/d20([+-]\\d+)?/i);
    const modifier = modifierMatch?.[1] ? Number(modifierMatch[1]) : 0;
    const total = natural + modifier;
    return {
      individualRolls: [natural],
      diceRolls: [{ result: natural }],
      total,
      totalWithBonus: total + Number(bonus || 0),
      bonus,
      formula: cleaned,
      description: cleaned + ' = ' + total,
      fullDescription: cleaned + ' = ' + (total + Number(bonus || 0)),
    };
  };
  window.__phase31DicePatched = true;
  return true;
})()`);

await evaluate(`(() => {
  const select = document.querySelector('select[aria-label="Simulation Speed"]');
  if (!select) return false;
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'instant');
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
await evaluate(`(() => {
  window.__phase31RiposteObserver?.disconnect?.();
  const acceptVisibleRiposte = () => {
    const button = Array.from(document.querySelectorAll('button')).find(
      (entry) => entry.innerText.trim() === 'Riposte' && !entry.disabled
    );
    if (button) button.click();
  };
  const observer = new MutationObserver(acceptVisibleRiposte);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  window.__phase31RiposteObserver = observer;
  return true;
})()`);
await clickButton("Start Battle");

await evaluate(`(() => {
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
assert.equal(await waitFor(`document.body.innerText.includes('to=waiting-manual')`, 15000), true,
  "party must reach a manual initiative turn");
let handledManualTurnId = await evaluate(`(() => {
  const matches = Array.from(document.body.innerText.matchAll(
    /initiativeTurnId=([^ ]+) from=[^ ]+ to=waiting-manual/g
  ));
  return matches.at(-1)?.[1] || null;
})()`);
await clickMountedButton("Block");
await delay(100);
await clickMountedButton("Execute Block");
await delay(150);
if (await evaluate(`Array.from(document.querySelectorAll('button')).some(
  (entry) => entry.innerText.trim() === 'End Turn' && !entry.disabled
)`)) {
  await clickMountedButton("End Turn");
}

let log = "";
const deadline = Date.now() + 120000;
while (Date.now() < deadline) {
  await delay(500);
  log = await copyLog();
  if (log.includes("/reaction_resolved/")) break;
  if (await evaluate(`Array.from(document.querySelectorAll('button')).some(
    (entry) => entry.innerText.trim() === 'Riposte' && !entry.disabled
  )`)) {
    await clickMountedButton("Riposte");
  }
  const waitingMatches = Array.from(log.matchAll(
    /initiativeTurnId=([^ ]+) from=[^ ]+ to=waiting-manual/g,
  ));
  const waitingTurnId = waitingMatches.at(-1)?.[1] || null;
  if (waitingTurnId && waitingTurnId !== handledManualTurnId) {
    handledManualTurnId = waitingTurnId;
    const blockAvailable = await evaluate(`Array.from(document.querySelectorAll('button')).some(
      (entry) => entry.innerText.trim() === 'Block' && !entry.disabled
    )`);
    if (blockAvailable) {
      await clickMountedButton("Block");
      await delay(100);
      await clickMountedButton("Execute Block");
      await delay(100);
    }
    if (await evaluate(`Array.from(document.querySelectorAll('button')).some(
      (entry) => entry.innerText.trim() === 'End Turn' && !entry.disabled
    )`)) {
      await clickMountedButton("End Turn");
    }
  }
}

const lines = log.split(/\r?\n/);
const matching = (eventType) => lines.filter((line) => line.includes(`/${eventType}/`));
const requiredChain = [
  "defense_resolution",
  "reaction_opportunity_created",
  "reaction_consumed",
  "riposte-recovery-penalty-applied",
  "reaction_resolved",
];
const indexes = requiredChain.map((eventType) =>
  lines.findIndex((line) => line.includes(`/${eventType}/`)));
const artifactPath = path.resolve("combat-log-phase3-riposte-live.txt");
fs.writeFileSync(artifactPath, log, "utf8");

const initiativeRolls = matching("round-initiative-rolled");
const initiativeAudits = matching("initiative-order-scheduler-audit");
const report = {
  route: await evaluate("location.pathname"),
  artifactPath,
  logLength: log.length,
  requiredChain,
  indexes,
  chainOrdered: indexes.every((index, position) =>
    index >= 0 && (position === 0 || index > indexes[position - 1])),
  opportunityCount: matching("reaction_opportunity_created").length,
  consumptionCount: matching("reaction_consumed").length,
  resolutionCount: matching("reaction_resolved").length,
  recoveryPenaltyCount: matching("riposte-recovery-penalty-applied").length,
  counterRiposteCount: lines.filter((line) =>
    line.includes("/reaction_opportunity_created/") && line.includes('"reactionDepth":2')).length,
  staleReactionAdmissions: matching("reaction-execution-key-rejected").length,
  stalePromiseWarnings: lines.filter((line) =>
    line.includes("stale attack promise resolved with actor mismatch")).length,
  duplicateFinalizers: lines.filter((line) =>
    /duplicate.*finalizer|finalizer.*duplicate/i.test(line)).length,
  initiativeRollCount: initiativeRolls.length,
  schedulerAuditCount: initiativeAudits.length,
  identityMismatchCount: matching("initiative-display-identity-audit").filter(
    (line) => line.includes("matches=false")).length,
  resetAuditFailures: matching("combat-reset-coordinate-audit").filter(
    (line) => line.includes("matches=false")).length,
  objectRenderingError: await evaluate(`document.body?.innerText.includes('[object Object]')`),
};

assert.equal(report.route, "/combat");
assert.equal(report.chainOrdered, true, `required live chain missing or unordered: ${JSON.stringify(indexes)}`);
assert.equal(report.opportunityCount, 1);
assert.equal(report.consumptionCount, 1);
assert.equal(report.resolutionCount, 1);
assert.equal(report.recoveryPenaltyCount, 1);
assert.equal(report.counterRiposteCount, 0);
assert.equal(report.staleReactionAdmissions, 0);
assert.equal(report.stalePromiseWarnings, 0);
assert.equal(report.duplicateFinalizers, 0);
assert.equal(report.identityMismatchCount, 0);
assert.equal(report.resetAuditFailures, 0);
assert.equal(report.objectRenderingError, false);
console.log(JSON.stringify(report, null, 2));
socket.close();
