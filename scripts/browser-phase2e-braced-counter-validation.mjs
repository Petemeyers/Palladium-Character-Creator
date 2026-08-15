import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import WebSocket from "ws";

import {
  PHASE2E_BRACED_COUNTER_FIXTURE,
  expectedBracedCounterDamage,
  pointsEqual,
} from "../src/utils/combat/phase2eBracedCounterFixture.js";

const API = PHASE2E_BRACED_COUNTER_FIXTURE.windowApiName;
const reportPath = path.join("patches", "phase2e-braced-counter-browser-log.json");

const targets = await fetch("http://127.0.0.1:9223/json").then((response) => response.json());
const target = targets.find((entry) => entry.type === "page" && /:5173\/.*combat/.test(entry.url || ""));
assert.ok(target?.webSocketDebuggerUrl, "combat page CDP target must be available on 127.0.0.1:9223");

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
const waitFor = async (expression, timeoutMs = 20000, label = expression) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await evaluate(expression);
    if (value) return value;
    await delay(150);
  }
  throw new Error(`timed out waiting for ${label}`);
};

await send("Runtime.enable");
await evaluate(`(() => {
  try { localStorage.removeItem("debugCombat"); } catch {}
  const combatUrl = location.origin + "/combat";
  if (location.href !== combatUrl) {
    location.href = combatUrl;
  } else {
    location.reload();
  }
  return true;
})()`);
await delay(1200);
await waitFor(`Boolean(document.body?.innerText.includes("Combat Arena") || document.body?.innerText.includes("Combat"))`, 20000, "combat page");

