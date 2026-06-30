import assert from "node:assert/strict";

import SELECTABLE_ACTORS from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import {
  appendOriginalBattleEvent,
  finalizeOriginalBattleEventLedger,
  getOriginalBattleEventsByType,
  initializeOriginalBattleEventLedger,
} from "../src/utils/originalBattleEventLedger.js";
import {
  createOriginalDamageAwardEventInputs,
  isMythicOrMonsterActor,
} from "../src/utils/originalActorRuntimeAwardEvents.js";
import {
  proposeOriginalTraitAwards,
  summarizeOriginalTraitAwardProposals,
} from "../src/utils/originalActorTraitAwardProposals.js";
import { awardOriginalTrait } from "../src/utils/originalActorTraits.js";

const getSelectableCombatant = (id, options = {}) => {
  const source = SELECTABLE_ACTORS.find((actor) => actor.id === id);
  const result = adaptSelectableActorToCombatant(source, options);
  assert.equal(result.ok, true, `${id} adapts for runtime event tests`);
  return result.combatant;
};

const longbowman = getSelectableCombatant("longbowman", { team: "party", controlMode: "player" });
const hawk = getSelectableCombatant("hawk", { team: "party", controlMode: "player" });
const minotaur = getSelectableCombatant("minotaur", { team: "enemy", controlMode: "ai" });
const referenceSnapshot = JSON.stringify([longbowman, hawk, minotaur]);

assert.equal(isMythicOrMonsterActor(minotaur), true, "Minotaur is classified from existing mythic metadata");
assert.equal(isMythicOrMonsterActor(longbowman), false, "ordinary soldiers are not mythic");
assert.equal(isMythicOrMonsterActor({ originalActorMetadata: { tier: "legendary" } }), true);
assert.doesNotThrow(() => isMythicOrMonsterActor({ tags: [null, {}] }));

const woundedPlayer = {
  ...longbowman,
  id: "player-1",
  name: "Alden",
  currentHP: 2,
  hp: 2,
  HP: 2,
  maxHP: 20,
  status: "active",
};
const damageInputSnapshot = JSON.stringify({ woundedPlayer, minotaur });
const damageEvents = createOriginalDamageAwardEventInputs({
  actor: woundedPlayer,
  sourceActor: minotaur,
  damage: 9,
  hpBefore: 11,
  hpAfter: 2,
  maxHP: 20,
  attackName: "Heavy Axe",
  damageExpression: "2d8+4",
  bodyLocation: "torso",
  wasCritical: true,
  round: 2,
  turn: 4,
});
assert.deepEqual(damageEvents.map((event) => event.type), [
  "actor_damaged",
  "actor_seriously_wounded",
]);
assert.deepEqual(damageEvents[0].details, {
  damage: 9,
  hpBefore: 11,
  hpAfter: 2,
  attackName: "Heavy Axe",
  damageExpression: "2d8+4",
  bodyLocation: "torso",
  wasCritical: true,
});
assert.doesNotThrow(() => JSON.stringify(damageEvents[0].details));
assert.equal(JSON.stringify({ woundedPlayer, minotaur }), damageInputSnapshot, "damage event creation is immutable");

const malformedDamageEvents = createOriginalDamageAwardEventInputs({
  actor: woundedPlayer,
  damage: 1,
  hpBefore: 2,
  hpAfter: 1,
  maxHP: 20,
  attackName: {},
  damageExpression: [],
  bodyLocation: { zone: "arm" },
});
assert.equal(malformedDamageEvents[0].details.attackName, null);
assert.equal(malformedDamageEvents[0].details.damageExpression, null);
assert.equal(malformedDamageEvents[0].details.bodyLocation, null);
assert.deepEqual(createOriginalDamageAwardEventInputs(), [], "missing damage input fails safely");

