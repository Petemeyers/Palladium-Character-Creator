import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const authorityUrl = pathToFileURL(path.join(root, "src/utils/combat/aiTurnStabilityAuthority.js")).href;
const {
  AI_TURN_STABILITY_AUTHORITY_ID,
  buildPlayerAiProgressCoordinate,
  classifyPlayerAiProgressObservation,
  filterAutomatedFormationOptionsForViability,
  hasActiveFormationAlly,
} = await import(authorityUrl);

assert.equal(AI_TURN_STABILITY_AUTHORITY_ID, "ai-turn-stability-v1");

const base = {
  initiativeTurnId: 41,
  round: 12,
  turnCounter: 40,
  turnIndex: 0,
  activeActorId: "party-1",
  remainingActions: 1,
};

assert.deepEqual(buildPlayerAiProgressCoordinate(base), {
  initiativeTurnId: "41",
  round: "12",
  turnCounter: "40",
  turnIndex: "0",
  activeActorId: "party-1",
});

// Same-turn action consumption remains an ordinary observation.
const sameTurnSpend = classifyPlayerAiProgressObservation(base, {
  ...base,
  remainingActions: 0,
});
assert.equal(sameTurnSpend.sameTurn, true);
assert.equal(sameTurnSpend.superseded, false);
assert.deepEqual(sameTurnSpend.reasons, []);

// Same-turn no-change remains eligible for the existing zero-progress guard.
const sameTurnNoProgress = classifyPlayerAiProgressObservation(base, { ...base });
assert.equal(sameTurnNoProgress.classification, "same-turn");

// The observed 1 -> 2 case is a new-round coordinate, not a same-turn action
// budget mutation. It must supersede the old invocation.
const roundRollover = classifyPlayerAiProgressObservation(base, {
  ...base,
  initiativeTurnId: 42,
  round: 13,
  turnCounter: 41,
  remainingActions: 2,
});
assert.equal(roundRollover.superseded, true);
assert.ok(roundRollover.reasons.includes("initiativeTurnId-changed"));
assert.ok(roundRollover.reasons.includes("round-changed"));
assert.ok(roundRollover.reasons.includes("turnCounter-changed"));

const actorHandoff = classifyPlayerAiProgressObservation(base, {
  ...base,
  turnIndex: 1,
  activeActorId: "enemy-1",
});
assert.equal(actorHandoff.superseded, true);
assert.ok(actorHandoff.reasons.includes("activeActorId-changed"));
assert.ok(actorHandoff.reasons.includes("turnIndex-changed"));

const options = [
  { id: "rally-formation", label: "Rally Formation" },
  { id: "anchor-position", label: "Anchor Position" },
];
const soloActor = { id: "party-1", team: "party" };
const enemy = { id: "enemy-1", team: "enemy" };
assert.equal(hasActiveFormationAlly(soloActor, [soloActor, enemy]), false);
assert.deepEqual(
  filterAutomatedFormationOptionsForViability({ actor: soloActor, combatants: [soloActor, enemy], options }).map((option) => option.id),
  ["anchor-position"],
  "solo automated fighter must not select Rally Formation",
);

const ally = { id: "party-2", team: "party" };
assert.equal(hasActiveFormationAlly(soloActor, [soloActor, ally, enemy]), true);
assert.deepEqual(
  filterAutomatedFormationOptionsForViability({ actor: soloActor, combatants: [soloActor, ally, enemy], options }).map((option) => option.id),
  ["rally-formation", "anchor-position"],
  "Rally Formation remains available to automated fighters when an active ally exists",
);

const fledAlly = { id: "party-2", team: "party", fled: true };
assert.equal(hasActiveFormationAlly(soloActor, [soloActor, fledAlly]), false);

// Caller-supplied alliance semantics can override side labels when needed.
const factionActor = { id: "a", factionKey: "red" };
const factionAlly = { id: "b", factionKey: "red" };
assert.equal(hasActiveFormationAlly(factionActor, [factionActor, factionAlly], (a, b) => a.factionKey === b.factionKey), true);

console.log("PASS Milestone 8C-8C.3C AI turn stability + formation viability authority");
