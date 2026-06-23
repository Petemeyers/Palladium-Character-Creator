const toNumber = (value) => {
  if (value === undefined || value === null || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const textOrFallback = (value, fallback) => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const sanitizeRecord = (record) => {
  const finalDamage = toNumber(record?.finalDamage);
  if (finalDamage === null || finalDamage <= 0) return null;

  return {
    id: textOrFallback(record?.id, `wound-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    timestamp: textOrFallback(record?.timestamp, new Date().toISOString()),
    ...(record?.createdRound !== undefined ? { createdRound: record.createdRound } : {}),
    attackerName: textOrFallback(record?.attackerName, "Unknown attacker"),
    targetName: textOrFallback(record?.targetName, "Unknown target"),
    attackName: textOrFallback(record?.attackName, "Basic Attack"),
    location: textOrFallback(record?.location, "Unknown"),
    severity: textOrFallback(record?.severity, "Unknown wound"),
    rawDamage: toNumber(record?.rawDamage) ?? 0,
    armorReduction: toNumber(record?.armorReduction) ?? 0,
    finalDamage,
    note: typeof record?.note === "string" ? record.note : "",
  };
};

export function createWoundRecord({
  attacker,
  target,
  attack,
  woundPreview,
  rawDamage,
  armorReduction,
  finalDamage,
  createdRound,
} = {}) {
  const finalDamageNumber = toNumber(finalDamage ?? woundPreview?.finalDamage);
  if (finalDamageNumber === null || finalDamageNumber <= 0) return null;

  return sanitizeRecord({
    id: `wound-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    createdRound,
    attackerName: attacker?.name || attacker?.attackerName,
    targetName: target?.name || target?.targetName,
    attackName: attack?.name || woundPreview?.attackName,
    location: woundPreview?.location,
    severity: woundPreview?.severity,
    rawDamage: rawDamage ?? woundPreview?.rawDamage,
    armorReduction: armorReduction ?? woundPreview?.armorReduction,
    finalDamage: finalDamageNumber,
    note: woundPreview?.note,
  });
}

export function getWoundRecords(combatant = {}) {
  if (!combatant || typeof combatant !== "object" || !Array.isArray(combatant.combatWounds)) {
    return [];
  }

  return combatant.combatWounds
    .map((record) => sanitizeRecord(record))
    .filter(Boolean);
}

export function addWoundRecord(combatant = {}, woundRecord) {
  const existing = getWoundRecords(combatant);
  const nextRecord = sanitizeRecord(woundRecord);
  if (!nextRecord) {
    return {
      ...(combatant && typeof combatant === "object" ? combatant : {}),
      combatWounds: existing,
    };
  }

  return {
    ...(combatant && typeof combatant === "object" ? combatant : {}),
    combatWounds: [...existing, nextRecord],
  };
}

export default {
  addWoundRecord,
  createWoundRecord,
  getWoundRecords,
};
