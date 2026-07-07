import assert from "node:assert/strict";
import {
  decidePlayerTurnStartRoute,
  shouldAllowSurvivalFinalizerHandoff,
  shouldAutoResolvePlayerSurvival,
  shouldEnterManualPlayerWait,
} from "../src/utils/aiToggleResume.js";

const routedPartyActor = {
  id: "knight-2",
  name: "Knight #2",
  team: "party",
  moraleState: { status: "ROUTED" },
};

const forceAutomaticSurvival = shouldAutoResolvePlayerSurvival(routedPartyActor);

assert.equal(forceAutomaticSurvival, true);
assert.equal(
  decidePlayerTurnStartRoute({
    aiControlEnabled: false,
    isPartyActor: true,
    effectiveControlMode: "player",
    activeFighterMatches: true,
    canAct: true,
    forceAutomaticSurvival,
  }).route,
  "player-ai",
);
assert.equal(
  shouldEnterManualPlayerWait({
    aiControlEnabled: false,
    isPartyActor: true,
    forceAutomaticSurvival,
    currentTurnKey: "knight-2|1|4",
  }),
  false,
);
assert.equal(
  shouldAllowSurvivalFinalizerHandoff({
    source: "player-ai",
    actor: routedPartyActor,
  }),
  true,
);

console.log("routed-player manual-control auto-resolution tests passed");
