import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatCombatActorLabel } from "../src/utils/combatActorIdentity.js";
import { formatAcceptedFinalizerSettlement } from "../src/utils/turnSchedulerDiagnostics.js";

const accepted = { id: "party-3399-367", name: "Knight", team: "party" };
const otherParty = { id: "party-475699-5", name: "Knight", team: "party" };
const enemy = { id: "enemy-8699-363", name: "Knight", team: "enemy" };
const roster = [accepted, otherParty, enemy];
const acceptedLabel = formatCombatActorLabel(accepted, { roster });
const settled = formatAcceptedFinalizerSettlement({
  actorName: acceptedLabel,
  nextName: formatCombatActorLabel(enemy, { roster }),
  source: "player-ai-flanking-continuation-resolved",
});

assert.match(settled, /actor=Knight \[party\/3399-367\]/);
assert.doesNotMatch(settled, /actor=Knight \[party\/475699-5\]/);

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /actingActorSnapshot: playerAiActingActorSnapshot/);
assert.match(source, /actorName: acceptedActingActorLabel/);

console.log("Accepted-finalizer actor snapshot tests passed");
