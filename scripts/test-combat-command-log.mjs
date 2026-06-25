import assert from "node:assert/strict";

import {
  commandBlockedLog,
  commandPendingLog,
  commandSelectedLog,
  commandStartedLog,
  commandCompletedLog,
  movementTargetingCommandLog,
  postureCommandLog,
  recoveryCommandLog,
} from "../src/utils/combatCommandLog.js";

const assertDisplaySafe = (message) => {
  assert.equal(typeof message, "string");
  assert.equal(message.includes("[object Object]"), false, "does not render raw objects");
  assert.equal(message.includes("function"), false, "does not render functions");
};

const actor = { id: "fighter-1", name: "Mimi", bad: () => {} };

const selected = commandSelectedLog({ actor, action: { name: "Defend", payload: { raw: true } } });
assert.equal(selected, "[Command Center] Mimi selected Defend.");
assertDisplaySafe(selected);

const defend = postureCommandLog({ actor: "Sorulwen", postureLabel: "Defensive" });
assert.equal(defend, "[Command Center] Sorulwen enters Defensive Posture.");
assertDisplaySafe(defend);

const block = postureCommandLog({ actor, postureLabel: "Blocking" });
assert.equal(block, "[Command Center] Mimi enters Blocking Posture.");
assertDisplaySafe(block);

const evade = postureCommandLog({ actor, postureLabel: "Evading" });
assert.equal(evade, "[Command Center] Mimi enters Evading Posture.");
assertDisplaySafe(evade);

const recover = recoveryCommandLog({ actor, recovered: 2 });
assert.equal(recover, "[Command Center] Mimi recovers 2 stamina.");
assertDisplaySafe(recover);

const move = movementTargetingCommandLog({ actor, actionType: "move" });
assert.equal(move, "[Command Center] Mimi begins Move targeting.");
assertDisplaySafe(move);

const run = movementTargetingCommandLog({ actor, actionType: "run" });
assert.equal(run, "[Command Center] Mimi begins Run targeting.");
assertDisplaySafe(run);

const charge = movementTargetingCommandLog({ actor, actionType: "charge" });
assert.equal(charge, "[Command Center] Mimi begins Charge targeting. Attack follow-through pending.");
assertDisplaySafe(charge);

const blocked = commandBlockedLog({ action: { name: "Attack" }, reason: "target out of reach." });
assert.equal(blocked, "[Command Center] Attack blocked: target out of reach.");
assertDisplaySafe(blocked);

const pending = commandPendingLog({ action: { name: "Use Item" }, reason: "item effect handler not wired yet." });
assert.equal(pending, "[Command Center] Use Item pending: item effect handler not wired yet.");
assertDisplaySafe(pending);

const started = commandStartedLog({ actor: null, action: null, detail: { raw: true } });
assert.equal(started, "[Command Center] Combatant begins Command.");
assertDisplaySafe(started);

const completed = commandCompletedLog({ actor: { label: "Guard" }, action: { type: "block" }, detail: () => "bad" });
assert.equal(completed, "[Command Center] Guard completed block.");
assertDisplaySafe(completed);

assert.doesNotThrow(() => commandSelectedLog({ actor: { name: () => "bad" }, action: { name: {} } }));
assertDisplaySafe(commandSelectedLog({ actor: { name: () => "bad" }, action: { name: {} } }));

console.log("combat command log tests passed");
