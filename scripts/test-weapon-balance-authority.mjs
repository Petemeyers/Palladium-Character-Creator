import assert from "node:assert/strict";
import {
  evaluateWeaponCalibrationTargets,
  getSpecializedWeaponBalanceAdjustment,
  getWeaponEntryBalanceAdjustment,
} from "../src/utils/combat/weaponBalanceAuthority.js";

const spear = { id: "weapon.spear", name: "Spear", reachFeet: 10, handsRequired: 2, twoHanded: true };
const longsword = { id: "weapon.longsword", name: "Longsword", halfSwordCapable: true, handsRequired: 2 };
const halfSword = getWeaponEntryBalanceAdjustment({
  mover: {},
  moverWeapon: longsword,
  controllerWeapon: spear,
  entryTechnique: { id: "half-sword-entry" },
});
assert.equal(halfSword.adjustment, 3);
assert.ok(halfSword.reasons.includes("half-sword-entry-calibration"));
assert.equal(getSpecializedWeaponBalanceAdjustment({ actionId: "polearm-beat-entry" }).attack, 1);
const evaluations = evaluateWeaponCalibrationTargets({
  "two-handed-spear-vs-arming-sword": { leftWinRate: 0.89 },
});
assert.equal(evaluations[0].status, "within-target");
console.log("weapon balance authority test passed");
