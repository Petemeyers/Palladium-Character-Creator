import assert from "node:assert/strict";
import { resolveCombatSideOutcome } from "../src/utils/combatBrokenState.js";

const outcome = resolveCombatSideOutcome({ partyCount: 3, hostileCount: 1, activePartyCount: 0, activeHostileCount: 0 });
assert.equal(outcome.bothSidesBroken, true);
assert.equal(outcome.partyDefeated, false);
assert.equal(outcome.partyVictorious, false);
console.log("all combatants broken combat-end tests passed");
