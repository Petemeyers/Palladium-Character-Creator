import assert from "node:assert/strict";

import {
  buildCriticalImpactScenario,
  getDamageSeverity,
} from "../src/utils/combat/criticalImpactScenarios.js";

assert.equal(getDamageSeverity({ damageRolled: 85, damageMax: 100 }), "devastating");
assert.equal(getDamageSeverity({ damageRolled: 65, damageMax: 100 }), "severe");
assert.equal(getDamageSeverity({ damageRolled: 40, damageMax: 100 }), "solid");
assert.equal(getDamageSeverity({ damageRolled: 20, damageMax: 100 }), "light");
assert.equal(getDamageSeverity({ damageRolled: 1, damageMax: 100 }), "minor");
assert.equal(getDamageSeverity({ damageRolled: 5 }), "devastating");

for (const severity of ["solid", "severe", "devastating"]) {
  const blunt = buildCriticalImpactScenario({
    attacker: { name: "Guard" },
    defender: { name: "Bandit" },
    weapon: { name: "Mace" },
    location: "head",
    severity,
    damage: 6,
  });
  assert.ok(blunt.effects.some((effect) => effect.type === "DAZED"));
  assert.equal(blunt.effects.some((effect) => effect.type === "BLEEDING"), false);
}

const bluntTorso = buildCriticalImpactScenario({
  weapon: { name: "Club" },
  location: "torso",
  severity: "severe",
});
assert.equal(bluntTorso.effects.some((effect) => effect.type === "BLEEDING"), false);

for (const weapon of ["Long Sword", "Battle Axe", "Spear", "Longbow Arrow", "Crossbow Bolt"]) {
  const scenario = buildCriticalImpactScenario({
    weapon: { name: weapon },
    attackType: weapon.includes("bow") || weapon.includes("Arrow") || weapon.includes("Bolt") ? "ranged" : "melee",
    location: "torso",
    severity: "solid",
    damage: 5,
  });
  assert.ok(
    scenario.effects.some((effect) => effect.type === "BLEEDING"),
    `${weapon} should create bleeding on solid critical`,
  );
}

const minorBlade = buildCriticalImpactScenario({
  weapon: { name: "Dagger" },
  location: "weaponArm",
  severity: "minor",
});
assert.equal(minorBlade.effects.some((effect) => effect.type === "BLEEDING"), false);

const missingNames = buildCriticalImpactScenario({
  weapon: null,
  location: "hands",
  severity: "light",
});
assert.equal(typeof missingNames.text, "string");
assert.ok(missingNames.text.length > 0);

console.log("critical impact scenario tests passed");
