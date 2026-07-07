import assert from "node:assert/strict";
import { shouldEnterManualPlayerWait } from "../src/utils/aiToggleResume.js";

const turnKey = "knight-2|player|3|1|8";
assert.equal(shouldEnterManualPlayerWait({
  aiControlEnabled: false,
  isPartyActor: true,
  currentTurnKey: turnKey,
  lastWaitTurnKey: "",
}), true);
assert.equal(shouldEnterManualPlayerWait({
  aiControlEnabled: false,
  isPartyActor: true,
  currentTurnKey: turnKey,
  lastWaitTurnKey: turnKey,
}), false);
assert.equal(shouldEnterManualPlayerWait({
  aiControlEnabled: false,
  isPartyActor: true,
  currentTurnKey: "knight-2|player|3|1|9",
  lastWaitTurnKey: turnKey,
}), true);

console.log("Manual-wait per-turn log dedupe tests passed");
