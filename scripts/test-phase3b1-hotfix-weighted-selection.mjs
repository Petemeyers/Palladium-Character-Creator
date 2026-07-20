import assert from "node:assert/strict";

import {
  ARMORED_TECHNIQUES,
  selectArmoredCombatTechnique,
} from "../src/utils/ai/selectArmoredCombatTechnique.js";

const attacker = {
  id: "knight-a",
  name: "Knight A",
  inventory: [{ name: "Dagger" }],
};
const defender = {
  id: "knight-b",
  name: "Knight B",
  armor: { armorClass: "plate", rigidCoverage: true, name: "Plate Harness" },
};
const longSword = { name: "Long Sword", damage: "1d8", range: 5 };

function pick(rngValue, memory = { ineffectiveCutContacts: 1 }) {
  let draws = 0;
  const selection = selectArmoredCombatTechnique({
    attacker,
    defender,
    weapon: longSword,
    distance: 5,
    tacticalMemory: memory,
    rng: () => {
      draws += 1;
      return rngValue;
    },
  });
  return { selection, draws };
}

const low = pick(0.01);
const middle = pick(0.55);
const high = pick(0.92);

assert.equal(low.draws, 1, "eligible armored selection should consume exactly one RNG draw");
assert.equal(middle.draws, 1, "candidate walking should not consume retry RNG");
assert.equal(high.draws, 1, "high roll should still consume exactly one RNG draw");
assert.equal(low.selection.selectedTechnique, ARMORED_TECHNIQUES.LONGSWORD_CUT, "low weighted roll should select first cumulative band");
assert.notEqual(middle.selection.selectedTechnique, low.selection.selectedTechnique, "different weighted rolls should vary selections");
assert.notEqual(high.selection.selectedTechnique, ARMORED_TECHNIQUES.HALF_SWORD_THRUST, "weighted selection should not always choose max score");
assert.ok(middle.selection.totalScore > 0, "developer metadata should include total score");
assert.ok(Array.isArray(middle.selection.cumulativeRanges), "developer metadata should include cumulative ranges");
assert.ok(middle.selection.selectedRange, "developer metadata should include selected cumulative range");

let nonPlateDraws = 0;
const nonPlate = selectArmoredCombatTechnique({
  attacker,
  defender: { ...defender, armor: { armorClass: "leather", rigidCoverage: false } },
  weapon: longSword,
  distance: 5,
  rng: () => {
    nonPlateDraws += 1;
    return 0.5;
  },
});
assert.equal(nonPlate.selectedTechnique, null, "non-plate fight should not use armored technique selection");
assert.equal(nonPlateDraws, 0, "non-plate fight should consume zero armored RNG draws");

const failedGap = pick(0.5, {
  ineffectiveCutContacts: 2,
  failedGapAttempts: 4,
  lastTechnique: ARMORED_TECHNIQUES.HALF_SWORD_THRUST,
  repeatTechniqueCount: 3,
});
const halfSword = failedGap.selection.candidates.find((candidate) => candidate.technique === ARMORED_TECHNIQUES.HALF_SWORD_THRUST);
const grapple = failedGap.selection.candidates.find((candidate) => candidate.technique === ARMORED_TECHNIQUES.GRAPPLE);
const pommel = failedGap.selection.candidates.find((candidate) => candidate.technique === ARMORED_TECHNIQUES.POMMEL_OR_CROSSGUARD);
assert.ok(halfSword.score < 50, "failed gap attempts and repetition should reduce half-sword score");
assert.ok(grapple.score > 30, "failed gap attempts should improve grapple pressure");
assert.ok(pommel.score > 20, "failed gap attempts should improve pommel/crossguard pressure");

console.log("✅ Phase 3B1 hotfix weighted selection tests passed");
