import { resolveArmorContact } from "./armorContactResolver.js";
import {
  applyArmorImpactToFighter,
  resolveLayeredArmorImpact,
} from "./armorAssemblyImpact.js";
import {
  COMBAT_LOG_AUDIENCES,
  COMBAT_LOG_CHANNELS,
} from "./combatLogEvents.js";
import {
  HIT_LOCATION_POLICIES,
  PROTECTION_POLICIES,
  buildCanonicalEffectMutationKey,
  isCanonicalResolvedEffectEvent,
  normalizeCanonicalResolvedEffect,
  validateCanonicalEffectOwnership,
} from "./canonicalResolvedCombatEffect.js";
import {
  applyHPToFighter as defaultApplyHPToFighter,
  clampHP as defaultClampHP,
  getFighterHP as defaultGetFighterHP,
} from "./canonicalHpAuthority.js";

const cloneFighters = (fighters = []) => fighters.map((fighter) => ({ ...fighter }));

function findById(fighters, id) {
  return fighters.find((fighter) => String(fighter?.id) === String(id)) || null;
}

export function resolvePhysicalProtectionForCanonicalEffect({
  source,
  target,
  effect,
  amount,
  rollHitLocationFn = null,
  resolveArmorContactFn = resolveArmorContact,
  resolveLayeredArmorImpactFn = resolveLayeredArmorImpact,
} = {}) {
  const supplied = effect?.hitLocationAlreadyResolved && effect?.hitLocation
    ? { location: effect.hitLocation, slot: effect.hitLocationSlot || null, supplied: true }
    : null;
  const rolled = supplied || (typeof rollHitLocationFn === "function" ? rollHitLocationFn() : { location: "Torso", slot: "torso" });
  const hitLocation = rolled?.location || rolled?.zone || "torso";
  const attackData = {
    name: effect?.label,
    damageType: effect?.damageType,
    type: effect?.delivery,
  };
  const contact = typeof resolveArmorContactFn === "function"
    ? resolveArmorContactFn({
        attacker: source,
        defender: target,
        attackData,
        hitLocation,
      })
    : { damageAllowed: true, bodilyDamageMultiplier: 1, armorConsulted: true };
  const layered = typeof resolveLayeredArmorImpactFn === "function"
    ? resolveLayeredArmorImpactFn({
        attacker: source,
        defender: target,
        attack: attackData,
        hitLocation,
        contactResult: contact,
      })
    : null;
  const injuryAuthorized = contact?.damageAllowed === true || layered?.body?.injuryAuthorized === true;
  const multiplier = injuryAuthorized
    ? Number(contact?.bodilyDamageMultiplier ?? layered?.body?.damageMultiplier ?? 1)
    : Number(layered?.body?.damageMultiplier ?? 0);
  const scaled = Math.floor(Number(amount) * (Number.isFinite(multiplier) ? multiplier : 0));
  const appliedAmount = injuryAuthorized
    ? Math.max(Number(layered?.body?.minimumDamage || 0), scaled)
    : Math.max(0, scaled);
  return {
    armorConsulted: true,
    hitLocation: rolled,
    contact,
    layered,
    amount: Math.max(0, appliedAmount),
    injuryAuthorized,
  };
}

function buildPresentationEvents({ effect, source, target, previousHP, nextHP, appliedAmount, protection, accepted, reason }) {
  const actorName = source?.name || effect.sourceId || "Unknown";
  const targetName = target?.name || effect.targetId || "Unknown";
  const playerMessage = effect.eventType === "HEAL"
    ? `${effect.label} heals ${targetName} for ${appliedAmount} HP.`
    : appliedAmount > 0
      ? `${effect.label} hits ${targetName} for ${appliedAmount} ${effect.damageType} damage.`
      : `${effect.label} fails to harm ${targetName}.`;
  return [
    {
      audience: COMBAT_LOG_AUDIENCES.BOTH,
      channel: COMBAT_LOG_CHANNELS.DAMAGE,
      eventType: effect.eventType === "HEAL" ? "canonical-effect-healed" : "canonical-effect-applied",
      level: appliedAmount > 0 ? "combat" : "info",
      type: appliedAmount > 0 ? "damage" : "info",
      actorId: effect.sourceId,
      targetId: effect.targetId,
      message: playerMessage,
      data: {
        family: effect.family,
        delivery: effect.delivery,
        protectionPolicy: effect.protectionPolicy,
        damageType: effect.damageType,
        amount: appliedAmount,
        previousHP,
        nextHP,
        hitLocation: protection?.hitLocation?.location || effect.hitLocation || null,
        armorConsulted: protection?.armorConsulted === true,
        originControlMode: effect.originControlMode,
      },
    },
    {
      audience: COMBAT_LOG_AUDIENCES.DEVELOPER,
      channel: COMBAT_LOG_CHANNELS.VALIDATION,
      eventType: accepted ? "canonical-effect-mutation" : "canonical-effect-rejected",
      level: accepted ? "debug" : "warning",
      type: "debug",
      actorId: effect.sourceId,
      targetId: effect.targetId,
      message:
        `${accepted ? "canonical effect applied" : "canonical effect rejected"}: ` +
        `actor=${actorName} target=${targetName} family=${effect.family} ` +
        `protection=${effect.protectionPolicy} amount=${appliedAmount} reason=${reason}`,
      data: {
        executionId: effect.executionId,
        castId: effect.castId,
        tacticalUseId: effect.tacticalUseId,
        mutationKey: effect.mutationKey,
        reason,
        armorConsulted: protection?.armorConsulted === true,
      },
    },
  ];
}

