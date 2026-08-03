export const TACTICAL_ACTION_TIMING = Object.freeze({
  unarmedQuickStrike: Object.freeze({ preparationPulses: 1, recoveryPulses: 1 }),
  daggerAttack: Object.freeze({ preparationPulses: 1, recoveryPulses: 1 }),
  shortSwordAttack: Object.freeze({ preparationPulses: 1, recoveryPulses: 1 }),
  longswordCut: Object.freeze({ preparationPulses: 1, recoveryPulses: 1 }),
  longswordThrust: Object.freeze({ preparationPulses: 1, recoveryPulses: 1 }),
  halfSwordThrust: Object.freeze({ preparationPulses: 2, recoveryPulses: 1 }),
  heavyMeleeAttack: Object.freeze({ preparationPulses: 2, recoveryPulses: 2 }),
  spearThrust: Object.freeze({ preparationPulses: 1, recoveryPulses: 1 }),
  longbowRushedShot: Object.freeze({ preparationPulses: 2, recoveryPulses: 1 }),
  longbowStandardShot: Object.freeze({ preparationPulses: 3, recoveryPulses: 1 }),
  longbowAimedShot: Object.freeze({ preparationPulses: 4, recoveryPulses: 1 }),
  loadedCrossbowShot: Object.freeze({ preparationPulses: 1, recoveryPulses: 1 }),
  grappleEntry: Object.freeze({ preparationPulses: 1, recoveryPulses: 1 }),
});

export function getTacticalActionTiming(timingKey) {
  return TACTICAL_ACTION_TIMING[timingKey] || TACTICAL_ACTION_TIMING.unarmedQuickStrike;
}

export default TACTICAL_ACTION_TIMING;
