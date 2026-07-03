export const SURVIVAL_INTENTS = Object.freeze({
  HOLD: "hold",
  ATTACK: "attack",
  REGROUP_WITH_ALLY: "regroup-with-ally",
  FALL_BACK_TO_LEADER: "fall-back-to-leader",
  WITHDRAW_TO_TEAM_CENTER: "withdraw-to-team-center",
  HIDE_BEHIND_STRONGEST_ALLY: "hide-behind-strongest-ally",
  DEFENSIVE_BACKSTEP: "defensive-backstep",
  PANIC_FLEE_TO_EDGE: "panic-flee-to-edge",
  COWER: "cower",
  SURRENDER: "surrender",
});

const SURVIVAL_INTENT_VALUES = new Set(Object.values(SURVIVAL_INTENTS));

export function normalizeSurvivalIntent(intent, fallback = SURVIVAL_INTENTS.HOLD) {
  return SURVIVAL_INTENT_VALUES.has(intent) ? intent : fallback;
}
