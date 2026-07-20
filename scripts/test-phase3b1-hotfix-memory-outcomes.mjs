import assert from "node:assert/strict";

import {
  buildArmoredTacticalMemoryKey,
  getArmoredTacticalMemory,
  recordArmoredTacticalOutcome,
} from "../src/utils/combat/armoredTacticalMemory.js";

const store = new Map();
const base = {
  generationId: "gen-1",
  attackerId: "enemy-knight",
  defenderId: "party-knight",
  executionKey: "attack-1",
  round: 1,
  turn: 1,
};

const key = buildArmoredTacticalMemoryKey(base);
assert.equal(key, "gen-1::enemy-knight::party-knight", "shared key builder should use generation/attacker/defender");

const cut = recordArmoredTacticalOutcome(store, {
  ...base,
  attackMode: "longsword-cut",
  contactResult: {
    attackMode: "longsword-cut",
    contactType: "solid-plate",
    damageAllowed: false,
  },
});
assert.equal(cut.recorded, true);
assert.equal(cut.memory.ineffectiveCutContacts, 1);
assert.equal(cut.memory.solidPlateContacts, 1);

const replay = recordArmoredTacticalOutcome(store, {
  ...base,
  attackMode: "longsword-cut",
  contactResult: {
    attackMode: "longsword-cut",
    contactType: "solid-plate",
    damageAllowed: false,
  },
});
assert.equal(replay.recorded, false, "replayed same execution/outcome should be idempotent");
assert.equal(replay.memory.ineffectiveCutContacts, 1, "idempotent replay should not double-count ineffective cuts");

const failedGap = recordArmoredTacticalOutcome(store, {
  ...base,
  executionKey: "attack-2",
  attackMode: "half-sword-thrust",
  contactResult: {
    attackMode: "half-sword-thrust",
    contactType: "solid-plate",
    damageAllowed: false,
    gapReached: false,
    gapCapable: true,
  },
});
assert.equal(failedGap.memory.failedGapAttempts, 1, "failed half-sword gap attempt should be recorded once");

const successfulGap = recordArmoredTacticalOutcome(store, {
  ...base,
  executionKey: "attack-3",
  attackMode: "half-sword-thrust",
  outcomeType: "successful-gap-hit",
  contactResult: {
    attackMode: "half-sword-thrust",
    contactType: "armor-gap",
    damageAllowed: true,
    gapReached: true,
    gapCapable: true,
  },
});
assert.equal(successfulGap.memory.successfulGapHits, 1, "successful gap hit should be recorded even when damage continues");

const reversed = getArmoredTacticalMemory(store, {
  generationId: "gen-1",
  attackerId: "party-knight",
  defenderId: "enemy-knight",
});
assert.equal(reversed.ineffectiveCutContacts, 0, "swapping attacker/defender must not retrieve enemy memory");

const nextGen = getArmoredTacticalMemory(store, {
  generationId: "gen-2",
  attackerId: "enemy-knight",
  defenderId: "party-knight",
});
assert.equal(nextGen.successfulGapHits, 0, "new generation should use isolated memory key");

console.log("✅ Phase 3B1 hotfix memory outcome tests passed");
