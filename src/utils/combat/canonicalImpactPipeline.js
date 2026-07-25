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
    return { accepted: false, reason: prerequisite?.reason || "invalid-intent", directHpMutation: false, events: [event("technique-prerequisite-failed", { reason: prerequisite?.reason || "invalid-intent" }, "warning")] };
  }
  const events = [
    event("selected-technique", { techniqueKey: intent.techniqueKey, resolverRoute: intent.resolverRoute }),
    event("technique-prerequisite-passed", { techniqueKey: intent.techniqueKey }),
    event("derived-attack-modifier-components", intent.derivedAttackModifier),
    event("movement-momentum", { straightLineFeet: movement.straightLineFeet || 0, momentum: movement.momentum || 0 }),
    event("active-defense-resolved", { outcome: defense.evaded ? "evaded" : "not-evaded" }),
  ];
  if (defense.evaded) {
    events.push(event("recovery-opening-created", { committedMiss: true, opening: "attacker-recovery" }));
    return { accepted: true, outcome: "evaded", bodilyDamagePermitted: false, directHpMutation: false, stageCountValid: true, events };
  }
  events.push(event("shield-interception-resolved", {
    intercepted: shield.intercepted === true,
    shieldId: shield.shieldId || null,
    armImpact: shield.armImpact || 0,
  }));
  events.push(event("hit-location-resolved", { location: hitLocation.location || "unresolved" }));
  if (shield.intercepted) {
    events.push(
      event("stability-contest-resolved", { ...stability }),
      event("forced-movement-resolved", { distanceFeet: stability.displacementFeet || 0 }),
      event("stamina-spent", { amount: stamina.spent || intent.technique.staminaCost || 0 }),
      event("injury-authorization-resolved", { authorized: false, reason: "shield-interception" }),
    );
    return { accepted: true, outcome: "shield-interception", bodilyDamagePermitted: false, directHpMutation: false, stageCountValid: true, events };
  }
  events.push(event("armor-layer-contacted", { layer: armor.layer || armor.armorClass || "unarmored" }));
  events.push(event("contact-surface-resolved", {
    contactSurface: intent.technique.contactSurface,
    contactType: contact.contactType || "direct",
  }));
  const plate = armor.rigidCoverage === true || /plate/i.test(String(armor.armorClass || armor.layer || ""));
  const gap = contact.armorGap === true || contact.exposedLocation === true;
  let outcome = "impact-transfer";
  let bodilyDamagePermitted = true;
  if (plate && !gap) {
    bodilyDamagePermitted = contact.penetrated === true;
    outcome = contact.penetrated === true ? "conditional-penetration" : (contact.dented ? "armor-denting" : "armor-deflection-or-blunt-transfer");
  } else if (gap) {
    outcome = "armor-gap-contact";
  }
  events.push(event("armor-impact-resolved", {
    outcome,
    penetration: contact.penetrated === true,
    deflection: plate && !gap && contact.penetrated !== true,
    denting: contact.dented === true,
    bluntTransfer: contact.bluntTransfer || 0,
  }));
  events.push(event("stability-contest-resolved", { ...stability }));
  if (stability.displacementFeet) events.push(event("forced-movement-resolved", { distanceFeet: stability.displacementFeet }));
  events.push(event("stamina-spent", { amount: stamina.spent || intent.technique.staminaCost || 0 }));
  events.push(event("injury-authorization-resolved", {
    authorized: bodilyDamagePermitted,
    reason: bodilyDamagePermitted ? outcome : "intact-rigid-coverage",
    bluntTransfer: contact.bluntTransfer || 0,
  }));
  return {
    accepted: true,
    outcome,
    bodilyDamagePermitted,
    directHpMutation: false,
    stageCountValid:
      events.length === COMMITTED_MINOTAUR_IMPACT_STAGES.length &&
      COMMITTED_MINOTAUR_IMPACT_STAGES.every((stage, index) => events[index]?.eventType === stage),
    events,
  };
}

export default resolveCanonicalImpactPipeline;
