const key = (value) => String(value || "").trim().toLowerCase();

export function resolveCanonicalProjectileArmorContact({
  weaponProfile = {},
  armor = {},
  attackResult = {},
  contact = {},
} = {}) {
  if (key(weaponProfile.deliveryType) !== "projectile") return { accepted: false, reason: "not-projectile" };
  if (attackResult.hit !== true) return { accepted: true, outcome: "miss", permitsDamage: false };
  if (contact.shieldIntercepted) return { accepted: true, outcome: "shield-interception", permitsDamage: false };
  const plate = key(armor.armorClass || armor.category || armor.name).includes("plate") || armor.rigidCoverage === true;
  const legalGap = contact.armorGap === true || contact.uncoveredLocation === true;
  if (plate && !legalGap) {
    return {
      accepted: true,
      outcome: contact.solidPlate === false ? "armor-deflection" : "solid-plate-stop",
      permitsDamage: false,
      criticalContinuesThroughArmor: attackResult.natural20 === true,
    };
  }
  if (legalGap) return { accepted: true, outcome: "armor-gap-contact", permitsDamage: true };
  if (/mail|padding|padded/.test(key(armor.armorClass || armor.category || armor.name))) {
    return { accepted: true, outcome: "mail-or-padding-absorption", permitsDamage: Boolean(contact.penetratingContact) };
  }
  return { accepted: true, outcome: contact.penetratingContact ? "penetrating-contact" : "vulnerable-uncovered-location", permitsDamage: true };
}

export default resolveCanonicalProjectileArmorContact;
