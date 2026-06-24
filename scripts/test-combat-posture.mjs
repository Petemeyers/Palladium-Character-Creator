import assert from "node:assert/strict";

import {
  applyDefensivePosture,
  clearExpiredPostures,
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

const defended = applyDefensivePosture(base, posture);
assert.equal(defended.combatPosture.label, "Defending", "defensive posture is applied");
assert.equal(JSON.stringify(base), snapshot, "applying posture does not mutate original input");
assert.equal(defended.hp, base.hp, "defend does not change HP");
assert.equal(defended.currentStamina, base.currentStamina, "defend does not change stamina");
assert.equal(defended.armorReduction, base.armorReduction, "defend does not change armor data");
assert.equal(defended.damageTotal, base.damageTotal, "defend does not change damage data");
assert.deepEqual(defended.wounds, base.wounds, "defend does not change wounds");

assert.equal(getCombatPosture({}), null, "missing posture returns null");
assert.equal(getCombatPosture(null), null, "null input returns null posture");
assert.doesNotThrow(() => getCombatPosture({ combatPosture: "bad" }), "malformed posture does not throw");

const stillDefending = clearExpiredPostures(defended, 2, 4);
assert.equal(stillDefending.combatPosture.label, "Defending", "posture remains before same combatant next turn");

const cleared = clearExpiredPostures(defended, 3, 3);
assert.equal(getCombatPosture(cleared), null, "posture clears when combatant reaches next turn");
assert.equal(cleared.hp, base.hp, "clearing posture does not change HP");
assert.equal(cleared.currentStamina, base.currentStamina, "clearing posture does not change stamina");
assert.equal(cleared.armorReduction, base.armorReduction, "clearing posture does not change armor data");
assert.equal(cleared.damageTotal, base.damageTotal, "clearing posture does not change damage data");
assert.deepEqual(cleared.wounds, base.wounds, "clearing posture does not change wounds");

assert.doesNotThrow(() => createDefensivePosture({ round: "bad", turnIndex: true }), "malformed create input does not throw");
assert.doesNotThrow(() => applyDefensivePosture(null, null), "malformed apply input does not throw");
assert.doesNotThrow(() => clearExpiredPostures(null, "bad", false), "malformed clear input does not throw");

console.log("combat posture tests passed");
