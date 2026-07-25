import {
  PLATE_GAP_BY_LOCATION,
  isPlateCoveredLocation,
  normalizeArmorProfile,
} from "./weaponArmorProfiles.js";

const locationOf = (hitLocation) => (
  typeof hitLocation === "string"
    ? hitLocation
    : hitLocation?.location || hitLocation?.zone || "torso"
);

export function resolveCanonicalArmorCoverage({
  defender = {},
  armor = null,
  hitLocation,
  explicitGap = false,
} = {}) {
  const profile = armor?.armorClass ? armor : normalizeArmorProfile(defender);
  const location = locationOf(hitLocation);
  const armorId =
    defender?.equippedArmor?.id ||
    defender?.armorProfile?.profileKey ||
    profile?.armorLayer?.id ||
    null;
  const armorName =
    profile?.armorName ||
    defender?.equippedArmor?.name ||
    defender?.armorName ||
    "unarmored";
  if (!profile?.armorClass) {
    return Object.freeze({
      armorId,
      armorName,
      armorClass: "unknown",
      hitLocation: location,
      coverageType: "unknown",
      coverageLayer: null,
      gapAvailable: false,
      weakPointAvailable: false,
      source: "canonical-equipped-armor-profile",
      valid: false,
      reason: "missing-armor-class",
    });
  }
  const plate = profile.armorClass === "plate" && profile.rigidCoverage === true;
  const covered = plate && isPlateCoveredLocation(profile, location);
  const gapAvailable = plate && Boolean(PLATE_GAP_BY_LOCATION[location]);
  const coverageType = plate
    ? explicitGap && gapAvailable
      ? "plate-gap"
      : covered
        ? "plate"
        : "uncovered"
    : profile.rigidCoverage
      ? "rigid-partial"
      : /mail/i.test(profile.armorClass)
        ? "mail"
        : /pad/i.test(profile.armorClass)
          ? "padded"
          : /unarmored|none/i.test(profile.armorClass)
            ? "uncovered"
            : "flexible";
  return Object.freeze({
    armorId,
    armorName,
    armorClass: profile.armorClass,
    hitLocation: location,
    coverageType,
    coverageLayer: profile.armorLayer || defender?.equippedArmor || null,
    gapAvailable,
    weakPointAvailable: gapAvailable,
    source: "canonical-equipped-armor-profile",
    valid: true,
    reason: null,
  });
}

