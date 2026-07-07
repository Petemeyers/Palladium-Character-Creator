import assert from "node:assert/strict";
import {
  decidePlayerTurnStartRoute,
  shouldAutoResolvePlayerSurvival,
  shouldEnterManualPlayerWait,
} from "../src/utils/aiToggleResume.js";

const routed = { id: "knight-2", team: "party", state: { moraleState: "routed" } };
const forceAutomaticSurvival = shouldAutoResolvePlayerSurvival(routed);

assert.equal(forceAutomaticSurvival, true);
assert.equal(decidePlayerTurnStartRoute({
  aiControlEnabled: false,
  isPartyActor: true,
  effectiveControlMode: "player",
  activeFighterMatches: true,
  canAct: true,
  forceAutomaticSurvival,
}).route, "player-ai");
assert.equal(shouldEnterManualPlayerWait({
  aiControlEnabled: false,
  isPartyActor: true,
  forceAutomaticSurvival,
  currentTurnKey: "knight-2|1|4",
}), false);

console.log("Routed-player manual-mode survival tests passed");
