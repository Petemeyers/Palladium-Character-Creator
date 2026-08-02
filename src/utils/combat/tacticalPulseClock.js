export const COMBAT_TIMING_MODES = Object.freeze({
  SEQUENTIAL: "sequential",
  TACTICAL_PULSE: "tactical-pulse",
});

export const TACTICAL_PULSE_STATES = Object.freeze({
  PLANNING: "planning",
  INTENTIONS_LOCKED: "intentions-locked",
  MOVEMENT_RESOLVING: "movement-resolving",
  REACTIONS_PENDING: "reactions-pending",
  COMPLETED: "completed",
});

const TRANSITIONS = Object.freeze({
  [TACTICAL_PULSE_STATES.PLANNING]: TACTICAL_PULSE_STATES.INTENTIONS_LOCKED,
  [TACTICAL_PULSE_STATES.INTENTIONS_LOCKED]: TACTICAL_PULSE_STATES.MOVEMENT_RESOLVING,
  [TACTICAL_PULSE_STATES.MOVEMENT_RESOLVING]: TACTICAL_PULSE_STATES.REACTIONS_PENDING,
  [TACTICAL_PULSE_STATES.REACTIONS_PENDING]: TACTICAL_PULSE_STATES.COMPLETED,
});

export function normalizeCombatTimingMode(value) {
  return value === COMBAT_TIMING_MODES.TACTICAL_PULSE
    ? COMBAT_TIMING_MODES.TACTICAL_PULSE
    : COMBAT_TIMING_MODES.SEQUENTIAL;
}

export function createTacticalPulseClock({ pulsesPerCycle = 6 } = {}) {
  return Object.freeze({
    mode: COMBAT_TIMING_MODES.TACTICAL_PULSE,
    pulseIndex: 0,
    elapsedSeconds: 0,
    cycleIndex: 1,
    pulsesPerCycle: Math.max(1, Number(pulsesPerCycle) || 6),
    state: TACTICAL_PULSE_STATES.PLANNING,
  });
}

export function createTacticalPulseOwnership({ clock, generationId, combatSession } = {}) {
  if (clock?.mode !== COMBAT_TIMING_MODES.TACTICAL_PULSE || clock.state !== TACTICAL_PULSE_STATES.PLANNING) {
    return { accepted: false, reason: "pulse-clock-not-ready" };
  }
  const generation = Number(generationId);
  const session = Number(combatSession);
  if (!Number.isFinite(generation) || !Number.isFinite(session)) {
    return { accepted: false, reason: "invalid-pulse-coordinate" };
  }
  return {
    accepted: true,
    ownership: Object.freeze({
      generationId: generation,
      combatSession: session,
      pulseIndex: clock.pulseIndex + 1,
      cycleIndex: clock.cycleIndex,
    }),
  };
}

export function transitionTacticalPulseClock(clock, nextState) {
  const expected = TRANSITIONS[clock?.state];
  if (!expected || expected !== nextState) {
    return { accepted: false, reason: "invalid-pulse-state-transition", clock };
  }
  return { accepted: true, clock: Object.freeze({ ...clock, state: nextState }) };
}

export function abortTacticalPulseClock(clock) {
  if (clock?.mode !== COMBAT_TIMING_MODES.TACTICAL_PULSE) {
    return { accepted: false, reason: "invalid-pulse-clock", clock };
  }
  return {
    accepted: true,
    clock: Object.freeze({
      ...clock,
      state: TACTICAL_PULSE_STATES.PLANNING,
    }),
  };
}

export function completeTacticalPulseClock(clock) {
  if (clock?.state !== TACTICAL_PULSE_STATES.COMPLETED) {
    return { accepted: false, reason: "pulse-not-completed", clock };
  }
  const completedPulses = clock.pulseIndex + 1;
  return {
    accepted: true,
    clock: Object.freeze({
      ...clock,
      pulseIndex: completedPulses,
      elapsedSeconds: completedPulses,
      cycleIndex: Math.floor(completedPulses / clock.pulsesPerCycle) + 1,
      state: TACTICAL_PULSE_STATES.PLANNING,
    }),
  };
}

export function formatTacticalBattleTime(elapsedSeconds = 0) {
  const total = Math.max(0, Math.floor(Number(elapsedSeconds) || 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
