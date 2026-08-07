const normalizeText = (value) => String(value ?? "").trim().toLowerCase();
const toFinite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const WEAPON_CONDITION_TYPES = Object.freeze({
  OFF_BALANCE: "off-balance",
  GUARD_DISRUPTED: "guard-disrupted",
  SHIELD_BOUND: "shield-bound",
  WEAPON_POINT_DISPLACED: "weapon-point-displaced",
  FORMATION_DISRUPTED: "formation-disrupted",
  WEAPON_BOUND: "weapon-bound",
  FORMATION_ANCHORED: "formation-anchored",
});

const DEFAULT_PENALTIES = Object.freeze({
  [WEAPON_CONDITION_TYPES.OFF_BALANCE]: Object.freeze({ defense: -1, entry: -1, control: 0, attack: 0 }),
  [WEAPON_CONDITION_TYPES.GUARD_DISRUPTED]: Object.freeze({ defense: -1, entry: 0, control: -1, attack: 0 }),
  [WEAPON_CONDITION_TYPES.SHIELD_BOUND]: Object.freeze({ defense: -1, entry: -1, control: 0, attack: 0 }),
  [WEAPON_CONDITION_TYPES.WEAPON_POINT_DISPLACED]: Object.freeze({ defense: 0, entry: 0, control: -2, attack: 0 }),
  [WEAPON_CONDITION_TYPES.FORMATION_DISRUPTED]: Object.freeze({ defense: 0, entry: -1, control: -1, attack: 0 }),
  [WEAPON_CONDITION_TYPES.WEAPON_BOUND]: Object.freeze({ defense: -1, entry: 0, control: -1, attack: -1 }),
  [WEAPON_CONDITION_TYPES.FORMATION_ANCHORED]: Object.freeze({ defense: 0, entry: 0, control: 1, attack: 0 }),
});

const normalizeStatusType = (status) => normalizeText(
  typeof status === "string" ? status : status?.type || status?.status || status?.id,
).replaceAll("_", "-");

export const isWeaponConditionActive = (status, currentRound = null) => {
  if (!status) return false;
  if (typeof status === "string") return true;
  if (status.active === false || status.expired === true) return false;
  if (status.persistentUntilRecovered === true) return true;
  const round = Number(currentRound);
  const expiresRound = Number(status.expiresRound ?? status.expirationRound ?? status.untilRound);
  if (Number.isFinite(round) && round > 0 && Number.isFinite(expiresRound) && round > expiresRound) return false;
  return true;
};

export const getActiveWeaponConditionPenalties = (actor, currentRound = null) => {
  const statuses = Array.isArray(actor?.statusEffects) ? actor.statusEffects : [];
  const result = {
    attack: 0,
    defense: 0,
    entry: 0,
    control: 0,
    sources: [],
  };

  statuses.forEach((status) => {
    if (!isWeaponConditionActive(status, currentRound)) return;
    const type = normalizeStatusType(status);
    const defaults = DEFAULT_PENALTIES[type];
    const explicit = typeof status === "object" && status?.penalties && typeof status.penalties === "object"
      ? status.penalties
      : null;
    if (!defaults && !explicit) return;
    const penalties = {
      attack: toFinite(explicit?.attack, defaults?.attack || 0),
      defense: toFinite(explicit?.defense, defaults?.defense || 0),
      entry: toFinite(explicit?.entry, defaults?.entry || 0),
      control: toFinite(explicit?.control, defaults?.control || 0),
    };
    result.attack += penalties.attack;
    result.defense += penalties.defense;
    result.entry += penalties.entry;
    result.control += penalties.control;
    result.sources.push({
      id: typeof status === "object" ? status.id || null : null,
      type,
      penalties,
      expiresRound: typeof status === "object" ? status.expiresRound ?? null : null,
    });
  });

  // Several simultaneous temporary conditions should matter without allowing an
  // unbounded status stack to erase the d20.
  result.attack = Math.max(-4, Math.min(4, result.attack));
  result.defense = Math.max(-4, Math.min(4, result.defense));
  result.entry = Math.max(-4, Math.min(4, result.entry));
  result.control = Math.max(-4, Math.min(4, result.control));
  return result;
};

export const pruneExpiredWeaponConditions = (actor, currentRound = null) => {
  if (!actor || !Array.isArray(actor.statusEffects)) return actor;
  const statusEffects = actor.statusEffects.filter((status) => isWeaponConditionActive(status, currentRound));
  return statusEffects.length === actor.statusEffects.length ? actor : { ...actor, statusEffects };
};

export const createWeaponCondition = ({
  type,
  source,
  sourceActorId = null,
  targetActorId = null,
  currentRound = 0,
  durationRounds = 1,
  penalties = null,
  metadata = {},
} = {}) => {
  const normalizedType = normalizeText(type).replaceAll("_", "-");
  if (!normalizedType) return null;
  return Object.freeze({
    id: `${normalizedType}:${sourceActorId || "source"}:${targetActorId || "target"}:${currentRound}`,
    type: normalizedType,
    source: source || normalizedType,
    sourceActorId,
    targetActorId,
    appliedRound: toFinite(currentRound, 0),
    expiresRound: toFinite(currentRound, 0) + Math.max(0, toFinite(durationRounds, 1)),
    penalties: {
      ...(DEFAULT_PENALTIES[normalizedType] || {}),
      ...(penalties || {}),
    },
    ...metadata,
  });
};
