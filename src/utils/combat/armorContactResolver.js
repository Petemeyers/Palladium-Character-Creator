import {
  ARMOR_CONTACT_TYPES,
  ARMOR_COVERAGE_TYPES,
  getLocationGapName,
  getModeGapDifficulty,
  getTargetStateGapDefenseModifier,
  getWeaponArmorTraits,
  isLongswordWeapon,
  isPlateCoveredLocation,
  LONGSWORD_ATTACK_MODES,
  normalizeArmorProfile,
  normalizeLongswordAttackMode,
} from "./weaponArmorProfiles.js";
import { resolveCanonicalArmorCoverage } from "./canonicalArmorCoverage.js";

function getLocation(hitLocation) {
  if (typeof hitLocation === "string") return hitLocation;
  return hitLocation?.location || hitLocation?.zone || "torso";
}

export function isCanonicalPhysicalThrownWeapon(weapon = {}) {
  const deliveryType = String(
    weapon?.deliveryType || weapon?.deliveryMethod || "",
  ).trim().toLowerCase();
  const classification = [
    weapon?.attackType,
    weapon?.type,
    weapon?.weaponType,
    weapon?.category,
  ].map((value) => String(value || "").trim().toLowerCase());
  return (
    deliveryType === "thrown" ||
    weapon?.isThrown === true ||
    classification.includes("thrown")
  );
}

export function getCanonicalThrownArmorMode(weapon = {}) {
  if (!isCanonicalPhysicalThrownWeapon(weapon)) return null;
  return String(
    weapon?.attackMode ||
    weapon?.selectedTechnique ||
    weapon?.armorTechnique ||
    weapon?.techniqueKey ||
    weapon?.armorContactProfile ||
    `${weapon?.weaponFamily || "physical-weapon"}-throw`,
  ).trim();
}

function hasStatus(actor = {}, statusText) {
  const wanted = String(statusText || "").toLowerCase();
  const values = [
    actor?.condition,
    actor?.status,
    ...(Array.isArray(actor?.statusEffects) ? actor.statusEffects : []),
    ...(Array.isArray(actor?.conditions) ? actor.conditions.map((condition) => condition?.type || condition?.name || condition) : []),
  ].map((value) => String(value || "").toLowerCase());
  return values.some((value) => value.includes(wanted));
}

export function buildTargetGapState(actor = {}, explicit = {}) {
  return {
    offBalance: explicit.offBalance ?? explicit.isOffBalance ?? hasStatus(actor, "off-balance"),
    prone: explicit.prone ?? explicit.isProne ?? hasStatus(actor, "prone"),
    grappled: explicit.grappled ?? explicit.isGrappled ?? Boolean(actor?.grappleState?.opponent),
    pinned: explicit.pinned ?? explicit.isPinned ?? (hasStatus(actor, "pinned") || actor?.grappleState?.state === "PINNED"),
    stunned: explicit.stunned ?? explicit.isStunned ?? (hasStatus(actor, "stunned") || hasStatus(actor, "dazed")),
  };
}

export function getGapDefense({
  normalDefense = 10,
  armor,
  attackMode,
  targetState = {},
} = {}) {
  const armorProfile = armor?.armorClass ? armor : normalizeArmorProfile({ armor });
  return Math.max(
    1,
    Number(normalDefense || 10) +
      Number(armorProfile.gapDefenseBonus || 0) +
      getModeGapDifficulty(attackMode) +
      getTargetStateGapDefenseModifier(targetState),
  );
}

function baseResult({
  contactType,
  hitLocation,
  coverageType,
  armorLayer,
  attackMode,
  normalDefense,
  gapDefense,
  gapCapable,
  gapReached = false,
  damageAllowed = false,
  bodilyDamageMultiplier = 0,
  convertedDamageType = null,
  damagePrevented = false,
  penetration = false,
  mayBleed = false,
  mayCauseUnconsciousness = false,
  mayStagger = false,
  mayKnockDown = false,
  reason,
  criticalArmorImpact = false,
  gapLocation = null,
} = {}) {
  return {
    contactType,
    hitLocation,
    coverageType,
    armorLayer,
    attackMode,
    normalDefense,
    gapDefense,
    gapCapable,
    gapReached,
    damageAllowed,
    bodilyDamageMultiplier,
    convertedDamageType,
    damagePrevented,
    penetration,
    mayBleed,
    mayCauseUnconsciousness,
    mayStagger,
    mayKnockDown,
    reason,
    criticalArmorImpact,
    gapLocation,
  };
}

