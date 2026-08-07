import {
  WEAPON_BIND_STATES,
  createPersistentWeaponBind,
  releasePersistentWeaponBind,
  upsertPersistentWeaponBind,
} from "./weaponBindAuthority.js";

const toFinite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const WEAPON_BIND_ACTIONS = Object.freeze({
  BREAK_BIND: "break-bind",
  REVERSE_BIND: "reverse-bind",
  STRIKE_FROM_BIND: "strike-from-bind",
  GRAPPLE_FROM_BIND: "grapple-from-bind",
  YIELD_AND_WITHDRAW: "yield-and-withdraw",
  RELEASE_WEAPON: "release-weapon",
  RELEASE_BIND: "release-bind",
});

const ACTIONS = Object.freeze({
  [WEAPON_BIND_ACTIONS.BREAK_BIND]: Object.freeze({ id: WEAPON_BIND_ACTIONS.BREAK_BIND, label: "Break Bind", actionCost: 1, staminaCost: 1 }),
  [WEAPON_BIND_ACTIONS.REVERSE_BIND]: Object.freeze({ id: WEAPON_BIND_ACTIONS.REVERSE_BIND, label: "Reverse the Bind", actionCost: 1, staminaCost: 2 }),
  [WEAPON_BIND_ACTIONS.STRIKE_FROM_BIND]: Object.freeze({ id: WEAPON_BIND_ACTIONS.STRIKE_FROM_BIND, label: "Strike from the Bind", actionCost: 1, staminaCost: 1 }),
  [WEAPON_BIND_ACTIONS.GRAPPLE_FROM_BIND]: Object.freeze({ id: WEAPON_BIND_ACTIONS.GRAPPLE_FROM_BIND, label: "Grapple from the Bind", actionCost: 1, staminaCost: 2 }),
  [WEAPON_BIND_ACTIONS.YIELD_AND_WITHDRAW]: Object.freeze({ id: WEAPON_BIND_ACTIONS.YIELD_AND_WITHDRAW, label: "Yield and Withdraw", actionCost: 1, staminaCost: 1 }),
  [WEAPON_BIND_ACTIONS.RELEASE_WEAPON]: Object.freeze({ id: WEAPON_BIND_ACTIONS.RELEASE_WEAPON, label: "Release Weapon", actionCost: 1, staminaCost: 0 }),
  [WEAPON_BIND_ACTIONS.RELEASE_BIND]: Object.freeze({ id: WEAPON_BIND_ACTIONS.RELEASE_BIND, label: "Release Bind", actionCost: 0, staminaCost: 0 }),
});

export const getWeaponBindCounterplayOptions = ({ bindState, canWithdraw = false, canGrapple = true, canReleaseWeapon = true } = {}) => {
  if (!bindState?.bind || bindState.bind.state !== WEAPON_BIND_STATES.ACTIVE) return [];
  const role = bindState.role;
  if (role === "controller") {
    return [
      ACTIONS[WEAPON_BIND_ACTIONS.STRIKE_FROM_BIND],
      ...(canGrapple ? [ACTIONS[WEAPON_BIND_ACTIONS.GRAPPLE_FROM_BIND]] : []),
      ACTIONS[WEAPON_BIND_ACTIONS.RELEASE_BIND],
    ];
  }
  return [
    ACTIONS[WEAPON_BIND_ACTIONS.BREAK_BIND],
    ACTIONS[WEAPON_BIND_ACTIONS.REVERSE_BIND],
    ACTIONS[WEAPON_BIND_ACTIONS.STRIKE_FROM_BIND],
    ...(canGrapple ? [ACTIONS[WEAPON_BIND_ACTIONS.GRAPPLE_FROM_BIND]] : []),
    ...(canWithdraw ? [ACTIONS[WEAPON_BIND_ACTIONS.YIELD_AND_WITHDRAW]] : []),
    ...(canReleaseWeapon ? [ACTIONS[WEAPON_BIND_ACTIONS.RELEASE_WEAPON]] : []),
  ];
};

const abilityModifier = (actor, useDeftness = false) => {
  const score = toFinite(
    useDeftness
      ? actor?.attributes?.deftness ?? actor?.dex ?? actor?.deftness
      : actor?.attributes?.might ?? actor?.str ?? actor?.might,
    10,
  );
  const training = toFinite(actor?.weaponTraining ?? actor?.proficiencyBonus ?? actor?.training?.weapon, 0);
  const stamina = toFinite(actor?.combatStamina?.current ?? actor?.stamina, 0);
  const fatiguePenalty = stamina <= 0 ? -2 : stamina <= 5 ? -1 : 0;
  return Math.floor((score - 10) / 2) + training + fatiguePenalty;
};

