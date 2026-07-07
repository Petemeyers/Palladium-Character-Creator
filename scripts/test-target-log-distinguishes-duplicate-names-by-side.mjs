import assert from "node:assert/strict";
import fs from "node:fs";
import { disambiguateDuplicateCombatActorNames } from "../src/utils/combatActorIdentity.js";

const partyKnight = { id: "playable-knight-2", name: "Knight #2", team: "party" };
const enemyKnight = { id: "enemy-knight-2", name: "Knight #2", team: "enemy" };
assert.equal(
  disambiguateDuplicateCombatActorNames("Knight #2 attacks Knight #2 with Long Sword.", {
    roster: [partyKnight, enemyKnight],
    activeActor: partyKnight,
  }),
  "Knight #2 [party] attacks Knight #2 [enemy] with Long Sword.",
);
const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPage, /disambiguateDuplicateCombatActorNames\(/);
console.log("duplicate-name combat-log labels tests passed");
