import assert from "node:assert/strict";
import {
  shouldAllowSurvivalFinalizerHandoff,
  shouldEnterManualPlayerWait,
} from "../src/utils/aiToggleResume.js";

const willingPartyActor = {
  id: "knight-1",
  name: "Knight #1",
  team: "party",
  remainingActions: 1,
  state: { moraleState: "steady" },
};

assert.equal(
  shouldAllowSurvivalFinalizerHandoff({
    source: "player-ai",
    actor: willingPartyActor,
  }),
  false,
  "Ordinary willing player-ai actor should not receive survival-handoff bypass.",
);

assert.equal(
  shouldEnterManualPlayerWait({
    aiControlEnabled: false,
    isPartyActor: true,
    forceAutomaticSurvival: false,
    currentTurnKey: "knight-1|1|4",
  }),
  true,
  "Manual control should still wait for an active willing player actor.",
);

console.log("manual-control willing-player wait tests passed");
