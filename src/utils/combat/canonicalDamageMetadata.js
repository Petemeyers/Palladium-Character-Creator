const normalize = (value) => String(value ?? "").trim().toLowerCase().replaceAll("_", "-");

const DAMAGE_TYPE_ALIASES = Object.freeze({
  cut: "slashing",
  cutting: "slashing",
  slash: "slashing",
  slashing: "slashing",
  thrust: "piercing",
  stab: "piercing",
  piercing: "piercing",
  puncture: "piercing",
  blunt: "bludgeoning",
  bludgeon: "bludgeoning",
  bludgeoning: "bludgeoning",
  impact: "bludgeoning",
  control: "control",
  grapple: "control",
});

export function normalizeCanonicalDamageType(value) {
  const key = normalize(value);
  return DAMAGE_TYPE_ALIASES[key] || (key || null);
}

const locationOf = (value) => {
  if (!value) return null;
  if (typeof value === "string") return normalize(value) || null;
  return normalize(value.location || value.hitLocation || value.bodyLocation) || null;
};

export function resolveCanonicalDamageType({ attack = {}, contact = {}, impact = {}, projectile = false } = {}) {
  const explicit = normalizeCanonicalDamageType(
    contact.convertedDamageType || contact.damageType || impact.damageType ||
    attack.damageType || attack.typeOfDamage || attack.damageKind,
  );
  if (explicit) return explicit;
  const text = [
    attack.name,
    attack.attackMode,
    attack.selectedTechnique,
    attack.armorTechnique,
    attack.type,
    attack.weaponType,
    attack.category,
  ].map(normalize).join(" ");
  if (projectile || /arrow|bolt|bow|crossbow|thrust|stab|spear|dagger|knife|gore|horn/.test(text)) return "piercing";
  if (/cut|slash|edge|sword|axe|claw/.test(text)) return "slashing";
  if (/pommel|crossguard|mace|hammer|club|headbutt|slam|punch|kick|rock|blunt|impact/.test(text)) return "bludgeoning";
  if (/grapple|clinch|control|hold/.test(text)) return "control";
  return null;
}

export function resolveCanonicalDamageMetadata({
  attack = {},
  contact = {},
  impact = null,
  projectile = false,
} = {}) {
  const damageType = resolveCanonicalDamageType({ attack, contact, impact: impact || {}, projectile });
  const hitLocation = locationOf(contact.hitLocation) || locationOf(impact) || null;
  return Object.freeze({
    damageType,
    hitLocation,
    valid: Boolean(damageType && hitLocation),
    missing: [
      ...(!damageType ? ["damageType"] : []),
      ...(!hitLocation ? ["hitLocation"] : []),
    ],
  });
}

export function validateCanonicalHpMutationMetadata({ damage = 0, damageType, hitLocation } = {}) {
  if (!(Number(damage) > 0)) return { valid: true, reason: "no-bodily-damage" };
  const normalizedType = normalizeCanonicalDamageType(damageType);
  const normalizedLocation = locationOf(hitLocation);
  if (!normalizedType || !normalizedLocation) {
    return {
      valid: false,
      reason: "missing-canonical-damage-metadata",
      missing: [
        ...(!normalizedType ? ["damageType"] : []),
        ...(!normalizedLocation ? ["hitLocation"] : []),
      ],
    };
  }
  return { valid: true, damageType: normalizedType, hitLocation: normalizedLocation };
}

export default resolveCanonicalDamageMetadata;
