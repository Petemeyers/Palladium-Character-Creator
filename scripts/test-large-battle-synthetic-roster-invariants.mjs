import assert from "node:assert/strict";

import {
  disambiguateDuplicateCombatActorNames,
  formatCombatActorLabel,
} from "../src/utils/combatActorIdentity.js";

const party = [
  ...Array.from({ length: 10 }, (_, index) => ({
    id: `party-guard-${index + 1}`,
    name: `Guard #${index + 1}`,
    type: "player",
    team: "party",
  })),
  ...Array.from({ length: 10 }, (_, index) => ({
    id: `party-archer-${index + 1}`,
    name: `Archer #${index + 1}`,
    type: "player",
    team: "party",
  })),
];

const enemies = [
  { id: "enemy-arena-champion", name: "Arena Champion", type: "enemy", team: "enemy" },
  { id: "enemy-knight", name: "Knight", type: "enemy", team: "enemy" },
  { id: "enemy-longbowman", name: "Longbowman", type: "enemy", team: "enemy" },
  ...Array.from({ length: 10 }, (_, index) => ({
    id: `enemy-archer-${index + 1}`,
    name: `Archer #${index + 1}`,
    type: "enemy",
    team: "enemy",
  })),
];

const roster = [...party, ...enemies];
assert.equal(roster.length, 33, "synthetic large battle contains 33 fighters");
assert.equal(new Set(roster.map((fighter) => fighter.id)).size, 33, "synthetic large battle fighter ids are unique");

assert.equal(
  formatCombatActorLabel(enemies.at(-1), { roster, counterpart: party.at(-1) }),
  "Archer #10 [enemy]",
  "enemy Archer #10 side label appends to full numbered name",
);

const logLine = disambiguateDuplicateCombatActorNames(
  "Archer #10 fires at Archer #10.",
  { roster, activeActor: enemies.at(-1) },
);
assert.equal(
  logLine,
  "Archer #10 [enemy] fires at Archer #10 [party].",
  "large-battle duplicate-name logs preserve #10 formatting",
);

console.log("✅ large-battle synthetic roster invariants passed");
