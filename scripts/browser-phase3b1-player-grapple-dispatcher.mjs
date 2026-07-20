import assert from "node:assert/strict";
import WebSocket from "ws";

const targets = await fetch("http://127.0.0.1:9223/json").then((response) => response.json());
const target = targets.find((entry) => entry.type === "page" && entry.url === "http://127.0.0.1:5173/combat");
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
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
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
const weaponPattern = process.env.BROWSER_WEAPON_PATTERN || "long sword";
const waitFor = async (predicateExpression, timeoutMs = 15000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(predicateExpression)) return true;
    await delay(150);
  }
  return false;
};
const clickButton = async (label) => {
  const clicked = await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).reverse().find((entry) => entry.innerText.trim() === ${JSON.stringify(label)} && !entry.disabled && entry.offsetParent !== null);
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert.equal(clicked, true, `enabled ${label} button must exist`);
};
const setControl = async (label, selector, optionPredicateSource, explicitValue = null) => {
  const result = await evaluate(`(() => {
    const labelNode = Array.from(document.querySelectorAll('label')).find((entry) => entry.innerText.trim() === ${JSON.stringify(label)});
    const container = labelNode?.closest('[role="group"]') || labelNode?.parentElement;
    const control = container?.querySelector(${JSON.stringify(selector)});
    if (!control) return { ok: false, reason: 'missing-control' };
    const options = Array.from(control.options || []);
    const option = ${explicitValue === null ? `options.find(${optionPredicateSource})` : `options.find((entry) => entry.value === ${JSON.stringify(explicitValue)})`};
    const value = option ? option.value : ${explicitValue === null ? "null" : JSON.stringify(explicitValue)};
    if (value == null) return { ok: false, reason: 'missing-option', options: options.map((entry) => entry.textContent.trim()) };
    const prototype = control.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(control, value);
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, value, text: option?.textContent?.trim() || value, options: options.map((entry) => entry.textContent.trim()) };
  })()`);
  assert.equal(result.ok, true, `${label} must be configurable: ${JSON.stringify(result)}`);
  return result;
};
const setInput = async (label, value) => {
  const result = await evaluate(`(() => {
    const labelNode = Array.from(document.querySelectorAll('label')).find((entry) => entry.innerText.trim() === ${JSON.stringify(label)});
    const input = labelNode?.parentElement?.querySelector('input');
    if (!input) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(result, true, `${label} input must exist`);
};

await send("Runtime.enable");
await send("Browser.grantPermissions", {
  origin: "http://127.0.0.1:5173",
  permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
}).catch(() => {});
await evaluate(`(() => { localStorage.clear(); sessionStorage.clear(); location.reload(); return true; })()`);
await delay(750);
assert.equal(await waitFor(`document.body?.innerText.includes('Combat Arena')`), true);
if (await evaluate(`document.body?.innerText.includes('Step 1 of 3: Choose Both Sides')`)) {
  await clickButton("Close");
  await delay(250);
}

const addKnight = async ({ side, name }) => {
  await clickButton("Add Fighter");
  const modalReady = await waitFor(`document.body?.innerText.includes('Select Fighter:')`);
  if (!modalReady) {
    const visibleText = await evaluate(`document.body?.innerText.slice(0, 4000) || ''`);
    throw new Error(`Add Fighter modal did not open: ${visibleText}`);
  }
  await setControl("Select Fighter:", "select", `(entry) => /^Knight \\(/.test(entry.textContent.trim())`);
  await delay(250);
  await setControl("Side", "select", "() => false", side);
  await setControl("Control Mode", "select", "() => false", "ai");
  await setInput("Custom Name (optional):", name);
  const weapon = await setControl(
    "Weapon (Humanoid Only):",
    "select",
    `(entry) => new RegExp(${JSON.stringify(weaponPattern)}, 'i').test(entry.textContent)`,
  );
  await clickButton("Add to Combat");
  assert.equal(await waitFor(`!document.body?.innerText.includes('Select Fighter:')`), true);
  return weapon;
};

const existingRoster = await evaluate(`document.body?.innerText.includes('Party Members (') || document.body?.innerText.includes('Opponents (')`);
if (existingRoster) {
  await clickButton("Reset Combat");
  await delay(500);
  const confirmLabel = await evaluate(`Array.from(document.querySelectorAll('button')).filter((entry) => !entry.disabled && entry.offsetParent !== null).map((entry) => entry.innerText.trim()).find((text) => /^(Confirm|Reset|Yes)$/i.test(text)) || ''`);
  if (confirmLabel) await clickButton(confirmLabel);
  await delay(750);
}
const partyWeapon = await addKnight({ side: "party", name: "Player Knight" });
const enemyWeapon = await addKnight({ side: "enemy", name: "Enemy Knight" });
await evaluate(`(() => {
  const select = document.querySelector('select[aria-label="Simulation Speed"]');
  if (!select) return false;
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'instant');
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);

const aiButtonText = await evaluate(`Array.from(document.querySelectorAll('button')).map((entry) => entry.innerText.trim()).find((text) => text === 'Manual' || /AI Control/.test(text)) || ''`);
if (aiButtonText === "Manual" || /OFF|Disabled/i.test(aiButtonText)) await clickButton(aiButtonText);
const battleActive = await evaluate(`Array.from(document.querySelectorAll('button')).some((entry) => entry.innerText.trim() === 'Pause' && !entry.disabled)`);
if (!battleActive) await clickButton("Start Battle");

await evaluate(`(() => {
  const select = Array.from(document.querySelectorAll('select')).find((entry) => Array.from(entry.options).some((option) => option.textContent.trim() === 'Developer Events'));
  const option = select && Array.from(select.options).find((entry) => entry.textContent.trim() === 'Developer Events');
  if (!select || !option) return false;
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, option.value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);

const deadline = Date.now() + 120000;
let logText = "";
let bodyText = "";
while (Date.now() < deadline) {
  await delay(1000);
  const copyAvailable = await evaluate(`Array.from(document.querySelectorAll('button')).some((entry) => entry.innerText.trim() === 'Copy Entire Log' && !entry.disabled)`);
  if (copyAvailable) {
    await clickButton("Copy Entire Log");
    logText = await evaluate(`navigator.clipboard.readText().catch(() => '')`) || "";
  }
  bodyText = await evaluate(`document.body?.innerText || ''`);
  if (/Victory|Defeat|Combat Over|wins the battle|battle has ended/i.test(bodyText + "\n" + logText)) break;
}

const logLines = logText.split(/\r?\n/);
const count = (eventType) => logLines.filter((line) => line.includes(`/${eventType}/`)).length;
const lifecycleEventTypes = [
  "initiative-action-token-created",
  "grapple-action-selected",
  "grapple-action-dispatched",
  "grapple-action-resolution-started",
  "grapple-action-roll-claimed",
  "grapple-action-committed",
  "grapple-action-completed",
  "grapple-success-turn-ending-commitment",
  "clinch-dagger-drawn",
];
const grappleLifecycle = logLines.filter((line) => lifecycleEventTypes.some((eventType) => line.includes(`/${eventType}/`))).map((line) => {
  const eventType = lifecycleEventTypes.find((candidate) => line.includes(`/${candidate}/`));
  const tokenMatch = line.match(/"actionToken":"([^"]+)"/) || line.match(/actionToken=([^\s|]+)/);
  const actorMatch = line.match(/actorId=([^\s|]+)/) || line.match(/"actorId":"([^"]+)"/);
  const actionTypeMatch = line.match(/"actionType":"([^"]+)"/) || line.match(/actionType=([^\s|]+)/);
  return { eventType, actionToken: tokenMatch?.[1] || null, actorId: actorMatch?.[1] || null, actionType: actionTypeMatch?.[1] || null };
});
const phase321Evidence = logLines
  .filter((line) => /break free roll:|clinch strike roll:|clinch-dagger-drawn|draw-clinch-dagger-turn-ending-state-committed|grapple-success-turn-ending-commitment/.test(line))
  .slice(-40);
const result = {
  partyWeapon: partyWeapon.text,
  enemyWeapon: enemyWeapon.text,
  logLength: logText.length,
  dispatcherMissing: count("grapple-dispatch-required-but-missing"),
  genericContinuationBlocked: count("player-grapple-generic-continuation-path-blocked"),
  zeroProgress: count("player-ai-zero-progress-action-detected"),
  recoveryCompleted: count("player-grapple-missing-dispatcher-recovery-completed"),
  duplicateRecovery: count("player-grapple-missing-dispatcher-recovery-duplicate-blocked"),
  aiEntry: count("player-grapple-dispatcher-ai-entry"),
  normalized: count("player-grapple-dispatcher-normalized"),
  routeEntry: count("player-grapple-dispatcher-route-entry"),
  actionEntry: count("player-grapple-dispatcher-action-entry"),
  tokenCreated: count("initiative-action-token-created"),
  selected: count("grapple-action-selected"),
  dispatched: count("grapple-action-dispatched"),
  resolutionStarted: count("grapple-action-resolution-started"),
  rollClaimed: count("grapple-action-roll-claimed"),
  completed: count("grapple-action-completed"),
  committed: count("grapple-action-committed"),
  lifecycleAudits: count("grapple-action-lifecycle-audit"),
  terminalReturn: count("grapple-combat-end-terminal-return"),
  duplicateCompletion: count("grapple-action-duplicate-completion-blocked"),
  diceBoundaryBlocked: count("grapple-dice-boundary-without-canonical-claim-blocked"),
  admissionAccepted: count("canonical-grapple-admission-accepted"),
  admissionRejected: count("canonical-grapple-admission-rejected"),
  admissionRecovery: count("canonical-grapple-admission-recovery-completed"),
  sequenceMismatch: count("continuation-action-sequence-mismatch"),
  nonGrappleReceiptBlocked: count("non-grapple-grapple-receipt-creation-blocked"),
  firedReceiptWatchdog: count("fired-continuation-left-pending-after-action-return"),
  settledReceiptWatchdog: count("fired-continuation-left-pending-after-action-settled"),
  receiptHops: count("action-continuation-receipt-hop"),
  receiptTurnAudits: count("action-continuation-receipt-turn-audit"),
  identitySeparated: count("grapple-plan-canonical-identity-separated"),
  identityCollision: count("grapple-plan-canonical-execution-identity-collision-blocked"),
  genericReceiptCreated: count("remaining-action-continuation-created"),
  genericReceiptFired: count("remaining-action-continuation-fired"),
  genericReceiptConsumed: count("remaining-action-continuation-consumed"),
  grappleSuccessTurnEnding: count("grapple-success-turn-ending-commitment"),
  twoHandedWeaponDropped: count("grapple-commitment-two-handed-weapon-dropped"),
  oneHandedWeaponRetained: count("grapple-one-handed-weapon-retained"),
  daggerDrawn: count("clinch-dagger-drawn"),
  clinchStrikeConvertedToDraw: count("clinch-strike-converted-to-draw-dagger"),
  standingGroundNormalized: count("standing-ground-attack-normalized-to-clinch-strike"),
  droppedWeaponRecovered: count("dropped-weapon-recovered"),
  illegalImmediateFollowUp: count("initial-grapple-illegal-immediate-followup-blocked"),
  invalidBreakFree: count("break-free-invalid-roll-blocked"),
  drawFollowupBlocked: count("draw-clinch-dagger-followup-scheduling-blocked"),
  turnEndingActionsRemain: count("turn-ending-effect-actions-remain"),
  turnEndingExhaustionRepair: count("turn-ending-action-exhaustion-committed"),
  clinchStrikeWithoutExecution: count("clinch-strike-roll-without-canonical-execution-blocked"),
  standingGroundResolverBlocked: count("standing-clinch-used-ground-attack-resolver-blocked"),
  acceptedWithoutCompletion: count("grapple-action-accepted-without-completion-detected"),
  acceptedMissingRollClaim: count("accepted-action-missing-canonical-roll-claim"),
  clinchStrikeRolls: logLines.filter((line) => /clinch strike roll:/i.test(line)).length,
  breakFreeRolls: logLines.filter((line) => /break free roll:/i.test(line)).length,
  invalidPlayerRollText: logLines.filter((line) => /break free roll:/i.test(line) && /NaN|undefined|\[object Object\]/i.test(line)).length,
  phase321Evidence,
  grappleLifecycle,
  outcome: /Victory|Defeat|Combat Over|wins the battle|battle has ended/i.test(bodyText + "\n" + logText),
};
console.log(JSON.stringify(result, null, 2));
for (const diagnostic of [
  "player-ai-zero-progress-action-detected",
  "canonical-grapple-admission-rejected",
  "canonical-grapple-admission-recovery-completed",
  "continuation-action-sequence-mismatch",
  "non-grapple-grapple-receipt-creation-blocked",
  "fired-continuation-left-pending-after-action-return",
  "fired-continuation-left-pending-after-action-settled",
]) {
  const index = logText.indexOf(diagnostic);
  if (index >= 0) console.log(`DIAGNOSTIC ${diagnostic}\n${logText.slice(Math.max(0, index - 1200), index + 1800)}`);
}
if (!result.outcome) console.log(logText.slice(-5000));

assert.equal(result.dispatcherMissing, 0);
assert.equal(result.genericContinuationBlocked, 0);
assert.equal(result.zeroProgress, 0);
assert.equal(result.recoveryCompleted, 0);
assert.equal(result.duplicateRecovery, 0);
assert.equal(result.admissionRejected, 0);
assert.equal(result.admissionRecovery, 0);
assert.equal(result.sequenceMismatch, 0);
assert.equal(result.nonGrappleReceiptBlocked, 0);
assert.equal(result.firedReceiptWatchdog, 0);
assert.equal(result.settledReceiptWatchdog, 0);
assert.equal(result.identityCollision, 0);
assert.equal(result.illegalImmediateFollowUp, 0);
assert.equal(result.standingGroundNormalized, 0);
assert.equal(result.invalidBreakFree, 0);
assert.equal(result.drawFollowupBlocked, 0);
assert.equal(result.turnEndingActionsRemain, 0);
assert.equal(result.turnEndingExhaustionRepair, 0);
assert.equal(result.clinchStrikeWithoutExecution, 0);
assert.equal(result.standingGroundResolverBlocked, 0);
assert.equal(result.acceptedWithoutCompletion, 0);
assert.equal(result.acceptedMissingRollClaim, 0);
assert.equal(result.invalidPlayerRollText, 0);
assert.equal(result.outcome, true, "browser battle should reach an outcome");

socket.close();
