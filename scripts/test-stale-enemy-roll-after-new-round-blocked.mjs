import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPageSource = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(combatPageSource, /clearAttackExecutionState\(`new-melee-round:\$\{nextRoundNumber\}`\)/);
assert.match(combatPageSource, /execution-key-round-stale/);
assert.match(combatPageSource, /execution-key-turn-counter-stale/);
assert.match(combatPageSource, /execution-key-turn-token-stale/);

const roundStaleIndex = combatPageSource.indexOf("execution-key-round-stale");
const rollGateIndex = combatPageSource.indexOf('const immediateAttackRollBlock = getAttackRollOwnershipBlockReason("attack-roll")');
const attackRollIndex = combatPageSource.indexOf("attackRollResult = CryptoSecureDice.parseAndRoll", rollGateIndex);
assert.ok(roundStaleIndex !== -1, "execution key round staleness must be detected");
assert.ok(
  rollGateIndex !== -1 && attackRollIndex !== -1 && rollGateIndex < attackRollIndex,
  "attack roll gate must run before dice are rolled",
);

assert.match(combatPageSource, /keyMetadata\.meleeRound/);
assert.match(combatPageSource, /keyMetadata\.turnCounter/);

console.log("stale enemy roll after new round is blocked by round/turn key checks");
