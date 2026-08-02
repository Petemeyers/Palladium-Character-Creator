import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import WebSocket from "ws";

const targets = await fetch("http://127.0.0.1:9223/json").then((response) => response.json());
const target = targets.find((entry) => entry.type === "page" && entry.url.includes("/combat"));
assert.ok(target?.webSocketDebuggerUrl, "real Chrome combat page must be available");
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
  const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result.value;
};
const waitFor = async (predicate, timeoutMs = 60000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(predicate)) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
};
const click = async (label, occurrence = 0) => evaluate(`(async () => {
  const candidates = [...document.querySelectorAll('button')].filter((node) => node.innerText.trim() === ${JSON.stringify(label)} && !node.disabled);
  const button = candidates[${occurrence}] || candidates.at(-1);
  if (!button) return false;
  button.click();
  await new Promise((resolve) => setTimeout(resolve, 200));
  return true;
})()`);
const addFighters = async (fighterLabel, armyValue, count) => {
  assert.equal(await click("Add Fighter", 1), true, `open Add Fighter for ${fighterLabel}`);
  const added = await evaluate(`(async () => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return false;
    const fighterSelect = [...dialog.querySelectorAll('select')].find((node) => [...node.options].some((option) => option.text === ${JSON.stringify(fighterLabel)}));
    if (!fighterSelect) return false;
    const option = [...fighterSelect.options].find((candidate) => candidate.text === ${JSON.stringify(fighterLabel)});
    fighterSelect.value = option.value;
    fighterSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    const armySelect = [...dialog.querySelectorAll('select')].find((node) => {
      const values = [...node.options].map((candidate) => candidate.value);
      return values.length === 2 && values.includes('party') && values.includes('enemy');
    });
    const countInput = [...dialog.querySelectorAll('input[type=number]')].at(-1);
    if (!armySelect || !countInput) return false;
    armySelect.value = ${JSON.stringify(armyValue)};
    armySelect.dispatchEvent(new Event('change', { bubbles: true }));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(countInput, ${JSON.stringify(String(count))});
    countInput.dispatchEvent(new Event('input', { bubbles: true }));
    countInput.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    const add = [...dialog.querySelectorAll('button')].find((node) => /^Add(?: \\d+)? to Combat$/i.test(node.innerText.trim()) && !node.disabled);
    if (!add) return false;
    add.click();
    await new Promise((resolve) => setTimeout(resolve, 200));
    return true;
  })()`);
  assert.equal(added, true, `add ${count} ${fighterLabel} to ${armyValue}`);
};

await evaluate(`(() => { localStorage.clear(); sessionStorage.clear(); location.reload(); return true; })()`);
assert.equal(await waitFor(`Boolean(document.body?.innerText.includes('Combat Arena'))`), true);
await addFighters("Longbowman (Human)", "party", 10);
await addFighters("Longbowman (Human)", "enemy", 10);
await addFighters("Goblin Warrior (Humanoid)", "party", 10);
await addFighters("Goblin Warrior (Humanoid)", "enemy", 10);
await addFighters("Knight (Human)", "party", 1);
await addFighters("Knight (Human)", "enemy", 1);
await click("Close");
const selected = await evaluate(`(() => {
  const select = [...document.querySelectorAll('select')].find((node) => [...node.options].some((option) => option.text === 'Tactical Pulse'));
  const option = select && [...select.options].find((candidate) => candidate.text === 'Tactical Pulse');
  if (!select || !option) return false;
  select.value = option.value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return select.value === 'tactical-pulse';
})()`);
assert.equal(selected, true, "select tactical-pulse timing");
assert.equal(await click("Start Battle"), true);
assert.equal(await waitFor(`Boolean(document.body?.innerText.includes('Advance One Pulse'))`), true, "pulse controls appear");
assert.equal(await click("Run Pulses"), true);
assert.equal(await waitFor(`Boolean(document.body?.innerText.toUpperCase().includes('BATTLE TIME: 00:06'))`, 120000), true, "six pulses complete");
await evaluate(`new Promise((resolve) => setTimeout(resolve, 2000))`);

