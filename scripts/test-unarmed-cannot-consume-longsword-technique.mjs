import assert from "node:assert/strict";
import { validateArmoredPlanRuntimeWeaponIdentity } from "../src/utils/combat/armoredTechniqueWeaponValidation.js";

for (const technique of ["longsword-cut", "longsword-thrust", "half-sword-thrust", "pommel-or-crossguard-strike"]) {
  const result = validateArmoredPlanRuntimeWeaponIdentity({
    plan: { sourceWeaponId: "long-sword", sourceWeaponName: "Long Sword", resolvedAttackMode: technique },
    runtimeWeapon: { id: "Unarmed Attack", name: "Unarmed Attack", isFallbackUnarmed: true },
    runtimeAttackMode: technique,
  });
  assert.equal(result.ok, false, `${technique} must reject Unarmed Attack`);
}
console.log("unarmed cannot consume longsword technique test passed");
