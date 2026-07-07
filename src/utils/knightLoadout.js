const DAGGER = Object.freeze({
  name: "Dagger",
  type: "weapon",
  category: "one-handed",
  damage: "1d4",
  reach: 1,
  lengthFt: 1,
  usableInClinch: true,
});

const text = (...values) => values.filter(Boolean).join(" ").toLowerCase();
const itemName = (item) => typeof item === "string" ? item : item?.name;

export function isKnightProfile(actor = {}) {
  return /\bknight\b/.test(text(
    actor.id,
    actor.name,
    actor.role,
    actor.profession,
    actor.className,
    actor.publicClassName,
    actor.modelKey,
    actor.selectableActorId,
  ));
}

export function hasKnightCloseWeapon(actor = {}) {
  const candidates = [
    ...(Array.isArray(actor.inventory) ? actor.inventory : []),
    ...(Array.isArray(actor.equipment) ? actor.equipment : []),
    ...(Array.isArray(actor.equistaminadWeapons) ? actor.equistaminadWeapons : []),
    ...(Array.isArray(actor.equippedWeapons) ? actor.equippedWeapons : []),
    ...(Array.isArray(actor.attacks) ? actor.attacks : []),
  ];
  return candidates.some((item) => /dagger|knife|short blade/i.test(String(itemName(item) || "")));
}

export function ensureKnightCloseWeaponLoadout(actor = {}) {
  if (!actor || typeof actor !== "object") return actor;
  let normalized = actor;
  if (isKnightProfile(actor) && !hasKnightCloseWeapon(actor)) {
    normalized = {
      ...actor,
      inventory: [
        ...(Array.isArray(actor.inventory) ? actor.inventory.map((item) => (
          item && typeof item === "object" ? { ...item } : item
        )) : []),
        { ...DAGGER },
      ],
    };
  }
  if (normalized.autoRollCharacter && typeof normalized.autoRollCharacter === "object") {
    const autoRollCharacter = ensureKnightCloseWeaponLoadout(normalized.autoRollCharacter);
    if (autoRollCharacter !== normalized.autoRollCharacter) {
      normalized = { ...normalized, autoRollCharacter };
    }
  }
  return normalized;
}

export const KNIGHT_FALLBACK_DAGGER = DAGGER;

export default ensureKnightCloseWeaponLoadout;
