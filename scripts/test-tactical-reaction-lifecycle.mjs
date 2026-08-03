import assert from "node:assert/strict";
import {
  admitTacticalReactionResolution,
  completeTacticalReactionResolution,
  createTacticalReactionRuntime,
  openTacticalReactionWindow,
  progressTacticalReactionWindows,
} from "../src/utils/combat/tacticalReactionWindow.js";
import { collectEvents, fighter, reactionIntent } from "./tactical-reaction-test-helpers.mjs";

const runtime = createTacticalReactionRuntime({ generationId: 1, combatSession: 1 });
const fighters = [fighter("attacker", "party"), fighter("defender", "enemy")];
const log = collectEvents();
const opened = openTacticalReactionWindow({ runtime, intent: reactionIntent(), executionKey: "execution:1", pulseIndex: 2, fighters, onEvent: log.onEvent });
assert.equal(opened.accepted, true);
assert.equal(opened.window.state, "awaiting-responses");
assert.equal(opened.window.responseDeadlinePulse, 3);
assert.equal(runtime.activeWindows.size, 1);
assert.equal(openTacticalReactionWindow({ runtime, intent: reactionIntent(), executionKey: "execution:1", pulseIndex: 2, fighters }).reason, "duplicate-reaction-window");
progressTacticalReactionWindows({ runtime, pulseIndex: 3, fighters, onEvent: log.onEvent });
const locked = runtime.activeWindows.get(opened.window.reactionWindowId);
assert.equal(locked.state, "locked");
const admitted = admitTacticalReactionResolution({ runtime, reactionWindowId: locked.reactionWindowId, pulseIndex: 3, onEvent: log.onEvent });
assert.equal(admitted.accepted, true);
assert.equal(admitted.window.state, "resolving");
const completed = completeTacticalReactionResolution({ runtime, reactionWindowId: locked.reactionWindowId, pulseIndex: 3, result: { parryOutcome: "parry_advantage" }, onEvent: log.onEvent });
assert.equal(completed.accepted, true);
assert.equal(completed.window.state, "resolved");
assert.equal(completed.window.resolution.parryOutcome, "parry_advantage", "parry quality remains available for future logic");
assert.equal(completeTacticalReactionResolution({ runtime, reactionWindowId: locked.reactionWindowId, pulseIndex: 3 }).reason, "reaction-window-not-active");
assert.equal(log.events.some((entry) => entry.eventType.includes("riposte")), false, "Phase 1B2A never executes a riposte");
console.log("tactical reaction lifecycle tests passed");
