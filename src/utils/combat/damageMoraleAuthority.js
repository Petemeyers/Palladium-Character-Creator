const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const clampRatio = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
};

export const DAMAGE_MORALE_THRESHOLDS = Object.freeze({
  significantHitRatio: 0.15,
  routeEligibleHitRatio: 0.25,
  pressuredHpRatio: 0.5,
  desperateHpRatio: 0.25,
  alliesDownRatio: 0.5,
});

export function getCanonicalMoraleStatus(fighter) {
  return String(
    fighter?.moraleState?.status ||
    fighter?.state?.moraleState ||
    fighter?.moraleState ||
    "STEADY",
  ).trim().toUpperCase();
}

export function hasUncontrolledBleeding(fighter) {
  const bleeding = fighter?.bleeding || fighter?.state?.bleeding || {};
  return bleeding?.active === true && bleeding?.stabilized !== true;
}

export function hasSevereRecordedWound(fighter) {
  const wounds = [
    ...(Array.isArray(fighter?.wounds) ? fighter.wounds : []),
    ...(Array.isArray(fighter?.state?.wounds) ? fighter.state.wounds : []),
  ];

  return wounds.some((wound) => {
    const severity = normalizeText(
      wound?.severity || wound?.grade || wound?.injurySeverity || wound?.depth,
    );
    return (
      severity.includes("critical") ||
      severity.includes("severe") ||
      severity.includes("major") ||
      severity.includes("deep") ||
      wound?.fracture?.present === true ||
      wound?.openFracture === true ||
      Number(wound?.vascularDamage || 0) >= 50 ||
      Number(wound?.organDamage || 0) >= 35
    );
  });
}

/**
 * Determines whether a damaging hit creates enough new pressure to justify a
 * morale roll. Ordinary chip damage does not trigger a new check merely because
 * the fighter was already shaken.
 */
export function evaluateDamageMoraleTrigger({
  defender,
  hpBefore,
  hpAfter,
  damageDealt,
  critical = false,
  bigPainHit = false,
  alliesDownRatio = 0,
  horrorFailed = false,
} = {}) {
  const maxHp = Math.max(
    1,
    Number(defender?.maxHP || defender?.maxHp || defender?.totalHP || hpBefore || 1),
  );
  const before = Math.max(0, Number.isFinite(Number(hpBefore)) ? Number(hpBefore) : maxHp);
  const after = Math.max(0, Number.isFinite(Number(hpAfter)) ? Number(hpAfter) : before);
  const damage = Math.max(0, Number(damageDealt) || Math.max(0, before - after));
  const damageRatio = clampRatio(damage / maxHp);
  const hpBeforeRatio = clampRatio(before / maxHp);
  const hpAfterRatio = clampRatio(after / maxHp);
  const allyLossRatio = clampRatio(alliesDownRatio);
  const severeWound = hasSevereRecordedWound(defender);
  const uncontrolledBleeding = hasUncontrolledBleeding(defender);

  const reasons = [];
  if (critical) reasons.push("critical-hit");
  if (bigPainHit) reasons.push("pain-stagger");
  if (damageRatio >= DAMAGE_MORALE_THRESHOLDS.significantHitRatio) {
    reasons.push("significant-damage");
  }
  if (
    hpBeforeRatio > DAMAGE_MORALE_THRESHOLDS.pressuredHpRatio &&
    hpAfterRatio <= DAMAGE_MORALE_THRESHOLDS.pressuredHpRatio
  ) {
    reasons.push("crossed-half-health");
  }
  if (
    hpBeforeRatio > DAMAGE_MORALE_THRESHOLDS.desperateHpRatio &&
    hpAfterRatio <= DAMAGE_MORALE_THRESHOLDS.desperateHpRatio
  ) {
    reasons.push("crossed-quarter-health");
  }
  if (allyLossRatio >= DAMAGE_MORALE_THRESHOLDS.alliesDownRatio) {
    reasons.push("heavy-allied-losses");
  }
  if (horrorFailed) reasons.push("horror-failure");
  if (severeWound) reasons.push("severe-wound");
  if (uncontrolledBleeding) reasons.push("uncontrolled-bleeding");

  const shouldCheck = reasons.length > 0;
  const canEscalateToRouted = (
    critical ||
    bigPainHit ||
    damageRatio >= DAMAGE_MORALE_THRESHOLDS.routeEligibleHitRatio ||
    hpAfterRatio <= DAMAGE_MORALE_THRESHOLDS.pressuredHpRatio ||
    allyLossRatio >= DAMAGE_MORALE_THRESHOLDS.alliesDownRatio ||
    horrorFailed ||
    severeWound ||
    uncontrolledBleeding
  );

  return {
    shouldCheck,
    canEscalateToRouted,
    reasons,
    primaryReason: reasons[0] || "ordinary-damage",
    maxHp,
    hpBefore: before,
    hpAfter: after,
    hpBeforeRatio,
    hpAfterRatio,
    damage,
    damageRatio,
    alliesDownRatio: allyLossRatio,
    critical: Boolean(critical),
    bigPainHit: Boolean(bigPainHit),
    horrorFailed: Boolean(horrorFailed),
    severeWound,
    uncontrolledBleeding,
    previousStatus: getCanonicalMoraleStatus(defender),
  };
}

/**
 * Prevents the legacy morale resolver from turning a routine failed damage
 * check into an immediate route. A failed check may produce SHAKEN, but ROUTED
 * requires a route-eligible trigger.
 */
export function guardDamageMoraleOutcome({ fighterBefore, outcome, trigger } = {}) {
  const previousStatus = getCanonicalMoraleStatus(fighterBefore);
  const requestedStatus = String(
    outcome?.moraleState?.status || previousStatus,
  ).trim().toUpperCase();

  if (!trigger?.shouldCheck) {
    return {
      ...(outcome || {}),
      success: true,
      result: "check-skipped-no-meaningful-trigger",
      moraleState: {
        ...(fighterBefore?.moraleState || {}),
        status: previousStatus,
      },
      suppressed: true,
      suppressionReason: "no-meaningful-damage-trigger",
      previousStatus,
      requestedStatus,
      appliedStatus: previousStatus,
    };
  }

  if (requestedStatus === "ROUTED" && trigger.canEscalateToRouted !== true) {
    const appliedStatus = previousStatus === "SHAKEN" ? "SHAKEN" : "SHAKEN";
    return {
      ...(outcome || {}),
      moraleState: {
        ...(outcome?.moraleState || fighterBefore?.moraleState || {}),
        status: appliedStatus,
        routeSuppressed: true,
        routeSuppressionReason: "damage-trigger-not-route-eligible",
      },
      suppressed: true,
      suppressionReason: "damage-trigger-not-route-eligible",
      previousStatus,
      requestedStatus,
      appliedStatus,
    };
  }

  return {
    ...(outcome || {}),
    suppressed: false,
    previousStatus,
    requestedStatus,
    appliedStatus: requestedStatus,
  };
}
