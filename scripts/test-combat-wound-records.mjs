import assert from "node:assert/strict";

import {
  addWoundRecord,
  createWoundRecord,
  getWoundRecords,
} from "../src/utils/combatWoundRecords.js";

const sourceTarget = {
  id: "target-1",
  name: "Shield Bearer",
  combatWounds: [
    {
      id: "existing-wound",
      timestamp: "2026-01-01T00:00:00.000Z",
      attackerName: "Raider",
      targetName: "Shield Bearer",
      attackName: "Axe",
      location: "Left Arm",
      severity: "Glancing wound",
      rawDamage: 3,
      armorReduction: 1,
      finalDamage: 2,
      note: "",
    },
  ],
};
const sourceSnapshot = JSON.stringify(sourceTarget);

const record = createWoundRecord({
  attacker: { name: "Spearman", ignored: () => "not serialized" },
  target: sourceTarget,
  attack: { name: "Spear thrust" },
  woundPreview: {
    location: "Right Arm",
    severity: "Minor wound",
    rawDamage: 7,
    armorReduction: 2,
    finalDamage: 5,
    note: "Clean strike.",
  },
  rawDamage: 7,
  armorReduction: 2,
  finalDamage: 5,
});

assert.ok(record.id, "record has an id");
assert.ok(record.timestamp, "record has a timestamp");
assert.equal(record.attackerName, "Spearman");
assert.equal(record.targetName, "Shield Bearer");
assert.equal(record.attackName, "Spear thrust");
assert.equal(record.location, "Right Arm");
assert.equal(record.severity, "Minor wound");
assert.equal(record.rawDamage, 7);
assert.equal(record.armorReduction, 2);
assert.equal(record.finalDamage, 5);
assert.equal(record.note, "Clean strike.");
assert.equal(
  Object.values(record).some((value) => typeof value === "function" || (value && typeof value === "object" && !Array.isArray(value))),
  false,
  "record stores only display-safe primitive values"
);

const emptyTarget = { id: "empty-target", name: "Empty Target" };
const withFirstWound = addWoundRecord(emptyTarget, record);
assert.equal(withFirstWound.combatWounds.length, 1, "adds to empty wound list");
assert.deepEqual(emptyTarget, { id: "empty-target", name: "Empty Target" }, "does not mutate empty source target");

const withPreservedWound = addWoundRecord(sourceTarget, record);
assert.equal(withPreservedWound.combatWounds.length, 2, "preserves existing wound records");
assert.equal(withPreservedWound.combatWounds[0].id, "existing-wound");
assert.equal(JSON.stringify(sourceTarget), sourceSnapshot, "does not mutate source with existing wounds");

const absorbedRecord = createWoundRecord({
  attacker: { name: "Spearman" },
  target: sourceTarget,
  attack: { name: "Spear thrust" },
  woundPreview: {
    location: "None",
    severity: "Absorbed / No wound",
    finalDamage: 0,
  },
  finalDamage: 0,
});
assert.equal(absorbedRecord, null, "final damage 0 creates no wound record");
const absorbedTarget = addWoundRecord(sourceTarget, absorbedRecord);
assert.equal(absorbedTarget.combatWounds.length, 1, "null wound record is skipped");

assert.deepEqual(getWoundRecords({}), [], "missing wound list returns empty array");
assert.deepEqual(getWoundRecords({ combatWounds: "bad-data" }), [], "malformed wound list returns empty array");
assert.deepEqual(getWoundRecords(null), [], "null combatant returns empty array");

console.log("combat wound record tests passed");
