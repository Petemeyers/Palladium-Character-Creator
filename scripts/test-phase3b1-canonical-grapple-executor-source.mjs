import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/pages/CombatPage.jsx", "utf8");
const resolver = readFileSync("src/utils/combatActionHandlers/grappleActions.js", "utf8");
const grappling = readFileSync("src/utils/grapplingSystem.js", "utf8");
const lifecycle = readFileSync("src/utils/combat/canonicalGrappleExecution.js", "utf8");

assert.match(page, /const executeCanonicalGrappleAction = useCallback\(\(\{/);
assert.match(page, /createCanonicalGrappleAdmission\(\{[\s\S]*?generationId[\s\S]*?initiativeTurnId[\s\S]*?actionToken[\s\S]*?actionSequence[\s\S]*?actorId[\s\S]*?opponentId[\s\S]*?executionKey[\s\S]*?continuationAuthorizationId[\s\S]*?continuationKey[\s\S]*?admittedAt/);
assert.match(lifecycle, /Object\.freeze\(admission\)/);
assert.match(page, /const claimCanonicalGrappleRoll = useCallback/);
assert.match(lifecycle, /"roll-claimed": Object\.freeze\(\["committed"/);
assert.match(page, /transitionCanonicalGrappleExecutionRecord\(existingExecution, "committed"\)/);
assert.match(resolver, /export function executeAdmittedGrappleResolution\(\{/);
assert.match(resolver, /eventType: "grapple-inner-resolver-direct-entry-blocked"/);
assert.doesNotMatch(page, /handleGrappleActionHandler/);
assert.doesNotMatch(page, /\bhandleGrappleAction\(/);
assert.doesNotMatch(grappling, /rollDice \|\| \(\(\) => Math\.floor\(Math\.random\(\) \* 20\) \+ 1\)/);

const token = page.indexOf('eventType: "initiative-action-token-created"');
const consumed = page.indexOf('eventType: "grapple-continuation-authorization-consumed"', token);
const selected = page.indexOf('eventType: "grapple-action-selected"', consumed);
const dispatched = page.indexOf('eventType: "grapple-action-dispatched"', selected);
const resolving = page.indexOf("beginGrappleActionResolution({", dispatched);
const admitted = page.indexOf("executeAdmittedGrappleResolutionHandler({", resolving);
assert.ok(token >= 0 && consumed > token && selected > consumed && dispatched > selected && resolving > dispatched && admitted > resolving);

console.log("✅ Phase 3B1 canonical grapple executor source tests passed");
