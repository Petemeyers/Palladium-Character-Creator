import assert from "node:assert/strict";
import fs from "node:fs";

import { formatAcceptedFinalizerSettlement } from "../src/utils/turnSchedulerDiagnostics.js";

assert.equal(
  formatAcceptedFinalizerSettlement({
    actorName: "Knight #1",
    nextName: "Knight #2",
    source: "player-ai-grapple",
  }),
  "accepted finalizer refs settled actor=Knight #1 next=Knight #2 source=player-ai-grapple",
);

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /const actingFighter = fightersNow\?\.\[turnIndexNow\]/);
assert.match(source, /const acceptedActingActor =\s*finalizerMeta\?\.actingActorSnapshot \|\| actingFighter/);
assert.match(source, /actorName: acceptedActingActorLabel/);
assert.match(source, /actingActorSnapshot: playerAiActingActorSnapshot/);
assert.match(source, /nextName: formatCombatActorLabel\(fighter/);

console.log("finalizer settlement attribution tests passed");
