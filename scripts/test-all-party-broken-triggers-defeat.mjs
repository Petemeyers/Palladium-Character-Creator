import assert from "node:assert/strict";
import { resolveCombatSideOutcome } from "../src/utils/combatBrokenState.js";

const outcome = resolveCombatSideOutcome({ partyCount: 3, hostileCount: 1, activePartyCount: 0, activeHostileCount: 1 });
assert.equal(outcome.partyDefeated, true);
assert.equal(outcome.bothSidesBroken, false);
console.log("all party broken defeat tests passed");
