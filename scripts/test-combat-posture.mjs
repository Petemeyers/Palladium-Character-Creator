import assert from "node:assert/strict";

import {
  applyCombatPosture,
  applyDefensivePosture,
  clearExpiredPostures,
  createCombatPosture,
  createDefensivePosture,
  getCombatPosture,
} from "../src/utils/combatPosture.js";

const hasFunction = (value) => {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(hasFunction);
};

const base = {
  id: "fighter-1",
  name: "Mimi",
  hp: 8,
  currentStamina: 5,
  maxStamina: 10,
  armorReduction: 2,
  damageTotal: 0,
  wounds: [{ id: "wound-1", location: "arm" }],
  inventory: [{ id: "item-1", name: "Linen Bandage" }],
  remainingActions: 1,
};
const snapshot = JSON.stringify(base);

const posture = createDefensivePosture({ round: 2, turnIndex: 3, actor: base });
assert.deepEqual(posture, {
  type: "defending",
  label: "Defending",
  createdRound: 2,
  createdTurnIndex: 3,
  expires: "next-turn",
  note: "Defensive posture active until this combatant's next turn.",
});
assert.equal(hasFunction(posture), false, "posture contains no functions");
assert.equal(Object.values(posture).some((value) => value && typeof value === "object"), false, "posture stores no raw objects");

const blocking = createCombatPosture({ type: "blocking", round: 2, turnIndex: 3 });
assert.deepEqual(blocking, {
  type: "blocking",
  label: "Blocking",
  createdRound: 2,
  createdTurnIndex: 3,
  expires: "next-turn",
  note: "Blocking posture active until this combatant's next turn.",
});
assert.equal(hasFunction(blocking), false, "blocking posture contains no functions");
assert.equal(Object.values(blocking).some((value) => value && typeof value === "object"), false, "blocking posture stores no raw objects");

const evading = createCombatPosture({ type: "evading", round: 2, turnIndex: 3 });
assert.deepEqual(evading, {
  type: "evading",
  label: "Evading",
  createdRound: 2,
  createdTurnIndex: 3,
  expires: "next-turn",
  note: "Evading posture active until this combatant's next turn.",
});
assert.equal(hasFunction(evading), false, "evading posture contains no functions");
assert.equal(Object.values(evading).some((value) => value && typeof value === "object"), false, "evading posture stores no raw objects");

const defended = applyDefensivePosture(base, posture);
assert.equal(defended.combatPosture.label, "Defending", "defensive posture is applied");
assert.equal(JSON.stringify(base), snapshot, "applying posture does not mutate original input");
assert.equal(defended.hp, base.hp, "defend does not change HP");
assert.equal(defended.currentStamina, base.currentStamina, "defend does not change stamina");
assert.equal(defended.armorReduction, base.armorReduction, "defend does not change armor data");
assert.equal(defended.damageTotal, base.damageTotal, "defend does not change damage data");
assert.deepEqual(defended.wounds, base.wounds, "defend does not change wounds");
assert.deepEqual(defended.inventory, base.inventory, "defend does not change inventory");

const blocked = applyCombatPosture(base, blocking);
assert.equal(blocked.combatPosture.label, "Blocking", "blocking posture is applied");
assert.equal(JSON.stringify(base), snapshot, "applying blocking posture does not mutate original input");
assert.equal(blocked.hp, base.hp, "block does not change HP");
assert.equal(blocked.currentStamina, base.currentStamina, "block does not change stamina");
assert.equal(blocked.armorReduction, base.armorReduction, "block does not change armor data");
assert.equal(blocked.damageTotal, base.damageTotal, "block does not change damage data");
assert.deepEqual(blocked.wounds, base.wounds, "block does not change wounds");
assert.deepEqual(blocked.inventory, base.inventory, "block does not change inventory");

const evaded = applyCombatPosture(base, evading);
assert.equal(evaded.combatPosture.label, "Evading", "evading posture is applied");
assert.equal(JSON.stringify(base), snapshot, "applying evading posture does not mutate original input");
assert.equal(evaded.hp, base.hp, "evade does not change HP");
assert.equal(evaded.currentStamina, base.currentStamina, "evade does not change stamina");
assert.equal(evaded.armorReduction, base.armorReduction, "evade does not change armor data");
assert.equal(evaded.damageTotal, base.damageTotal, "evade does not change damage data");
assert.deepEqual(evaded.wounds, base.wounds, "evade does not change wounds");
assert.deepEqual(evaded.inventory, base.inventory, "evade does not change inventory");

assert.equal(getCombatPosture({}), null, "missing posture returns null");
assert.equal(getCombatPosture(null), null, "null input returns null posture");
assert.doesNotThrow(() => getCombatPosture({ combatPosture: "bad" }), "malformed posture does not throw");

const stillDefending = clearExpiredPostures(defended, 2, 4);
assert.equal(stillDefending.combatPosture.label, "Defending", "posture remains before same combatant next turn");

const cleared = clearExpiredPostures(defended, 3, 3);
assert.equal(getCombatPosture(cleared), null, "posture clears when combatant reaches next turn");
assert.equal(cleared.hp, base.hp, "clearing posture does not change HP");
assert.equal(cleared.currentStamina, base.currentStamina + 1, "uninterrupted defensive posture recovers 1 stamina on expiry");
assert.equal(cleared.armorReduction, base.armorReduction, "clearing posture does not change armor data");
assert.equal(cleared.damageTotal, base.damageTotal, "clearing posture does not change damage data");
assert.deepEqual(cleared.wounds, base.wounds, "clearing posture does not change wounds");
assert.deepEqual(cleared.inventory, base.inventory, "clearing posture does not change inventory");

const clearedBlock = clearExpiredPostures(blocked, 3, 3);
assert.equal(getCombatPosture(clearedBlock), null, "blocking posture clears when combatant reaches next turn");

const clearedEvade = clearExpiredPostures(evaded, 3, 3);
assert.equal(getCombatPosture(clearedEvade), null, "evading posture clears when combatant reaches next turn");

assert.doesNotThrow(() => createCombatPosture({ type: "bad", round: "bad", turnIndex: true }), "malformed generic create input does not throw");
assert.doesNotThrow(() => createDefensivePosture({ round: "bad", turnIndex: true }), "malformed create input does not throw");
assert.doesNotThrow(() => applyCombatPosture(null, null), "malformed generic apply input does not throw");
assert.doesNotThrow(() => applyDefensivePosture(null, null), "malformed apply input does not throw");
assert.doesNotThrow(() => clearExpiredPostures(null, "bad", false), "malformed clear input does not throw");

console.log("combat posture tests passed");
