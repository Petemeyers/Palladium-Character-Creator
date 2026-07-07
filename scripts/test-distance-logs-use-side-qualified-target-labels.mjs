import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatCombatActorLabel } from "../src/utils/combatActorIdentity.js";

const partyKnight = { id: "party-knight-2", name: "Knight #2", team: "party" };
const enemyKnight = { id: "enemy-knight-1", name: "Knight #1", team: "enemy" };
const roster = [partyKnight, enemyKnight];

assert.equal(formatCombatActorLabel(partyKnight, { roster, counterpart: enemyKnight }), "Knight #2");
assert.equal(formatCombatActorLabel(enemyKnight, { roster, counterpart: partyKnight }), "Knight #1");

const duplicateParty = { id: "party-knight-1", name: "Knight #1", team: "party" };
const duplicateRoster = [partyKnight, duplicateParty, enemyKnight];
assert.equal(
  formatCombatActorLabel(enemyKnight, { roster: duplicateRoster, counterpart: partyKnight }),
  "Knight #1 [enemy]",
);

const playerAi = readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
assert.match(playerAi, /formatCombatActorLabel\(player/);
assert.match(playerAi, /formatCombatActorLabel\(target/);
assert.match(playerAi, /\$\{playerLogLabel\} is \$\{Math\.round\(currentDistance\)\}ft from \$\{/);
assert.doesNotMatch(playerAi, /\$\{player\.name\} is \$\{Math\.round\(currentDistance\)\}ft from/);

console.log("player distance-log side-qualified label tests passed");
