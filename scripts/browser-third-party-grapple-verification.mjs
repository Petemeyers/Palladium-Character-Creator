import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
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
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result?.value;
};
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const waitFor = async (expression, timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return true;
    await delay(150);
  }
  return false;
};
const clickButton = async (label) => {
  const result = await evaluate(`(() => {
    const label = ${JSON.stringify(label)};
    const button = Array.from(document.querySelectorAll('button')).reverse()
      .find((entry) => entry.innerText.trim() === label && !entry.disabled && entry.offsetParent !== null);
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert.equal(result, true, `enabled ${label} button must exist`);
};
const setSelect = async (label, predicateSource, explicitValue = null) => {
  const result = await evaluate(`(() => {
    const labelNode = Array.from(document.querySelectorAll('label'))
      .find((entry) => entry.innerText.trim() === ${JSON.stringify(label)});
    const container = labelNode?.closest('[role="group"]') || labelNode?.parentElement;
    const select = container?.querySelector('select');
    if (!select) return { ok: false, reason: 'missing-select' };
    const options = Array.from(select.options);
    const option = ${explicitValue === null
      ? `options.find(${predicateSource})`
      : `options.find((entry) => entry.value === ${JSON.stringify(explicitValue)})`};
    if (!option) return { ok: false, reason: 'missing-option', options: options.map((entry) => entry.textContent.trim()) };
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, option.value);
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, value: option.value, text: option.textContent.trim() };
  })()`);
  assert.equal(result.ok, true, `${label} must be configurable: ${JSON.stringify(result)}`);
  return result;
};
const setInput = async (label, value) => {
  const result = await evaluate(`(() => {
    const labelNode = Array.from(document.querySelectorAll('label'))
      .find((entry) => entry.innerText.trim() === ${JSON.stringify(label)});
    const input = labelNode?.parentElement?.querySelector('input');
    if (!input) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(result, true, `${label} input must exist`);
};
const addActor = async ({ actorName, side, name }) => {
  await clickButton("Add Fighter");
  assert.equal(await waitFor(`document.body?.innerText.includes('Select Fighter:')`), true);
  await setSelect("Select Fighter:", `(entry) => entry.textContent.trim().startsWith(${JSON.stringify(`${actorName} (`)})`);
  await delay(200);
  await setSelect("Side", "() => false", side);
  await setSelect("Control Mode", "() => false", "ai");
  await setInput("Custom Name (optional):", name);
  await clickButton("Add to Combat");
  assert.equal(await waitFor(`!document.body?.innerText.includes('Select Fighter:')`), true);
};

await send("Runtime.enable");
await send("Browser.grantPermissions", {
  origin: "http://localhost:5173",
  permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
}).catch(() => {});
await evaluate(`(() => { localStorage.clear(); sessionStorage.clear(); location.reload(); return true; })()`);
assert.equal(await waitFor(`document.body?.innerText.includes('Combat Arena')`), true);
if (await evaluate(`document.body?.innerText.includes('Step 1 of 3: Choose Both Sides')`)) {
  await clickButton("Close");
  await delay(250);
}

const rosterPresent = await evaluate(`document.body?.innerText.includes('Party Members (') || document.body?.innerText.includes('Opponents (')`);
if (rosterPresent) {
  await clickButton("Reset Combat");
  await delay(350);
  const confirm = await evaluate(`Array.from(document.querySelectorAll('button'))
    .filter((entry) => !entry.disabled && entry.offsetParent !== null)
    .map((entry) => entry.innerText.trim()).find((text) => /^(Confirm|Reset|Yes)$/i.test(text)) || ''`);
  if (confirm) await clickButton(confirm);
  await delay(500);
}

await addActor({ actorName: "Knight", side: "party", name: "Knight" });
await addActor({ actorName: "Longbowman", side: "enemy", name: "Longbowman #1" });
await addActor({ actorName: "Longbowman", side: "enemy", name: "Longbowman #2" });
await addActor({ actorName: "Longbowman", side: "enemy", name: "Longbowman #3" });

const speedSet = await evaluate(`(() => {
  const select = document.querySelector('select[aria-label="Simulation Speed"]');
  const option = select && Array.from(select.options).find((entry) => entry.value === 'instant');
  if (!select || !option) return false;
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, option.value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
assert.equal(speedSet, true, "instant simulation speed must be available");

const aiToggle = await evaluate(`Array.from(document.querySelectorAll('button'))
  .map((entry) => entry.innerText.trim())
  .find((text) => text === 'Manual' || /AI Control/.test(text)) || ''`);
if (aiToggle === "Manual" || /OFF|Disabled/i.test(aiToggle)) await clickButton(aiToggle);
const aiEnabledBeforeStart = await evaluate(`Array.from(document.querySelectorAll('button'))
  .map((entry) => entry.innerText.trim()).some((text) => /AI Control.*(?:ON|Enabled)/i.test(text))`);

await clickButton("Start Battle");

const developerFilterSet = await evaluate(`(() => {
  const select = Array.from(document.querySelectorAll('select'))
    .find((entry) => Array.from(entry.options).some((option) => option.textContent.trim() === 'Developer Events'));
  const option = select && Array.from(select.options).find((entry) => entry.textContent.trim() === 'Developer Events');
  if (!select || !option) return false;
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, option.value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
assert.equal(developerFilterSet, true, "developer event filter must be available");

let completeLog = "";
let bodyText = "";
const battleDeadline = Date.now() + 240_000;
while (Date.now() < battleDeadline) {
  await delay(750);
  const canCopy = await evaluate(`Array.from(document.querySelectorAll('button'))
    .some((entry) => entry.innerText.trim() === 'Copy Entire Log' && !entry.disabled)`);
  if (canCopy) {
    await clickButton("Copy Entire Log");
    completeLog = await evaluate(`navigator.clipboard.readText().catch(() => '')`) || completeLog;
  }
  bodyText = await evaluate(`document.body?.innerText || ''`);
  if (/Victory|Defeat|Combat Over|wins the battle|battle has ended|surrender/i.test(`${bodyText}\n${completeLog}`)) break;
}

await mkdir("patches", { recursive: true });
const exportPath = "patches/knight-vs-three-longbowmen-developer-log.txt";
await writeFile(exportPath, completeLog, "utf8");

const lines = completeLog.split(/\r?\n/).filter(Boolean);
const matching = (pattern) => lines.filter((line) => pattern.test(line));
const thirdParty = matching(/third-party grapple ignored/i);
const activeGrappleRoutes = matching(/combat obligation routed:.*obligation=active-grapple/i);
const standingSuppressions = matching(/standing armored selector suppressed:.*reason=active-grapple/i);
const canonicalGrapple = matching(/canonical-grapple-admission-accepted|grapple-action-resolution-started|executeCanonicalGrappleAction/i);
const daggerProjectileViolations = matching(/(?:Dagger|Knife).*?(?:projectile|arrow.*consum|ammo.*consum)/i);
const arrowImpactLines = matching(/(?:arrow|longbow).*?(?:impact|hit|location=)/i);
const malformedArrowHits = arrowImpactLines.filter((line) => /(?:hit|impact)/i.test(line) &&
  (!/location=\S+/i.test(line) || !/technique=longbow-arrow/i.test(line) || !/massKg=0\.075/i.test(line)));
const outcomeMatch = `${bodyText}\n${completeLog}`.match(/Victory|Defeat|Combat Over|wins the battle|battle has ended|surrender/i);

const diagnosticKeys = thirdParty.map((line) => {
  const actor = line.match(/actorId=([^\s|]+)/)?.[1] || "unknown";
  const targetId = line.match(/targetId=([^\s|]+)/)?.[1] || "unknown";
  const turn = line.match(/initiativeTurnId=([^\s|]+)/)?.[1] || line.match(/actionToken=([^\s|]+)/)?.[1] || line.match(/round=([^\s|]+)/)?.[1] || line;
  return `${actor}|${targetId}|${turn}`;
});
const duplicateThirdPartyDiagnostics = diagnosticKeys.filter((key, index) => diagnosticKeys.indexOf(key) !== index);
const neutralRouteViolations = activeGrappleRoutes.filter((line) => /state=neutral|opponent=(?:null|none)/i.test(line));

const result = {
  route: await evaluate(`location.pathname`),
  aiEnabledBeforeStart,
  exportedLog: exportPath,
  logCharacters: completeLog.length,
  logLines: lines.length,
  outcome: outcomeMatch?.[0] || null,
  thirdPartyIgnoredCount: thirdParty.length,
  duplicateThirdPartyDiagnostics,
  activeGrappleRouteCount: activeGrappleRoutes.length,
  neutralRouteViolations,
  standingSuppressionCount: standingSuppressions.length,
  canonicalGrappleCount: canonicalGrapple.length,
  daggerProjectileViolations,
  arrowImpactCount: arrowImpactLines.length,
  malformedArrowHits,
  thirdPartyEvidence: thirdParty.slice(-20),
  activeGrappleEvidence: activeGrappleRoutes.slice(-20),
  suppressionEvidence: standingSuppressions.slice(-20),
  canonicalGrappleEvidence: canonicalGrapple.slice(-20),
  arrowEvidence: arrowImpactLines.slice(-20),
  tail: lines.slice(-40),
};
console.log(JSON.stringify(result, null, 2));

assert.equal(aiEnabledBeforeStart, true, "AI control must be enabled before battle start");
assert.ok(completeLog.length > 0, "complete developer log must be exported");
assert.ok(result.outcome, "battle must reach a canonical outcome");
assert.deepEqual(neutralRouteViolations, [], "neutral actors must not enter active-grapple obligation");
assert.deepEqual(duplicateThirdPartyDiagnostics, [], "third-party diagnostic must emit once per affected decision");
assert.deepEqual(daggerProjectileViolations, [], "non-thrown dagger must remain melee-only");
assert.deepEqual(malformedArrowHits, [], "arrow hits must retain location, technique, and mass diagnostics");

socket.close();
