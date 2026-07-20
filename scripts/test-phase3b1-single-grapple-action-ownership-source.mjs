import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");
const grappleActions = fs.readFileSync("src/utils/combatActionHandlers/grappleActions.js", "utf8");

assert.match(combatPage, /grappleActionExecutionRegistryRef = useRef\(new Map\(\)\)/);
assert.match(combatPage, /function|const createGrappleActionExecutionRecord/);
assert.match(combatPage, /eventType:\s*"grapple-action-duplicate-roll-blocked"/);
assert.match(combatPage, /eventType:\s*"grapple-action-duplicate-completion-blocked"/);

const createRecord = combatPage.indexOf("createGrappleActionExecutionRecord({");
const dispatchLog = combatPage.indexOf('eventType: "grapple-action-dispatched"', createRecord);
const handlerCall = combatPage.indexOf("const grappleCompletion = executeAdmittedGrappleResolutionHandler", dispatchLog);
const canonicalCompletionCall = combatPage.indexOf("completeCanonicalGrappleAction({", handlerCall);
const canonicalCompletionHelper = combatPage.indexOf("const completeCanonicalGrappleAction = useCallback");
const completeGate = combatPage.indexOf("completeGrappleActionExecution(executionKey", canonicalCompletionHelper);
const completionArbiter = combatPage.indexOf("resolveCombatActionCompletion({", completeGate);

assert.ok(createRecord >= 0, "grapple execution record should be created");
assert.ok(dispatchLog > createRecord, "dispatch log should follow record creation");
assert.ok(handlerCall > dispatchLog, "handler should run after dispatch");
assert.ok(canonicalCompletionCall > handlerCall, "canonical completion helper should run after handler");
assert.ok(completeGate > canonicalCompletionHelper, "canonical completion helper should use the exactly-once completion gate");
assert.ok(completionArbiter > completeGate, "arbiter should run only after exactly-once completion gate");

assert.match(
  combatPage,
  /if \(/m,
  "source sanity",
);
assert.match(
  combatPage,
  /const beginGrappleActionResolution = useCallback/,
  "generic grapple entry should begin resolution without claiming a dice roll",
);
assert.match(
  combatPage,
  /const claimCanonicalGrappleRoll = useCallback/,
  "the actual dice boundary should have a dedicated one-time roll claim",
);
assert.match(
  combatPage,
  /const validateClaimedGrappleRoll = useCallback/,
  "delayed or opposed-roll callbacks should validate the existing claim read-only",
);
assert.match(grappleActions, /claimCanonicalGrappleRoll\(\{ admission, rollKind, source: "grapple-dice-boundary" \}\)/);
assert.match(grappleActions, /validateClaimedGrappleRoll\(\{ expectedRollKind: rollKind, source: "grapple-dice-callback" \}\)/);
assert.doesNotMatch(
  combatPage,
  /beginGrappleActionRoll\(validationActionId, source\)/,
  "generic validation must not consume the first dice roll",
);

console.log("✅ Phase 3B1 single grapple action ownership source tests passed");
