import assert from "node:assert/strict";
import {
  applyPublicCombatDamage,
  getPublicCombatHpInfo,
} from "../src/utils/publicCombatHp.js";

const target = {
  id: "target-1",
  name: "Training Guard",
  HP: 12,
};
const targetSnapshot = JSON.stringify(target);

const fiveDamage = applyPublicCombatDamage(target, 5);
assert.equal(fiveDamage.ok, true, "Damage should apply to a target with HP");
assert.equal(fiveDamage.hpField, "HP", "HP field should be used when present");
assert.equal(fiveDamage.oldHp, 12, "Old HP should be reported");
assert.equal(fiveDamage.newHp, 7, "5 damage against 12 HP should leave 7 HP");
assert.equal(fiveDamage.updatedTarget.HP, 7, "Updated target should carry new HP");
assert.equal(JSON.stringify(target), targetSnapshot, "Damage helper should not mutate the original target");

const largeDamage = applyPublicCombatDamage(target, 20);
assert.equal(largeDamage.ok, true, "Large damage should apply");
assert.equal(largeDamage.newHp, 0, "HP should not drop below 0");
assert.equal(largeDamage.updatedTarget.HP, 0, "Updated target should clamp HP to 0");

const missingHp = applyPublicCombatDamage({ name: "No HP" }, 5);
assert.equal(missingHp.ok, false, "Missing HP should fail safely");
assert.ok(missingHp.missingFields.includes("HP"), "Missing HP should be reported");

const alreadyApplied = applyPublicCombatDamage(target, 5, { applied: true });
assert.equal(alreadyApplied.ok, false, "Applied result should not apply again");
assert.ok(alreadyApplied.missingFields.includes("applied"), "Applied state should be reported");

const hpLowercase = applyPublicCombatDamage({ name: "Lowercase", hp: 12 }, 5);
assert.equal(hpLowercase.ok, true, "Lowercase hp should be supported");
assert.equal(hpLowercase.hpField, "hp", "Lowercase hp field should be updated");
assert.equal(hpLowercase.updatedTarget.hp, 7, "Lowercase hp should decrease");

const hitPoints = applyPublicCombatDamage({ name: "Hit Points", hitPoints: 12 }, 5);
assert.equal(hitPoints.ok, true, "hitPoints should be supported");
assert.equal(hitPoints.hpField, "hitPoints", "hitPoints field should be updated");
assert.equal(hitPoints.updatedTarget.hitPoints, 7, "hitPoints should decrease");

const derivedFallback = applyPublicCombatDamage({
  name: "Derived Only",
  publicDerivedStats: { hitPoints: 12 },
}, 5);
assert.equal(derivedFallback.ok, true, "Derived hit points should be readable as a fallback");
assert.equal(derivedFallback.hpField, "HP", "Derived fallback should write local HP");
assert.equal(derivedFallback.updatedTarget.HP, 7, "Derived fallback should create local HP");
assert.equal(derivedFallback.updatedTarget.publicDerivedStats.hitPoints, 12, "Derived stats should remain read-only");

const info = getPublicCombatHpInfo({ hp: 4 });
assert.equal(info.ok, true, "HP info should read supported fields");
assert.equal(info.hp, 4, "HP info should report numeric HP");
assert.equal(info.field, "hp", "HP info should report the field used");

console.log("Public combat HP tests passed.");
