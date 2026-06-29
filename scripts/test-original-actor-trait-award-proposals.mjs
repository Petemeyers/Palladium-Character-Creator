import assert from "node:assert/strict";

import SELECTABLE_ACTORS from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { awardOriginalTrait } from "../src/utils/originalActorTraits.js";
import { proposeOriginalTraitAwards } from "../src/utils/originalActorTraitAwardProposals.js";

const before = [
  {
    id: "guard-1",
    name: "Alden",
    currentHP: 14,
    controlMode: "manual",
    originalActorMetadata: { state: { wounds: [] }, traits: [] },
  },
  awardOriginalTrait({ id: "veteran-1", name: "Bera", currentHP: 12 }, "blooded"),
  { id: "fallen-1", name: "Cadan", currentHP: 10 },
];
const after = [
  {
    ...before[0],
    currentHP: 5,
    routed: true,
    originalActorMetadata: {
      ...before[0].originalActorMetadata,
      state: { wounds: [{ id: "wound-1", location: "arm" }] },
    },
  },
  { ...before[1], currentHP: 8 },
  { ...before[2], currentHP: -30, status: "dead", isDead: true },
];
const beforeSnapshot = JSON.stringify(before);
const afterSnapshot = JSON.stringify(after);

const proposals = proposeOriginalTraitAwards({
  combatantsBefore: before,
  combatantsAfter: after,
  battleEvents: [
    { type: "line-held", actorId: "guard-1", reason: "Held the bridge line while allies withdrew." },
    { type: "duel_won", winnerId: "guard-1" },
    { type: "oath_kept", actorId: "veteran-1" },
    { traitId: "village_defender", actorId: "guard-1", confidence: "medium" },
    { traitId: "not_seeded", actorId: "guard-1" },
  ],
  context: { participantActorIds: ["guard-1", "veteran-1", "fallen-1"] },
});

const guardTraits = proposals.filter((proposal) => proposal.actorId === "guard-1");
assert.deepEqual(
  guardTraits.map((proposal) => proposal.traitId).sort(),
  ["blooded", "duel_proven", "line_holder", "rout_survivor", "scarred_survivor", "village_defender"].sort(),
  "survival, state deltas, and explicit events produce proposals",
);
assert.equal(guardTraits.find((proposal) => proposal.traitId === "blooded").reason, "Survived combat and did not already have Blooded.");
assert.equal(guardTraits.find((proposal) => proposal.traitId === "village_defender").confidence, "medium");
assert.deepEqual(
  Object.keys(guardTraits[0]),
  ["actorId", "actorName", "traitId", "traitName", "reason", "layer", "source", "confidence"],
  "proposal shape is display-safe and stable",
);
assert.equal(proposals.some((proposal) => proposal.actorId === "veteran-1" && proposal.traitId === "blooded"), false, "existing traits are not proposed twice");
assert.equal(proposals.some((proposal) => proposal.actorId === "veteran-1" && proposal.traitId === "oath_fast"), true);
assert.equal(proposals.some((proposal) => proposal.actorId === "fallen-1"), false, "dead actors do not receive survival proposals");
assert.equal(JSON.stringify(before), beforeSnapshot, "before actors are not mutated");
assert.equal(JSON.stringify(after), afterSnapshot, "after actors are not mutated");

assert.deepEqual(proposeOriginalTraitAwards(), [], "missing input is safe");
assert.deepEqual(
  proposeOriginalTraitAwards({ combatantsBefore: null, combatantsAfter: {}, battleEvents: "bad" }),
  [],
  "malformed collections are safe",
);

const passiveProposals = proposeOriginalTraitAwards({
  combatantsAfter: [{ id: "civilian-1", name: "Civilian", controlMode: "passive", currentHP: 5 }],
});
assert.deepEqual(passiveProposals, [], "passive actors are not assumed to have participated");

const getActor = (id) => SELECTABLE_ACTORS.find((actor) => actor.id === id);
const referenceActors = ["longbowman", "hawk", "minotaur"].map((id) =>
  adaptSelectableActorToCombatant(getActor(id)).combatant
);
const referenceSnapshot = JSON.stringify(referenceActors);
const referenceProposals = proposeOriginalTraitAwards({ combatantsAfter: referenceActors });
assert.equal(referenceProposals.filter((proposal) => proposal.traitId === "blooded").length, 3);
assert.equal(JSON.stringify(referenceActors), referenceSnapshot, "reference actors remain unchanged by proposal generation");
assert.equal(referenceActors[0].attacks[0].name, "Longbow Shot");
assert.equal(referenceActors[1].movement.flying, 60);
assert.equal(referenceActors[2].name, "Minotaur");

console.log("original actor trait award proposal tests passed");
