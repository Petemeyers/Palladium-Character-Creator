import { applyCanonicalCombatEffect } from "./applyCanonicalCombatEffect.js";
import {
  DELIVERY_POLICIES,
  HIT_LOCATION_POLICIES,
  PROTECTION_POLICIES,
} from "./canonicalResolvedCombatEffect.js";
import { resolveArmorContact } from "./armorContactResolver.js";
import {
  applyArmorImpactToFighter,
  resolveLayeredArmorImpact,
} from "./armorAssemblyImpact.js";

function locationName(value) {
  if (typeof value === "string" && value.trim()) return value;
  return value?.location || value?.zone || "torso";
}

function grappleAttackData({ actionType, weapon, attackMode, result }) {
  const damageType = String(
    weapon?.damageType ||
    result?.damageType ||
    weapon?.type ||
    (actionType === "takedown" ? "bludgeoning" : "physical"),
  ).toLowerCase();
  return {
    ...(weapon || {}),
    name: weapon?.name || (actionType === "takedown" ? "Takedown Impact" : "Grapple Strike"),
    damageType,
    type: "melee",
    attackMode: attackMode || weapon?.attackMode || null,
    grappleImpact: true,
  };
}

export function resolveCanonicalGrapplePhysicalProtection({
  source,
  target,
  amount,
  actionType,
  weapon,
  attackMode,
  result,
  hitLocation,
  armorContact,
  resolveArmorContactFn = resolveArmorContact,
  resolveLayeredArmorImpactFn = resolveLayeredArmorImpact,
} = {}) {
  const location = locationName(hitLocation);
  const attack = grappleAttackData({ actionType, weapon, attackMode, result });
  try {
    const contact = armorContact || resolveArmorContactFn({
      attacker: source,
      defender: target,
      weapon: attack,
      attackData: attack,
      attackMode: attack.attackMode,
      attackRoll: result?.attackRoll,
      attackTotal: result?.attackRoll,
      critical: result?.critical === true,
      hitLocation: location,
      targetState: {
        grappled: true,
        pinned: source?.grappleState?.groundControl?.state === "pinned",
      },
      normalDefense: target?.guardRating ?? target?.armorClass ?? 12,
    });
    if (!contact || typeof contact !== "object") {
      return {
        accepted: false,
        reason: "grapple-armor-contact-missing",
        armorConsulted: true,
        amount: 0,
        hitLocation: { location, supplied: true },
      };
    }
    if (contact.accepted === false) {
      return {
        accepted: false,
        reason: contact.reason || "grapple-armor-processing-failed",
        armorConsulted: true,
        amount: 0,
        hitLocation: { location, supplied: true },
        contact,
      };
    }

    const bypassesCoveredArmor =
      contact.gapReached === true ||
      contact.coverageType === "unarmored" ||
      contact.contactType === "unarmored";
    if (bypassesCoveredArmor) {
      const multiplier = Number(contact.bodilyDamageMultiplier ?? 1);
      return {
        accepted: true,
        armorConsulted: true,
        hitLocation: { location, supplied: true },
        contact,
        layered: null,
        injuryAuthorized: contact.damageAllowed !== false,
        amount: contact.damageAllowed === false
          ? 0
          : Math.max(0, Math.floor(Number(amount || 0) * (Number.isFinite(multiplier) ? multiplier : 1))),
        usedPreResolvedContact: Boolean(armorContact),
        gapPreserved: contact.gapReached === true,
      };
    }

    const layered = resolveLayeredArmorImpactFn({
      attacker: source,
      defender: target,
      attack,
      techniqueKey: attack.techniqueKey || attack.attackMode || null,
      hitLocation: location,
      attackMargin: Number(result?.attackRoll || 0) - Number(target?.guardRating ?? target?.armorClass ?? 12),
      critical: result?.critical === true,
      contactResult: contact,
    });
    if (!layered || layered.accepted !== true) {
      return {
        accepted: false,
        reason: layered?.reason || "grapple-layered-armor-impact-failed",
        armorConsulted: true,
        amount: 0,
        hitLocation: { location, supplied: true },
        contact,
        layered: layered || null,
      };
    }

    const injuryAuthorized =
      contact.damageAllowed === true ||
      layered.body?.injuryAuthorized === true;
    const multiplier = injuryAuthorized
      ? Number(contact.bodilyDamageMultiplier ?? layered.body?.damageMultiplier ?? 1)
      : Number(layered.body?.damageMultiplier ?? 0);
    const scaled = Math.floor(Number(amount || 0) * (Number.isFinite(multiplier) ? multiplier : 0));
    return {
      accepted: true,
      armorConsulted: true,
      hitLocation: { location, supplied: true },
      contact,
      layered,
      injuryAuthorized,
      amount: injuryAuthorized
        ? Math.max(Number(layered.body?.minimumDamage || 0), scaled)
        : Math.max(0, scaled),
      usedPreResolvedContact: Boolean(armorContact),
      gapPreserved: false,
    };
  } catch (error) {
    return {
      accepted: false,
      reason: "grapple-armor-processing-failed",
      armorConsulted: true,
      amount: 0,
      hitLocation: { location, supplied: true },
      error,
    };
  }
}

