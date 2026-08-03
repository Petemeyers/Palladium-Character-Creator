import { assert, setup, auditTacticalChargeBraceOwnership } from "./tactical-charge-brace-test-helpers.mjs";
import { cleanupTacticalChargeBraceRuntime, resolveTacticalChargeContacts, resolveTacticalChargeStepBoundary } from "../src/utils/combat/tacticalChargeBraceRuntime.js";
const context = setup(); const cleanup = cleanupTacticalChargeBraceRuntime(context.runtime, "combat-ended");
assert.equal(cleanup.accepted, true); assert.equal(cleanup.eventType, "tactical-charge-brace-terminal-cleanup"); assert.equal(cleanup.data.committedChargeCount, 1); assert.equal(cleanup.data.heldBraceCount, 1); assert.equal(auditTacticalChargeBraceOwnership(context.runtime).matches, true);
assert.equal((await resolveTacticalChargeStepBoundary({ runtime: context.runtime, charge: context.runtime.terminalCharges[0] })).accepted, false);
assert.equal((await resolveTacticalChargeContacts({ runtime: context.runtime })).accepted, false);
assert.equal(context.runtime.postTerminalMovementBlocked, 1); assert.equal(context.runtime.postTerminalAttacksBlocked, 1);
assert.equal(cleanupTacticalChargeBraceRuntime(context.runtime).accepted, false);
console.log("tactical charge brace terminal cleanup: 9/9 passed");
