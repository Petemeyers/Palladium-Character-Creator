import assert from "node:assert/strict";
import { advanceExhaustedCower, resetExhaustedCowerCount } from "../src/utils/combatBrokenState.js";

let actor = { id: "knight", status: "active", currentHP: 18, moraleState: { status: "ROUTED" } };
const first = advanceExhaustedCower(actor);
assert.equal(first.terminal, false);
const second = advanceExhaustedCower(first.actor);
assert.equal(second.terminal, false);
const third = advanceExhaustedCower(second.actor);
assert.equal(third.terminal, true);
assert.equal(third.actor.canAct, false);
assert.equal(resetExhaustedCowerCount(second.actor).routingExhaustedCowerCount, 0);
console.log("exhausted cower terminal threshold tests passed");
