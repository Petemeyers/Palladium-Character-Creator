import assert from "node:assert/strict";
import { markCombatantFled } from "../src/utils/combatFledState.js";
import { canTargetForAction } from "../src/utils/factionDisposition.js";

const party = { id: "party", type: "player", team: "party" };
const fledEnemy = markCombatantFled({ id: "enemy", type: "enemy", team: "enemy", currentHP: 10 });
assert.equal(canTargetForAction(party, fledEnemy, "attack"), false);
assert.equal(canTargetForAction(fledEnemy, party, "attack"), false);
console.log("fled combatant targeting exclusion test passed");
