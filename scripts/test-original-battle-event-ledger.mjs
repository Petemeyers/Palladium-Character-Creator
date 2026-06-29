import assert from "node:assert/strict";

import {
  ORIGINAL_BATTLE_EVENT_TYPES,
  appendOriginalBattleEvent,
  createOriginalBattleEvent,
  createOriginalBattleEventLedger,
  finalizeOriginalBattleEventLedger,
  getOriginalBattleEventsByType,
  getOriginalBattleEventsForActor,
  initializeOriginalBattleEventLedger,
} from "../src/utils/originalBattleEventLedger.js";
import { proposeOriginalTraitAwards } from "../src/utils/originalActorTraitAwardProposals.js";

const actor = { id: "guard-1", name: "Alden", currentHP: 12 };
const sourceActor = { id: "raider-1", name: "Raider" };
const details = { damage: 4, damageType: "cutting", nested: { location: "arm" } };
const detailsSnapshot = JSON.stringify(details);

const event = createOriginalBattleEvent({
  type: "actor-damaged",
  actor,
  sourceActor,
  round: 1,
  turn: 2,
  details,
}, {
  now: () => 123456789,
  idFactory: () => "event-1",
});

assert.deepEqual(event, {
  id: "event-1",
  type: "actor_damaged",
  actorId: "guard-1",
  actorName: "Alden",
  sourceActorId: "raider-1",
  sourceActorName: "Raider",
  round: 1,
  turn: 2,
  timestamp: 123456789,
  details,
});
assert.notEqual(event.details, details, "event details are cloned");
assert.notEqual(event.details.nested, details.nested, "nested event details are cloned");
assert.equal(JSON.stringify(details), detailsSnapshot, "event creation does not mutate details");

const initialLedger = createOriginalBattleEventLedger([], { now: () => 1000 });
const ledgerWithDamage = appendOriginalBattleEvent(initialLedger, event);
const ledger = appendOriginalBattleEvent(ledgerWithDamage, {
  type: ORIGINAL_BATTLE_EVENT_TYPES.DUEL_WON,
  actorId: "guard-1",
  actorName: "Alden",
  round: 3,
  turn: 6,
  details: { opponentId: "raider-1" },
}, {
  now: () => 123456790,
  idFactory: ({ sequence }) => `event-${sequence + 1}`,
});

assert.deepEqual(initialLedger, [], "append does not mutate the source ledger");
assert.equal(ledgerWithDamage.length, 1);
assert.equal(ledger.length, 2);
assert.equal(ledger[1].id, "event-2");
assert.equal(ledger[1].type, "duel_won");
assert.equal(getOriginalBattleEventsByType(ledger, "actor damaged").length, 1);
assert.equal(getOriginalBattleEventsForActor(ledger, "guard-1").length, 2);
assert.equal(getOriginalBattleEventsForActor(ledger, "raider-1").length, 0);
assert.equal(getOriginalBattleEventsForActor(ledger, "raider-1", { includeAsSource: true }).length, 1);

const proposals = proposeOriginalTraitAwards({
  combatantsBefore: [actor],
  combatantsAfter: [{ ...actor, currentHP: 8 }],
  battleEvents: ledger,
});
assert.equal(proposals.some((proposal) => proposal.traitId === "blooded"), true);
assert.equal(proposals.some((proposal) => proposal.traitId === "duel_proven"), true, "ledger events feed proposal generation");

const noSource = createOriginalBattleEvent({
  id: "event-no-source",
  type: "encounter started",
  actorId: "",
  actorName: "Encounter",
  details: { map: "ford" },
  timestamp: 50,
});
assert.equal(noSource.sourceActorId, null);
assert.equal(noSource.sourceActorName, null);
assert.equal(noSource.type, "encounter_started");

const circular = {};
circular.self = circular;
assert.deepEqual(createOriginalBattleEvent({ type: "test", details: circular }).details, {}, "circular details fail safely");
assert.deepEqual(createOriginalBattleEventLedger(null), []);
assert.deepEqual(getOriginalBattleEventsForActor(null, "guard-1"), []);

const longbowman = {
  id: "longbowman-1",
  name: "Longbowman",
  currentHP: 18,
  controlMode: "ai",
  modelKey: "longbowman",
  aiRole: "archer",
  attacks: [{ name: "Longbow Shot", rangeProfile: { normal: 150 } }],
};
const hawk = {
  id: "hawk-1",
  name: "Hawk",
  currentHP: 4,
  controlMode: "ai",
  modelKey: "hawk",
  movementModes: ["walking", "flying"],
  movement: { walking: 10, flying: 60 },
};
const minotaur = {
  id: "minotaur-1",
  name: "Minotaur",
  currentHP: 0,
  status: "defeated",
  controlMode: "ai",
  modelKey: "minotaur",
  category: "mythic",
  aiRole: "brute",
};
const passiveObserver = {
  id: "observer-1",
  name: "Observer",
  currentHP: 5,
  controlMode: "passive",
};
const combatants = [longbowman, hawk, minotaur, passiveObserver];
const combatantsSnapshot = JSON.stringify(combatants);
const lifecycleLedger = initializeOriginalBattleEventLedger({ combatants }, { now: () => 2000 });

assert.equal(getOriginalBattleEventsByType(lifecycleLedger, "combat_started").length, 1);
assert.equal(getOriginalBattleEventsByType(lifecycleLedger, "actor_entered_combat").length, 3);
assert.equal(
  getOriginalBattleEventsForActor(lifecycleLedger, "observer-1").length,
  0,
  "passive actors are not initial combat participants"
);

const completedLifecycleLedger = finalizeOriginalBattleEventLedger(lifecycleLedger, {
  combatants,
  round: 2,
  turn: 7,
}, { now: () => 3000 });
assert.equal(getOriginalBattleEventsByType(completedLifecycleLedger, "combat_ended").length, 1);
assert.equal(getOriginalBattleEventsByType(completedLifecycleLedger, "actor_survived_combat").length, 2);
assert.equal(getOriginalBattleEventsByType(completedLifecycleLedger, "actor_defeated").length, 1);
assert.equal(JSON.stringify(combatants), combatantsSnapshot, "ledger lifecycle does not mutate combatants");
assert.equal(longbowman.attacks[0].rangeProfile.normal, 150);
assert.equal(longbowman.modelKey, "longbowman");
assert.equal(longbowman.aiRole, "archer");
assert.deepEqual(hawk.movementModes, ["walking", "flying"]);
assert.equal(hawk.movement.flying, 60);
assert.equal(hawk.modelKey, "hawk");
assert.equal(minotaur.name, "Minotaur");
assert.equal(minotaur.category, "mythic");
assert.equal(minotaur.aiRole, "brute");
assert.equal(minotaur.modelKey, "minotaur");

const survivorOnlyProposal = proposeOriginalTraitAwards({
  combatantsBefore: [longbowman],
  combatantsAfter: [],
  battleEvents: getOriginalBattleEventsForActor(completedLifecycleLedger, "longbowman-1"),
});
assert.equal(
  survivorOnlyProposal.some((proposal) => proposal.traitId === "blooded"),
  true,
  "encounter-end survivor events feed trait proposals"
);

const finalizedAgain = finalizeOriginalBattleEventLedger(completedLifecycleLedger, { combatants });
assert.equal(
  getOriginalBattleEventsByType(finalizedAgain, "combat_ended").length,
  1,
  "ledger finalization is idempotent"
);

console.log("original battle event ledger tests passed");