await send("Browser.grantPermissions", { origin: "http://localhost:5173", permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] }).catch(() => {});
const log = await evaluate(`(async () => {
  const button = [...document.querySelectorAll('button')].find((node) => node.innerText.trim() === 'Copy Entire Log' && !node.disabled);
  button?.click();
  await new Promise((resolve) => setTimeout(resolve, 250));
  return navigator.clipboard.readText();
})()`);
const outputPath = "patches/tactical-pulse-phase1a-browser-log.txt";
mkdirSync("patches", { recursive: true });
writeFileSync(outputPath, log, "utf8");
const lines = log.split(/\r?\n/).filter(Boolean);
const eventLines = (type) => lines.filter((line) => line.includes("[DEVELOPER/")
  && (line.includes(`/${type}/`) || line.includes(`] ${type}:`)));
const parseData = (line) => {
  const marker = " | data=";
  const index = line.indexOf(marker);
  if (index < 0) return null;
  try { return JSON.parse(line.slice(index + marker.length)); } catch { return null; }
};
const committed = eventLines("tactical-step-committed").map(parseData).filter(Boolean);
const requests = eventLines("tactical-movement-stamina-spend-requested").map(parseData).filter(Boolean);
const resolved = eventLines("tactical-movement-stamina-spend-resolved").map(parseData).filter(Boolean);
const conflicts = eventLines("tactical-step-conflict").map(parseData).filter(Boolean);
const audits = eventLines("tactical-pulse-position-authority-audit").map(parseData).filter(Boolean);
const completed = eventLines("tactical-pulse-completed").map(parseData).filter(Boolean);
assert.equal(completed.length, 6);
assert.equal(completed.at(-1).elapsedSeconds, 6);
assert.ok(committed.length > 0, "live actors must commit pulse movement");
assert.ok(committed.every((entry) => Array.isArray(entry.path) && entry.path.length > 0), "all voluntary movement has paths");
for (const pulseIndex of new Set(committed.map((entry) => entry.pulseIndex))) {
  const pulse = committed.filter((entry) => entry.pulseIndex === pulseIndex);
  for (const actorId of new Set(pulse.map((entry) => entry.actorId))) {
    const actorSteps = pulse.filter((entry) => entry.actorId === actorId);
    const mode = actorSteps[0].movementMode;
    const limit = mode === "walk" ? 1 : mode === "run" ? 2 : mode === "sprint" || mode === "charge" ? 3 : 0;
    assert.ok(actorSteps.length <= limit, `${actorId} ${mode} exceeds pulse rate`);
  }
  const passOneLast = Math.max(...pulse.map((entry, index) => entry.stepPass === 1 ? index : -1));
  const passTwoFirst = pulse.findIndex((entry) => entry.stepPass === 2);
  if (passTwoFirst >= 0) assert.ok(passTwoFirst > passOneLast, "all pass-one commits precede pass two");
}
assert.equal(new Set(requests.map((entry) => entry.chargeKey)).size, requests.length, "stamina requests unique per actor/pulse");
assert.equal(requests.length, resolved.length, "each stamina request resolves once");
assert.ok(audits.length === 6 && audits.every((entry) => entry.matches === true), "all pulse position audits pass");
assert.equal(lines.filter((line) => /stale-generation-step-blocked/i.test(line)).length, 0);
assert.equal(lines.filter((line) => /pulse-ownership-overlap/i.test(line)).length, 0);
assert.equal(lines.filter((line) => /attack-roll|projectile-released|damage-roll/i.test(line)).length, 0, "pulse movement does not invoke attacks");

console.log(JSON.stringify({
  outputPath,
  fighters: 42,
  completedPulses: completed.length,
  elapsedSeconds: completed.at(-1).elapsedSeconds,
  committedSteps: committed.length,
  staminaRequests: requests.length,
  staminaResolved: resolved.length,
  conflicts: conflicts.length,
  positionAudits: audits.length,
  positionMismatches: audits.filter((entry) => !entry.matches).length,
  staleGenerationBlocks: 0,
  overlappingOwnership: 0,
  attackEvents: 0,
}, null, 2));
socket.close();
