import assert from "node:assert/strict";
import { applyGrappleFollowUpOutcome } from "../src/utils/grappleFollowUp.js";

const result = applyGrappleFollowUpOutcome(
  { id: "knight", actionsPerRound: 2, remainingActions: 1 },
  { remainingActions: 2 },
);

assert.equal(result.ok, true);
assert.equal(result.actor.remainingActions, 0);
assert.equal(result.shouldPassTurn, true);

console.log("Grapple follow-up turn-pass tests passed");