export function applyCanonicalCombatEffect({
  event,
  fighters = [],
  liveContext = {},
  authorities = {},
} = {}) {
  if (!isCanonicalResolvedEffectEvent(event) && event?.type !== "HEAL" && event?.type !== "DAMAGE") {
    return { accepted: false, reason: "not-a-resolved-effect", fighters, logs: [], mutated: false };
  }
  if (event?.vsArmor === true) {
    return { accepted: false, reason: "armor-durability-event", fighters, logs: [], mutated: false };
  }

  const getFighterHP = authorities.getFighterHP || defaultGetFighterHP;
  const clampHP = authorities.clampHP || defaultClampHP;
  const applyHPToFighter = authorities.applyHPToFighter || defaultApplyHPToFighter;
  const resolvePhysicalProtection = authorities.resolvePhysicalProtection
    || resolvePhysicalProtectionForCanonicalEffect;

  const effect = {
    ...normalizeCanonicalResolvedEffect(event),
  };
  effect.mutationKey = buildCanonicalEffectMutationKey(effect);
  const ownership = validateCanonicalEffectOwnership(effect, liveContext);
  if (!ownership.ok) {
    return {
      accepted: false,
      reason: ownership.reason,
      effect,
      fighters,
      logs: buildPresentationEvents({
        effect,
        source: findById(fighters, effect.sourceId),
        target: findById(fighters, effect.targetId),
        previousHP: null,
        nextHP: null,
        appliedAmount: 0,
        protection: { armorConsulted: false },
        accepted: false,
        reason: ownership.reason,
      }),
      mutated: false,
    };
  }

  const nextFighters = cloneFighters(fighters);
  const target = findById(nextFighters, effect.targetId);
  const source = findById(nextFighters, effect.sourceId);
  if (!target) {
    return { accepted: false, reason: "target-replaced-or-missing", effect, fighters, logs: [], mutated: false };
  }

  const previousHP = getFighterHP(target);
  let appliedAmount = Math.max(0, Number(effect.amount) || 0);
  let protection = { armorConsulted: false, hitLocation: effect.hitLocation, amount: appliedAmount };

  if (effect.eventType !== "HEAL" && effect.protectionPolicy === PROTECTION_POLICIES.PHYSICAL_ARMOR) {
    if (effect.hitLocationPolicy === HIT_LOCATION_POLICIES.NOT_APPLICABLE) {
      protection = { armorConsulted: true, skippedHitLocation: true, amount: appliedAmount };
    } else {
      protection = resolvePhysicalProtection({
        source,
        target,
        effect,
        amount: appliedAmount,
        rollHitLocationFn: authorities.rollHitLocation,
        resolveArmorContactFn: authorities.resolveArmorContact,
        resolveLayeredArmorImpactFn: authorities.resolveLayeredArmorImpact,
      });
      if (protection?.accepted === false) {
        const reason = protection.reason || "physical-protection-resolution-failed";
        return {
          accepted: false,
          reason,
          effect,
          fighters,
          logs: buildPresentationEvents({
            effect,
            source,
            target,
            previousHP,
            nextHP: previousHP,
            appliedAmount: 0,
            protection,
            accepted: false,
            reason,
          }),
          mutated: false,
          protection,
          mutationKey: ownership.mutationKey,
        };
      }
      appliedAmount = Math.max(0, Number(protection.amount) || 0);
      if (protection.layered?.accepted && typeof (authorities.applyArmorImpactToFighter || applyArmorImpactToFighter) === "function") {
        const applyArmor = authorities.applyArmorImpactToFighter || applyArmorImpactToFighter;
        const armored = applyArmor(target, protection.layered);
        Object.assign(target, armored);
      }
    }
  }

  const nextHP = effect.eventType === "HEAL"
    ? clampHP(previousHP + appliedAmount, target)
    : clampHP(previousHP - appliedAmount, target);

  applyHPToFighter(target, nextHP);
  liveContext.resolvedKeys?.add?.(ownership.mutationKey);

  const logs = buildPresentationEvents({
    effect,
    source,
    target,
    previousHP,
    nextHP,
    appliedAmount: Math.abs(nextHP - previousHP),
    protection,
    accepted: true,
    reason: ownership.reason,
  });

  return {
    accepted: true,
    reason: ownership.reason,
    effect,
    fighters: nextFighters,
    target,
    source,
    previousHP,
    nextHP,
    appliedAmount: Math.abs(nextHP - previousHP),
    protection,
    logs,
    mutated: nextHP !== previousHP,
    mutationKey: ownership.mutationKey,
    originControlMode: effect.originControlMode,
  };
}

export default applyCanonicalCombatEffect;
