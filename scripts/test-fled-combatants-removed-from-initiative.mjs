import assert from "node:assert/strict";
import fs from "node:fs";
import { isActiveCombatantForHostility } from "../src/utils/combatHostilityState.js";
import { markCombatantFled } from "../src/utils/combatFledState.js";

const fled = markCombatantFled({ id: "router", type: "enemy", currentHP: 10, canAct: true });
assert.equal(isActiveCombatantForHostility(fled), false);
assert.equal(fled.remainingActions, 0);
const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /const canFighterStartTurn = useCallback\(\(fighter\) => \{[\s\S]*?if \(!canFighterAct\(fighter\)\) return false/);
assert.match(source, /isCombatantFled\(fighter\) \|\| isCombatantBroken\(fighter\)/);
console.log("fled combatant initiative exclusion test passed");
