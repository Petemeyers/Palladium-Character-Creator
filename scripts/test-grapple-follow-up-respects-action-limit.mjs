import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyGrappleFollowUpOutcome } from "../src/utils/grappleFollowUp.js";

const actor = { id: "knight", actionsPerRound: 2, remainingActions: 2 };
const first = applyGrappleFollowUpOutcome(actor, { remainingActions: 2, grappleState: { state: "grapple_clinch" } });
const second = applyGrappleFollowUpOutcome(first.actor, { remainingActions: 2 });
const blocked = applyGrappleFollowUpOutcome(second.actor, { remainingActions: 2 });

assert.equal(first.actor.remainingActions, 1, "stale outcome cannot restore the first spent action");
assert.equal(second.actor.remainingActions, 0, "second follow-up spends the final legal action");
assert.equal(blocked.ok, false, "third follow-up is rejected");

const handler = readFileSync(new URL("../src/utils/combatActionHandlers/grappleActions.js", import.meta.url), "utf8");
assert.match(handler, /applyGrappleFollowUpOutcome\(updated\[attackerIndex\], outcome\)/);

console.log("Grapple follow-up action-limit tests passed");
