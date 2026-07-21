import assert from "node:assert/strict";
import { normalizeAlignmentBehavior, hasAlignmentBehaviorMapping } from "../src/utils/behavior/normalizeAlignmentBehavior.js";
import { scoreSurrenderTreatment } from "../src/utils/combat/surrenderState.js";

const first = normalizeAlignmentBehavior("neutral-good");
const second = normalizeAlignmentBehavior(first);
assert.deepEqual(first, second);
assert.equal(first.alignmentKey, "neutral-good");
assert.equal(first.alignmentName, "Neutral Good");
assert.equal(first.lawChaosAxis, "neutral");
assert.equal(first.goodEvilAxis, "good");
for (const field of ["honor", "mercy", "discipline", "greed", "cruelty", "pride", "executionWeight"]) {
  assert.equal(Number.isFinite(first[field]), true, field);
}
for (const label of ["Principled", "Scrupulous", "Unprincipled", "Anarchist", "Miscreant", "Aberrant", "Diabolic", "Lawful Good", "Chaotic Evil"]) {
  assert.equal(hasAlignmentBehaviorMapping(label), true, label);
}
assert.equal(normalizeAlignmentBehavior("Scrupulous").alignmentKey, "neutral-good");
assert.equal(normalizeAlignmentBehavior("Diabolic").alignmentKey, "chaotic-evil");
assert.equal(hasAlignmentBehaviorMapping("Unknown Philosophical School"), false);
const merciful = scoreSurrenderTreatment({ responder: { alignment: "Scrupulous", traits: ["merciful"] }, prisonerValue: 2, guardsPresent: 1, witnessesPresent: 1 });
const ruthless = scoreSurrenderTreatment({ responder: { alignment: "Diabolic", traits: ["cruel"] }, orders: "no quarter" });
assert.notEqual(merciful.treatment, "execute");
assert.ok(ruthless.treatmentScores.execute > merciful.treatmentScores.execute);
assert.ok(merciful.treatmentScores.execute > -Infinity);
console.log("Phase 3C0 alignment normalization passed");
