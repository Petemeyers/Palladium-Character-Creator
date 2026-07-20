import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/pages/CombatPage.jsx", "utf8");
const resolver = readFileSync("src/utils/combatActionHandlers/grappleActions.js", "utf8");

assert.match(resolver, /setFighters\(updated\);[\s\S]*?onPostHpMutation\(updated/);
assert.match(page, /grappleCompletion\?\.combatEnded === true \|\| canonicalCompletion\?\.completionDecision\?\.decision === "combat-ended"/);
assert.match(page, /cancelRemainingActionContinuationsForActor\(\{[\s\S]*?reason: "grapple-combat-ended"/);
assert.match(page, /resetGrapple\(next\)/);
assert.match(page, /eventType: "grapple-combat-end-terminal-return"/);
assert.match(page, /eventType: "grapple-continuation-key-lifecycle-audit"/);
assert.match(page, /eventType: "grapple-combat-end-continuation-audit"/);
assert.match(page, /callbacksPending/);
assert.match(page, /activePendingOwnership/);
assert.match(page, /nonterminalExecutions/);
assert.doesNotMatch(page, /eventType: "continuation-attempted-after-combat-end"/);

const completion = page.indexOf("const canonicalCompletion =");
const terminal = page.indexOf('eventType: "grapple-combat-end-terminal-return"', completion);
const continuation = page.indexOf('decision === "continuation-created"', completion);
assert.ok(completion >= 0 && terminal > completion && continuation > terminal, "terminal return must dominate continuation branching");

console.log("✅ Phase 3B1 lethal grapple terminal-return source tests passed");