const defeatedMinotaur = {
  ...minotaur,
  currentHP: 0,
  hp: 0,
  HP: 0,
  status: "unconscious",
};
const finishingEvents = createOriginalDamageAwardEventInputs({
  actor: defeatedMinotaur,
  sourceActor: woundedPlayer,
  damage: 5,
  hpBefore: 4,
  hpAfter: 0,
  maxHP: 52,
  attackName: "Longbow Shot",
});
assert.equal(finishingEvents.some((event) => event.type === "actor_defeated_enemy"), true);
assert.equal(
  finishingEvents.find((event) => event.type === "actor_defeated_enemy").actor.id,
  woundedPlayer.id,
  "the defeating actor owns the direct-combat event"
);

let ledger = initializeOriginalBattleEventLedger({
  combatants: [woundedPlayer, minotaur],
  round: 1,
  turn: 0,
}, { now: () => 100 });
assert.equal(getOriginalBattleEventsByType(ledger, "actor_faced_mythic").length, 1);
for (const event of [...damageEvents, ...finishingEvents]) {
  ledger = appendOriginalBattleEvent(ledger, event, { now: () => 200 });
}
ledger = finalizeOriginalBattleEventLedger(ledger, {
  combatants: [woundedPlayer, defeatedMinotaur],
  round: 2,
  turn: 5,
}, { now: () => 300 });
assert.equal(getOriginalBattleEventsByType(ledger, "actor_survived_mythic_encounter").length, 1);

const proposals = proposeOriginalTraitAwards({
  combatantsBefore: [{ ...woundedPlayer, currentHP: 20, hp: 20, HP: 20 }],
  combatantsAfter: [woundedPlayer, defeatedMinotaur],
  battleEvents: ledger,
});
assert.deepEqual(
  proposals.filter((proposal) => proposal.actorId === woundedPlayer.id).map((proposal) => proposal.traitId).sort(),
  ["blooded", "duel_proven", "monster_dread_tested", "scarred_survivor"].sort(),
  "runtime events enable all safe direct-combat proposals"
);
assert.equal(summarizeOriginalTraitAwardProposals(proposals).length, proposals.length, "the panel summary supports multiple award types");

const actorWithScar = awardOriginalTrait(woundedPlayer, "scarred_survivor");
const duplicateSafe = proposeOriginalTraitAwards({
  combatantsAfter: [actorWithScar],
  battleEvents: [{ type: "actor_seriously_wounded", actorId: actorWithScar.id }],
});
assert.equal(duplicateSafe.some((proposal) => proposal.traitId === "scarred_survivor"), false);

const routedActor = { ...hawk, id: "hawk-routed", status: "fled", fled: true, currentHP: 3 };
const routedLedger = finalizeOriginalBattleEventLedger(
  initializeOriginalBattleEventLedger({ combatants: [routedActor] }),
  { combatants: [routedActor] }
);
assert.equal(getOriginalBattleEventsByType(routedLedger, "actor_routed").length, 1);
assert.equal(getOriginalBattleEventsByType(routedLedger, "actor_retreat_survived").length, 1);
assert.equal(
  proposeOriginalTraitAwards({ combatantsAfter: [routedActor], battleEvents: routedLedger })
    .some((proposal) => proposal.traitId === "rout_survivor"),
  true
);

const deadActor = { ...woundedPlayer, id: "dead-1", currentHP: -30, status: "dead", isDead: true };
assert.deepEqual(proposeOriginalTraitAwards({
  combatantsAfter: [deadActor],
  battleEvents: [{ type: "actor_seriously_wounded", actorId: deadActor.id }],
}), []);
const passiveActor = { ...woundedPlayer, id: "passive-1", controlMode: "passive" };
assert.deepEqual(proposeOriginalTraitAwards({
  combatantsAfter: [passiveActor],
  battleEvents: [{ type: "actor_defeated_enemy", actorId: passiveActor.id }],
}), []);

assert.equal(JSON.stringify([longbowman, hawk, minotaur]), referenceSnapshot, "runtime award helpers preserve actors");
assert.equal(longbowman.attacks[0].name, "Longbow Shot");
assert.equal(hawk.movement.flying, 60);
assert.equal(minotaur.name, "Minotaur");
assert.equal(minotaur.modelKey, "minotaur");

console.log("original actor runtime award event tests passed");
