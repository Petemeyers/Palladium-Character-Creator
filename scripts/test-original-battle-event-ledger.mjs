import assert from "node:assert/strict";

import {
  ORIGINAL_BATTLE_EVENT_TYPES,
  appendOriginalBattleEvent,
  createOriginalBattleEvent,
  createOriginalBattleEventLedger,
  getOriginalBattleEventsByType,
  getOriginalBattleEventsForActor,
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

console.log("original battle event ledger tests passed");
