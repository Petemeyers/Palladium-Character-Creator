import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import process from "node:process";
import WebSocket from "ws";

const targets = await fetch("http://127.0.0.1:9223/json").then((response) => response.json());
const target = targets.find((entry) => entry.type === "page" && entry.url.includes("/combat"));
assert.ok(target?.webSocketDebuggerUrl, "combat browser target must be available");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
let sequence = 0;
const pending = new Map();
socket.on("message", (raw) => {
  const response = JSON.parse(String(raw));
  const request = pending.get(response.id);
  if (!request) return;
  pending.delete(response.id);
  response.error ? request.reject(new Error(response.error.message)) : request.resolve(response.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const evaluated = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text);
  return evaluated.result.value;
};

const mode = process.argv[2] || "inspect";
if (mode === "reset") {
  await evaluate(`(() => { localStorage.clear(); sessionStorage.clear(); location.reload(); return true; })()`);
  await new Promise((resolve) => setTimeout(resolve, 800));
  console.log(JSON.stringify({ reset: true }));
} else if (mode === "inspect") {
  console.log(JSON.stringify(await evaluate(`({
    route: location.pathname,
    text: document.body.innerText.slice(0, 12000),
    buttons: [...document.querySelectorAll('button')].map((node, index) => ({ index, text: node.innerText, disabled: node.disabled })),
    selects: [...document.querySelectorAll('select')].map((node, index) => ({ index, value: node.value, options: [...node.options].map(option => option.text) })),
    inputs: [...document.querySelectorAll('input')].map((node, index) => ({ index, type: node.type, value: node.value, checked: node.checked, placeholder: node.placeholder })),
  })`), null, 2));
} else if (mode === "scenario") {
  const report = await evaluate(`(async () => {
    const module = await import('/src/utils/combat/combatCorrectnessBrowserScenario.js');
    return module.runCombatCorrectnessBrowserScenario();
  })()`);
  assert.equal(report.actorCount, 20);
  assert.equal(report.identityAudit.matches, true);
  assert.equal(report.routedTargetExcluded, true);
  assert.equal(report.projectileReleaseCount, 2);
  console.log(JSON.stringify(report, null, 2));
} else if (mode === "click") {
  const label = process.argv[3] || "";
  const occurrence = Math.max(0, Number(process.argv[4]) || 0);
  const result = await evaluate(`(async () => {
    const candidates = [...document.querySelectorAll('button')].filter(node => node.innerText.trim() === ${JSON.stringify(label)} && !node.disabled);
    const node = candidates[${JSON.stringify(occurrence)}];
    if (!node) return { clicked: false, count: candidates.length };
    node.click();
    await new Promise(resolve => setTimeout(resolve, 350));
    return { clicked: true, count: candidates.length, text: document.body.innerText.slice(-8000) };
  })()`);
  console.log(JSON.stringify(result, null, 2));
} else if (mode === "select") {
  const selectIndex = Number(process.argv[3]);
  const value = process.argv[4];
  console.log(JSON.stringify(await evaluate(`(() => {
    const node = [...document.querySelectorAll('select')][${JSON.stringify(selectIndex)}];
    if (!node) return { selected: false };
    node.value = ${JSON.stringify(value)};
    node.dispatchEvent(new Event('change', { bubbles: true }));
    return { selected: true, value: node.value };
  })()`), null, 2));
} else if (mode === "select-text") {
  const optionText = process.argv[3];
  console.log(JSON.stringify(await evaluate(`(() => {
    const node = [...document.querySelectorAll('select')].find(select => [...select.options].some(option => option.text === ${JSON.stringify(optionText)}));
    const option = node && [...node.options].find(candidate => candidate.text === ${JSON.stringify(optionText)});
    if (!node || !option) return { selected: false };
    node.value = option.value;
    node.dispatchEvent(new Event('change', { bubbles: true }));
    return { selected: true, value: node.value, option: option.text };
  })()`), null, 2));
} else if (mode === "add-fighters") {
  const fighterLabel = process.argv[3];
  const armyValue = process.argv[4];
  const count = Math.max(1, Math.min(10, Number(process.argv[5]) || 1));
  console.log(JSON.stringify(await evaluate(`(async () => {
    const selects = [...document.querySelectorAll('select')];
    const fighterSelect = selects.find(node => [...node.options].some(option => option.text === ${JSON.stringify(fighterLabel)}));
    if (!fighterSelect) return { added: false, reason: 'missing-select' };
    const fighterOption = [...fighterSelect.options].find(option => option.text === ${JSON.stringify(fighterLabel)});
    fighterSelect.value = fighterOption.value;
    fighterSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 100));
    const armySelect = [...document.querySelectorAll('select')].reverse().find(node => [...node.options].some(option => option.value === ${JSON.stringify(armyValue)}) && [...node.options].some(option => option.value === 'enemy'));
    if (!armySelect) return { added: false, reason: 'missing-army-select' };
    armySelect.value = ${JSON.stringify(armyValue)};
    armySelect.dispatchEvent(new Event('change', { bubbles: true }));
    const countInput = [...document.querySelectorAll('input[type=number]')].at(-1);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(countInput, ${JSON.stringify(String(count))});
    countInput.dispatchEvent(new Event('input', { bubbles: true }));
    countInput.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 100));
    const button = [...document.querySelectorAll('button')].find(node => /^Add(?: \\d+)? to Combat$/i.test(node.innerText.trim()) && !node.disabled);
    if (!button) return { added: false, reason: 'button-disabled', fighterValue: fighterSelect.value, armyValue: armySelect.value, count: countInput.value };
    button.click();
    await new Promise(resolve => setTimeout(resolve, 350));
    return { added: true, fighter: ${JSON.stringify(fighterLabel)}, army: ${JSON.stringify(armyValue)}, count: ${JSON.stringify(count)} };
  })()`), null, 2));
} else if (mode === "audit") {
  console.log(JSON.stringify(await evaluate(`(() => {
    const text = document.body.innerText;
    const needles = [
      'stale-damage-application-rejected', 'stale damage application',
      'attack-roll-modifier-arithmetic-invalid', 'player-control-takeover-started',
      'player-control-takeover-completed', 'attack key registry created',
      'combat roll gate passed', 'HP mutation', 'Victory', 'Defeat', 'Combat is over',
      'Enemy Enemy', 'Party Party', 'NaN', 'undefined Attack'
    ];
    return {
      textLength: text.length,
      counts: Object.fromEntries(needles.map(needle => [needle, text.split(needle).length - 1])),
      evidence: text.split('\\n').filter(line => needles.some(needle => line.includes(needle))).slice(-160),
    };
  })()`), null, 2));
} else if (mode === "wait-party-toggle-ai") {
  const timeoutMs = Math.max(1000, Number(process.argv[3]) || 60000);
  const result = await evaluate(`(async () => {
    const deadline = Date.now() + ${JSON.stringify(timeoutMs)};
    while (Date.now() < deadline) {
      const body = document.body.innerText;
      const manualButton = [...document.querySelectorAll('button')]
        .find((node) => node.innerText.trim() === 'Manual' && !node.disabled);
      if (manualButton && /PARTY ACTIVE TURN/i.test(body)) {
        manualButton.click();
        await new Promise((resolve) => setTimeout(resolve, 350));
        return { toggled: true, buttonText: manualButton.innerText, body: document.body.innerText.slice(-4000) };
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return { toggled: false, reason: 'party-manual-turn-timeout', body: document.body.innerText.slice(-4000) };
  })()`);
  assert.equal(result.toggled, true, `manual-to-AI takeover was not reached within ${timeoutMs}ms`);
  console.log(JSON.stringify(result, null, 2));
} else if (mode === "export") {
  await send("Browser.grantPermissions", {
    origin: "http://localhost:5173",
    permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
  }).catch(() => {});
  const report = await evaluate(`(async () => {
    const button = [...document.querySelectorAll('button')]
      .find((node) => node.innerText.trim() === 'Copy Entire Log' && !node.disabled);
    if (button) button.click();
    await new Promise((resolve) => setTimeout(resolve, 250));
    const log = await navigator.clipboard.readText().catch(() => '');
    const lines = log.split(/\\r?\\n/).filter(Boolean);
    const count = (pattern) => lines.filter((line) => pattern.test(line)).length;
    const evidence = (pattern) => lines.filter((line) => pattern.test(line)).slice(-30);
    return {
      log,
      body: document.body.innerText,
      summary: {
        lines: lines.length,
        deferred: count(/player-ai-continuation-deferred/i),
        admittedAfterRelease: count(/player-ai-continuation-admitted-after-owner-release/i),
        overlapBlocked: count(/player AI overlap blocked/i),
        ownerless: count(/player AI active turn ownership audit:.*matches=false/i),
        positionMismatch: count(/position authority audit:.*matches=false/i),
        contradictoryLabels: count(/(?:Party .*\\[enemy|Enemy .*\\[party)/i),
        staleDamage: count(/stale-damage-application-rejected|stale damage application/i),
        modifierError: count(/modifier-arithmetic-invalid|NaN/i),
        terminal: count(/(?:Victory! All enemies|Defeat!|Combat is over\\. No further attacks|combat ended cleanup audit|stalemate)/i),
        movement: count(/moves? \\d+ feet|approach movement committed/i),
        ammunition: count(/ammunition.*(?:spent|decremented)|arrow.*(?:20.*19|19.*18)/i),
      },
      evidence: {
        continuation: evidence(/player-ai-continuation-(?:deferred|admitted-after-owner-release)|canonical player AI action completion/i),
        movement: evidence(/moves? \\d+ feet|approach movement committed|movement stamina/i),
        labels: evidence(/Initiative Order|Party Knight|Enemy Knight/i),
        position: evidence(/position authority audit/i),
        terminal: evidence(/(?:Victory! All enemies|Defeat!|Combat is over\\. No further attacks|combat ended cleanup audit|stalemate)/i),
      },
    };
  })()`);
  const outputPath = process.argv[3] || "patches/combat-log-2026-08-01-200312-repair.txt";
  mkdirSync("patches", { recursive: true });
  writeFileSync(outputPath, report.log, "utf8");
  console.log(JSON.stringify({ outputPath, ...report.summary, evidence: report.evidence }, null, 2));
}
socket.close();