export function applyCanonicalGrappleImpact({
  fighters = [],
  attacker,
  defender,
  result = {},
  actionType,
  weapon = null,
  attackMode = null,
  hitLocation = "torso",
  armorContact = null,
  executionKey,
  combatSession = null,
  turnToken = null,
  resolvedKeys = null,
  originControlMode = "unspecified",
  authorities = {},
} = {}) {
  const previousHP = (authorities.getFighterHP || ((fighter) =>
    Number(fighter?.currentHP ?? fighter?.hp ?? fighter?.HP) || 0))(defender);
  const rawDamage = result.deathBlow === true
    ? Math.max(0, previousHP + 100)
    : Math.max(0, Number(result.damage) || 0);
  const attack = grappleAttackData({ actionType, weapon, attackMode, result });
  const event = {
    type: "DAMAGE",
    sourceId: attacker?.id,
    targetId: defender?.id,
    amount: rawDamage,
    attackType: "physical",
    damageType: attack.damageType,
    executionKey,
    combatSession,
    turnToken,
    controlMode: originControlMode,
    canonicalEffect: {
      kind: "grapple-impact",
      label: attack.name,
      delivery: DELIVERY_POLICIES.PHYSICAL_CONTACT,
      protectionPolicy: PROTECTION_POLICIES.PHYSICAL_ARMOR,
      hitLocationPolicy: HIT_LOCATION_POLICIES.SUPPLIED,
      hitLocation: locationName(hitLocation),
      executionId: executionKey,
      sourceId: attacker?.id,
      targetId: defender?.id,
      amount: rawDamage,
      damageType: attack.damageType,
      originControlMode,
    },
  };

  let applied;
  try {
    applied = applyCanonicalCombatEffect({
      event,
      fighters,
      liveContext: {
        combatActive: true,
        combatOver: false,
        combatSession,
        turnToken,
        fighters,
        resolvedKeys,
      },
      authorities: {
        ...authorities,
        applyArmorImpactToFighter:
          authorities.applyArmorImpactToFighter || applyArmorImpactToFighter,
        resolvePhysicalProtection: ({ source, target, amount }) =>
          resolveCanonicalGrapplePhysicalProtection({
            source,
            target,
            amount,
            actionType,
            weapon,
            attackMode,
            result,
            hitLocation,
            armorContact,
            resolveArmorContactFn: authorities.resolveArmorContact || resolveArmorContact,
            resolveLayeredArmorImpactFn:
              authorities.resolveLayeredArmorImpact || resolveLayeredArmorImpact,
          }),
      },
    });
  } catch (error) {
    applied = {
      accepted: false,
      reason: "grapple-armor-processing-failed",
      fighters,
      logs: [],
      mutated: false,
      protection: {
        accepted: false,
        reason: "grapple-armor-processing-failed",
        armorConsulted: true,
        amount: 0,
        hitLocation: { location: locationName(hitLocation), supplied: true },
        error,
      },
    };
  }

  if (applied.accepted === false && applied.reason === "grapple-armor-processing-failed") {
    return {
      ...applied,
      logs: [
        ...(applied.logs || []),
        {
          audience: "developer",
          channel: "validation",
          eventType: "grapple-armor-processing-failed-safe",
          level: "error",
          type: "error",
          actorId: attacker?.id || null,
          targetId: defender?.id || null,
          executionKey: executionKey || null,
          source: "canonical-grapple-impact",
          message:
            `grapple armor processing failed safely: actor=${attacker?.name || attacker?.id || "unknown"} ` +
            `target=${defender?.name || defender?.id || "unknown"}; HP mutation blocked`,
          data: { actionType, weapon: attack.name, hitLocation: locationName(hitLocation) },
        },
      ],
    };
  }
  return applied;
}

export default applyCanonicalGrappleImpact;
