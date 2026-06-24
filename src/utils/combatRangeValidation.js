const hasValue = (value) => value !== undefined && value !== null && value !== "";

const toNumber = (value) => {
  if (!hasValue(value) || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const parseFeet = (value) => {
  const number = toNumber(value);
  if (number !== null) return number;
  const match = String(value || "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
};

const cleanText = (value, fallback = "") => {
  if (typeof value === "string") {
    const trimmed = value.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
};

const getPosition = (combatant) => {
  if (!combatant || typeof combatant !== "object") return null;
  const position =
    combatant.position ||
    combatant.mapPosition ||
    combatant.hex ||
    combatant.coordinates ||
    combatant.location ||
    combatant;
  const x = toNumber(position?.x);
  const y = toNumber(position?.y);
  return x !== null && y !== null ? { x, y } : null;
};

const getExplicitDistance = (attacker, target) => {
  const values = [
    target?.distanceFt,
    target?.distanceFeet,
    target?.targetDistanceFt,
    target?.rangeDistanceFt,
    attacker?.targetDistanceFt,
    attacker?.distanceToTargetFt,
  ];
  for (const value of values) {
    const distance = parseFeet(value);
    if (distance !== null) return distance;
  }
  return null;
};

export function getDistanceBetweenCombatants(attacker, target) {
  const explicitDistance = getExplicitDistance(attacker, target);
  if (explicitDistance !== null) return explicitDistance;

  const from = getPosition(attacker);
  const to = getPosition(target);
  if (!from || !to) return null;

  const dx = Math.abs(from.x - to.x);
  const dy = Math.abs(from.y - to.y);
  return Math.max(dx, dy) * 5;
}

const inferRangeType = (attack = {}, reachFt, rangeFt) => {
  const attackText = [
    attack?.rangeType,
    attack?.attackType,
    attack?.type,
    attack?.category,
    attack?.weaponType,
    attack?.name,
    attack?.label,
  ].map((value) => cleanText(value).toLowerCase()).join(" ");

  if (/\b(ranged|range|bow|crossbow|sling|thrown|javelin|dart)\b/.test(attackText)) return "ranged";
  if (/\b(melee|close|reach|sword|axe|mace|spear|dagger|knife|unarmed|bite|claw)\b/.test(attackText)) return "melee";
  if (rangeFt !== null && (reachFt === null || rangeFt > reachFt)) return "ranged";
  if (reachFt !== null) return "melee";
  return "unknown";
};

export function getAttackReachOrRange(attack = {}) {
  if (!attack || typeof attack !== "object" || typeof attack === "function") {
    return {
      reachFt: null,
      rangeFt: null,
      rangeType: "unknown",
    };
  }

  const reachFt = parseFeet(
    attack.reachFt ??
    attack.reach ??
    attack.metadata?.reachFt ??
    attack.metadata?.reach
  );
  const rangeFt = parseFeet(
    attack.rangeFt ??
    attack.range ??
    attack.normalRangeFt ??
    attack.normalRange ??
    attack.metadata?.rangeFt ??
    attack.metadata?.range
  );
  const rangeType = inferRangeType(attack, reachFt, rangeFt);

  return {
    reachFt,
    rangeFt,
    rangeType,
  };
}

export function validateAttackRange({ attacker, target, attack } = {}) {
  const distanceFt = getDistanceBetweenCombatants(attacker, target);
  const { reachFt, rangeFt, rangeType } = getAttackReachOrRange(attack);
  const effectiveRangeFt = rangeType === "ranged" ? rangeFt : reachFt;

  if (distanceFt === null || effectiveRangeFt === null || rangeType === "unknown") {
    return {
      distanceFt,
      reachFt,
      rangeFt,
      inRange: null,
      rangeType,
      message: "Range unknown.",
      suggestedAction: "",
    };
  }

  const inRange = distanceFt <= effectiveRangeFt;
  if (inRange) {
    return {
      distanceFt,
      reachFt,
      rangeFt,
      inRange: true,
      rangeType,
      message: "Target in range.",
      suggestedAction: "",
    };
  }

  return {
    distanceFt,
    reachFt,
    rangeFt,
    inRange: false,
    rangeType,
    message: rangeType === "ranged"
      ? "Target out of range. Move closer or choose another ranged weapon."
      : "Target out of reach. Move closer or choose a ranged weapon.",
    suggestedAction: rangeType === "ranged"
      ? "Move closer or choose another ranged weapon."
      : "Move, Run, Charge, or select a ranged attack.",
  };
}

export default {
  getAttackReachOrRange,
  getDistanceBetweenCombatants,
  validateAttackRange,
};
