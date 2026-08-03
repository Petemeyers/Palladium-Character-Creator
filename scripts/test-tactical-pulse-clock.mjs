import assert from "node:assert/strict";
import {
  completeTacticalPulseClock,
  createTacticalPulseClock,
  normalizeCombatTimingMode,
  TACTICAL_PULSE_STATES,
  transitionTacticalPulseClock,
} from "../src/utils/combat/tacticalPulseClock.js";

assert.equal(normalizeCombatTimingMode(undefined), "sequential");
assert.equal(normalizeCombatTimingMode("legacy-save"), "sequential");
assert.equal(normalizeCombatTimingMode("tactical-pulse"), "tactical-pulse");
let clock = createTacticalPulseClock();
assert.deepEqual(clock, { mode: "tactical-pulse", pulseIndex: 0, elapsedSeconds: 0, cycleIndex: 1, pulsesPerCycle: 6, state: "planning" });
for (let pulse = 1; pulse <= 7; pulse += 1) {
  for (const state of [
    TACTICAL_PULSE_STATES.INTENTIONS_LOCKED,
    TACTICAL_PULSE_STATES.MOVEMENT_RESOLVING,
    TACTICAL_PULSE_STATES.ACTION_PREPARATION,
    TACTICAL_PULSE_STATES.ACTIONS_READY,
    TACTICAL_PULSE_STATES.ATTACK_RESOLVING,
    TACTICAL_PULSE_STATES.REACTIONS_PENDING,
    TACTICAL_PULSE_STATES.COMPLETED,
  ]) {
    const transition = transitionTacticalPulseClock(clock, state);
    assert.equal(transition.accepted, true);
    clock = transition.clock;
  }
  clock = completeTacticalPulseClock(clock).clock;
  assert.equal(clock.elapsedSeconds, pulse);
}
assert.equal(clock.pulseIndex, 7);
assert.equal(clock.cycleIndex, 2);
assert.equal(clock.state, "planning");
console.log("tactical pulse clock tests passed");
