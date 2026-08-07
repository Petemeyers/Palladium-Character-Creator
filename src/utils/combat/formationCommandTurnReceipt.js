const RECOVERY_COMMAND_IDS = new Set(["reform-line", "rally-formation"]);

export const recordFormationCommandReceipt = (actor, {
  commandId,
  success = true,
  initiativeTurnId = null,
  currentRound = null,
} = {}) => {
  if (!actor || !commandId) return actor;
  return {
    ...actor,
    formationState: {
      ...(actor.formationState || {}),
      lastCommandReceipt: {
        commandId,
        success: success !== false,
        initiativeTurnId: initiativeTurnId || null,
        round: Number.isFinite(Number(currentRound)) ? Number(currentRound) : null,
      },
    },
  };
};

export const filterFormationCommandOptionsForTurnReceipt = ({
  actor,
  options = [],
  initiativeTurnId = null,
} = {}) => {
  if (!Array.isArray(options) || options.length === 0) return [];
  const receipt = actor?.formationState?.lastCommandReceipt;
  if (!receipt || !initiativeTurnId || receipt.initiativeTurnId !== initiativeTurnId) return options;
  return options.filter((option) => {
    if (option?.id === receipt.commandId) return false;
    if (receipt.success !== false && RECOVERY_COMMAND_IDS.has(receipt.commandId) && RECOVERY_COMMAND_IDS.has(option?.id)) {
      return false;
    }
    return true;
  });
};
