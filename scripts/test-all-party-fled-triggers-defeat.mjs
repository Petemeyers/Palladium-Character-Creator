import assert from "node:assert/strict";
import fs from "node:fs";
import { getCombatHostilityState } from "../src/utils/combatHostilityState.js";
import { markCombatantFled } from "../src/utils/combatFledState.js";
import { resolveCombatSideOutcome } from "../src/utils/combatBrokenState.js";

const party = markCombatantFled({ id: "party", type: "player", team: "party", currentHP: 10, canAct: true });
const enemy = { id: "enemy", type: "enemy", team: "enemy", aggression: "hostile", currentHP: 10, canAct: true };
const state = getCombatHostilityState([party, enemy]);
assert.deepEqual(state.activeCombatants.map((fighter) => fighter.id), [enemy.id]);
assert.equal(resolveCombatSideOutcome({ partyCount: 1, hostileCount: 1, activePartyCount: 0, activeHostileCount: 1 }).partyDefeated, true);
const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /partyDefeated: sideOutcome\.partyDefeated/);
assert.match(source, /if \(combatVictoryState\.partyDefeated\)/);
console.log("all party fled defeat-state test passed");
