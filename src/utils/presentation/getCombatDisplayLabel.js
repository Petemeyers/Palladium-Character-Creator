export function getCombatDisplayLabel(value, fallback = "Unknown") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    return value.map((entry) => getCombatDisplayLabel(entry, "")).filter(Boolean).join(", ") || fallback;
  }
  if (typeof value === "object") {
    return String(
      value.displayName ?? value.name ?? value.label ?? value.profileKey ??
      value.weaponId ?? value.actorKey ?? value.id ?? fallback
    );
  }
  return String(value);
}

export default getCombatDisplayLabel;
