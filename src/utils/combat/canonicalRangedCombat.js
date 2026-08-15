const key = (value) => String(value || "").trim().toLowerCase();
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const PROJECTILE_DELIVERY_TYPES = Object.freeze(["projectile", "thrown"]);

export function isCanonicalProjectileProfile(profile = {}) {
  return PROJECTILE_DELIVERY_TYPES.includes(key(profile?.deliveryType));
}

export function normalizeCanonicalRangedWeaponProfile(profile = {}) {
  if (!profile || typeof profile !== "object") return profile;
  const explicitDelivery = key(profile.deliveryType || profile.deliveryMethod);
  if (explicitDelivery && !PROJECTILE_DELIVERY_TYPES.includes(explicitDelivery)) return profile;
  const classifications = [
    profile.attackType,
    profile.type,
    profile.kind,
    profile.category,
    profile.weaponType,
    profile.attackMode,
    profile.rangeCategory,
  ].map(key);
  const name = key(profile.name || profile.displayName);
  const thrown = explicitDelivery === "thrown"
    || profile.isThrown === true
    || classifications.includes("thrown")
    || /\bthrow|thrown\b/.test(name);
  const projectile = explicitDelivery === "projectile"
    || profile.isRanged === true
    || profile.isProjectile === true
    || profile.projectile === true
    || classifications.some((value) => ["ranged", "projectile", "missile"].includes(value))
    || /\b(longbow|shortbow|bow|crossbow|sling|dart|projectile|missile)\b/.test(name);
  if (!thrown && !projectile) return profile;
  const normalRangeFeet = number(
    profile.normalRangeFeet
      ?? profile.normalRangeFt
      ?? profile.rangeProfile?.normal
      ?? profile.rangeFeet
      ?? profile.rangeFt
      ?? profile.range,
    0,
  );
  const longRangeFeet = number(
    profile.longRangeFeet
      ?? profile.longRangeFt
      ?? profile.rangeProfile?.long
      ?? profile.maxRange
      ?? normalRangeFeet,
    normalRangeFeet,
  );
  const weaponFamily = key(profile.weaponFamily)
    || (name.includes("crossbow") ? "crossbow" : name.includes("bow") ? "bow" : thrown ? "thrown" : "projectile");
  // Some live compatibility weapon records identify the family but omit the
  // ammunition field. Preserve the established bow/crossbow inventory contract
  // instead of treating those records as ammunition-free projectiles.
  const ammunition = thrown
    ? null
    : (
        profile.ammunitionType
        || profile.ammunition
        || profile.ammoType
        || (weaponFamily === "crossbow" ? "bolts" : weaponFamily === "bow" ? "arrows" : null)
      );
  return {
    ...profile,
    weaponId: profile.weaponId || profile.profileKey || profile.id || `compatibility.${name.replace(/\s+/g, "-") || "projectile"}`,
    deliveryType: thrown ? "thrown" : "projectile",
    weaponFamily,
    normalRangeFeet,
    longRangeFeet,
    rangeProfile: {
      ...(profile.rangeProfile || {}),
      normal: normalRangeFeet,
      long: longRangeFeet,
    },
    ammunition,
    ammunitionType: thrown ? null : (profile.ammunitionType || key(ammunition).replace(/s$/, "") || null),
    ammunitionPerAttack: thrown ? 0 : number(profile.ammunitionPerAttack, 1),
  };
}

export function ammunitionStateMatchesWeaponProfile(ammunitionState, weaponProfile = null) {
  const profile = normalizeCanonicalRangedWeaponProfile(weaponProfile);
  if (!ammunitionState || !profile) return false;
  if (key(ammunitionState.weaponId) === key(profile.weaponId)) return true;
  const family = key(profile.weaponFamily);
  if (!["bow", "crossbow"].includes(family)) return false;
  const profileAmmunitionType = key(profile.ammunitionType || profile.ammunition).replace(/s$/, "");
  return Boolean(profileAmmunitionType) && key(ammunitionState.ammunitionType) === profileAmmunitionType;
}

