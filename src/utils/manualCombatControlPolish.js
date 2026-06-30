const safeText = (value, fallback = "") => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim() || fallback;
  }
  return fallback;
};

export function chooseManualAttackTarget(availableTargets = [], currentTargetId = "") {
  const targets = Array.isArray(availableTargets) ? availableTargets : [];
  const currentId = safeText(currentTargetId);
  if (currentId && targets.some((target) => safeText(target?.id) === currentId)) return currentId;
  return targets.length === 1 ? safeText(targets[0]?.id) : "";
}

export function chooseManualAttackWeapon(attackChoices = [], currentAttackIndex = "") {
  const choices = Array.isArray(attackChoices) ? attackChoices : [];
  const currentIndex = safeText(currentAttackIndex);
  const currentChoice = choices.find((choice) => String(choice?.index) === currentIndex);

  if (currentChoice && currentChoice.validation?.inRange !== false) {
    return { attackIndex: currentIndex, invalidReason: "" };
  }

  const legalChoices = choices.filter((choice) => choice?.validation?.inRange !== false);
  return {
    attackIndex: legalChoices.length === 1 ? String(legalChoices[0].index) : "",
    invalidReason: currentChoice?.validation?.message || "",
  };
}

export function buildManualQuickAttackState({
  attacker = null,
  target = null,
  attack = null,
  rangeValidation = {},
  rangedRangeModifier = {},
  remainingActions = null,
  combatOver = false,
} = {}) {
  const targetName = safeText(target?.name || target?.summary?.name, "target");
  const attackName = safeText(attack?.name || attack?.attackName, "selected weapon");
  const distanceFt = Number(rangeValidation?.distanceFt);
  const reachFt = Number(rangeValidation?.reachFt);

  let disabledReason = "";
  if (combatOver) disabledReason = "Combat is over.";
  else if (!attacker) disabledReason = "Choose an attacker.";
  else if (!target) disabledReason = "Choose a target.";
  else if (!attack) disabledReason = "Choose a weapon.";
  else if (remainingActions !== null && Number(remainingActions) <= 0) disabledReason = "No actions remaining.";
  else if (rangeValidation?.inRange === false) {
    disabledReason = rangeValidation?.rangeType === "melee" && Number.isFinite(distanceFt)
      ? `${attackName} is melee-only at ${distanceFt} ft. Move within ${Number.isFinite(reachFt) ? reachFt : 5} ft or choose a ranged weapon.`
      : safeText(rangeValidation?.message, "Target is out of range.");
  }

  const isRanged = rangedRangeModifier?.isRanged === true;
  const verb = isRanged ? "Shoot" : "Strike";
  let label = `${verb} ${targetName} with ${attackName}`;
  if (isRanged && Number.isFinite(Number(rangedRangeModifier?.distanceFt))) {
    const maxRange = Number.isFinite(Number(rangedRangeModifier?.maxRangeFt))
      ? Number(rangedRangeModifier.maxRangeFt)
      : "?";
    const band = safeText(rangedRangeModifier?.bandLabel, "Range pending");
    label += ` - ${Number(rangedRangeModifier.distanceFt)}/${maxRange} ft, ${band}`;
  }

  return {
    enabled: !disabledReason,
    disabledReason,
    label,
  };
}

export default {
  chooseManualAttackTarget,
  chooseManualAttackWeapon,
  buildManualQuickAttackState,
};
