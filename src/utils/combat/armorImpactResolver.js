export function resolveArmorImpactEffect({
  attackMode,
  hitLocation,
  critical = false,
  attackMargin = 0,
  contactResult = {},
  rng,
} = {}) {
  if (!contactResult || contactResult.damageAllowed) {
    return { checkRequired: false, reason: "bodily-damage-path" };
  }

  const mode = String(attackMode || contactResult.attackMode || "");
  const location = String(hitLocation || contactResult.hitLocation || "");
  const isPommel = mode.includes("pommel") || mode.includes("crossguard");
  const highImpactCut = critical || Number(attackMargin) >= 8;
  let effectType = null;
  let dc = null;

  if (isPommel && location === "head") {
    effectType = "stagger";
    dc = critical ? 14 : 12;
  } else if (isPommel && location === "legs") {
    effectType = "knockdown";
    dc = critical ? 14 : 12;
  } else if (highImpactCut && (location === "head" || location === "torso")) {
    effectType = "stagger";
    dc = critical ? 13 : 11;
  } else if (highImpactCut && location === "legs") {
    effectType = "knockdown";
    dc = critical ? 13 : 11;
  }

  if (!effectType) {
    return { checkRequired: false, reason: "ordinary-plate-contact-no-status" };
  }

  const roll = typeof rng === "function" ? Number(rng()) : null;
  const success = roll == null ? false : roll >= dc;
  return {
    checkRequired: true,
    effectType,
    dc,
    roll,
    success,
    statusApplied: success ? (effectType === "knockdown" ? "OFF_BALANCE" : "STAGGERED") : null,
    duration: success ? 1 : 0,
    reason: `${mode || "armor impact"}-${location || "unknown"}`,
  };
}
