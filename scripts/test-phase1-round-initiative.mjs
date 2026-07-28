import assert from "node:assert/strict";
import {
  calculateInitiativeBonus,
  getPrimaryInitiativeWeapon,
  isInitiativeEligible,
  rollRoundInitiative,
} from "../src/utils/combat/roundInitiative.js";

let assertions = 0;
const check = (condition, message) => {
  assertions += 1;
  assert.ok(condition, message);
};

function sequenceRng(values) {
  let index = 0;
  return () => values[index++];
}

const knight = {
  id: "knight",
  name: "Knight",
  currentHP: 20,
  attributes: { PP: 16, Spd: 30 },
  initiativeBonus: 2,
  equistaminadWeapons: [{ id: "dagger", name: "Dagger", length: 1, type: "SHORT" }],
  remainingActions: 0,
  actionsPerRound: 2,
};
const guard = {
  id: "guard",
  name: "Guard",
  currentHP: 18,
  attributes: { PP: 10, Spd: 80 },
  initiativeBonus: 0,
  equistaminadWeapons: [],
  remainingActions: 0,
  actionsPerRound: 1,
};

const firstRound = rollRoundInitiative(
  [knight, guard],
  { round: 1 },
  sequenceRng([4, 15]),
);
check(firstRound[0].id === "guard", "combat start sorts every eligible fighter by its fresh roll");
check(firstRound.every((fighter) => fighter.initiativeRound === 1), "combat start records round 1 metadata");
check(firstRound.every((fighter) => fighter.initiativeRoll !== null), "every eligible fighter rolls at combat start");

const secondRound = rollRoundInitiative(
  firstRound,
  { round: 2 },
  sequenceRng([1, 20]),
);
check(secondRound[0].id === "knight", "a new round can produce a different order");
check(secondRound[0].initiativeRoll === 20, "the old initiative roll is not reused");
check(secondRound[0].initiativeRound === 2, "the new order records the new round");

const bonus = calculateInitiativeBonus(knight, { round: 2 });
check(bonus.physicalProwessModifier === 3, "Physical Prowess uses the canonical ability modifier");
check(bonus.combatTrainingBonus === 2, "persistent combat-training initiative applies");
check(bonus.weaponMeasureModifier === 1, "the active short weapon contributes the existing measure modifier");
check(bonus.total === 6, "initiative bonus includes training, Physical Prowess, and weapon measure");
check(calculateInitiativeBonus(guard, { round: 2 }).physicalProwessModifier === 0, "movement Speed does not replace Physical Prowess");
check(
  calculateInitiativeBonus({ ...knight, dex: 4, attributes: { PP: 16, Spd: 80 } }, { round: 2 })
    .physicalProwessModifier === 3,
  "explicit Physical Prowess remains primary when a separate dexterity field is present",
);
check(getPrimaryInitiativeWeapon(knight)?.id === "dagger", "array-shaped equipped weapons resolve to the active weapon");
check(getPrimaryInitiativeWeapon(guard) === null, "an unarmed fighter has no initiative weapon and does not crash");

const routed = { ...guard, id: "routed", moraleState: { status: "ROUTED", hasFled: false } };
const ineligible = [
  { ...guard, id: "dead", status: "dead", currentHP: 0 },
  { ...guard, id: "unconscious", condition: "unconscious" },
  { ...guard, id: "fled", moraleState: { status: "FLED", hasFled: true } },
  { ...guard, id: "surrendered", surrenderState: { status: "accepted" } },
  { ...guard, id: "captured", isCaptured: true },
];
check(isInitiativeEligible(routed), "a routed fighter remains eligible to spend its turn fleeing");
ineligible.forEach((fighter) => {
  check(!isInitiativeEligible(fighter), `${fighter.id} is ineligible`);
});
const eligibilityRound = rollRoundInitiative(
  [routed, ...ineligible],
  { round: 3 },
  sequenceRng([12]),
);
check(eligibilityRound[0].id === "routed", "the first actionable slot is the eligible routed fighter");
check(eligibilityRound.slice(1).every((fighter) => fighter.initiativeRoll === null), "ineligible fighters do not roll");
check(eligibilityRound.slice(1).every((fighter) => fighter.remainingActions === 0), "ineligible fighters receive no action budget");

const ties = rollRoundInitiative(
  [{ ...guard, id: "alpha" }, { ...guard, id: "beta" }],
  { round: 4 },
  sequenceRng([10, 10, 3, 17]),
);
check(ties[0].id === "beta", "a separate tie-break roll orders identical totals");
check(ties.every((fighter) => fighter.initiativeTotal === 10), "tie breakers do not inflate visible totals");
check(ties[0].initiativeTieBreaker === 17, "the hidden tie-break value is recorded separately");

const frightened = {
  ...knight,
  id: "frightened",
  meta: { horrorInitPenalty: -2, horrorFailedRound: 1 },
};
const fearRound = rollRoundInitiative([frightened], { round: 2 }, sequenceRng([10]));
check(fearRound[0].initiativeBreakdown.temporaryModifier === -2, "a pending one-use horror penalty applies");
check(fearRound[0].meta.horrorInitPenalty === undefined, "the one-use horror penalty is consumed after rolling");
const laterRound = rollRoundInitiative(fearRound, { round: 3 }, sequenceRng([10]));
check(laterRound[0].initiativeBreakdown.temporaryModifier === 0, "the consumed horror penalty does not persist");
check(laterRound[0].initiativeBreakdown.combatTrainingBonus === 2, "persistent training remains on later rounds");

check(knight.remainingActions === 0, "initiative calculation does not restore or spend actions");
check(!("attack" in firstRound[0]), "initiative rolling does not trigger an attack");

console.log(`Phase 1 round initiative: ${assertions}/${assertions} assertions passed`);
