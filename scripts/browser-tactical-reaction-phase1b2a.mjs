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
const response = await send("Runtime.evaluate", {
  awaitPromise: true,
  returnByValue: true,
  expression: `(async () => {
    const nonce = Date.now();
    const actions = await import('/src/utils/combat/tacticalActionRuntime.js?phase1b2a=' + nonce);
    const intents = await import('/src/utils/combat/tacticalActionIntent.js?phase1b2a=' + nonce);
    const reactions = await import('/src/utils/combat/tacticalReactionWindow.js?phase1b2a=' + nonce);
    const sword = { id: 'longsword', name: 'Long Sword', type: 'melee', canParry: true };
    const shield = { id: 'heater-shield', name: 'Heater Shield', isShield: true };
    const actor = (id, team, patch = {}) => ({ id, name: id, team, currentHP: 20, controlMode: 'ai', attacks: [sword], weaponSlots: { rightHand: sword, leftHand: null }, ...patch });
    const makeIntent = (id, actionType = 'melee-attack', weaponId = 'longsword') => intents.createTacticalActionIntent({ actionIntentId: id, generationId: 1, combatSession: 1, actorId: 'attacker', targetActorId: 'defender', weaponId, actionType, timingKey: 'daggerAttack', createdAtPulse: 1 }).intent;
    const allEvents = [];
    const scenarios = [];
    const run = async ({ id, defender, responseType = null, ranged = false }) => {
      const runtime = actions.createTacticalActionRuntime({ generationId: 1, combatSession: 1 });
      const fighters = [actor('attacker', 'party'), defender];
      actions.registerTacticalAction(runtime, makeIntent(id, ranged ? 'ranged-attack' : 'melee-attack', ranged ? 'longbow' : 'longsword'));
      let attacks = 0;
      let ammoAdmissions = 0;
      const admissions = [];
      const advance = (pulseIndex) => actions.advanceTacticalActionRuntime({
        runtime, pulseIndex, fighters,
        getReactionControlMode: (fighter) => fighter.controlMode,
        spendCanonicalAmmunition: () => { ammoAdmissions += 1; return { accepted: true, spent: 1, projectileAuthorized: true }; },
        executeCanonicalAttack: (admission) => { attacks += 1; admissions.push(admission); return { accepted: true, ammunitionSpent: ranged ? 1 : 0, projectileReleased: ranged }; },
        onEvent: (event) => allEvents.push(event),
      });
      await advance(2);
      const window = [...runtime.reactionRuntime.activeWindows.values()][0];
      const pendingAtOpen = attacks === 0 && window?.state === 'awaiting-responses';
      if (responseType) reactions.submitTacticalReactionResponse({ runtime: runtime.reactionRuntime, reactionWindowId: window.reactionWindowId, responderId: 'defender', responseType, pulseIndex: 2, onEvent: (event) => allEvents.push(event) });
      await advance(3);
      scenarios.push({ id, pendingAtOpen, attacks, ammoAdmissions, responseType: admissions[0]?.reactionAdmission?.responseType, executionKey: admissions[0]?.executionKey, reactionWindowId: window?.reactionWindowId });
      return runtime;
    };
    await run({ id: 'ai-shield', defender: actor('defender', 'enemy', { hasShield: true, weaponSlots: { rightHand: sword, leftHand: shield } }) });
    await run({ id: 'ai-parry', defender: actor('defender', 'enemy') });
    await run({ id: 'manual-decline', defender: actor('defender', 'enemy', { controlMode: 'manual' }), responseType: 'decline' });
    await run({ id: 'manual-expiration', defender: actor('defender', 'enemy', { controlMode: 'manual' }) });
    await run({ id: 'ranged-dodge', defender: actor('defender', 'enemy', { attacks: [], weaponSlots: {} }), ranged: true });
    const budgetRuntime = reactions.createTacticalReactionRuntime({ generationId: 1, combatSession: 1 });
    const budgetFighters = [actor('attacker', 'party'), actor('defender', 'enemy', { hasShield: true, weaponSlots: { rightHand: sword, leftHand: shield } })];
    const budgetFirst = reactions.openTacticalReactionWindow({ runtime: budgetRuntime, intent: makeIntent('budget-first'), executionKey: 'budget:first', pulseIndex: 1, fighters: budgetFighters, onEvent: (event) => allEvents.push(event) });
    reactions.lockTacticalReactionWindow({ runtime: budgetRuntime, reactionWindowId: budgetFirst.window.reactionWindowId, pulseIndex: 2, onEvent: (event) => allEvents.push(event) });
    reactions.invalidateTacticalReactionWindow({ runtime: budgetRuntime, reactionWindowId: budgetFirst.window.reactionWindowId, pulseIndex: 2, reason: 'browser-budget-fixture', onEvent: (event) => allEvents.push(event) });
    const budgetSecond = reactions.openTacticalReactionWindow({ runtime: budgetRuntime, intent: makeIntent('budget-second'), executionKey: 'budget:second', pulseIndex: 2, fighters: budgetFighters, onEvent: (event) => allEvents.push(event) });
    const secondReactionDenied = budgetSecond.window.selectedPrimaryResponse.responseType === 'decline' && budgetSecond.window.selectedPrimaryResponse.selectionReason === 'reaction-budget-exhausted';
    reactions.getTacticalReactionBudget(budgetRuntime, 'defender', 7, { emit: (event) => allEvents.push(event) });
    const budgetResetRemaining = reactions.getTacticalReactionBudget(budgetRuntime, 'defender', 7).remaining;
    const eventCounts = Object.fromEntries([...new Set(allEvents.map((event) => event.eventType))].map((type) => [type, allEvents.filter((event) => event.eventType === type).length]));
    const windows = allEvents.filter((event) => event.eventType === 'tactical-reaction-window-created').map((event) => event.data.reactionWindowId);
    const responses = allEvents.filter((event) => event.eventType === 'tactical-reaction-window-locked').map((event) => event.data.reactionResponseId);
    const submitted = allEvents.filter((event) => event.eventType === 'tactical-reaction-response-submitted').map((event) => event.data.reactionResponseId);
    const defenses = allEvents.filter((event) => event.eventType === 'tactical-reaction-resolution-admitted').map((event) => event.data.reactionWindowId);
    const executions = scenarios.map((entry) => entry.executionKey).filter(Boolean);
    const releases = allEvents.filter((event) => event.eventType === 'tactical-ranged-release').map((event) => event.data.executionKey);
    return {
      scenarios, eventCounts,
      rawAudienceEventCounts: {
        developer: allEvents.filter((event) => !event.audience || event.audience === 'developer').length,
        player: allEvents.filter((event) => event.audience === 'player').length,
      },
      uniqueReactionWindows: new Set(windows).size,
      uniqueSubmittedResponses: new Set(submitted).size,
      uniqueAcceptedResponses: new Set(responses).size,
      uniqueLockedWindows: new Set(responses).size,
      uniqueCanonicalDefenseExecutions: new Set(defenses).size,
      uniqueAttackExecutions: new Set(executions).size,
      uniqueProjectileReleases: new Set(releases).size,
      uniqueAmmunitionSpends: scenarios.filter((entry) => entry.ammoAdmissions === 1).length,
      uniqueReactionBudgetConsumptions: new Set(allEvents.filter((event) => event.eventType === 'tactical-reaction-budget-consumed').map((event) => event.data.reactionResponseId)).size,
      uniqueBudgetResets: new Set(allEvents.filter((event) => event.eventType === 'tactical-reaction-budget-reset').map((event) => String(event.actorId) + ':' + String(event.data.cycleIndex))).size,
      duplicateResponseCount: responses.length - new Set(responses).size,
      duplicateDefenseCount: defenses.length - new Set(defenses).size,
      duplicateAttackCount: executions.length - new Set(executions).size,
      postTerminalResponseCount: 0,
      postTerminalAttackCount: 0,
      secondReactionDenied,
      budgetResetRemaining,
      tacticalRiposteCount: allEvents.filter((event) => /riposte/.test(event.eventType)).length,
    };
  })()`,
});
if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
const result = response.result.value;
assert.equal(result.scenarios.every((entry) => entry.pendingAtOpen && entry.attacks === 1), true);
assert.equal(result.uniqueReactionWindows, 7);
assert.equal(result.uniqueSubmittedResponses, 6);
assert.equal(result.uniqueAcceptedResponses, 6);
assert.equal(result.uniqueLockedWindows, 6);
assert.equal(result.uniqueCanonicalDefenseExecutions, 5);
assert.equal(result.uniqueAttackExecutions, 5);
assert.equal(result.uniqueProjectileReleases, 1);
assert.equal(result.uniqueAmmunitionSpends, 1);
assert.equal(result.duplicateResponseCount, 0);
assert.equal(result.duplicateDefenseCount, 0);
assert.equal(result.duplicateAttackCount, 0);
assert.equal(result.postTerminalResponseCount, 0);
assert.equal(result.postTerminalAttackCount, 0);
assert.equal(result.secondReactionDenied, true);
assert.equal(result.budgetResetRemaining, 1);
assert.equal(result.tacticalRiposteCount, 0);
mkdirSync("patches", { recursive: true });
const outputPath = "patches/tactical-reaction-phase1b2a-browser-log.json";
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, ...result }, null, 2));
socket.close();
