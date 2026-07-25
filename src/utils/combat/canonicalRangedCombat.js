const key = (value) => String(value || "").trim().toLowerCase();
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const PROJECTILE_DELIVERY_TYPES = Object.freeze(["projectile", "thrown"]);

export function isCanonicalProjectileProfile(profile = {}) {
  return PROJECTILE_DELIVERY_TYPES.includes(key(profile.deliveryType));
}
export function normalizeCanonicalAmmunitionState(actor = {}, weaponProfile = null) {
  const profile = weaponProfile || (actor.weaponProfiles || []).find(isCanonicalProjectileProfile) || null;
  if (!profile || key(profile.deliveryType) === "thrown") return null;
  const ammunitionType = key(profile.ammunitionType || profile.ammunition).replace(/s$/, "");
  if (!ammunitionType) return null;
  const existing = actor.ammunitionState && key(actor.ammunitionState.weaponId) === key(profile.weaponId)
    ? actor.ammunitionState
    : {};
  const aliases = new Set([ammunitionType, `${ammunitionType}s`]);
  const inventoryCount = (actor.inventory || []).reduce((sum, item) => (
    aliases.has(key(item.ammunitionType || item.name).replace(/^ordinary-/, ""))
      ? sum + Math.max(0, number(item.quantity, 1))
      : sum
  ), 0);
  const maximum = Math.max(0, number(existing.maximum, inventoryCount));
  const current = Math.min(maximum, Math.max(0, number(existing.current, inventoryCount)));
  const isCrossbow = key(profile.weaponFamily) === "crossbow";
  const chambered = isCrossbow ? existing.chambered === true : false;
  return Object.freeze({
    weaponId: profile.weaponId,
    ammunitionType,
    current,
    maximum,
    chambered,
    reloadState: isCrossbow ? (chambered ? "loaded" : key(existing.reloadState) || "reload-required") : "ready",
    lastSpentActionToken: existing.lastSpentActionToken || null,
    spentActionTokens: Object.freeze([...(existing.spentActionTokens || [])]),
  });
}
export function validateCanonicalRangedAttack({
  actor = {},
  target = {},
  weaponProfile = {},
  ammunitionState = actor.ammunitionState,
  actionToken,
  activeActionToken,
  distanceFeet,
  lineOfSight = true,
  obstruction = false,
  cover = null,
  firingIntoMelee = false,
} = {}) {
  const reject = (reason) => ({ accepted: false, reason, rollAllowed: false, ammunitionSpendAllowed: false });
  if (!isCanonicalProjectileProfile(weaponProfile)) return reject("invalid-delivery-type");
  if (!actionToken || (activeActionToken && actionToken !== activeActionToken)) return reject("stale-action-token");
  if (!actor.id || !target.id || actor.dead || actor.unconscious || actor.surrendered || actor.captured || actor.routed) return reject("actor-cannot-fire");
  if (actor.grappleState?.active || actor.grappled || actor.isGrappling) return reject("weapon-unavailable-in-grapple");
  const distance = number(distanceFeet, Infinity);
  const normal = number(weaponProfile.normalRangeFeet ?? weaponProfile.rangeProfile?.normal, 0);
  const long = number(weaponProfile.longRangeFeet ?? weaponProfile.rangeProfile?.long, normal);
  if (!Number.isFinite(distance) || distance > long) return reject("target-out-of-range");
  if (!lineOfSight || obstruction) return reject("line-of-sight-blocked");
  if (key(weaponProfile.deliveryType) === "projectile") {
    const state = ammunitionState || normalizeCanonicalAmmunitionState(actor, weaponProfile);
    if (!state || state.current < number(weaponProfile.ammunitionPerAttack, 1)) return reject("ammunition-empty");
    if (key(weaponProfile.weaponFamily) === "crossbow" && (!state.chambered || state.reloadState !== "loaded")) return reject("reload-required");
  }
  return {
    accepted: true,
    reason: null,
    rollAllowed: true,
    ammunitionSpendAllowed: true,
    rangeBand: distance <= normal ? "normal" : "long",
    cover,
    firingIntoMelee: Boolean(firingIntoMelee),
    actionToken,
  };
}
export function claimCanonicalAmmunitionSpend({
  ammunitionState,
  weaponProfile,
  actionToken,
  activeActionToken,
} = {}) {
  const reject = (reason) => ({ accepted: false, reason, eventType: "ranged-ammunition-spend-rejected", ammunitionState });
  if (!actionToken || (activeActionToken && actionToken !== activeActionToken)) return reject("stale-action-token");
  if (!isCanonicalProjectileProfile(weaponProfile) || key(weaponProfile.deliveryType) === "thrown") return reject("invalid-ammunition-weapon");
  if (key(ammunitionState?.weaponId) !== key(weaponProfile.weaponId)) return reject("ammunition-weapon-mismatch");
  if ((ammunitionState?.spentActionTokens || []).includes(actionToken) || ammunitionState?.lastSpentActionToken === actionToken) return reject("duplicate-ammunition-spend");
  const amount = number(weaponProfile.ammunitionPerAttack, 1);
  if (number(ammunitionState?.current) < amount) return { ...reject("ammunition-empty"), eventType: "ranged-ammunition-empty" };
  if (key(weaponProfile.weaponFamily) === "crossbow" && (!ammunitionState.chambered || ammunitionState.reloadState !== "loaded")) {
    return { ...reject("reload-required"), eventType: "ranged-reload-required" };
  }
  return {
    accepted: true,
    eventType: "ranged-ammunition-spend-claimed",
    claim: Object.freeze({ actionToken, weaponId: weaponProfile.weaponId, ammunitionType: ammunitionState.ammunitionType, amount }),
  };
}

