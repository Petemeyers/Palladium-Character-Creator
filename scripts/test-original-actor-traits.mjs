import assert from "node:assert/strict";

import SELECTABLE_ACTORS from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import {
  ORIGINAL_TRAIT_DEFINITIONS,
  awardOriginalTrait,
  awardOriginalTraits,
  getOriginalTraits,
  hasOriginalTrait,
} from "../src/utils/originalActorTraits.js";

const SEEDED_TRAIT_IDS = [
  "blooded",
  "line_holder",
  "rout_survivor",
  "scarred_survivor",
  "duel_proven",
  "monster_dread_tested",
  "oath_fast",
  "oathbreaker",
  "village_defender",
];

SEEDED_TRAIT_IDS.forEach((traitId) => {
  const definition = ORIGINAL_TRAIT_DEFINITIONS[traitId];
  assert.ok(definition, `${traitId} definition should exist`);
  ["id", "name", "layer", "rank", "source", "description", "effects", "drawbacks"].forEach((field) => {
    assert.notEqual(definition[field], undefined, `${traitId} should define ${field}`);
  });
});

const legacyActor = {
  id: "legacy-guard",
  name: "Legacy Guard",
  team: "party",
  controlMode: "manual",
  playable: true,
  modelKey: "guard",
  aiRole: "defensive",
  HP: 18,
  guardRating: 15,
  PS: 14,
  PP: 12,
  PE: 13,
  movementModes: ["ground"],
  movement: 30,
  attacks: [{ name: "Spear Thrust", damage: "1d6+2" }],
  legacyFlag: "preserved",
};
const legacySnapshot = JSON.stringify(legacyActor);
const bloodedActor = awardOriginalTrait(legacyActor, "blooded");

assert.notEqual(bloodedActor, legacyActor, "trait award returns a cloned actor");
assert.equal(JSON.stringify(legacyActor), legacySnapshot, "trait award does not mutate the source actor");
assert.ok(bloodedActor.originalActorMetadata, "trait award ensures original metadata exists");
assert.equal(hasOriginalTrait(bloodedActor, "blooded"), true);
assert.equal(getOriginalTraits(bloodedActor).find((trait) => trait.id === "blooded").name, "Blooded");
assert.equal(bloodedActor.team, legacyActor.team);
assert.equal(bloodedActor.controlMode, legacyActor.controlMode);
assert.equal(bloodedActor.playable, legacyActor.playable);
assert.equal(bloodedActor.HP, legacyActor.HP);
assert.equal(bloodedActor.guardRating, legacyActor.guardRating);
assert.equal(bloodedActor.aiRole, legacyActor.aiRole);
assert.equal(bloodedActor.modelKey, legacyActor.modelKey);
assert.deepEqual(bloodedActor.attacks, legacyActor.attacks);
assert.deepEqual(bloodedActor.movementModes, legacyActor.movementModes);
assert.equal(bloodedActor.PS, legacyActor.PS);
assert.equal(bloodedActor.legacyFlag, "preserved");

const duplicateAward = awardOriginalTrait(bloodedActor, "blooded");
assert.equal(getOriginalTraits(duplicateAward).filter((trait) => trait.id === "blooded").length, 1, "duplicate awards do not duplicate ids");
assert.equal(getOriginalTraits(duplicateAward).find((trait) => trait.id === "blooded").rank, 1);

const rankedAward = awardOriginalTrait(duplicateAward, "blooded", { incrementRank: true });
assert.equal(getOriginalTraits(rankedAward).find((trait) => trait.id === "blooded").rank, 2, "rank increments only when requested");

const multipleAwards = awardOriginalTraits(legacyActor, ["line_holder", "village_defender"]);
assert.equal(hasOriginalTrait(multipleAwards, "line_holder"), true);
assert.equal(hasOriginalTrait(multipleAwards, "village_defender"), true);
assert.notEqual(awardOriginalTraits(legacyActor, []), legacyActor, "empty batch still returns a normalized clone");

const getActor = (id) => SELECTABLE_ACTORS.find((actor) => actor.id === id);

const longbowman = adaptSelectableActorToCombatant(getActor("longbowman")).combatant;
const awardedLongbowman = awardOriginalTrait(longbowman, "blooded");
assert.equal(awardedLongbowman.modelKey, "longbowman");
assert.equal(awardedLongbowman.aiRole, "archer");
assert.equal(awardedLongbowman.attacks[0].name, "Longbow Shot");
assert.equal(awardedLongbowman.attacks[0].rangeProfile.normal, 150);
assert.equal(awardedLongbowman.inventory.find((item) => item.name === "Arrows").quantity, 20);

const hawk = adaptSelectableActorToCombatant(getActor("hawk")).combatant;
const awardedHawk = awardOriginalTrait(hawk, "monster_dread_tested");
assert.ok(awardedHawk.movementModes.includes("flying"));
assert.equal(awardedHawk.movement.flying, 60);
assert.equal(awardedHawk.abilities.movement.flight.active, true);
assert.equal(awardedHawk.modelKey, "hawk");

const minotaur = adaptSelectableActorToCombatant(getActor("minotaur")).combatant;
const awardedMinotaur = awardOriginalTrait(minotaur, "duel_proven");
assert.equal(awardedMinotaur.name, "Minotaur");
assert.equal(awardedMinotaur.category, "mythic");
assert.equal(awardedMinotaur.aiRole, "brute");
assert.equal(awardedMinotaur.modelKey, "minotaur");
assert.equal(awardedMinotaur.attacks.find((attack) => attack.name === "Heavy Axe").reach, 10);

assert.throws(() => awardOriginalTrait(legacyActor, "unknown_trait"), /Unknown original trait/);

console.log("original actor trait award tests passed");
