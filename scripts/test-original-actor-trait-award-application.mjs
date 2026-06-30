import assert from "node:assert/strict";

import SELECTABLE_ACTORS from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import {
  applyAllOriginalTraitAwardProposalsToCombatants,
  applyOriginalTraitAwardProposalToCombatants,
  createOriginalTraitAwardProposalState,
  markOriginalTraitAwardProposalApplied,
} from "../src/utils/originalActorTraitAwardApplication.js";
import { awardOriginalTrait, getOriginalTraits, hasOriginalTrait } from "../src/utils/originalActorTraits.js";

const getActor = (id) => SELECTABLE_ACTORS.find((actor) => actor.id === id);
const combatants = ["longbowman", "hawk", "minotaur"].map((id) => (
  adaptSelectableActorToCombatant(getActor(id)).combatant
));
const combatantsSnapshot = JSON.stringify(combatants);
const savedCharacter = JSON.parse(JSON.stringify(combatants[0]));
const savedCharacterSnapshot = JSON.stringify(savedCharacter);
const proposal = {
  actorId: combatants[0].id,
  actorName: combatants[0].name,
  traitId: "blooded",
  traitName: "Blooded",
  reason: "Survived combat.",
  source: "combat",
};

const result = applyOriginalTraitAwardProposalToCombatants(combatants, proposal);
assert.equal(result.applied, true);
assert.equal(result.status, "applied");
assert.equal(hasOriginalTrait(result.combatants[0], "blooded"), true);
assert.equal(JSON.stringify(combatants), combatantsSnapshot, "application does not mutate source combatants");
assert.equal(result.combatants[1], combatants[1], "unrelated Hawk remains untouched");
assert.equal(result.combatants[2], combatants[2], "unrelated Minotaur remains untouched");
assert.equal(result.combatants[0].attacks[0].name, "Longbow Shot");
assert.equal(result.combatants[0].modelKey, "longbowman");
assert.equal(result.combatants[0].aiRole, "archer");
assert.equal(result.combatants[1].movement.flying, 60);
assert.equal(result.combatants[1].modelKey, "hawk");
assert.equal(result.combatants[2].name, "Minotaur");
assert.equal(result.combatants[2].modelKey, "minotaur");

const duplicateResult = applyOriginalTraitAwardProposalToCombatants(result.combatants, proposal);
assert.equal(duplicateResult.applied, false);
assert.equal(duplicateResult.alreadyApplied, true);
assert.equal(duplicateResult.status, "already_applied");
assert.equal(getOriginalTraits(duplicateResult.combatants[0]).filter((trait) => trait.id === "blooded").length, 1);

const actorWithTrait = awardOriginalTrait(combatants[0], "blooded");
const alreadyAppliedResult = applyOriginalTraitAwardProposalToCombatants(
  [actorWithTrait, combatants[1]],
  proposal
);
assert.equal(alreadyAppliedResult.status, "already_applied");
assert.equal(getOriginalTraits(alreadyAppliedResult.combatants[0]).length, 1);

const pendingState = createOriginalTraitAwardProposalState([proposal]);
assert.equal(pendingState[0].status, "pending");
const appliedState = markOriginalTraitAwardProposalApplied(pendingState, proposal, result, { now: () => 1234 });
assert.equal(appliedState[0].status, "applied");
assert.equal(appliedState[0].appliedAt, 1234);
assert.equal(pendingState[0].status, "pending", "proposal state is updated immutably");
assert.deepEqual(createOriginalTraitAwardProposalState(), [], "new encounter state clears pending and applied awards");

assert.equal(JSON.stringify(savedCharacter), savedCharacterSnapshot, "saved-character data is not written back");
assert.equal(applyOriginalTraitAwardProposalToCombatants(combatants, { ...proposal, actorId: "missing" }).status, "actor_not_found");
assert.equal(applyOriginalTraitAwardProposalToCombatants(combatants, { ...proposal, traitId: "missing" }).status, "invalid_trait");

const bulkProposals = createOriginalTraitAwardProposalState([
  proposal,
  { ...proposal, traitId: "duel_proven", traitName: "Duel Proven" },
  { ...proposal, actorId: "missing", traitId: "scarred_survivor", traitName: "Scarred Survivor" },
]);
const bulkResult = applyAllOriginalTraitAwardProposalsToCombatants(combatants, bulkProposals, { now: () => 5678 });
assert.equal(hasOriginalTrait(bulkResult.combatants[0], "blooded"), true);
assert.equal(hasOriginalTrait(bulkResult.combatants[0], "duel_proven"), true);
assert.deepEqual(bulkResult.proposals.map((entry) => entry.status), ["applied", "applied", "actor_not_found"]);
assert.equal(bulkResult.results.length, 3);
assert.equal(JSON.stringify(combatants), combatantsSnapshot, "bulk application does not mutate combatants");
assert.equal(JSON.stringify(savedCharacter), savedCharacterSnapshot, "bulk application does not save character data");
const bulkDuplicate = applyAllOriginalTraitAwardProposalsToCombatants(
  bulkResult.combatants,
  createOriginalTraitAwardProposalState([proposal])
);
assert.equal(bulkDuplicate.proposals[0].status, "already_applied");
assert.equal(getOriginalTraits(bulkDuplicate.combatants[0]).filter((trait) => trait.id === "blooded").length, 1);

console.log("original actor trait award application tests passed");
