import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(source, /eventType: "grapple-second-action-without-fired-continuation"/);
assert.match(source, /validateActionContinuationAdmission\(\{/);
assert.match(source, /eventType: "grapple-continuation-terminal-return-propagated"/);
assert.match(source, /pendingContinuation: true/);
assert.match(source, /fireActionContinuationReceipt\(entry\)/);
assert.doesNotMatch(source, /state: "fired", firedAt: Date\.now\(\) \}\);[\s\S]{0,600}remainingActionContinuationRegistryRef\.current\.delete\(continuationKey\)/);
assert.match(source, /reason: "combat-end"/);
assert.match(source, /eventType: "combat-end-grapple-cleanup-validated"/);

console.log("✅ Phase 3B1 active clinch continuation source tests passed");
