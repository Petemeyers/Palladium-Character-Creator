import assert from "node:assert/strict";

import { summarizeOriginalTraitsForDisplay } from "../src/utils/originalActorMetadataDisplay.js";

const apiCharacter = JSON.parse(JSON.stringify({
  _id: "saved-bato",
  name: "Bato",
  originalActorMetadata: {
    traits: [
      "blooded",
      {
        traitId: "line_holder",
        name: "Line Holder",
        layer: "formation",
        source: "combat",
        reason: "Held the bridge while companions withdrew.",
      },
      {
        id: "scarred_survivor",
        source: "combat",
      },
      { unexpected: { nested: true } },
      null,
      [],
    ],
  },
}));

const summary = summarizeOriginalTraitsForDisplay(apiCharacter, { limit: 3 });
assert.equal(summary.total, 3, "malformed traits are omitted without affecting valid traits");
assert.equal(summary.traits[0].name, "Blooded", "known string IDs use friendly trait names");
assert.equal(summary.traits[0].layer, "tempered");
assert.equal(summary.traits[0].source, "combat");
assert.deepEqual(summary.traits[1], {
  id: "line_holder",
  name: "Line Holder",
  layer: "formation",
  source: "combat",
  reason: "Held the bridge while companions withdrew.",
});
assert.equal(summary.traits[2].name, "Scarred Survivor", "partial objects use seeded names");
assert.equal(summary.hiddenCount, 0);

const compact = summarizeOriginalTraitsForDisplay({
  originalActorMetadata: {
    traits: ["blooded", "line_holder", "rout_survivor", "duel_proven", "oath_fast"],
  },
}, { limit: 3 });
assert.equal(compact.traits.length, 3);
assert.equal(compact.total, 5);
assert.equal(compact.hiddenCount, 2);

assert.deepEqual(
  summarizeOriginalTraitsForDisplay({}, { limit: 3 }),
  { traits: [], total: 0, hiddenCount: 0 },
  "missing traits are safe"
);
assert.deepEqual(
  summarizeOriginalTraitsForDisplay({ originalActorMetadata: { traits: null } }, { limit: 3 }),
  { traits: [], total: 0, hiddenCount: 0 },
  "null traits are safe"
);

const unknown = summarizeOriginalTraitsForDisplay({
  originalActorMetadata: { traits: ["ford_watcher"] },
});
assert.equal(unknown.traits[0].name, "Ford Watcher", "unknown IDs remain readable");
assert.doesNotMatch(JSON.stringify(summary), /\[object Object\]/);

console.log("character list Chronicle trait display tests passed");
