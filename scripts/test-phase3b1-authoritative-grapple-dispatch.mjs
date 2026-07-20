import assert from "node:assert/strict";

import { resolveGrappleTurnAction } from "../src/utils/ai/resolveGrappleTurnAction.js";

const actor = {
  id: "party-knight",
  name: "Knight [party]",
  remainingActions: 1,
  grappleState: { state: "clinch", opponent: "enemy-knight" },
};
const opponent = {
  id: "enemy-knight",
  name: "Knight [enemy]",
  grappleState: { state: "clinch", opponent: "party-knight" },
};

const route = resolveGrappleTurnAction({
  actor,
  opponent,
  remainingActions: 1,
  availableClinchWeapons: [{ id: "dagger", name: "Dagger", damage: "1d4" }],
  generationId: "g1",
  round: 3,
  initiativeIndex: 0,
  initiativeTurnId: "g1:3:0:party-knight:17",
  actionToken: "g1:3:0:party-knight:17:1",
  turnToken: "turn-token",
});

assert.equal(route.handled, true);
assert.equal(route.routeType, "grapple-dispatch-required");
assert.equal(route.dispatchRequired, true);
assert.equal(route.grappleAction.actionType, route.actionType);
assert.equal(route.grappleAction.initiativeTurnId, "g1:3:0:party-knight:17");
assert.equal(route.grappleAction.actionToken, "g1:3:0:party-knight:17:1");
assert.ok(["drawClinchDagger", "clinchStrike", "breakFree", "improveControl", "reverseControl", "takedown", "releaseGrapple", "groundAttack"].includes(route.actionType));
assert.notEqual(route.actionType, "attack", "active grapple must not route to generic attack()");
assert.equal(route.actionSpent, false, "dispatcher/handler owns action spending");
assert.equal(route.stateChanged, false, "adapter must not mutate state");
assert.equal(route.initiativeTurnId, "g1:3:0:party-knight:17");
assert.equal(route.actionToken, "g1:3:0:party-knight:17:1");

const pass = resolveGrappleTurnAction({
  actor: { ...actor, remainingActions: 0 },
  opponent,
  remainingActions: 0,
  generationId: "g1",
  turnToken: "turn-token",
});

assert.equal(pass.handled, true);
assert.equal(pass.routeType, "legal-pass");
assert.equal(pass.actionType, "pass");
assert.equal(pass.actionSpent, true);
assert.equal(pass.dispatchRequired, false);

console.log("✅ Phase 3B1 authoritative grapple dispatch tests passed");