export function normalizeCanonicalAmmunitionState(actor = {}, weaponProfile = null) {
  const profile = normalizeCanonicalRangedWeaponProfile(
    weaponProfile || (actor.weaponProfiles || []).find(isCanonicalProjectileProfile) || null,
  );
  if (!profile || key(profile.deliveryType) === "thrown") return null;
  const ammunitionType = key(profile.ammunitionType || profile.ammunition).replace(/s$/, "");
  if (!ammunitionType) return null;
  const existing = ammunitionStateMatchesWeaponProfile(actor.ammunitionState, profile)
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
    weaponId: existing.weaponId || profile.weaponId,
    ammunitionType,
    current,
    maximum,
    chambered,
    reloadState: isCrossbow ? (chambered ? "loaded" : key(existing.reloadState) || "reload-required") : "ready",
    lastSpentActionToken: existing.lastSpentActionToken || null,
    spentActionTokens: Object.freeze([...(existing.spentActionTokens || [])]),
    lastReloadActionToken: existing.lastReloadActionToken || null,
    reloadActionTokens: Object.freeze([...(existing.reloadActionTokens || [])]),
  });
}
export function validateCanonicalRangedAttack({
  actor = {},
  target = {},
  weaponProfile = {},
  ammunitionState = actor.ammunitionState,
  actionToken,
  activeActionToken,
  activeActorId = null,
  distanceFeet,
  lineOfSight = true,
  obstruction = false,
  cover = null,
  firingIntoMelee = false,
  targetLegal = true,
  hostileTarget = true,
  weaponAvailable = true,
  executionContext = null,
} = {}) {
  const normalizedWeapon = normalizeCanonicalRangedWeaponProfile(weaponProfile);
  const distance = number(distanceFeet, Infinity);
  const normal = number(normalizedWeapon.normalRangeFeet ?? normalizedWeapon.rangeProfile?.normal ?? normalizedWeapon.range, 0);
  const long = number(
    normalizedWeapon.longRangeFeet ?? normalizedWeapon.rangeProfile?.long ?? normalizedWeapon.maxRange ?? normal,
    normal,
  );
  const minimum = Math.max(0, number(
    normalizedWeapon.minimumRangeFeet ?? normalizedWeapon.rangeProfile?.minimum ?? normalizedWeapon.minimumRange,
    0,
  ));
  const deliveryType = key(normalizedWeapon.deliveryType);
  const isCrossbow = key(normalizedWeapon.weaponFamily) === "crossbow";
  const state = deliveryType === "projectile"
    ? (ammunitionState || normalizeCanonicalAmmunitionState(actor, normalizedWeapon))
    : null;
  const rangeBand = !Number.isFinite(distance) || distance > long
    ? "out-of-range"
    : distance < minimum
      ? "inside-minimum-range"
      : distance <= normal
        ? "normal"
        : "long";
  const chamberState = isCrossbow
    ? {
        chambered: state?.chambered === true,
        reloadState: state?.reloadState || "reload-required",
      }
    : null;
  const baseResult = {
    rangeBand,
    distanceFeet: distance,
    ammunitionState: state,
    ammoClaim: null,
    chamberState,
    obstruction,
    normalizedWeapon,
    targetId: target?.id || null,
    actionToken: actionToken || null,
    executionContext,
  };
  const reject = (reason) => ({
    ...baseResult,
    accepted: false,
    reason,
    rollAllowed: false,
    ammunitionSpendAllowed: false,
  });
  if (!isCanonicalProjectileProfile(normalizedWeapon)) return reject("invalid-delivery-type");
  if (!actionToken || (activeActionToken !== undefined && actionToken !== activeActionToken)) return reject("stale-action-token");
  if (activeActorId != null && String(activeActorId) !== String(actor.id || "")) return reject("stale-action-owner");
  if (
    !actor.id || actor.dead || actor.isDead || actor.unconscious || actor.isUnconscious
    || actor.surrendered || actor.captured || actor.routed || actor.canAct === false
  ) return reject("actor-cannot-fire");
  if (
    !target.id || String(actor.id) === String(target.id)
    || target.dead || target.isDead || target.captured || target.surrendered
    || targetLegal === false || hostileTarget === false
  ) return reject("illegal-ranged-target");
  if (actor.grappleState?.active || actor.grappled || actor.isGrappling) return reject("weapon-unavailable-in-grapple");
  if (weaponAvailable === false) return reject("ranged-weapon-unavailable");
  if (!Number.isFinite(distance) || distance > long) return reject("target-out-of-range");
  if (distance < minimum) return reject("target-inside-minimum-range");
  if (!lineOfSight || obstruction) return reject("line-of-sight-blocked");
  if (deliveryType === "projectile") {
    if (!state || state.current < number(normalizedWeapon.ammunitionPerAttack, 1)) return reject("ammunition-empty");
    if (isCrossbow && (!state.chambered || state.reloadState !== "loaded")) return reject("reload-required");
  }
  return {
    ...baseResult,
    accepted: true,
    reason: null,
    rollAllowed: true,
    ammunitionSpendAllowed: true,
    ammoClaim: deliveryType === "projectile"
      ? Object.freeze({
          eligible: true,
          actionToken,
          weaponId: normalizedWeapon.weaponId,
          ammunitionType: state?.ammunitionType || key(normalizedWeapon.ammunitionType || normalizedWeapon.ammunition),
          amount: number(normalizedWeapon.ammunitionPerAttack, 1),
          commitment: "projectile-release",
        })
      : null,
    cover,
    firingIntoMelee: Boolean(firingIntoMelee),
  };
}
export function claimCanonicalAmmunitionSpend({
  ammunitionState,
  weaponProfile,
  actionToken,
  activeActionToken,
} = {}) {
  const profile = normalizeCanonicalRangedWeaponProfile(weaponProfile);
  const reject = (reason) => ({ accepted: false, reason, eventType: "ranged-ammunition-spend-rejected", ammunitionState });
  if (!actionToken || (activeActionToken !== undefined && actionToken !== activeActionToken)) return reject("stale-action-token");
  if (!isCanonicalProjectileProfile(profile) || key(profile.deliveryType) === "thrown") return reject("invalid-ammunition-weapon");
  if (!ammunitionStateMatchesWeaponProfile(ammunitionState, profile)) return reject("ammunition-weapon-mismatch");
  if ((ammunitionState?.spentActionTokens || []).includes(actionToken) || ammunitionState?.lastSpentActionToken === actionToken) return reject("duplicate-ammunition-spend");
  const amount = number(profile.ammunitionPerAttack, 1);
  if (number(ammunitionState?.current) < amount) return { ...reject("ammunition-empty"), eventType: "ranged-ammunition-empty" };
  if (key(profile.weaponFamily) === "crossbow" && (!ammunitionState.chambered || ammunitionState.reloadState !== "loaded")) {
    return { ...reject("reload-required"), eventType: "ranged-reload-required" };
  }
  return {
    accepted: true,
    eventType: "ranged-ammunition-spend-claimed",
    claim: Object.freeze({ actionToken, weaponId: ammunitionState.weaponId, ammunitionType: ammunitionState.ammunitionType, amount }),
  };
}

