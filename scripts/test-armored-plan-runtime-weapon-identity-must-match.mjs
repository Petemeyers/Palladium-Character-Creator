import assert from "node:assert/strict";
import fs from "node:fs";
import { validateArmoredPlanRuntimeWeaponIdentity } from "../src/utils/combat/armoredTechniqueWeaponValidation.js";

const plan = { sourceWeaponId: "long-sword", sourceWeaponName: "Long Sword", resolvedAttackMode: "longsword-cut" };
assert.equal(validateArmoredPlanRuntimeWeaponIdentity({
  plan,
  runtimeWeapon: { id: "long-sword", name: "Long Sword" },
  runtimeAttackMode: "longsword-cut",
}).ok, true);
const mismatch = validateArmoredPlanRuntimeWeaponIdentity({
  plan,
  runtimeWeapon: { id: "unarmed", name: "Unarmed Attack" },
  runtimeAttackMode: "longsword-cut",
});
assert.equal(mismatch.ok, false);
assert.match(mismatch.reason, /weapon/);
const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const runtimeGate = combatPage.indexOf("validateArmoredPlanRuntimeWeaponIdentity({");
const staminaBoundary = combatPage.indexOf('getAttackRollOwnershipBlockReason("attack-roll-pre-stamina")');
assert.ok(runtimeGate >= 0 && runtimeGate < staminaBoundary, "runtime identity must reject before stamina and RNG boundaries");
const rejection = combatPage.slice(runtimeGate, combatPage.indexOf("const validation = validateArmoredTechniqueWeapon", runtimeGate));
assert.match(rejection, /recoverRejectedArmoredActionPlan/);
assert.match(rejection, /armored-plan-runtime-weapon-identity-rejected/);
console.log("armored plan runtime weapon identity test passed");
