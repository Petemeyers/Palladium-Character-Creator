import assert from "node:assert/strict";

import {
  ARMORED_TECHNIQUES,
  buildArmoredTechniqueAttack,
  selectArmoredCombatTechnique,
} from "../src/utils/ai/selectArmoredCombatTechnique.js";

const knight = {
  id: "a",
  name: "Knight",
  inventory: [{ name: "Dagger" }],
};
const plateTarget = {
  id: "b",
  name: "Plate Knight",
  armor: { armorClass: "plate", rigidCoverage: true, armorName: "Plate Harness" },
};
const nonPlateTarget = {
  id: "c",
  name: "Unarmored",
  armor: { armorClass: "none", rigidCoverage: false },
};
const longSword = { name: "Long Sword", damage: "1d8", type: "melee", range: 5 };

const initial = selectArmoredCombatTechnique({
  attacker: knight,
  defender: plateTarget,
  weapon: longSword,
  distance: 5,
});
assert.ok(
  initial.candidates.find((candidate) => candidate.technique === ARMORED_TECHNIQUES.LONGSWORD_CUT)?.score > 0,
  "ordinary cut should remain eligible before plate confirmation",
);

const afterOne = selectArmoredCombatTechnique({
  attacker: knight,
  defender: plateTarget,
  weapon: longSword,
  distance: 5,
  tacticalMemory: { ineffectiveCutContacts: 1 },
});
assert.equal(
  afterOne.candidates.find((candidate) => candidate.technique === ARMORED_TECHNIQUES.LONGSWORD_CUT)?.baseScore,
  5,
  "ordinary cut weight should be sharply reduced after one ineffective cut",
);
assert.ok(
  afterOne.candidates.find((candidate) => candidate.technique === ARMORED_TECHNIQUES.HALF_SWORD_THRUST)?.score >= 40,
  "half-sword should become favored after a stopped cut",
);

const repeated = selectArmoredCombatTechnique({
  attacker: knight,
  defender: plateTarget,
  weapon: longSword,
  distance: 5,
  tacticalMemory: { ineffectiveCutContacts: 2 },
  rng: () => 0,
});
assert.notEqual(repeated.selectedTechnique, ARMORED_TECHNIQUES.LONGSWORD_CUT, "repeated stopped cuts must not keep selecting cuts");
assert.ok(
  repeated.candidates.find((candidate) => candidate.technique === ARMORED_TECHNIQUES.POMMEL_OR_CROSSGUARD),
  "pommel/crossguard should be eligible",
);
assert.ok(
  repeated.candidates.find((candidate) => candidate.technique === ARMORED_TECHNIQUES.GRAPPLE),
  "grapple should be eligible",
);

const vulnerable = selectArmoredCombatTechnique({
  attacker: knight,
  defender: { ...plateTarget, statusEffects: ["OFF_BALANCE"] },
  weapon: longSword,
  distance: 5,
  tacticalMemory: { ineffectiveCutContacts: 1 },
});
assert.ok(
  vulnerable.candidates.find((candidate) => candidate.technique === ARMORED_TECHNIQUES.GRAPPLE)?.score >
    afterOne.candidates.find((candidate) => candidate.technique === ARMORED_TECHNIQUES.GRAPPLE)?.score,
  "off-balance target should improve grapple scoring",
);

let rngConsumed = false;
const nonPlate = selectArmoredCombatTechnique({
  attacker: knight,
  defender: nonPlateTarget,
  weapon: longSword,
  distance: 5,
  rng: () => {
    rngConsumed = true;
    return 0;
  },
});
assert.equal(nonPlate.selectedTechnique, null, "non-plate fights should not use armored selection");
assert.equal(rngConsumed, false, "non-plate fights must not consume armored-technique RNG");

const halfSword = buildArmoredTechniqueAttack(longSword, ARMORED_TECHNIQUES.HALF_SWORD_THRUST);
assert.equal(halfSword.attackMode, ARMORED_TECHNIQUES.HALF_SWORD_THRUST, "half-sword mode should be carried by attack payload");
assert.equal(halfSword.damageType, "piercing", "half-sword should use piercing damage type");

const pommel = buildArmoredTechniqueAttack(longSword, ARMORED_TECHNIQUES.POMMEL_OR_CROSSGUARD);
assert.equal(pommel.damageType, "blunt", "pommel/crossguard should use blunt damage type");

console.log("✅ Phase 3B1 armored technique selection tests passed");
