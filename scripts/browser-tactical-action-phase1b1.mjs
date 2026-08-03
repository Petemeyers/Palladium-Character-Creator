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
const waitFor = async (predicate, timeoutMs = 120000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(predicate)) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
};
const click = async (label, occurrence = 0) => evaluate(`(async () => {
  const buttons = [...document.querySelectorAll('button')].filter((node) => node.innerText.trim() === ${JSON.stringify(label)} && !node.disabled);
  const button = buttons[${occurrence}] || buttons.at(-1);
  if (!button) return false;
  button.click();
  await new Promise((resolve) => setTimeout(resolve, 200));
  return true;
})()`);
const addFighter = async (label, side) => {
  assert.equal(await click("Add Fighter", 999), true);
  const result = await evaluate(`(async () => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find((candidate) => (
      [...candidate.querySelectorAll('select option')].some((option) => option.text === ${JSON.stringify(label)})
    ));
    if (!dialog) return { ok: false, reason: 'dialog-missing' };
    const selects = [...dialog.querySelectorAll('select')];
    const fighter = selects.find((node) => [...node.options].some((option) => option.text === ${JSON.stringify(label)}));
    if (!fighter) return { ok: false, reason: 'fighter-select-missing', options: selects.map((node) => [...node.options].map((option) => option.text)) };
    fighter.value = [...fighter.options].find((option) => option.text === ${JSON.stringify(label)}).value;
    fighter.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    const side = [...dialog.querySelectorAll('select')].find((node) => {
      const values = [...node.options].map((option) => option.value);
      return values.length === 2 && values.includes('party') && values.includes('enemy');
    });
    if (!side) return { ok: false, reason: 'side-select-missing' };
    side.value = ${JSON.stringify(side)};
    side.dispatchEvent(new Event('change', { bubbles: true }));
    const count = [...dialog.querySelectorAll('input[type=number]')].at(-1);
    if (count) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(count, '1');
      count.dispatchEvent(new Event('input', { bubbles: true }));
      count.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    const add = [...dialog.querySelectorAll('button')].find((node) => /^Add(?: [0-9]+)? to Combat$/i.test(node.innerText.trim()) && !node.disabled);
    add?.click();
    await new Promise((resolve) => setTimeout(resolve, 150));
    return { ok: Boolean(add), reason: add ? null : 'add-button-missing', buttons: [...dialog.querySelectorAll('button')].map((node) => node.innerText.trim()) };
  })()`);
  assert.equal(result.ok, true, `add ${label} to ${side}: ${JSON.stringify(result)}`);
};

await evaluate(`(() => { localStorage.clear(); sessionStorage.clear(); location.reload(); return true; })()`);
assert.equal(await waitFor(`document.body?.innerText.includes('Combat Arena')`), true);
for (const side of ["party", "enemy"]) {
  await addFighter("Longbowman (Human)", side);
  await addFighter("Goblin Warrior (Humanoid)", side);
  await addFighter("Knight (Human)", side);
}
await click("Close");
assert.equal(await evaluate(`(() => {
  const select = [...document.querySelectorAll('select')].find((node) => [...node.options].some((option) => option.text === 'Tactical Pulse'));
  if (!select) return false;
  select.value = 'tactical-pulse';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return select.value === 'tactical-pulse';
})()`), true);
assert.equal(await click("Start Battle"), true);
assert.equal(await waitFor(`document.body?.innerText.includes('Advance One Pulse')`), true);
const pulseCount = 18;
for (let pulse = 0; pulse < pulseCount; pulse += 1) {
  assert.equal(await waitFor(`[...document.querySelectorAll('button')].some((node) => node.innerText.trim() === 'Advance One Pulse' && !node.disabled)`), true);
  assert.equal(await click("Advance One Pulse"), true);
  const elapsed = String(pulse + 1).padStart(2, "0");
  assert.equal(await waitFor(`document.body?.innerText.toUpperCase().includes('BATTLE TIME: 00:${elapsed}')`), true);
}
assert.equal(await waitFor(`document.body?.innerText.toUpperCase().includes('BATTLE TIME: 00:${String(pulseCount).padStart(2, "0")}')`), true);