export const resolveWeaponBindCounterplay = ({
  actionId,
  bindState,
  actor,
  opponent,
  actorRoll = 10,
  opponentRoll = 10,
  currentRound = 0,
} = {}) => {
  const action = ACTIONS[actionId];
  const bind = bindState?.bind;
  if (!action || !bind || bind.state !== WEAPON_BIND_STATES.ACTIVE) return { accepted: false, reason: "no-active-bind" };
  const base = {
    accepted: true,
    action,
    bindId: bind.bindId,
    actorId: actor?.id || actor?._id || null,
    opponentId: opponent?.id || opponent?._id || null,
    staminaCost: action.staminaCost,
    actionCost: action.actionCost,
    currentRound,
    success: true,
  };

  if (actionId === WEAPON_BIND_ACTIONS.STRIKE_FROM_BIND) {
    return { ...base, continueAttack: true, attackModifier: bindState.role === "controller" ? 1 : -1, maintainBind: true };
  }
  if (actionId === WEAPON_BIND_ACTIONS.GRAPPLE_FROM_BIND) {
    return { ...base, routeToGrapple: true, grappleControlModifier: bindState.role === "controller" ? 1 : 0, maintainBind: true };
  }
  if (actionId === WEAPON_BIND_ACTIONS.RELEASE_BIND) {
    return { ...base, releaseBind: true, releaseReason: "controller-released-bind" };
  }
  if (actionId === WEAPON_BIND_ACTIONS.YIELD_AND_WITHDRAW) {
    return { ...base, releaseBind: true, releaseReason: "yielded-and-withdrew", requiresWithdrawalHex: true };
  }
  if (actionId === WEAPON_BIND_ACTIONS.RELEASE_WEAPON) {
    return { ...base, releaseBind: true, releaseReason: "controlled-weapon-released", dropControlledWeapon: true };
  }

  const useDeftness = actionId === WEAPON_BIND_ACTIONS.REVERSE_BIND;
  const actorScore = Math.max(1, Math.min(20, toFinite(actorRoll, 10))) + abilityModifier(actor, useDeftness);
  const opponentScore = Math.max(1, Math.min(20, toFinite(opponentRoll, 10))) + abilityModifier(opponent, false) + toFinite(bind.controlBonus, 0);
  const margin = actorScore - opponentScore;
  const success = actionId === WEAPON_BIND_ACTIONS.REVERSE_BIND ? margin >= 2 : margin > 0;
  return {
    ...base,
    actorScore,
    opponentScore,
    margin,
    success,
    breakBind: success && actionId === WEAPON_BIND_ACTIONS.BREAK_BIND,
    reverseBind: success && actionId === WEAPON_BIND_ACTIONS.REVERSE_BIND,
    maintainBind: !success,
  };
};

export const applyWeaponBindCounterplay = ({ registry, resolution, bindState, currentRound = 0 } = {}) => {
  if (!(registry instanceof Map) || !resolution?.accepted || !bindState?.bind) return null;
  const bind = bindState.bind;
  if (resolution.releaseBind || resolution.breakBind) {
    return releasePersistentWeaponBind(registry, bind.bindId, resolution.releaseReason || "bind-broken");
  }
  if (resolution.reverseBind) {
    releasePersistentWeaponBind(registry, bind.bindId, "bind-reversed");
    const reversed = createPersistentWeaponBind({
      sourceActorId: bind.targetActorId,
      targetActorId: bind.sourceActorId,
      sourceWeaponId: bind.targetWeaponId,
      targetWeaponId: bind.sourceWeaponId,
      currentRound,
      durationRounds: Math.max(1, Number(bind.expiresRound) - Number(currentRound)),
      source: "reverse-bind",
      controlBonus: Math.max(1, toFinite(bind.controlBonus, 1)),
    });
    return upsertPersistentWeaponBind(registry, reversed);
  }
  return bind;
};

export const selectAutomatedWeaponBindAction = ({ bindState, actor, canWithdraw = false, canGrapple = true } = {}) => {
  const options = getWeaponBindCounterplayOptions({ bindState, canWithdraw, canGrapple });
  if (options.length === 0) return null;
  const stamina = toFinite(actor?.combatStamina?.current ?? actor?.stamina, 0);
  const find = (id) => options.find((option) => option.id === id) || null;
  if (bindState.role === "controller") {
    if (canGrapple && stamina >= 4) return find(WEAPON_BIND_ACTIONS.GRAPPLE_FROM_BIND) || find(WEAPON_BIND_ACTIONS.STRIKE_FROM_BIND);
    return find(WEAPON_BIND_ACTIONS.STRIKE_FROM_BIND) || find(WEAPON_BIND_ACTIONS.RELEASE_BIND);
  }
  if (stamina <= 2 && canWithdraw) return find(WEAPON_BIND_ACTIONS.YIELD_AND_WITHDRAW) || find(WEAPON_BIND_ACTIONS.RELEASE_WEAPON);
  return find(WEAPON_BIND_ACTIONS.BREAK_BIND) || find(WEAPON_BIND_ACTIONS.REVERSE_BIND) || find(WEAPON_BIND_ACTIONS.STRIKE_FROM_BIND);
};
