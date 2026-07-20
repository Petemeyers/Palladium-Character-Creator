import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(combatPage, /const createRemainingActionContinuationKey = useCallback/);
assert.match(combatPage, /eventType:\s*"continuation-fire-without-created-record"/);
assert.match(combatPage, /state:\s*"created"/);
assert.match(combatPage, /fireActionContinuationReceipt\(entry\)/);
assert.match(combatPage, /reason=continuation-pending/);

const factory = combatPage.indexOf("const createRemainingActionContinuationKey");
const arbiterUse = combatPage.indexOf("const continuationKey = createRemainingActionContinuationKey({", factory);
const attackUse = combatPage.indexOf("const continuationKey = createRemainingActionContinuationKey({", arbiterUse + 1);

assert.ok(factory >= 0, "canonical continuation-key factory should exist");
assert.ok(arbiterUse > factory, "combat completion arbiter should use canonical continuation key");
assert.ok(attackUse > arbiterUse, "attack impact continuation path should use canonical continuation key");

assert.match(
  combatPage,
  /if \(!entry \|\| entry\.state !== "created"\) \{[\s\S]*?continuation-fire-without-created-record/,
  "continuation firing should require an authoritative created record",
);

console.log("✅ Phase 3B1 continuation exclusivity source tests passed");
