/**
 * Milestone 8D Phase 3: canonical resolved-effect contract.
 * Describes an already-resolved impact/effect so CombatPage can apply it
 * through existing HP/protection authorities without re-running attack().
 */

const text = (value) => String(value ?? "").trim();
const lower = (value) => text(value).toLowerCase();

export const EFFECT_FAMILIES = Object.freeze({
  PHYSICAL_CONTACT: "physical-contact",
  PHYSICAL_PROJECTILE: "physical-projectile",
  MENTAL: "mental",
  SUPERNATURAL: "supernatural",
  HEALING: "healing",
  STATUS: "status",
});

export const DELIVERY_POLICIES = Object.freeze({
  PHYSICAL_CONTACT: "physical-contact",
  PHYSICAL_PROJECTILE: "physical-projectile",
  MENTAL: "mental",
  SUPERNATURAL: "supernatural",
  HEALING: "healing",
  STATUS: "status",
});

export const PROTECTION_POLICIES = Object.freeze({
  PHYSICAL_ARMOR: "physical-armor",
  BYPASS_PHYSICAL: "bypass-physical",
  NOT_APPLICABLE: "not-applicable",
});

export const HIT_LOCATION_POLICIES = Object.freeze({
  REQUIRED: "required",
  SUPPLIED: "supplied",
  NOT_APPLICABLE: "not-applicable",
});

const MENTAL_DAMAGE_TYPES = new Set(["tactical", "psi", "mind", "psychic", "mental"]);
const PHYSICAL_ATTACK_TYPES = new Set(["melee", "physical", "contact", "weapon"]);
const PROJECTILE_ATTACK_TYPES = new Set(["ranged", "projectile", "kinetic"]);
const HEALING_ATTACK_TYPES = new Set(["healing", "heal"]);
const MENTAL_ATTACK_TYPES = new Set(["mental", "psychic", "psi"]);
const SUPERNATURAL_ATTACK_TYPES = new Set(["supernatural", "magical", "magic"]);

function actorId(value) {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number") return String(value);
  return value.id != null ? String(value.id) : value._id != null ? String(value._id) : null;
}

function firstText(...values) {
  for (const value of values) {
    const next = text(value);
    if (next) return next;
  }
  return "";
}

