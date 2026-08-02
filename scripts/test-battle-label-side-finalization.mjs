import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  assignBattleLocalIdentities,
  auditBattleRosterIdentity,
  sanitizeCombatActorBaseName,
} from "../src/utils/combatActorIdentity.js";
import { buildInitiativePresentation } from "../src/utils/combat/initiativeIdentity.js";

assert.equal(sanitizeCombatActorBaseName("Party Knight [enemy] #1"), "Knight #1");
assert.equal(sanitizeCombatActorBaseName("Enemy Longbowman [party] #3"), "Longbowman #3");

const roster = assignBattleLocalIdentities([
  { id: "party-knight", name: "Knight [enemy] #1", team: "party", type: "player" },
  { id: "enemy-knight", name: "Party Knight #1", team: "enemy", type: "enemy" },
  { id: "party-longbow-1", name: "Longbowman", team: "party", type: "player" },
  { id: "party-longbow-2", name: "Longbowman", team: "party", type: "player" },
  { id: "enemy-longbow-1", name: "Longbowman", team: "enemy", type: "enemy" },
]);
assert.equal(roster[0].battleLabel, "Party Knight #1");
assert.equal(roster[1].battleLabel, "Enemy Knight #1");
assert.equal(roster[2].battleLabel, "Party Longbowman #1");
assert.equal(roster[3].battleLabel, "Party Longbowman #2");
assert.equal(roster[4].battleLabel, "Enemy Longbowman");
assert.equal(new Set(roster.map((actor) => actor.battleLabel)).size, roster.length);
assert.equal(auditBattleRosterIdentity(roster).matches, true);

const ordered = roster.map((actor, index) => ({
  ...actor,
  initiativeEligible: true,
  initiativeRoll: 20 - index,
  initiativeTotal: 20 - index,
  initiativeTieBreaker: 1,
}));
const presentation = buildInitiativePresentation(ordered, roster, { initiativeRound: 1 });
for (const result of presentation.results) {
  assert.ok(presentation.summary.includes(`${result.initiativeRank}. ${result.displayName} — ${result.initiativeTotal}`));
  assert.doesNotMatch(result.displayName, /Party .*\[enemy|Enemy .*\[party/i);
}

const page = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(page, /"round-initiative-summary",[\s\S]{0,80}\.includes\(message\.eventType\)/);
assert.match(page, /const summary = presentation\.summary/);
assert.match(page, /normalizeCombatantForBattle\(normalizeFighterSideId\(fighter/);

console.log("battle label side finalization tests passed");
