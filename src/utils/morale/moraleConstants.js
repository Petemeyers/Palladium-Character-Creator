export const MORALE_STATES = Object.freeze({
  STEADY: "steady",
  UNEASY: "uneasy",
  SHAKEN: "shaken",
  ROUTED: "routed",
  BROKEN: "broken",
  FLED: "fled",
});

export const ROUT_REASONS = Object.freeze({
  FEAR: "fear",
  PAIN: "pain",
  FATIGUE: "fatigue",
  ISOLATION: "isolation",
  LEADER_DEATH: "leaderDeath",
  FORMATION_COLLAPSE: "formationCollapse",
  MYTHIC_TERROR: "mythicTerror",
  OUTNUMBERED: "outnumbered",
  CONFUSION: "confusion",
  WOUND_SHOCK: "woundShock",
});

export const ROUT_BEHAVIORS = Object.freeze({
  PANIC_FLEE: "panicFlee",
  FLEE_TO_ESCAPE: "fleeToEscape",
  FALL_BACK_TO_ALLIES: "fallBackToAllies",
  SEEK_COMMANDER: "seekCommander",
  RETREAT_TO_COVER: "retreatToCover",
  CORNERED_FURY: "corneredFury",
  FREEZE: "freeze",
  SURRENDER: "surrender",
});

export const MORALE_STATE_ORDER = Object.freeze([
  MORALE_STATES.STEADY,
  MORALE_STATES.UNEASY,
  MORALE_STATES.SHAKEN,
  MORALE_STATES.ROUTED,
  MORALE_STATES.BROKEN,
  MORALE_STATES.FLED,
]);