function firstFinite(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

function normalizePolicyToken(value, allowed) {
  const key = lower(value).replaceAll("_", "-");
  return Object.values(allowed).includes(key) ? key : null;
}

export function deriveCanonicalEffectPolicies({
  eventType = "DAMAGE",
  kind = "",
  attackType = "",
  damageType = "",
  protectionPolicy = null,
  delivery = null,
  hitLocationPolicy = null,
  hitLocation = null,
} = {}) {
  const explicitProtection = normalizePolicyToken(protectionPolicy, PROTECTION_POLICIES);
  const explicitDelivery = normalizePolicyToken(delivery, DELIVERY_POLICIES)
    || firstText(delivery) || null;
  const explicitHitLocationPolicy = normalizePolicyToken(hitLocationPolicy, HIT_LOCATION_POLICIES);
  const type = lower(eventType);
  const familyHint = lower(kind);
  const attack = lower(attackType);
  const dmg = lower(damageType);

  if (type === "heal" || HEALING_ATTACK_TYPES.has(attack) || familyHint === "healing") {
    return {
      family: EFFECT_FAMILIES.HEALING,
      delivery: explicitDelivery || DELIVERY_POLICIES.HEALING,
      protectionPolicy: explicitProtection || PROTECTION_POLICIES.NOT_APPLICABLE,
      hitLocationPolicy: explicitHitLocationPolicy || HIT_LOCATION_POLICIES.NOT_APPLICABLE,
    };
  }

  if (familyHint === "status") {
    return {
      family: EFFECT_FAMILIES.STATUS,
      delivery: explicitDelivery || DELIVERY_POLICIES.STATUS,
      protectionPolicy: explicitProtection || PROTECTION_POLICIES.BYPASS_PHYSICAL,
      hitLocationPolicy: explicitHitLocationPolicy || HIT_LOCATION_POLICIES.NOT_APPLICABLE,
    };
  }

  if (MENTAL_ATTACK_TYPES.has(attack) || MENTAL_DAMAGE_TYPES.has(dmg)) {
    return {
      family: EFFECT_FAMILIES.MENTAL,
      delivery: explicitDelivery || DELIVERY_POLICIES.MENTAL,
      protectionPolicy: explicitProtection || PROTECTION_POLICIES.BYPASS_PHYSICAL,
      hitLocationPolicy: explicitHitLocationPolicy || HIT_LOCATION_POLICIES.NOT_APPLICABLE,
    };
  }

  if (SUPERNATURAL_ATTACK_TYPES.has(attack) || familyHint === "supernatural") {
    return {
      family: EFFECT_FAMILIES.SUPERNATURAL,
      delivery: explicitDelivery || DELIVERY_POLICIES.SUPERNATURAL,
      protectionPolicy: explicitProtection || PROTECTION_POLICIES.BYPASS_PHYSICAL,
      hitLocationPolicy: explicitHitLocationPolicy || HIT_LOCATION_POLICIES.NOT_APPLICABLE,
    };
  }

  if (PROJECTILE_ATTACK_TYPES.has(attack) && familyHint !== "technique") {
    const physicalProjectile = explicitProtection === PROTECTION_POLICIES.PHYSICAL_ARMOR
      || explicitDelivery === DELIVERY_POLICIES.PHYSICAL_PROJECTILE;
    if (physicalProjectile) {
      return {
        family: EFFECT_FAMILIES.PHYSICAL_PROJECTILE,
        delivery: explicitDelivery || DELIVERY_POLICIES.PHYSICAL_PROJECTILE,
        protectionPolicy: PROTECTION_POLICIES.PHYSICAL_ARMOR,
        hitLocationPolicy: explicitHitLocationPolicy
          || (hitLocation ? HIT_LOCATION_POLICIES.SUPPLIED : HIT_LOCATION_POLICIES.REQUIRED),
      };
    }
    return {
      family: EFFECT_FAMILIES.MENTAL,
      delivery: explicitDelivery || DELIVERY_POLICIES.MENTAL,
      protectionPolicy: explicitProtection || PROTECTION_POLICIES.BYPASS_PHYSICAL,
      hitLocationPolicy: explicitHitLocationPolicy || HIT_LOCATION_POLICIES.NOT_APPLICABLE,
    };
  }

  const physical = PHYSICAL_ATTACK_TYPES.has(attack)
    || familyHint === "technique"
    || explicitProtection === PROTECTION_POLICIES.PHYSICAL_ARMOR
    || explicitDelivery === DELIVERY_POLICIES.PHYSICAL_CONTACT;

  if (physical || explicitProtection === PROTECTION_POLICIES.PHYSICAL_ARMOR) {
    return {
      family: EFFECT_FAMILIES.PHYSICAL_CONTACT,
      delivery: explicitDelivery || DELIVERY_POLICIES.PHYSICAL_CONTACT,
      protectionPolicy: explicitProtection || PROTECTION_POLICIES.PHYSICAL_ARMOR,
      hitLocationPolicy: explicitHitLocationPolicy
        || (hitLocation ? HIT_LOCATION_POLICIES.SUPPLIED : HIT_LOCATION_POLICIES.REQUIRED),
    };
  }

  return {
    family: familyHint === "tactical" ? EFFECT_FAMILIES.MENTAL : EFFECT_FAMILIES.PHYSICAL_CONTACT,
    delivery: explicitDelivery || (familyHint === "tactical" ? DELIVERY_POLICIES.MENTAL : DELIVERY_POLICIES.PHYSICAL_CONTACT),
    protectionPolicy: explicitProtection
      || (familyHint === "tactical" ? PROTECTION_POLICIES.BYPASS_PHYSICAL : PROTECTION_POLICIES.PHYSICAL_ARMOR),
    hitLocationPolicy: explicitHitLocationPolicy
      || (familyHint === "tactical"
        ? HIT_LOCATION_POLICIES.NOT_APPLICABLE
        : (hitLocation ? HIT_LOCATION_POLICIES.SUPPLIED : HIT_LOCATION_POLICIES.REQUIRED)),
  };
}

export function isCanonicalResolvedEffectEvent(event = {}) {
  const type = text(event?.type).toUpperCase();
  if (type === "HEAL") return true;
  if (type !== "DAMAGE") return false;
  if (event?.vsArmor === true) return false;
  if (event?.canonicalEffect) return true;
  const kind = lower(event?.kind || event?.meta?.kind);
  return kind === "technique" || kind === "tactical" || kind === "status" || kind === "healing";
}

export function buildCanonicalEffectMutationKey(effect = {}) {
  const executionId = firstText(
    effect.executionId,
    effect.castId,
    effect.tacticalUseId,
    effect.executionKey,
    effect.statusKey ? `status:${effect.statusKey}` : "",
  ) || "unowned";
  return [
    executionId,
    effect.targetId || "none",
    effect.family || effect.kind || "effect",
    effect.effectSequence ?? 0,
  ].join("::");
}

export function normalizeCanonicalResolvedEffect(event = {}) {
  const type = text(event?.type).toUpperCase() || "DAMAGE";
  const meta = event?.meta && typeof event.meta === "object" ? event.meta : {};
  const supplied = event?.canonicalEffect && typeof event.canonicalEffect === "object"
    ? event.canonicalEffect
    : {};
  const kind = firstText(supplied.kind, event.kind, meta.kind, type === "HEAL" ? "healing" : "");
  const attackType = firstText(supplied.attackType, event.attackType, meta.attackType);
  const damageType = firstText(supplied.damageType, event.damageType, event.breakdown?.type, meta.damageType);
  const policies = deriveCanonicalEffectPolicies({
    eventType: type,
    kind,
    attackType,
    damageType,
    protectionPolicy: supplied.protectionPolicy || event.protectionPolicy || meta.protectionPolicy,
    delivery: supplied.delivery || event.delivery || event.deliveryType || meta.delivery,
    hitLocationPolicy: supplied.hitLocationPolicy || event.hitLocationPolicy || meta.hitLocationPolicy,
    hitLocation: supplied.hitLocation || event.hitLocation || meta.hitLocation,
  });
  const sourceId = actorId(supplied.sourceId || event.sourceId || event.attackerId || meta.sourceId || meta.casterId || meta.userId);
  const targetId = actorId(supplied.targetId || event.targetId || meta.targetId);
  const amount = firstFinite(supplied.amount, event.amount, event.breakdown?.final);
  const executionId = firstText(
    supplied.executionId,
    event.executionId,
    meta.castId,
    event.castId,
    meta.tacticalUseId,
    event.tacticalUseId,
    event.executionKey,
  );
  const statusKey = firstText(supplied.statusKey, event.statusKey, meta.statusKey) || null;
  return Object.freeze({
    eventType: type === "HEAL" ? "HEAL" : "DAMAGE",
    kind: kind || (type === "HEAL" ? "healing" : "effect"),
    family: policies.family,
    delivery: policies.delivery,
    protectionPolicy: policies.protectionPolicy,
    hitLocationPolicy: policies.hitLocationPolicy,
    sourceId,
    targetId,
    amount,
    damageType: damageType || (type === "HEAL" ? "healing" : "generic"),
    hitLocation: supplied.hitLocation || event.hitLocation || meta.hitLocation || null,
    hitLocationAlreadyResolved: Boolean(supplied.hitLocation || event.hitLocation || meta.hitLocation),
    statusEffects: Array.isArray(supplied.statusEffects || event.statusEffects)
      ? [...(supplied.statusEffects || event.statusEffects)]
      : [],
    applyMoraleWounds: policies.protectionPolicy === PROTECTION_POLICIES.PHYSICAL_ARMOR,
    applyTacticalMemory: policies.protectionPolicy === PROTECTION_POLICIES.PHYSICAL_ARMOR,
    label: firstText(supplied.label, event.power, event.technique, meta.technique, meta.power, kind, "effect"),
    originControlMode: firstText(supplied.originControlMode, event.controlMode, meta.controlMode, "unspecified"),
    executionId: executionId || null,
    statusKey,
    castId: firstText(meta.castId, event.castId, supplied.castId) || null,
    tacticalUseId: firstText(meta.tacticalUseId, event.tacticalUseId, supplied.tacticalUseId) || null,
    turnToken: meta.turnToken ?? event.turnToken ?? supplied.turnToken ?? null,
    combatSession: meta.combatSession ?? event.combatSession ?? supplied.combatSession,
    effectSequence: event.effectSequence ?? supplied.effectSequence ?? 0,
    vsArmor: event.vsArmor === true,
    mutationKey: null,
  });
}

export function validateCanonicalEffectOwnership(effect = {}, liveContext = {}) {
  const {
    combatActive = true,
    combatOver = false,
    combatSession = null,
    turnToken = null,
    fighters = [],
    pendingTechnique = null,
    pendingTactical = null,
    resolvedKeys = null,
    allowMissingExecution = false,
  } = liveContext;

  if (combatOver || combatActive === false) {
    return { ok: false, reason: "combat-inactive" };
  }
  if (!effect?.targetId) {
    return { ok: false, reason: "target-missing" };
  }
  const targetExists = fighters.some((fighter) => String(fighter?.id) === String(effect.targetId));
  if (!targetExists) {
    return { ok: false, reason: "target-replaced-or-missing" };
  }
  if (effect.sourceId) {
    const sourceExists = fighters.some((fighter) => String(fighter?.id) === String(effect.sourceId));
    if (!sourceExists) {
      return { ok: false, reason: "source-replaced-or-missing" };
    }
  }

  const mutationKey = buildCanonicalEffectMutationKey(effect);
  if (resolvedKeys?.has?.(mutationKey)) {
    return { ok: false, reason: "duplicate-effect-mutation", mutationKey };
  }

  if (effect.combatSession !== undefined && combatSession != null && effect.combatSession !== combatSession) {
    return { ok: false, reason: "combat-session-mismatch" };
  }

  const isTechnique = effect.kind === "technique" || Boolean(effect.castId);
  const isTactical = effect.kind === "tactical" || Boolean(effect.tacticalUseId);
  if (!isTechnique && !isTactical) {
    return { ok: true, reason: "status-or-direct", mutationKey };
  }

  if (!effect.executionId && !allowMissingExecution) {
    return { ok: false, reason: "missing-execution-identity" };
  }

  if (isTechnique && effect.castId) {
    const pending = pendingTechnique;
    if (!pending || String(pending.castId) !== String(effect.castId)) {
      return { ok: false, reason: "technique-cast-invalidated" };
    }
    if (pending.turnToken && effect.turnToken && pending.turnToken !== effect.turnToken) {
      return { ok: false, reason: "turn-token-mismatch" };
    }
    if (turnToken && effect.turnToken && turnToken !== effect.turnToken) {
      return { ok: false, reason: "turn-token-mismatch" };
    }
    if (pending.combatSession !== undefined && combatSession != null && pending.combatSession !== combatSession) {
      return { ok: false, reason: "combat-session-mismatch" };
    }
  }

  if (isTactical && effect.tacticalUseId) {
    const pending = pendingTactical;
    if (!pending || String(pending.id) !== String(effect.tacticalUseId)) {
      return { ok: false, reason: "tactical-use-invalidated" };
    }
    if (pending.turnToken && effect.turnToken && pending.turnToken !== effect.turnToken) {
      return { ok: false, reason: "turn-token-mismatch" };
    }
    if (turnToken && effect.turnToken && turnToken !== effect.turnToken) {
      return { ok: false, reason: "turn-token-mismatch" };
    }
  }

  return { ok: true, reason: "live", mutationKey };
}

export default {
  EFFECT_FAMILIES,
  DELIVERY_POLICIES,
  PROTECTION_POLICIES,
  HIT_LOCATION_POLICIES,
  buildCanonicalEffectMutationKey,
  deriveCanonicalEffectPolicies,
  isCanonicalResolvedEffectEvent,
  normalizeCanonicalResolvedEffect,
  validateCanonicalEffectOwnership,
};
