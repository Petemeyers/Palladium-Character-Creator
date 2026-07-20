import assert from "node:assert/strict";

import { selectWeightedCandidate } from "../src/utils/ai/weightedCombatSelection.js";
import { selectArmoredCombatTechnique } from "../src/utils/ai/selectArmoredCombatTechnique.js";

const result = selectWeightedCandidate({
  candidates: [
    { id: "bad-nan", weight: Number.NaN },
    { id: "bad-inf", weight: Infinity },
    { id: "zero", weight: 0 },
    { id: "cut", weight: 0.5 },
    { id: "half", weight: 100.25 },
    { id: "grapple", weight: 30.75 },
  ],
  rng: () => 0.99,
});

assert.equal(result.candidate.id, "grapple", "fractional/large weights should be selected by cumulative normalized draw");
assert.equal(result.rejectedCandidates.length, 3, "NaN, infinite, and zero weights should be rejected diagnostically");
assert.equal(result.totalWeight, 131.5);

const noCandidate = selectWeightedCandidate({
  candidates: [{ id: "zero", weight: 0 }],
  rng: () => {
    throw new Error("rng should not be consumed for all-zero candidates");
  },
});
assert.equal(noCandidate.candidate, null, "all-zero weights should return explicit no-candidate result");

let draws = 0;
const knight = { id: "a", name: "Knight", inventory: [{ name: "Dagger" }] };
const plate = { id: "b", armor: { armorClass: "plate", rigidCoverage: true, name: "Plate Harness" } };
const weapon = { name: "Long Sword", damage: "1d8", range: 5 };
selectArmoredCombatTechnique({
  attacker: knight,
  defender: plate,
  weapon,
  distance: 5,
  tacticalMemory: { ineffectiveCutContacts: 2, failedGapAttempts: 99 },
  rng: () => {
    draws += 1;
    return 0.42;
  },
});
assert.equal(draws, 1, "armored selector should consume exactly one normalized RNG draw regardless of total weight");

let nonPlateDraws = 0;
selectArmoredCombatTechnique({
  attacker: knight,
  defender: { id: "c", armor: { armorClass: "leather" } },
  weapon,
  distance: 5,
  rng: () => {
    nonPlateDraws += 1;
    return 0.5;
  },
});
assert.equal(nonPlateDraws, 0, "non-plate combat should consume zero armored-selection RNG draws");

console.log("✅ Phase 3B1 stabilization weighted RNG contract tests passed");
