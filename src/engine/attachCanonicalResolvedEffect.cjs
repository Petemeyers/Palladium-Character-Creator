function lower(value) {
  return String(value ?? "").trim().toLowerCase();
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function derivePolicies({ kind, attackType, damageType, protectionPolicy, delivery, hitLocation, hitLocationPolicy }) {
  const explicitProtection = firstText(protectionPolicy).replaceAll("_", "-");
  const explicitDelivery = firstText(delivery).replaceAll("_", "-");
  const attack = lower(attackType);
  const dmg = lower(damageType);
  const family = lower(kind);

  if (family === "healing" || attack === "healing" || attack === "heal") {
    return {
      family: "healing",
      delivery: explicitDelivery || "healing",
      protectionPolicy: explicitProtection || "not-applicable",
      hitLocationPolicy: firstText(hitLocationPolicy) || "not-applicable",
    };
  }
  if (family === "status") {
    return {
      family: "status",
      delivery: explicitDelivery || "status",
      protectionPolicy: explicitProtection || "bypass-physical",
      hitLocationPolicy: firstText(hitLocationPolicy) || "not-applicable",
    };
  }
  if (["mental", "psychic", "psi"].includes(attack) || ["tactical", "psi", "mind", "psychic", "mental"].includes(dmg)) {
    return {
      family: "mental",
      delivery: explicitDelivery || "mental",
      protectionPolicy: explicitProtection || "bypass-physical",
      hitLocationPolicy: firstText(hitLocationPolicy) || "not-applicable",
    };
  }
  if (["supernatural", "magical", "magic"].includes(attack) || family === "supernatural") {
    return {
      family: "supernatural",
      delivery: explicitDelivery || "supernatural",
      protectionPolicy: explicitProtection || "bypass-physical",
      hitLocationPolicy: firstText(hitLocationPolicy) || "not-applicable",
    };
  }
  if (["melee", "physical", "contact", "weapon"].includes(attack) || family === "technique") {
    return {
      family: "physical-contact",
      delivery: explicitDelivery || "physical-contact",
      protectionPolicy: explicitProtection || "physical-armor",
      hitLocationPolicy: firstText(hitLocationPolicy) || (hitLocation ? "supplied" : "required"),
    };
  }
  if (["ranged", "projectile", "kinetic"].includes(attack) && explicitProtection === "physical-armor") {
    return {
      family: "physical-projectile",
      delivery: explicitDelivery || "physical-projectile",
      protectionPolicy: "physical-armor",
      hitLocationPolicy: firstText(hitLocationPolicy) || (hitLocation ? "supplied" : "required"),
    };
  }
  if (family === "tactical") {
    return {
      family: "mental",
      delivery: explicitDelivery || "mental",
      protectionPolicy: explicitProtection || "bypass-physical",
      hitLocationPolicy: firstText(hitLocationPolicy) || "not-applicable",
    };
  }
  return {
    family: family || "physical-contact",
    delivery: explicitDelivery || "physical-contact",
    protectionPolicy: explicitProtection || "physical-armor",
    hitLocationPolicy: firstText(hitLocationPolicy) || (hitLocation ? "supplied" : "required"),
  };
}

function attachCanonicalResolvedEffect(event, extras = {}) {
  if (!event || typeof event !== "object") return event;
  const kind = firstText(extras.kind, event.kind, extras.meta?.kind);
  const attackType = firstText(extras.attackType, event.attackType, extras.power?.attackType, extras.technique?.attackType);
  const damageType = firstText(extras.damageType, event.damageType, extras.power?.damageType, extras.technique?.damageType);
  const protectionPolicy = firstText(
    extras.protectionPolicy,
    event.protectionPolicy,
    extras.power?.protectionPolicy,
    extras.technique?.protectionPolicy,
  );
  const delivery = firstText(
    extras.delivery,
    event.delivery,
    extras.power?.delivery,
    extras.power?.deliveryType,
    extras.technique?.delivery,
    extras.technique?.deliveryType,
  );
  const policies = derivePolicies({
    kind,
    attackType,
    damageType,
    protectionPolicy,
    delivery,
    hitLocation: extras.hitLocation || event.hitLocation,
    hitLocationPolicy: extras.hitLocationPolicy || event.hitLocationPolicy,
  });
  event.kind = kind || event.kind;
  event.attackType = attackType || event.attackType;
  event.damageType = damageType || event.damageType;
  event.protectionPolicy = policies.protectionPolicy;
  event.delivery = policies.delivery;
  event.hitLocationPolicy = policies.hitLocationPolicy;
  event.controlMode = firstText(extras.controlMode, event.controlMode, extras.meta?.controlMode) || event.controlMode;
  event.canonicalEffect = {
    ...(event.canonicalEffect || {}),
    family: policies.family,
    delivery: policies.delivery,
    protectionPolicy: policies.protectionPolicy,
    hitLocationPolicy: policies.hitLocationPolicy,
    kind: event.kind,
    attackType: event.attackType,
    damageType: event.damageType,
  };
  return event;
}

module.exports = {
  attachCanonicalResolvedEffect,
};
