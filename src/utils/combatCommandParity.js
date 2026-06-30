export const SCHEDULED_COMBAT_COMPATIBILITY_MESSAGE =
  "Legacy manual turn order is disabled while scheduled combat is active.";

export const SCHEDULED_COMBAT_ATTACK_MESSAGE =
  "Command Center attack preview is disabled while scheduled combat is active. Use the scheduled combat attack controls.";

export function isScheduledCombatActive({
  combatActive = false,
  combatOver = false,
  schedulerSource = "",
} = {}) {
  return schedulerSource === "live-initiative" || (combatActive === true && combatOver !== true);
}

export function getLegacyManualTurnOrderGate(options = {}) {
  const blocked = isScheduledCombatActive(options);
  return {
    enabled: !blocked,
    reason: blocked ? SCHEDULED_COMBAT_COMPATIBILITY_MESSAGE : "",
  };
}

export function getCommandCenterAttackGate(options = {}) {
  const blocked = isScheduledCombatActive(options);
  return {
    enabled: !blocked,
    reason: blocked ? SCHEDULED_COMBAT_ATTACK_MESSAGE : "",
  };
}

export function formatCommandActionCount(remainingActions, maxActions) {
  const remaining = Math.max(0, Number(remainingActions) || 0);
  const maximum = Math.max(remaining, Number(maxActions) || 0);
  return remaining <= 0
    ? "No actions remaining."
    : `Actions remaining: ${remaining}/${maximum}.`;
}

export default {
  formatCommandActionCount,
  getCommandCenterAttackGate,
  getLegacyManualTurnOrderGate,
  isScheduledCombatActive,
};
