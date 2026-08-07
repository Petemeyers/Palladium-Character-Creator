import assert from "node:assert/strict";
import fs from "node:fs";
import { createInitiativeTurnSlotKey } from "../src/utils/combat/initiativeActionTiming.js";

const actorId = "enemy-spearman-8";
const passOneBeforeSpend = createInitiativeTurnSlotKey({
  combatSession: 1, round: 1, turnCounter: 11, initiativeIndex: 11, actorId,
});
const passOneAfterSpend = createInitiativeTurnSlotKey({
  combatSession: 1, round: 1, turnCounter: 11, initiativeIndex: 11, actorId,
});
const actualPassTwo = createInitiativeTurnSlotKey({
  combatSession: 1, round: 1, turnCounter: 33, initiativeIndex: 11, actorId,
});

assert.equal(passOneBeforeSpend, passOneAfterSpend);
assert.notEqual(passOneBeforeSpend, actualPassTwo);
assert.equal(passOneBeforeSpend, "1|1|slot-11|11|enemy-spearman-8");
assert.equal(actualPassTwo, "1|1|slot-33|11|enemy-spearman-8");

const combat = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combat, /createInitiativeTurnSlotKey\(\{/);
assert.match(combat, /turnCounter: turnCounterRef\.current \?\? turnCounter/);
assert.doesNotMatch(combat, /keyParts\.push\(`pass-\$\{getInitiativeActionPassIndex\(fighter\)\}`\)/);
assert.match(combat, /actionPass: isInitiativeActionsMode/);

console.log("initiative turn slot identity regression: passed");