const armorReplan = await evaluate(`(async () => {
  const runtimeModule = await import('/src/utils/combat/tacticalActionRuntime.js');
  const intentModule = await import('/src/utils/combat/tacticalActionIntent.js');
  const runtime = runtimeModule.createTacticalActionRuntime({ generationId: 77, combatSession: 88 });
  const fighters = [{ id: 'knight-a', team: 'party' }, { id: 'knight-b', team: 'enemy' }];
  const create = (id, techniqueId, pulse, actionSequence) => intentModule.createTacticalActionIntent({
    actionIntentId: id, generationId: 77, combatSession: 88, actorId: 'knight-a', targetActorId: 'knight-b',
    weaponId: 'weapon.long-sword', techniqueId, timingKey: 'daggerAttack', createdAtPulse: pulse, actionSequence,
  }).intent;
  runtimeModule.registerTacticalAction(runtime, create('browser-armored-rejected', null, 0, 1));
  let rolls = 0;
  const rejected = await runtimeModule.advanceTacticalActionRuntime({
    runtime, pulseIndex: 1, fighters,
    executeCanonicalAttack: () => ({ accepted: false, reason: 'missing-armored-action-plan' }),
  });
  const rejectedTerminal = runtime.terminalHistory.at(-1);
  const replannedAdmission = runtimeModule.registerTacticalAction(runtime, create('browser-armored-replanned', 'half-sword-thrust', 1, 2));
  const replanned = await runtimeModule.advanceTacticalActionRuntime({
    runtime, pulseIndex: 2, fighters,
    executeCanonicalAttack: () => { rolls += 1; return { accepted: true, armorPipeline: true }; },
  });
  return {
    rejectedReason: rejectedTerminal?.invalidationReason,
    rejectedState: rejectedTerminal?.state,
    rejectedKey: rejectedTerminal?.executionKey,
    rejectedRollCount: 0,
    ownershipReleased: replannedAdmission.accepted,
    replannedKey: replanned.events.find((entry) => entry.eventType === 'tactical-attack-resolution-completed')?.data?.executionKey,
    replannedRollCount: rolls,
    recoveryActive: runtime.recoveryByActor.has('knight-a'),
    rejectedEventCount: rejected.events.filter((entry) => entry.eventType === 'tactical-attack-resolution-rejected').length,
  };
})()`);
assert.equal(armorReplan.rejectedReason, "missing-armored-action-plan");
assert.equal(armorReplan.rejectedState, "invalidated");
assert.equal(armorReplan.rejectedRollCount, 0);
assert.equal(armorReplan.ownershipReleased, true);
assert.equal(armorReplan.replannedRollCount, 1);
assert.equal(armorReplan.recoveryActive, true);
assert.equal(armorReplan.rejectedEventCount, 1);
assert.notEqual(armorReplan.rejectedKey, armorReplan.replannedKey);

