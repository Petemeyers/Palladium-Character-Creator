import assert from "node:assert/strict";
import fs from "node:fs";
import { getCombatHostilityState } from "../src/utils/combatHostilityState.js";
import { markCombatantFled } from "../src/utils/combatFledState.js";
import { resolveCombatSideOutcome } from "../src/utils/combatBrokenState.js";

const party = { id: "party", type: "player", team: "party", currentHP: 10, canAct: true };
const enemy = markCombatantFled({ id: "enemy", type: "enemy", team: "enemy", currentHP: 10, canAct: true });
const state = getCombatHostilityState([party, enemy]);
assert.deepEqual(state.activeCombatants.map((fighter) => fighter.id), [party.id]);
assert.equal(state.hasHostileSides, false);
assert.equal(resolveCombatSideOutcome({ partyCount: 1, hostileCount: 1, activePartyCount: 1, activeHostileCount: 0 }).partyVictorious, true);
const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /partyVictorious: sideOutcome\.partyVictorious/);
assert.match(source, /isCombatantFled\(fighter\) \|\| isCombatantBroken\(fighter\)/);
console.log("all enemies fled victory-state test passed");
