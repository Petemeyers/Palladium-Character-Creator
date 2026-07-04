import assert from "node:assert/strict";
import { resolveCombatSideOutcome } from "../src/utils/combatBrokenState.js";

const outcome = resolveCombatSideOutcome({ partyCount: 3, hostileCount: 2, activePartyCount: 3, activeHostileCount: 0 });
assert.equal(outcome.partyVictorious, true);
assert.equal(outcome.bothSidesBroken, false);
console.log("all enemies broken victory tests passed");
