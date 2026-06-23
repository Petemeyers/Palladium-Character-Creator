import assert from "node:assert/strict";
import {
  getWoundSeverity,
  previewWound,
  rollWoundLocation,
} from "../src/utils/combatWounds.js";

assert.deepEqual(rollWoundLocation({ rollLocation: () => 1 }), { roll: 1, location: "Head" }, "Roll 1 should hit Head");
assert.deepEqual(rollWoundLocation({ rollLocation: () => 4 }), { roll: 4, location: "Torso" }, "Roll 4 should hit Torso");
assert.deepEqual(rollWoundLocation({ rollLocation: () => 8 }), { roll: 8, location: "Right Arm" }, "Roll 8 should hit Right Arm");
assert.deepEqual(rollWoundLocation({ rollLocation: () => 14 }), { roll: 14, location: "Right Hand" }, "Roll 14 should hit Right Hand");
assert.deepEqual(rollWoundLocation({ rollLocation: () => 18 }), { roll: 18, location: "Left Leg" }, "Roll 18 should hit Left Leg");
assert.deepEqual(rollWoundLocation({ rollLocation: () => 20 }), { roll: 20, location: "Foot" }, "Roll 20 should hit Foot");

assert.equal(getWoundSeverity({ finalDamage: 0 }), "Absorbed / No wound", "0 final damage should be absorbed");
assert.equal(getWoundSeverity({ finalDamage: 2 }), "Glancing wound", "2 final damage should be glancing");
assert.equal(getWoundSeverity({ finalDamage: 5 }), "Minor wound", "5 final damage should be minor");
assert.equal(getWoundSeverity({ finalDamage: 10 }), "Serious wound", "10 final damage should be serious");
assert.equal(getWoundSeverity({ finalDamage: 15 }), "Critical wound", "15 final damage should be critical");
assert.equal(getWoundSeverity({ finalDamage: "bad" }), "Unknown / No wound", "Malformed damage should be safe");

const target = { id: "target", name: "Training Guard" };
const attack = { name: "Spear Thrust" };
const targetSnapshot = JSON.stringify(target);
const attackSnapshot = JSON.stringify(attack);

const preview = previewWound({
  attack,
  target,
  rawDamage: 9,
  armorReduction: 2,
  finalDamage: 7,
  rollLocation: () => 11,
});
assert.equal(preview.location, "Left Arm", "Injected roll should determine wound location");
assert.equal(preview.locationRoll, 11, "Injected location roll should be reported");
assert.equal(preview.severity, "Minor wound", "Final damage 7 should be a minor wound");
assert.equal(preview.rawDamage, 9, "Raw damage should be reported");
assert.equal(preview.armorReduction, 2, "Armor reduction should be reported");
assert.equal(preview.finalDamage, 7, "Final damage should be reported");

const absorbed = previewWound({
  attack,
  target,
  rawDamage: 2,
  armorReduction: 3,
  finalDamage: 0,
  rollLocation: () => 1,
});
assert.equal(absorbed.location, "None", "0 final damage should omit struck location");
assert.equal(absorbed.locationRoll, null, "0 final damage should not roll location");
assert.equal(absorbed.severity, "Absorbed / No wound", "0 final damage should preview no wound");
assert.equal(absorbed.note, "Armor absorbed the blow. No wound.", "0 final damage should report absorption note");

const malformed = previewWound({
  attack,
  target,
  rawDamage: "bad",
  armorReduction: "bad",
  finalDamage: "bad",
  rollLocation: () => 20,
});
assert.equal(malformed.location, "None", "Malformed final damage should avoid location roll");
assert.equal(malformed.severity, "Unknown / No wound", "Malformed final damage should be safe");

assert.equal(JSON.stringify(target), targetSnapshot, "Wound helper should not mutate target");
assert.equal(JSON.stringify(attack), attackSnapshot, "Wound helper should not mutate attack");

console.log("Combat wound preview tests passed.");
