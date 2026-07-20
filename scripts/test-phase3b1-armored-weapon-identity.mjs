import assert from "node:assert/strict";

import {
  resolveArmoredCombatAction,
} from "../src/utils/ai/resolveArmoredCombatAction.js";
import {
  ARMORED_TECHNIQUES,
  buildArmoredTechniqueAttack,
} from "../src/utils/ai/selectArmoredCombatTechnique.js";
import {
  validateArmoredTechniqueWeapon,
} from "../src/utils/combat/armoredTechniqueWeaponValidation.js";
import {
  createArmoredActionPlanRegistry,
  markArmoredActionPlanDispatched,
  markArmoredActionPlanTerminal,
  registerArmoredActionPlan,
} from "../src/utils/combat/armoredActionPlanRegistry.js";

const longSword = { id: "long-sword-1", name: "Long Sword", damage: "1d8" };
const dagger = { id: "dagger-1", name: "Dagger", damage: "1d4" };
const unarmed = { id: "unarmed", name: "Unarmed Attack", damage: "1" };

for (const technique of [
  ARMORED_TECHNIQUES.LONGSWORD_THRUST,
  ARMORED_TECHNIQUES.HALF_SWORD_THRUST,
  ARMORED_TECHNIQUES.POMMEL_OR_CROSSGUARD,
]) {
  const attack = buildArmoredTechniqueAttack(longSword, technique);
  assert.equal(attack.sourceWeaponName, "Long Sword");
  assert.equal(attack.sourceWeaponId, "long-sword-1");
  assert.equal(validateArmoredTechniqueWeapon({ selectedTechnique: technique, sourceWeapon: longSword }).ok, true);
  assert.equal(validateArmoredTechniqueWeapon({ selectedTechnique: technique, sourceWeapon: dagger }).ok, false);
  assert.equal(validateArmoredTechniqueWeapon({ selectedTechnique: technique, sourceWeapon: unarmed }).ok, false);
}

const pommel = buildArmoredTechniqueAttack(longSword, ARMORED_TECHNIQUES.POMMEL_OR_CROSSGUARD);
assert.equal(pommel.name, "Pommel Strike");
assert.equal(pommel.damageType, "blunt");
assert.equal(pommel.sourceWeaponName, "Long Sword");
assert.notEqual(pommel.name, "Unarmed Attack");

const logs = [];
const action = resolveArmoredCombatAction({
  attacker: { id: "a", name: "Knight A" },
  defender: { id: "d", name: "Knight D", armorProfile: { armorClass: "plate", rigidCoverage: true } },
  selectedWeapon: longSword,
  distance: 5,
  generationId: "g",
  round: 1,
  initiativeIndex: 0,
  turnToken: "turn-token-a",
  rng: () => 0.45,
  addLog: (entry) => logs.push(entry),
});
assert.equal(action.weapon.armoredActionPlan.sourceWeaponName, "Long Sword");
assert.equal(action.weapon.armoredActionPlan.sourceWeaponId, "long-sword-1");
assert.ok(action.weapon.armoredActionPlan.selectionId);

const registry = createArmoredActionPlanRegistry();
assert.equal(registerArmoredActionPlan(registry, action.weapon.armoredActionPlan).ok, true);
assert.equal(markArmoredActionPlanDispatched(registry, action.weapon.armoredActionPlan.selectionId).ok, true);
assert.equal(markArmoredActionPlanTerminal(registry, action.weapon.armoredActionPlan.selectionId, "consumed").ok, true);
assert.equal(
  markArmoredActionPlanTerminal(registry, action.weapon.armoredActionPlan.selectionId, "consumed").ok,
  false,
  "consumed plan cannot be reused",
);

console.log("✅ Phase 3B1 armored weapon identity tests passed");