if (await evaluate(`document.body?.innerText.includes("Step 1 of 3: Choose Both Sides")`)) {
  await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll("button")).find((entry) => entry.innerText.trim() === "Close");
    button?.click();
    return Boolean(button);
  })()`);
  await delay(300);
}

await waitFor(`Boolean(window.${API})`, 20000, "phase 2e fixture API");

await evaluate(`(async () => {
  const Dice = (await import("/src/utils/cryptoDice.js")).default;
  if (!window.__phase2eOriginalDice) {
    window.__phase2eOriginalDice = {
      rollD20: Dice.rollD20.bind(Dice),
      parseAndRoll: Dice.parseAndRoll.bind(Dice),
    };
  }
  window.__phase2eArmChargeAttack = false;
  window.__phase2eObservedAttackNatural = null;
  let initiativeIndex = 0;
  Dice.rollD20 = () => {
    const stack = String(new Error().stack || "");
    if (stack.includes("rollRoundInitiative") || stack.includes("roundInitiative")) {
      initiativeIndex += 1;
      return initiativeIndex === 1 ? 1 : 20;
    }
    return window.__phase2eOriginalDice.rollD20();
  };
  Dice.parseAndRoll = (formula, bonus = 0) => {
    const cleaned = String(formula || "");
    if (!/d20/i.test(cleaned)) return window.__phase2eOriginalDice.parseAndRoll(formula, bonus);
    const stack = String(new Error().stack || "");
    const natural = window.__phase2eArmChargeAttack && stack.includes("CombatPage")
      ? 19
      : 2;
    if (window.__phase2eArmChargeAttack && stack.includes("CombatPage") && natural === 19) {
      window.__phase2eArmChargeAttack = false;
      window.__phase2eObservedAttackNatural = 19;
    }
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
      description: cleaned + " = " + natural,
      fullDescription: cleaned + " = " + (total + Number(bonus || 0)),
    };
  };
  return true;
})()`);

const setup = await evaluate(`window.${API}.addFixtureActors()`);
assert.equal(setup?.ok, true, `fixture actors must be created: ${JSON.stringify(setup)}`);
const preStartPositions = setup.preStartPositions;
assert.deepEqual(preStartPositions.charger, { x: 20, y: 23 });
assert.deepEqual(preStartPositions.bracer, { x: 20, y: 20 });

await waitFor(`(window.${API}.snapshot()?.charger && window.${API}.snapshot()?.bracer)`, 10000, "fixture roster");
await evaluate(`window.${API}.startCombat()`);
await waitFor(`window.${API}.snapshot()?.combatActive === true`, 20000, "combat start");
await evaluate(`window.${API}.ensureSurvivalHp()`);
await delay(200);

const verification = await evaluate(`window.${API}.verifyLiveState()`);
assert.equal(verification?.ok, true, `fixture live state must match (20,20)/(20,23): ${(verification?.errors || []).join("; ")}`);
const postStart = verification.snapshot;
assert.ok(pointsEqual(postStart.charger.position, { x: 20, y: 23 }), `charger post-start ${JSON.stringify(postStart.charger.position)}`);
assert.ok(pointsEqual(postStart.bracer.position, { x: 20, y: 20 }), `bracer post-start ${JSON.stringify(postStart.bracer.position)}`);
assert.notEqual(postStart.ids.chargerId, postStart.ids.bracerId);
assert.equal(postStart.catalog.charge?.enabled, true, `Charge must be available: ${postStart.catalog.charge?.disabledReason || "missing"}`);
assert.equal(postStart.catalog.block?.enabled, true, `Block must be available: ${postStart.catalog.block?.disabledReason || "missing"}`);

await waitFor(
  `window.${API}.snapshot()?.currentActorId === window.${API}.snapshot()?.ids.bracerId`,
  15000,
  "bracer initiative turn",
);

const blockResult = await evaluate(`window.${API}.enterBlockingPosture()`);
assert.equal(blockResult?.ok, true, `Block posture must apply: ${JSON.stringify(blockResult)}`);
await delay(200);
const blocked = await evaluate(`window.${API}.snapshot()`);
assert.ok(
  blocked?.posture?.bracer?.type === "blocking" || blocked?.posture?.bracerStance === "Block",
  `bracer must enter Blocking posture: ${JSON.stringify(blocked?.posture)}`,
);

await evaluate(`window.${API}.endCurrentAction()`);
await waitFor(
  `window.${API}.snapshot()?.currentActorId === window.${API}.snapshot()?.ids.chargerId`,
  15000,
  "charger initiative turn",
);

const beforeCharge = await evaluate(`window.${API}.snapshot()`);
const actionsBeforeCharge = beforeCharge.charger.remainingActions;
const staminaBefore = beforeCharge.charger.currentStamina;
const chargerHpBefore = beforeCharge.charger.hp;
const bracerHpBefore = beforeCharge.bracer.hp;

const begin = await evaluate(`window.${API}.beginCharge()`);
assert.equal(begin?.ok, true, `Charge targeting must start: ${JSON.stringify(begin)}`);
await waitFor(
  `Array.isArray(window.${API}.snapshot()?.validMoves) && window.${API}.snapshot().validMoves.some((hex) => hex.x === 20 && hex.y === 21)`,
  8000,
  "charge destination (20,21)",
);

const afterMovementPromise = (async () => {
  await waitFor(
    `window.${API}.snapshot()?.logs?.some((entry) => /Charge movement completed|charges .* as a combined Charge action|charge follow-through scheduled/i.test(entry.message || entry.eventType || ""))`,
    8000,
    "charge movement",
  );
  return evaluate(`window.${API}.snapshot()`);
})();

await evaluate(`window.__phase2eArmChargeAttack = true`);
const destination = await evaluate(`window.${API}.selectChargeDestination()`);
assert.deepEqual(destination?.destination, { x: 20, y: 21 });

const afterMovement = await afterMovementPromise;
const actionsAfterMovement = afterMovement.charger.remainingActions;
assert.equal(
  actionsAfterMovement,
  actionsBeforeCharge,
  `Charge movement must not spend the action budget (${actionsBeforeCharge} -> ${actionsAfterMovement})`,
);

const afterAttack = await waitFor(`(() => {
  const snapshot = window.${API}.snapshot();
  const logs = snapshot?.logs || [];
  const attacked = logs.some((entry) => /attack-roll|Attack roll:|charge follow-through/i.test(\`\${entry.eventType} \${entry.message}\`));
  const moved = snapshot?.charger?.position?.x === 20 && snapshot?.charger?.position?.y === 21;
  return attacked && moved ? snapshot : null;
})()`, 12000, "charge follow-through attack");

await delay(400);
const finalSnapshot = await evaluate(`window.${API}.snapshot()`);
const observedNatural = await evaluate(`window.__phase2eObservedAttackNatural`);

const logs = finalSnapshot.logs || [];
const logText = logs.map((entry) => `${entry.eventType} ${entry.message}`).join("\n");
const impale = logs.find((entry) => /impales/i.test(entry.message || ""));
const damageMatch = logText.match(/for (\d+) damage/i) || (impale?.message || "").match(/for (\d+) damage/i);
const attackDamageMatch = logText.match(/(?:hits|deals|inflicts)\s+(\d+)\s+damage/i)
  || logText.match(/finalDamage[=:](\d+)/i);
const counterFromLog = damageMatch ? Number(damageMatch[1]) : null;
const chargerHpAfter = finalSnapshot.charger.hp;
const bracerHpAfter = finalSnapshot.bracer.hp;
const chargerDelta = chargerHpBefore - chargerHpAfter;
const bracerDelta = bracerHpBefore - bracerHpAfter;
const finalDamage = Number.isFinite(bracerDelta) && bracerDelta > 0 ? bracerDelta : null;
const expectedCounter = Number.isFinite(finalDamage) ? expectedBracedCounterDamage(finalDamage) : counterFromLog;
const attackRollMatch = logText.match(/Attack roll:\s*(\d+)/i);
const naturalAttackRoll = observedNatural || (attackRollMatch ? Number(attackRollMatch[1]) : null);
const followThroughCount = logs.filter((entry) => /charge-follow-through-scheduled|charge follow-through scheduled/i.test(`${entry.eventType} ${entry.message}`)).length;
const attackRollCount = logs.filter((entry) => entry.eventType === "attack-roll" || /^Attack roll:/.test(entry.message || "")).length;
const impaleCount = logs.filter((entry) => /impales/i.test(entry.message || "")).length;
const alreadyResolving = logs.some((entry) => /Action already resolving/i.test(entry.message || ""));
const staleBlocked = logs.some((entry) => /stale combat roll blocked|braced-counter-ownership-stale|stale damage application rejected/i.test(`${entry.eventType} ${entry.message}`));
const liveOwnershipPassed = logs.some((entry) => /combat roll gate passed:.*source=hp-mutation/i.test(entry.message || ""))
  && !staleBlocked;

const report = {
  fixture: "phase2e-braced-counter",
  preStartPositions,
  postStartPositions: {
    charger: postStart.charger.position,
    bracer: postStart.bracer.position,
  },
  ids: finalSnapshot.ids,
  block: blocked?.posture,
  charge: {
    start: { x: 20, y: 23 },
    destination: { x: 20, y: 21 },
    landed: finalSnapshot.charger.position,
    actionsBeforeCharge,
    actionsAfterMovement,
    actionsAfterAttack: finalSnapshot.charger.remainingActions,
    staminaBefore,
    staminaAfter: finalSnapshot.charger.currentStamina,
    followThroughCount,
    attackRollCount,
  },
  counter: {
    naturalAttackRoll,
    chargerHpBefore,
    bracerHpBefore,
    finalDamage,
    expectedCounter,
    chargerHpAfter,
    bracerHpAfter,
    chargerDelta,
    bracerDelta,
    impaleMessage: impale?.message || null,
  },
  mutation: {
    liveOwnershipPassed,
    impaleCount,
    aliases: {
      charger: {
        currentHP: finalSnapshot.charger.currentHP,
        hp: finalSnapshot.charger.hpAlias,
        HP: finalSnapshot.charger.HPAlias,
      },
    },
  },
  continuation: {
    pendingTurnAdvance: finalSnapshot.pendingTurnAdvance,
    turnActionResolving: finalSnapshot.turnActionResolving,
    executingAction: finalSnapshot.executingAction,
    currentActorId: finalSnapshot.currentActorId,
    alreadyResolving,
    staleBlocked,
  },
  logs,
};

fs.mkdirSync("patches", { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

assert.ok(pointsEqual(finalSnapshot.charger.position, { x: 20, y: 21 }), `charger must land at (20,21): ${JSON.stringify(finalSnapshot.charger.position)}`);
assert.equal(actionsAfterMovement, actionsBeforeCharge);
assert.equal(finalSnapshot.charger.remainingActions, actionsBeforeCharge - 1);
assert.ok(followThroughCount === 1, `charge follow-through must run once, saw ${followThroughCount}`);
assert.ok(attackRollCount <= 1, `charge attack must not duplicate, saw ${attackRollCount}`);
assert.equal(naturalAttackRoll, 19, "qualifying natural 18-20 must be observed");
assert.ok(impale, `braced-counter impale log missing\n${logText}`);
assert.equal(impaleCount, 1, `counter must execute once, saw ${impaleCount}`);
assert.equal(chargerDelta, expectedCounter, `charger HP must drop by floor(finalDamage/3); before=${chargerHpBefore} after=${chargerHpAfter} finalDamage=${finalDamage}`);
assert.notEqual(bracerDelta, chargerDelta === 0 ? -1 : chargerDelta, "counter damage must apply to the charger");
assert.equal(bracerHpAfter, bracerHpBefore - (finalDamage || 0));
assert.equal(liveOwnershipPassed, true, "hp-mutation ownership gate must pass with no stale counter rejection");
assert.equal(finalSnapshot.charger.currentHP, finalSnapshot.charger.hpAlias);
assert.equal(finalSnapshot.charger.currentHP, finalSnapshot.charger.HPAlias);
assert.equal(alreadyResolving, false, "no Action already resolving after completion");
assert.equal(staleBlocked, false, "no stale callback after completion");
assert.equal(finalSnapshot.turnActionResolving, false);
assert.equal(finalSnapshot.executingAction, false);

console.log(JSON.stringify({
  ok: true,
  reportPath,
  counter: report.counter,
  charge: report.charge,
  continuation: report.continuation,
}, null, 2));
socket.close();
