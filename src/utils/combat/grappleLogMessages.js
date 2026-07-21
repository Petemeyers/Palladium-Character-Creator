export function formatArmorGapContactOutcomeLog({
  attackerLabel = "Attacker",
  targetLabel = "Target",
  rolledDamage = 0,
  hpDamageApplied = 0,
  finalHP = 0,
  maxHP = 0,
  critical = false,
} = {}) {
  if ((Number(hpDamageApplied) || 0) <= 0) {
    return {
      injured: false,
      type: "info",
      message: `${attackerLabel} reaches an armor opening on ${targetLabel}, but the thrust fails to wound. (HP: ${finalHP}/${maxHP})`,
    };
  }
  return {
    injured: true,
    type: critical ? "critical" : "warning",
    message: `${targetLabel} takes ${rolledDamage} damage from ${attackerLabel} (armor bypassed - weak point struck)! (HP: ${finalHP}/${maxHP})`,
  };
}

export default formatArmorGapContactOutcomeLog;
