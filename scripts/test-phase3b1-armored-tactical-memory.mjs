import assert from "node:assert/strict";

import {
  clearArmoredTacticalMemoryForGeneration,
  clearArmoredTacticalMemoryStore,
  getArmoredTacticalMemory,
  recordArmorContactOutcome,
} from "../src/utils/combat/armoredTacticalMemory.js";

const store = new Map();

const args = {
  generationId: "battle-a",
  attackerId: "knight-a",
  defenderId: "knight-b",
  round: 1,
  turn: 4,
};

const first = recordArmorContactOutcome(store, args, {
  attackMode: "longsword-cut",
  contactType: "solid-plate",
  damageAllowed: false,
});

assert.equal(first.solidPlateContacts, 1, "solid plate contact should be recorded");
assert.equal(first.ineffectiveCutContacts, 1, "stopped longsword cut should count as ineffective cut");

const samePairNextRound = getArmoredTacticalMemory(store, {
  ...args,
  round: 2,
  turn: 1,
});
assert.equal(samePairNextRound.ineffectiveCutContacts, 1, "memory should persist into later rounds in same generation");

const differentTarget = getArmoredTacticalMemory(store, {
  generationId: "battle-a",
  attackerId: "knight-a",
  defenderId: "knight-c",
});
assert.equal(differentTarget.ineffectiveCutContacts, 0, "memory must be attacker/target specific");

recordArmorContactOutcome(store, args, {
  attackMode: "half-sword-thrust",
  contactType: "solid-plate",
  damageAllowed: false,
  gapReached: false,
});
assert.equal(
  getArmoredTacticalMemory(store, args).failedGapAttempts,
  1,
  "failed half-sword gap attempts should be recorded",
);

recordArmorContactOutcome(store, args, {
  attackMode: "half-sword-thrust",
  contactType: "armor-gap",
  damageAllowed: true,
  gapReached: true,
});
assert.equal(
  getArmoredTacticalMemory(store, args).successfulGapHits,
  1,
  "successful armor-gap hits should be recorded",
);

clearArmoredTacticalMemoryForGeneration(store, "battle-a");
assert.equal(getArmoredTacticalMemory(store, args).solidPlateContacts, 0, "generation clear should remove memory");

recordArmorContactOutcome(store, args, {
  attackMode: "longsword-cut",
  contactType: "solid-plate",
  damageAllowed: false,
});
clearArmoredTacticalMemoryStore(store);
assert.equal(store.size, 0, "combat reset clear should empty memory store");

console.log("✅ Phase 3B1 armored tactical memory tests passed");