export function resolveArmorContact({
  attacker,
  defender,
  weapon,
  attackMode,
  attackData,
  attackRoll,
  attackTotal,
  critical = false,
  hitLocation,
  armor,
  targetState = {},
  normalDefense,
} = {}) {
  const location = getLocation(hitLocation);
  const defense = Number(normalDefense ?? defender?.guardRating ?? defender?.armorClass ?? defender?.ac ?? 10) || 10;
  const total = Number(attackTotal ?? attackRoll ?? 0) || 0;
  const armorProfile = armor?.armorClass ? armor : normalizeArmorProfile(defender || {});
  const physicalWeapon = weapon || attackData || {};
  const mode = isCanonicalPhysicalThrownWeapon(physicalWeapon)
    ? (
        String(attackMode || "").trim() ||
        getCanonicalThrownArmorMode(physicalWeapon) ||
        "physical-weapon-throw"
      )
    : normalizeLongswordAttackMode({ weapon: physicalWeapon, attackMode, attackData });
  const weaponTraits = getWeaponArmorTraits(weapon || attackData || {});
  const gapCapable = Array.isArray(weaponTraits.gapCapableModes) && weaponTraits.gapCapableModes.includes(mode);
  const gapState = buildTargetGapState(defender, targetState);
  const gapDefense = getGapDefense({
    normalDefense: defense,
    armor: armorProfile,
    attackMode: mode,
    targetState: gapState,
  });
  const canonicalCoverage = resolveCanonicalArmorCoverage({
    defender,
    armor: armorProfile,
    hitLocation: location,
  });

  if (total < defense && !critical) {
    return baseResult({
      contactType: ARMOR_CONTACT_TYPES.MISS,
      hitLocation: location,
      coverageType: ARMOR_COVERAGE_TYPES.UNARMORED,
      armorLayer: armorProfile.armorLayer,
      attackMode: mode,
      normalDefense: defense,
      gapDefense,
      gapCapable,
      reason: "attack-below-defense",
    });
  }

  const plateCovered =
    canonicalCoverage.valid &&
    canonicalCoverage.coverageType === "plate" &&
    isPlateCoveredLocation(armorProfile, location);
  if (!plateCovered) {
    return baseResult({
      contactType: ARMOR_CONTACT_TYPES.UNARMORED,
      hitLocation: location,
      coverageType: armorProfile.armorClass === "plate"
        ? ARMOR_COVERAGE_TYPES.ARMOR_GAP
        : ARMOR_COVERAGE_TYPES.UNARMORED,
      armorLayer: armorProfile.armorLayer,
      attackMode: mode,
      normalDefense: defense,
      gapDefense,
      gapCapable,
      damageAllowed: true,
      bodilyDamageMultiplier: 1,
      convertedDamageType: attackData?.damageType || weapon?.damageType || null,
      mayBleed: true,
      mayCauseUnconsciousness: location === "head" || location === "torso",
      reason: armorProfile.armorClass === "plate" ? "plate-gap-or-uncovered-location" : "non-plate-armor",
    });
  }

  const contactProfile = String(
    attackData?.armorContactProfile ||
    weapon?.armorContactProfile ||
    "",
  ).toLowerCase();
  const canonicalHeavyAxe =
    attackData?.techniqueKey === "heavyAxe" ||
    /heavy[-\s]?axe/.test(contactProfile) ||
    /\bheavy axe\b/i.test(attackData?.name || weapon?.name || "");
  const canonicalHeadbutt =
    attackData?.techniqueKey === "headbutt" ||
    contactProfile === "helmet-blunt-impact";
  const canonicalRockSmash =
    attackData?.techniqueKey === "rockSmash" ||
    contactProfile === "improvised-heavy-melee";

  if (plateCovered && canonicalHeavyAxe) {
    const conditionalPenetration = Boolean(critical);
    return baseResult({
      contactType: conditionalPenetration
        ? ARMOR_CONTACT_TYPES.PENETRATED_ARMOR
        : ARMOR_CONTACT_TYPES.SOLID_PLATE,
      hitLocation: location,
      coverageType: ARMOR_COVERAGE_TYPES.SOLID_PLATE,
      armorLayer: armorProfile.armorLayer,
      attackMode: mode,
      normalDefense: defense,
      gapDefense,
      gapCapable: false,
      damageAllowed: conditionalPenetration,
      bodilyDamageMultiplier: conditionalPenetration ? 1 : 0,
      convertedDamageType: conditionalPenetration ? (attackData?.damageType || "slashing") : "blunt",
      damagePrevented: !conditionalPenetration,
      penetration: conditionalPenetration,
      mayStagger: true,
      mayKnockDown: critical,
      reason: conditionalPenetration
        ? "heavy-axe-conditional-plate-penetration"
        : "heavy-axe-deflection-denting-or-blunt-transfer",
      criticalArmorImpact: Boolean(critical),
    });
  }

  if (plateCovered && (canonicalHeadbutt || canonicalRockSmash)) {
    return baseResult({
      contactType: ARMOR_CONTACT_TYPES.BLUNT_THROUGH_ARMOR,
      hitLocation: location,
      coverageType: ARMOR_COVERAGE_TYPES.SOLID_PLATE,
      armorLayer: armorProfile.armorLayer,
      attackMode: mode,
      normalDefense: defense,
      gapDefense,
      gapCapable: false,
      damageAllowed: false,
      bodilyDamageMultiplier: 0,
      convertedDamageType: "bludgeoning",
      damagePrevented: true,
      mayStagger: true,
      mayKnockDown: critical || location === "legs",
      mayCauseUnconsciousness: location === "head" && critical,
      reason: canonicalHeadbutt
        ? "headbutt-blunt-impact-on-plate"
        : "rock-smash-blunt-impact-on-plate",
      criticalArmorImpact: Boolean(critical),
    });
  }

  if (!isLongswordWeapon(weapon || attackData) && !weaponTraits?.armorContactResolverRequired) {
    if (canonicalCoverage.armorClass === "plate" && canonicalCoverage.coverageType === "plate") {
      return baseResult({
        contactType: ARMOR_CONTACT_TYPES.SOLID_PLATE,
        hitLocation: location,
        coverageType: ARMOR_COVERAGE_TYPES.SOLID_PLATE,
        armorLayer: armorProfile.armorLayer,
        attackMode: mode,
        normalDefense: defense,
        gapDefense,
        gapCapable,
        damagePrevented: true,
        reason: "canonical-plate-contact-profile-required",
      });
    }
    return baseResult({
      contactType: ARMOR_CONTACT_TYPES.PENETRATED_ARMOR,
      hitLocation: location,
      coverageType: ARMOR_COVERAGE_TYPES.LIGHT_OR_FLEXIBLE,
      armorLayer: armorProfile.armorLayer,
      attackMode: mode,
      normalDefense: defense,
      gapDefense,
      gapCapable,
      damageAllowed: true,
      bodilyDamageMultiplier: 1,
      convertedDamageType: attackData?.damageType || weapon?.damageType || null,
      mayBleed: true,
      mayCauseUnconsciousness: location === "head" || location === "torso",
      penetration: true,
      reason: "non-longsword-default-existing-resolution",
    });
  }

  if (mode === LONGSWORD_ATTACK_MODES.CUT) {
    return baseResult({
      contactType: ARMOR_CONTACT_TYPES.SOLID_PLATE,
      hitLocation: location,
      coverageType: ARMOR_COVERAGE_TYPES.SOLID_PLATE,
      armorLayer: armorProfile.armorLayer,
      attackMode: mode,
      normalDefense: defense,
      gapDefense,
      gapCapable: false,
      damagePrevented: true,
      mayStagger: critical || location === "legs",
      mayKnockDown: critical && location === "legs",
      reason: critical
        ? "critical-longsword-cut-stopped-by-solid-plate"
        : "longsword-cut-stopped-by-solid-plate",
      criticalArmorImpact: Boolean(critical),
    });
  }

  if (mode === LONGSWORD_ATTACK_MODES.POMMEL_OR_CROSSGUARD_STRIKE) {
    return baseResult({
      contactType: ARMOR_CONTACT_TYPES.BLUNT_THROUGH_ARMOR,
      hitLocation: location,
      coverageType: ARMOR_COVERAGE_TYPES.SOLID_PLATE,
      armorLayer: armorProfile.armorLayer,
      attackMode: mode,
      normalDefense: defense,
      gapDefense,
      gapCapable: false,
      damageAllowed: false,
      bodilyDamageMultiplier: 0,
      convertedDamageType: "blunt",
      damagePrevented: true,
      mayStagger: true,
      mayKnockDown: location === "legs" || critical,
      mayCauseUnconsciousness: location === "head" && critical,
      reason: "pommel-or-crossguard-blunt-impact-on-plate",
      criticalArmorImpact: Boolean(critical),
    });
  }

  const naturalHalfSwordGap = critical && mode === LONGSWORD_ATTACK_MODES.HALF_SWORD_THRUST;
  const gapReached = gapCapable && (total >= gapDefense || naturalHalfSwordGap);
  if (gapReached) {
    return baseResult({
      contactType: ARMOR_CONTACT_TYPES.ARMOR_GAP,
      hitLocation: location,
      coverageType: ARMOR_COVERAGE_TYPES.ARMOR_GAP,
      armorLayer: armorProfile.armorLayer,
      attackMode: mode,
      normalDefense: defense,
      gapDefense,
      gapCapable,
      gapReached: true,
      damageAllowed: true,
      bodilyDamageMultiplier: 1,
      convertedDamageType: "piercing",
      penetration: true,
      mayBleed: true,
      mayCauseUnconsciousness: location === "head" || location === "torso",
      reason: naturalHalfSwordGap
        ? "natural-20-half-sword-gap-strike"
        : "gap-defense-met",
      gapLocation: getLocationGapName(location),
    });
  }

  return baseResult({
    contactType: ARMOR_CONTACT_TYPES.SOLID_PLATE,
    hitLocation: location,
    coverageType: ARMOR_COVERAGE_TYPES.SOLID_PLATE,
    armorLayer: armorProfile.armorLayer,
    attackMode: mode,
    normalDefense: defense,
    gapDefense,
    gapCapable,
    damagePrevented: true,
    mayStagger: critical || location === "legs",
    mayKnockDown: critical && location === "legs",
    reason: "gap-not-reached-solid-plate-contact",
    criticalArmorImpact: Boolean(critical),
  });
}

export default resolveArmorContact;