export function commitCanonicalAmmunitionSpend({ ammunitionState, weaponProfile, claim } = {}) {
  if (!claim || claim.weaponId !== weaponProfile?.weaponId || claim.ammunitionType !== ammunitionState?.ammunitionType) {
    return { accepted: false, reason: "invalid-ammunition-claim", eventType: "ranged-ammunition-spend-rejected", ammunitionState };
  }
  if ((ammunitionState.spentActionTokens || []).includes(claim.actionToken)) {
    return { accepted: false, reason: "duplicate-ammunition-spend", eventType: "ranged-ammunition-spend-rejected", ammunitionState };
  }
  const isCrossbow = key(weaponProfile.weaponFamily) === "crossbow";
  const next = Object.freeze({
    ...ammunitionState,
    current: ammunitionState.current - claim.amount,
    chambered: isCrossbow ? false : ammunitionState.chambered,
    reloadState: isCrossbow ? "reload-required" : ammunitionState.reloadState,
    lastSpentActionToken: claim.actionToken,
    spentActionTokens: Object.freeze([...(ammunitionState.spentActionTokens || []), claim.actionToken]),
  });
  return { accepted: true, eventType: "ranged-ammunition-spend-committed", ammunitionState: next };
}

export function completeCanonicalRangedReload({ ammunitionState, weaponProfile, actionToken, activeActionToken } = {}) {
  const rejected = (reason) => ({ accepted: false, reason, eventType: "ranged-ammunition-spend-rejected", ammunitionState });
  if (key(weaponProfile?.weaponFamily) !== "crossbow") return rejected("weapon-does-not-require-reload");
  if (!actionToken || (activeActionToken && actionToken !== activeActionToken)) return rejected("stale-action-token");
  if (ammunitionState.current <= 0) return { ...rejected("ammunition-empty"), eventType: "ranged-ammunition-empty" };
  return {
    accepted: true,
    eventType: "ranged-reload-completed",
    ammunitionState: Object.freeze({ ...ammunitionState, chambered: true, reloadState: "loaded" }),
  };
}
