import assert from "node:assert/strict";

import {
  disambiguateDuplicateCombatActorNames,
  formatCombatActorLabel,
} from "../src/utils/combatActorIdentity.js";

const roster = [
  { id: "enemy-archer-1", name: "Archer #1", type: "enemy", team: "enemy" },
  { id: "enemy-archer-10", name: "Archer #10", type: "enemy", team: "enemy" },
  { id: "party-archer-10", name: "Archer #10", type: "player", team: "party" },
];

assert.equal(
  formatCombatActorLabel(roster[1], { roster, counterpart: roster[2] }),
  "Archer #10 [enemy]",
  "side disambiguation appends after the full numbered name",
);

const message = disambiguateDuplicateCombatActorNames(
  "Archer #10 attacks Archer #10.",
  { roster, activeActor: roster[1] },
);

assert.equal(
  message,
  "Archer #10 [enemy] attacks Archer #10 [party].",
  "Archer #1 must not match inside Archer #10 and leave a trailing zero",
);

console.log("✅ numbered combat labels preserve two-digit suffixes");