export function commitCanonicalAmmunitionSpend({ ammunitionState, weaponProfile, claim } = {}) {
  const profile = normalizeCanonicalRangedWeaponProfile(weaponProfile);
  if (
    !claim
    || key(claim.weaponId) !== key(ammunitionState?.weaponId)
    || key(claim.ammunitionType) !== key(ammunitionState?.ammunitionType)
    || !ammunitionStateMatchesWeaponProfile(ammunitionState, profile)
  ) {
    return { accepted: false, reason: "invalid-ammunition-claim", eventType: "ranged-ammunition-spend-rejected", ammunitionState };
  }
  if ((ammunitionState.spentActionTokens || []).includes(claim.actionToken)) {
    return { accepted: false, reason: "duplicate-ammunition-spend", eventType: "ranged-ammunition-spend-rejected", ammunitionState };
  }
  const isCrossbow = key(profile.weaponFamily) === "crossbow";
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

export function completeCanonicalRangedReload({
  actor = null,
  ammunitionState,
  weaponProfile,
  actionToken,
  activeActionToken,
  activeActorId = null,
  weaponAvailable = true,
} = {}) {
  const profile = normalizeCanonicalRangedWeaponProfile(weaponProfile);
  const rejected = (reason) => ({ accepted: false, reason, eventType: "ranged-ammunition-spend-rejected", ammunitionState });
  if (key(profile?.weaponFamily) !== "crossbow") return rejected("weapon-does-not-require-reload");
  if (!actionToken || (activeActionToken !== undefined && actionToken !== activeActionToken)) return rejected("stale-action-token");
  if (actor && activeActorId != null && String(activeActorId) !== String(actor.id || "")) return rejected("stale-action-owner");
  if (
    actor && (
      !actor.id || actor.dead || actor.isDead || actor.unconscious || actor.isUnconscious
      || actor.surrendered || actor.captured || actor.routed || actor.canAct === false
    )
  ) return rejected("actor-cannot-reload");
  if (actor && (Number(actor.remainingActions ?? actor.actionsRemaining ?? 0) || 0) <= 0) return rejected("no-actions-remaining");
  if (actor && (actor.grappleState?.active || actor.grappled || actor.isGrappling)) return rejected("weapon-unavailable-in-grapple");
  if (weaponAvailable === false) return rejected("ranged-weapon-unavailable");
  if (!ammunitionStateMatchesWeaponProfile(ammunitionState, profile)) return rejected("ammunition-weapon-mismatch");
  if (
    (ammunitionState.reloadActionTokens || []).includes(actionToken)
    || ammunitionState.lastReloadActionToken === actionToken
  ) return rejected("duplicate-reload");
  if (ammunitionState.chambered === true || ammunitionState.reloadState === "loaded") return rejected("already-loaded");
  if (ammunitionState.current <= 0) return { ...rejected("ammunition-empty"), eventType: "ranged-ammunition-empty" };
  return {
    accepted: true,
    eventType: "ranged-reload-completed",
    actionCost: 1,
    staminaCost: 0,
    ammunitionConsumed: 0,
    ammunitionState: Object.freeze({
      ...ammunitionState,
      chambered: true,
      reloadState: "loaded",
      lastReloadActionToken: actionToken,
      reloadActionTokens: Object.freeze([...(ammunitionState.reloadActionTokens || []), actionToken]),
    }),
  };
}
