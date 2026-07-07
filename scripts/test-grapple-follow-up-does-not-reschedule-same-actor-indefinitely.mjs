import assert from "node:assert/strict";
import { applyGrappleFollowUpOutcome } from "../src/utils/grappleFollowUp.js";

let actor = { id: "knight", actionsPerRound: 2, remainingActions: 2 };
let accepted = 0;
for (let attempt = 0; attempt < 20; attempt += 1) {
  const result = applyGrappleFollowUpOutcome(actor, { remainingActions: 2 });
  if (!result.ok) break;
  accepted += 1;
  actor = result.actor;
}

assert.equal(accepted, 2);
assert.equal(actor.remainingActions, 0);

console.log("Grapple follow-up bounded-rescheduling tests passed");