await send("Browser.grantPermissions", { origin: "http://127.0.0.1:5173", permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] }).catch(() => {});
const log = await evaluate(`(async () => {
  const button = [...document.querySelectorAll('button')].find((node) => node.innerText.trim() === 'Copy Entire Log' && !node.disabled);
  button?.click();
  await new Promise((resolve) => setTimeout(resolve, 300));
  return navigator.clipboard.readText();
})()`);
mkdirSync("patches", { recursive: true });
const outputPath = "patches/tactical-action-phase1b1-browser-log.txt";
writeFileSync(outputPath, log, "utf8");
const lines = log.split(/\r?\n/).filter(Boolean);
const events = (name) => lines.filter((line) => line.includes(name));
const developerEvents = (name) => events(name).filter((line) => line.includes("[DEVELOPER/"));
const parseData = (line) => {
  const marker = " | data=";
  const index = line.indexOf(marker);
  if (index < 0) return null;
  try { return JSON.parse(line.slice(index + marker.length)); } catch { return null; }
};
const uniqueBy = (entries, identity) => new Set(entries.map(identity).filter(Boolean));
const canonicalIdentity = (eventType, data) => [
  data?.generationId,
  data?.combatSession,
  data?.actionIntentId,
  data?.executionKey || "pending",
  eventType,
].join("|");
const created = events("tactical-action-intent-created");
const preparing = events("tactical-action-preparation-progress");
const ready = events("tactical-action-ready");
const admitted = events("tactical-attack-resolution-admitted");
const completed = events("tactical-attack-resolution-completed");
const releases = events("tactical-ranged-release");
const recoveries = events("tactical-action-recovery-started");
assert.ok(created.length > 0, "tactical attacks are planned");
assert.ok(preparing.length > 0, "preparation advances by pulse");
assert.ok(ready.length > 0, "prepared attacks become ready");
assert.ok(admitted.length > 0, "ready attacks enter canonical admission");
assert.ok(completed.length > 0, "canonical attacks complete");
assert.ok(releases.length > 0, "at least one ranged attack releases");
assert.ok(recoveries.length > 0, "resolved attacks enter recovery");
const createdData = developerEvents("tactical-action-intent-created").map(parseData).filter(Boolean);
const completedData = developerEvents("tactical-attack-resolution-completed").map(parseData).filter(Boolean);
for (const completion of completedData) {
  const creation = createdData.find((entry) => entry.actionIntentId === completion.actionIntentId);
  assert.ok(creation && completion.pulseIndex > creation.createdAtPulse, "attack cannot resolve in its planning pulse");
}
const releaseData = developerEvents("tactical-ranged-release").map(parseData).filter(Boolean);
const ammunitionResolutionData = developerEvents("ammunition-spend-resolved").map(parseData).filter(Boolean);
const ammunitionData = ammunitionResolutionData.filter((entry) => entry.projectileReleased === true);
assert.equal(ammunitionData.length, releaseData.length, "each ranged release has one canonical ammunition spend");
assert.ok(ammunitionData.every((entry) => entry.previousCount - entry.nextCount === 1), "each release spends exactly one projectile");
assert.equal(events("duplicate-tactical-attack-execution").length, 0);
assert.equal(events("duplicate-ammunition-release").length, 0);
assert.equal(events("position-authority-audit").filter((line) => line.includes('"matches":false')).length, 0);
assert.equal(events("sequential-turn-started").length, 0);
assert.equal(events("post-combat").filter((line) => /mutation|release/i.test(line)).length, 0);
assert.equal(events("stale combat roll blocked").length, 0);
const canonicalEventTypes = [
  "tactical-action-intent-created",
  "tactical-action-preparation-started",
  "tactical-action-ready",
  "tactical-attack-resolution-admitted",
  "tactical-ranged-release",
  "tactical-action-recovery-started",
  "tactical-action-recovery-completed",
];
const uniqueCanonicalEvents = Object.fromEntries(canonicalEventTypes.map((eventType) => {
  const data = developerEvents(eventType).map(parseData).filter(Boolean);
  const identities = uniqueBy(data, (entry) => canonicalIdentity(eventType, entry));
  assert.equal(identities.size, data.length, `${eventType} must occur at most once per canonical action identity`);
  return [eventType, identities.size];
}));
const uniqueActionIntentCount = uniqueBy(createdData, (entry) => `${entry.generationId}|${entry.combatSession}|${entry.actionIntentId}`).size;
const uniqueExecutionKeyCount = uniqueBy(completedData, (entry) => entry.executionKey).size;
const uniqueRangedReleaseIdentityCount = uniqueBy(releaseData, (entry) => entry.executionKey).size;
const uniqueAmmunitionSpendIdentityCount = uniqueBy(ammunitionData, (entry) => entry.executionKey).size;
assert.equal(uniqueRangedReleaseIdentityCount, releaseData.length);
assert.equal(uniqueAmmunitionSpendIdentityCount, ammunitionData.length);
assert.equal(uniqueRangedReleaseIdentityCount, uniqueAmmunitionSpendIdentityCount);
console.log(JSON.stringify({
  outputPath,
  pulses: pulseCount,
  rawEventCounts: {
    created: created.length,
    preparing: preparing.length,
    ready: ready.length,
    admitted: admitted.length,
    completed: completed.length,
    releases: releases.length,
    recoveries: recoveries.length,
    ammunitionResolutions: ammunitionResolutionData.length,
  },
  uniqueActionIntentCount,
  uniqueExecutionKeyCount,
  uniqueRangedReleaseIdentityCount,
  uniqueAmmunitionSpendIdentityCount,
  uniqueCanonicalEvents,
  armorReplan,
}, null, 2));
socket.close();
