const event = (eventType, data = {}, level = "info") => ({ eventType, level, data });

export const COMMITTED_MINOTAUR_IMPACT_STAGES = Object.freeze([
  "selected-technique",
  "technique-prerequisite-passed",
  "derived-attack-modifier-components",
  "movement-momentum",
  "active-defense-resolved",
  "shield-interception-resolved",
  "hit-location-resolved",
  "armor-layer-contacted",
  "contact-surface-resolved",
  "armor-impact-resolved",
  "stability-contest-resolved",
  "stamina-spent",
  "injury-authorization-resolved",
]);

export function resolveCanonicalImpactPipeline({
  intent,
  prerequisite,
  movement = {},
  defense = {},
  shield = {},
  hitLocation = {},
  armor = {},
  contact = {},
  stability = {},
  stamina = {},
} = {}) {
  if (!intent?.accepted || prerequisite?.accepted === false) {
    return {
      accepted: false,
      reason: prerequisite?.reason || "invalid-intent",
      directHpMutation: false,
      events: [
        event(
          "technique-prerequisite-failed",
          { reason: prerequisite?.reason || "invalid-intent" },
          "warning",
        ),
      ],
    };
  }

  const events = [
    event("selected-technique", {
      techniqueKey: intent.techniqueKey,
      resolverRoute: intent.resolverRoute,
    }),
    event("technique-prerequisite-passed", { techniqueKey: intent.techniqueKey }),
    event("derived-attack-modifier-components", intent.derivedAttackModifier),
    event("movement-momentum", {
      straightLineFeet: movement.straightLineFeet || 0,
      momentum: movement.momentum || contact?.impact?.momentumNs || 0,
      kineticEnergyJ: contact?.impact?.kineticEnergyJ || 0,
    }),
    event("active-defense-resolved", {
      outcome: defense.evaded ? "evaded" : "not-evaded",
    }),
  ];

  if (defense.evaded) {
    events.push(event("recovery-opening-created", {
      committedMiss: true,
      opening: "attacker-recovery",
    }));
    return {
      accepted: true,
      outcome: "evaded",
      bodilyDamagePermitted: false,
      directHpMutation: false,
      stageCountValid: true,
      events,
    };
  }

  events.push(event("shield-interception-resolved", {
    intercepted: shield.intercepted === true,
    shieldId: shield.shieldId || null,
    armImpact: shield.armImpact || 0,
  }));
  events.push(event("hit-location-resolved", {
    location: hitLocation.location || "unresolved",
  }));

  if (shield.intercepted) {
    events.push(
      event("stability-contest-resolved", { ...stability }),
      event("forced-movement-resolved", {
        distanceFeet: stability.displacementFeet || 0,
      }),
      event("stamina-spent", {
        amount: stamina.spent || intent.technique.staminaCost || 0,
      }),
      event("injury-authorization-resolved", {
        authorized: false,
        reason: "shield-interception",
      }),
    );
    return {
      accepted: true,
      outcome: "shield-interception",
      bodilyDamagePermitted: false,
      directHpMutation: false,
      stageCountValid: true,
      events,
    };
  }

  events.push(event("armor-layer-contacted", {
    layer: armor.layer || armor.armorClass || "unarmored",
    assemblyQuality: armor.assemblyQuality || null,
    paddingPresent: armor.paddingPresent ?? null,
  }));
  events.push(event("contact-surface-resolved", {
    contactSurface: intent.technique.contactSurface,
    contactType: contact.contactType || "direct",
  }));

  const plate = armor.rigidCoverage === true ||
    /plate/i.test(String(armor.armorClass || armor.layer || ""));
  const gap = contact.armorGap === true || contact.exposedLocation === true;
  const bluntTransfer = Math.max(0, Number(contact.bluntTransfer || 0));
  const bluntInjuryAuthorized = contact.injuryAuthorized === true ||
    (Number(contact.injuryThresholdJ) > 0 && bluntTransfer >= Number(contact.injuryThresholdJ));

  let outcome = "impact-transfer";
  let bodilyDamagePermitted = true;

  if (plate && !gap) {
    bodilyDamagePermitted = contact.penetrated === true || bluntInjuryAuthorized;
    if (contact.penetrated === true) outcome = "conditional-penetration";
    else if (contact.buckled === true) outcome = "armor-crushing";
    else if (contact.dented === true && bluntInjuryAuthorized) outcome = "armor-denting-with-blunt-injury";
    else if (contact.dented === true) outcome = "armor-denting";
    else if (bluntInjuryAuthorized) outcome = "stopped-with-blunt-transfer";
    else outcome = contact.deflected === true
      ? "armor-deflection"
      : "armor-deflection-or-blunt-transfer";
  } else if (gap) {
    outcome = "armor-gap-contact";
  }

  events.push(event("armor-impact-resolved", {
    outcome,
    penetration: contact.penetrated === true,
    deflection: contact.deflected === true ||
      (plate && !gap && contact.penetrated !== true && contact.dented !== true),
    denting: contact.dented === true,
    buckled: contact.buckled === true,
    bluntTransfer,
    impactEnergyJ: contact?.impact?.kineticEnergyJ || 0,
    normalImpactEnergyJ: contact?.impact?.normalEnergyJ || 0,
    shellIntegrityLost: contact?.shell?.integrityLost || 0,
    shellIntegrityAfter: contact?.shell?.integrityAfter ?? null,
    dentDepthMm: contact?.shell?.dentDepthMm || 0,
    paddingPresent: contact?.padding?.present ?? null,
    paddingAbsorbedEnergyJ: contact?.padding?.absorbedEnergyJ || 0,
    paddingBottomedOut: contact?.padding?.bottomedOut === true,
    bodyDamageMultiplier: contact.bodyDamageMultiplier || 0,
  }));
  events.push(event("stability-contest-resolved", {
    ...stability,
    forcedMovementResolved: Number(stability.displacementFeet || 0) > 0,
  }));
  events.push(event("stamina-spent", {
    amount: stamina.spent || intent.technique.staminaCost || 0,
  }));
  events.push(event("injury-authorization-resolved", {
    authorized: bodilyDamagePermitted,
    reason: bodilyDamagePermitted
      ? outcome
      : (plate && !gap ? "rigid-coverage-limited-transfer" : outcome),
    bluntTransfer,
    injuryThresholdJ: contact.injuryThresholdJ || 0,
    bodyDamageMultiplier: contact.bodyDamageMultiplier || 0,
    statuses: Array.isArray(contact.statuses) ? contact.statuses : [],
  }));

  return {
    accepted: true,
    outcome,
    bodilyDamagePermitted,
    bodyDamageMultiplier: Number(contact.bodyDamageMultiplier || 0),
    minimumDamage: Number(contact.minimumDamage || 0),
    damageType: contact.damageType || null,
    armorImpact: contact.layeredImpact || null,
    stability: { ...stability },
    directHpMutation: false,
    stageCountValid:
      events.length === COMMITTED_MINOTAUR_IMPACT_STAGES.length &&
      COMMITTED_MINOTAUR_IMPACT_STAGES.every(
        (stage, index) => events[index]?.eventType === stage,
      ),
    events,
  };
}

export default resolveCanonicalImpactPipeline;
