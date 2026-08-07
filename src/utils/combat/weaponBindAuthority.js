const normalizeText = (value) => String(value ?? "").trim().toLowerCase();
const toFinite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const WEAPON_BIND_STATES = Object.freeze({
  ACTIVE: "active",
  RELEASED: "released",
  BROKEN: "broken",
  EXPIRED: "expired",
});

export const makeWeaponBindKey = (sourceActorId, targetActorId) => `${sourceActorId || "source"}::${targetActorId || "target"}`;

export const createPersistentWeaponBind = ({
  sourceActorId,
  targetActorId,
  sourceWeaponId = null,
  targetWeaponId = null,
  currentRound = 0,
  durationRounds = 2,
  source = "weapon-bind",
  controlBonus = 1,
} = {}) => {
  if (!sourceActorId || !targetActorId || sourceActorId === targetActorId) return null;
  const bindId = `weapon-bind:${sourceActorId}:${targetActorId}:${currentRound}`;
  return Object.freeze({
    bindId,
    key: makeWeaponBindKey(sourceActorId, targetActorId),
    state: WEAPON_BIND_STATES.ACTIVE,
    source,
    sourceActorId,
    targetActorId,
    sourceWeaponId,
    targetWeaponId,
    appliedRound: toFinite(currentRound, 0),
    expiresRound: toFinite(currentRound, 0) + Math.max(1, toFinite(durationRounds, 2)),
    controlBonus: Math.max(0, toFinite(controlBonus, 1)),
  });
};

export const upsertPersistentWeaponBind = (registry, bind) => {
  if (!(registry instanceof Map) || !bind?.bindId) return null;
  for (const [key, existing] of registry.entries()) {
    if (
      existing?.state === WEAPON_BIND_STATES.ACTIVE &&
      ((existing.sourceActorId === bind.sourceActorId && existing.targetActorId === bind.targetActorId) ||
       (existing.sourceActorId === bind.targetActorId && existing.targetActorId === bind.sourceActorId))
    ) registry.delete(key);
  }
  registry.set(bind.bindId, bind);
  return bind;
};

export const releasePersistentWeaponBind = (registry, bindId, reason = "released") => {
  if (!(registry instanceof Map) || !bindId) return null;
  const existing = registry.get(bindId);
  if (!existing) return null;
  const next = { ...existing, state: reason === "expired" ? WEAPON_BIND_STATES.EXPIRED : WEAPON_BIND_STATES.RELEASED, releaseReason: reason };
  registry.set(bindId, next);
  return next;
};

const getActorId = (actor) => actor?.id || actor?._id || null;
const getWeaponId = (weapon) => normalizeText(weapon?.id || weapon?.weaponId || weapon?.profileKey || weapon?.name);

export const reconcilePersistentWeaponBinds = (registry, {
  combatants = [],
  positions = {},
  currentRound = 0,
  getWeapon = null,
  calculateDistanceFeet = null,
} = {}) => {
  if (!(registry instanceof Map)) return [];
  const actorsById = new Map((Array.isArray(combatants) ? combatants : []).map((actor) => [getActorId(actor), actor]));
  const changed = [];
  for (const [bindId, bind] of registry.entries()) {
    if (bind?.state !== WEAPON_BIND_STATES.ACTIVE) continue;
    const sourceActor = actorsById.get(bind.sourceActorId);
    const targetActor = actorsById.get(bind.targetActorId);
    let reason = null;
    if (!sourceActor || !targetActor) reason = "actor-missing";
    else if (toFinite(currentRound) > toFinite(bind.expiresRound)) reason = "expired";
    else if (sourceActor.dead || sourceActor.defeated || targetActor.dead || targetActor.defeated) reason = "actor-incapacitated";
    else {
      const sourcePos = positions?.[bind.sourceActorId];
      const targetPos = positions?.[bind.targetActorId];
      if (sourcePos && targetPos && typeof calculateDistanceFeet === "function" && Number(calculateDistanceFeet(sourcePos, targetPos)) > 5.6) {
        reason = "distance-broken";
      }
      const sourceWeapon = typeof getWeapon === "function" ? getWeapon(sourceActor) : sourceActor?.selectedAttack || sourceActor?.equippedWeapon;
      const targetWeapon = typeof getWeapon === "function" ? getWeapon(targetActor) : targetActor?.selectedAttack || targetActor?.equippedWeapon;
      if (!reason && bind.sourceWeaponId && getWeaponId(sourceWeapon) && getWeaponId(sourceWeapon) !== normalizeText(bind.sourceWeaponId)) reason = "source-weapon-changed";
      if (!reason && bind.targetWeaponId && getWeaponId(targetWeapon) && getWeaponId(targetWeapon) !== normalizeText(bind.targetWeaponId)) reason = "target-weapon-changed";
    }
    if (reason) {
      const next = { ...bind, state: reason === "expired" ? WEAPON_BIND_STATES.EXPIRED : WEAPON_BIND_STATES.BROKEN, releaseReason: reason };
      registry.set(bindId, next);
      changed.push(next);
    }
  }
  return changed;
};

export const getActiveWeaponBinds = (registry, currentRound = null) => {
  if (!(registry instanceof Map)) return [];
  return [...registry.values()].filter((bind) => (
    bind?.state === WEAPON_BIND_STATES.ACTIVE &&
    (!Number.isFinite(Number(currentRound)) || Number(currentRound) <= Number(bind.expiresRound))
  ));
};

export const getActorWeaponBindState = (registry, actorId, currentRound = null) => {
  const binds = getActiveWeaponBinds(registry, currentRound).filter((bind) => bind.sourceActorId === actorId || bind.targetActorId === actorId);
  if (!binds.length) return null;
  const bind = binds[0];
  return {
    bind,
    role: bind.sourceActorId === actorId ? "controller" : "controlled",
    opponentId: bind.sourceActorId === actorId ? bind.targetActorId : bind.sourceActorId,
  };
};

export const getWeaponBindAttackModifier = ({
  registry,
  attackerId,
  targetId,
  currentRound = null,
} = {}) => {
  const state = getActorWeaponBindState(registry, attackerId, currentRound);
  if (!state) return { applies: false, modifier: 0, reason: "not-bound" };
  if (state.opponentId !== targetId) {
    return { applies: true, modifier: -2, reason: "attacking-away-from-active-bind", ...state };
  }
  if (state.role === "controller") {
    return { applies: true, modifier: 1, reason: "controlling-active-bind", ...state };
  }
  return { applies: true, modifier: -1, reason: "weapon-controlled-in-active-bind", ...state };
};

export const resolveBreakWeaponBind = ({
  bind,
  actor,
  opponent,
  actorRoll,
  opponentRoll,
} = {}) => {
  if (!bind) return { accepted: false, reason: "bind-missing" };
  const actorMod = Math.floor((toFinite(actor?.attributes?.might ?? actor?.str, 10) - 10) / 2) + toFinite(actor?.proficiencyBonus, 0);
  const opponentMod = Math.floor((toFinite(opponent?.attributes?.might ?? opponent?.str, 10) - 10) / 2) + toFinite(opponent?.proficiencyBonus, 0) + toFinite(bind.controlBonus, 0);
  const actorScore = Math.max(1, Math.min(20, toFinite(actorRoll, 1))) + actorMod;
  const opponentScore = Math.max(1, Math.min(20, toFinite(opponentRoll, 1))) + opponentMod;
  return {
    accepted: true,
    broken: actorScore > opponentScore,
    actorScore,
    opponentScore,
    margin: actorScore - opponentScore,
    bindId: bind.bindId,
  };
};
