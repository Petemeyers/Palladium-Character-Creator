const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const getWeaponIdentityText = (weapon = {}) => [
  weapon.id,
  weapon.weaponId,
  weapon.profileKey,
  weapon.canonicalWeaponId,
  weapon.name,
  weapon.displayName,
  weapon.label,
  weapon.weaponFamily,
]
  .filter(Boolean)
  .map(normalizeText)
  .join(" ");

const explicitlyTwoHanded = (weapon = {}) => (
  weapon.twoHanded === true ||
  weapon.requiresTwoHands === true ||
  Number(weapon.handsRequired) === 2 ||
  normalizeText(weapon.handedness).includes("two-handed") ||
  normalizeText(weapon.category).includes("two-handed")
);

export const isCanonicalPike = (weapon = {}) => {
  const identity = getWeaponIdentityText(weapon);
  return /(^|[\s._-])pike($|[\s._-])/.test(identity) || identity.includes("weapon.pike");
};

export const isCanonicalHalberd = (weapon = {}) => {
  const identity = getWeaponIdentityText(weapon);
  return (
    identity.includes("halberd") ||
    identity.includes("halbert") ||
    identity.includes("weapon.halberd")
  );
};

export const isCanonicalGreatsword = (weapon = {}) => {
  const identity = getWeaponIdentityText(weapon);
  return (
    identity.includes("greatsword") ||
    identity.includes("great sword") ||
    identity.includes("zweihander") ||
    identity.includes("montante") ||
    identity.includes("spadone") ||
    identity.includes("two-handed sword") ||
    (identity.includes("claymore") && explicitlyTwoHanded(weapon))
  );
};

export const isCanonicalLongsword = (weapon = {}) => {
  const identity = getWeaponIdentityText(weapon);
  return !isCanonicalGreatsword(weapon) && (
    identity.includes("longsword") ||
    identity.includes("long sword") ||
    identity.includes("weapon.long-sword")
  );
};

export const isCanonicalSword = (weapon = {}) => {
  const identity = getWeaponIdentityText(weapon);
  return isCanonicalGreatsword(weapon) || isCanonicalLongsword(weapon) || identity.includes("sword");
};

export const isCanonicalInfantrySpear = (weapon = {}) => {
  const identity = getWeaponIdentityText(weapon);
  return !isCanonicalPike(weapon) && !isCanonicalHalberd(weapon) && (
    identity.includes("weapon.infantry-spear") ||
    identity.includes("infantry spear") ||
    identity.includes("long-spear") ||
    (
      /(^|\s)spear($|\s)/.test(identity) &&
      explicitlyTwoHanded(weapon)
    )
  );
};

export const isCanonicalOneHandedSpear = (weapon = {}) => {
  const identity = getWeaponIdentityText(weapon);
  return (
    !isCanonicalInfantrySpear(weapon) &&
    !isCanonicalPike(weapon) &&
    !isCanonicalHalberd(weapon) &&
    /(^|[\s._-])spear($|[\s._-])/.test(identity) &&
    !explicitlyTwoHanded(weapon)
  );
};

export const isCanonicalPolearm = (weapon = {}) => (
  isCanonicalInfantrySpear(weapon) ||
  isCanonicalOneHandedSpear(weapon) ||
  isCanonicalPike(weapon) ||
  isCanonicalHalberd(weapon)
);

export const isCanonicalThrownWeapon = (weapon = {}) => {
  if (isCanonicalPolearm(weapon)) return false;
  const identity = getWeaponIdentityText(weapon);
  return (
    weapon.isThrown === true ||
    weapon.isProjectile === true ||
    weapon.isRanged === true ||
    weapon.ranged === true ||
    normalizeText(weapon.attackType) === "ranged" ||
    normalizeText(weapon.type) === "ranged" ||
    normalizeText(weapon.weaponType) === "thrown" ||
    normalizeText(weapon.deliveryType) === "projectile" ||
    normalizeText(weapon.category) === "thrown" ||
    identity.includes("javelin") ||
    identity.includes("throwing spear") ||
    identity.includes("thrown spear")
  );
};

export const getCanonicalWeaponReachFeet = (weapon = {}, fallback = 5.5) => {
  if (isCanonicalPike(weapon)) {
    return Math.max(15, Number(weapon.reachFeet) || 0, Number(weapon.reach) || 0);
  }
  if (isCanonicalHalberd(weapon)) {
    return Math.max(10, Number(weapon.reachFeet) || 0, Number(weapon.reach) || 0);
  }
  if (isCanonicalInfantrySpear(weapon)) {
    return Math.max(10, Number(weapon.reachFeet) || 0, Number(weapon.reach) || 0);
  }
  if (isCanonicalOneHandedSpear(weapon)) {
    return Math.max(10, Number(weapon.reachFeet) || 0, Number(weapon.reach) || 0);
  }
  if (isCanonicalGreatsword(weapon)) {
    return Math.max(5.5, Number(weapon.reachFeet) || 0, Number(weapon.reach) || 0);
  }
  if (isCanonicalThrownWeapon(weapon)) {
    return Number(
      weapon.normalRangeFeet ??
      weapon.rangeFeet ??
      weapon.rangeFt ??
      weapon.range ??
      fallback
    ) || fallback;
  }
  return Number(
    weapon.reachFeet ??
    weapon.reach ??
    weapon.lengthFt ??
    fallback
  ) || fallback;
};

export const getCanonicalWeaponLengthFeet = (weapon = {}, fallback = 0) => {
  if (isCanonicalPike(weapon)) return Math.max(12, Number(weapon.lengthFt) || 0);
  if (isCanonicalHalberd(weapon)) return Math.max(6, Number(weapon.lengthFt) || 0);
  if (isCanonicalInfantrySpear(weapon)) return Math.max(6, Number(weapon.lengthFt) || 0);
  if (isCanonicalOneHandedSpear(weapon)) return Math.max(5, Number(weapon.lengthFt) || 0);
  if (isCanonicalGreatsword(weapon)) return Math.max(5, Number(weapon.lengthFt) || 0);
  return Number(weapon.lengthFt ?? weapon.length ?? fallback) || fallback;
};

export const getCanonicalWeaponTypeLabel = (weapon = {}) => {
  if (isCanonicalPolearm(weapon) || isCanonicalGreatsword(weapon)) return "LONG";
  if (isCanonicalThrownWeapon(weapon)) return "RANGED";
  const explicit = normalizeText(
    weapon.weaponType || weapon.rangeCategory || weapon.deliveryType || weapon.category || weapon.type
  );
  if (explicit.includes("reach") || explicit.includes("extended")) return "LONG";
  if (explicit.includes("ranged") || explicit.includes("projectile") || explicit.includes("thrown")) return "RANGED";
  if (getCanonicalWeaponLengthFeet(weapon, 0) >= 6) return "LONG";
  return "MELEE";
};

export const getCanonicalWeaponTraitProfile = (weapon = {}) => {
  const identity = getWeaponIdentityText(weapon);
  const pike = isCanonicalPike(weapon);
  const halberd = isCanonicalHalberd(weapon);
  const twoHandedSpear = isCanonicalInfantrySpear(weapon);
  const oneHandedSpear = isCanonicalOneHandedSpear(weapon);
  const greatsword = isCanonicalGreatsword(weapon);
  const longsword = isCanonicalLongsword(weapon);
  const polearm = pike || halberd || twoHandedSpear || oneHandedSpear;
  const twoHanded = explicitlyTwoHanded(weapon) || pike || halberd || twoHandedSpear || greatsword;
  const reachFeet = getCanonicalWeaponReachFeet(weapon, 5.5);
  const woodenShaft = polearm && weapon.shaftMaterial !== "metal" && weapon.metalShaft !== true;

  let family = "other";
  if (pike) family = "pike";
  else if (halberd) family = "halberd";
  else if (twoHandedSpear) family = "two-handed-spear";
  else if (oneHandedSpear) family = "one-handed-spear";
  else if (greatsword) family = "greatsword";
  else if (longsword) family = "longsword";
  else if (isCanonicalSword(weapon)) family = "sword";
  else if (identity.includes("axe")) family = "axe";
  else if (identity.includes("mace") || identity.includes("hammer")) family = "impact";
  else if (identity.includes("dagger") || identity.includes("knife")) family = "dagger";

  return {
    family,
    identity,
    isPolearm: polearm,
    isPike: pike,
    isHalberd: halberd,
    isSpear: twoHandedSpear || oneHandedSpear,
    isTwoHandedSpear: twoHandedSpear,
    isOneHandedSpear: oneHandedSpear,
    isGreatsword: greatsword,
    isLongsword: longsword,
    isSword: isCanonicalSword(weapon),
    twoHanded,
    oneHanded: !twoHanded,
    reachFeet,
    lengthFeet: getCanonicalWeaponLengthFeet(weapon, 0),
    woodenShaft,
    shaftDestructible: woodenShaft && weapon.indestructible !== true,
    canBrace: Boolean(weapon.braceCapabilities?.canBrace ?? (pike || twoHandedSpear)),
    canHook: Boolean(weapon.canHook ?? halberd),
    canChop: Boolean(weapon.canChop ?? halberd ?? false),
    canTargetShaft: Boolean(weapon.canTargetShaft ?? greatsword),
    canBeatPolearm: Boolean(weapon.canBeatPolearm ?? greatsword ?? longsword),
    halfSwordCapable: Boolean(weapon.halfSwordCapable ?? longsword ?? greatsword),
    poorInClinch: Boolean(weapon.poorInClinch ?? polearm),
    formationDependent: Boolean(weapon.formationDependent ?? pike),
    shieldCompatible: Boolean(weapon.shieldCompatible ?? (!twoHanded && !polearm)),
  };
};

const normalizePolearmWeapon = (weapon = {}, family) => {
  const profile = getCanonicalWeaponTraitProfile({ ...weapon, weaponFamily: weapon.weaponFamily || family });
  return {
    ...weapon,
    type: "weapon",
    kind: "melee",
    attackType: "melee",
    weaponType: "melee",
    rangeCategory: "melee",
    deliveryType: "extended-melee",
    weaponFamily: weapon.weaponFamily || family,
    handedness: profile.twoHanded ? "two-handed" : "one-handed",
    handsRequired: profile.twoHanded ? 2 : 1,
    requiresTwoHands: profile.twoHanded,
    twoHanded: profile.twoHanded,
    shieldCompatible: profile.shieldCompatible,
    isMelee: true,
    isRanged: false,
    isProjectile: false,
    ranged: false,
    isThrown: false,
    requiresAmmo: false,
    usesAmmo: false,
    ammoRequired: false,
    consumeAmmo: false,
    ammunitionType: null,
    ammunitionPerAttack: 0,
    normalRangeFeet: null,
    longRangeFeet: null,
    range: null,
    rangeFt: null,
    rangeFeet: null,
    reach: profile.reachFeet,
    reachFeet: profile.reachFeet,
    lengthFt: profile.lengthFeet,
    shaftMaterial: weapon.shaftMaterial || (profile.isPolearm ? "wood" : undefined),
    shaftIntegrity: Number.isFinite(Number(weapon.shaftIntegrity))
      ? Number(weapon.shaftIntegrity)
      : profile.shaftDestructible
        ? 3
        : undefined,
    maxShaftIntegrity: Number.isFinite(Number(weapon.maxShaftIntegrity))
      ? Number(weapon.maxShaftIntegrity)
      : profile.shaftDestructible
        ? 3
        : undefined,
  };
};

export const normalizeCanonicalCombatWeapon = (weapon = {}) => {
  if (isCanonicalPike(weapon)) {
    return normalizePolearmWeapon({
      ...weapon,
      name: weapon.name || "Pike",
      displayName: weapon.displayName || weapon.name || "Pike",
      formationDependent: weapon.formationDependent ?? true,
      poorInClinch: true,
    }, "pike");
  }
  if (isCanonicalHalberd(weapon)) {
    return normalizePolearmWeapon({
      ...weapon,
      name: weapon.name || "Halberd",
      displayName: weapon.displayName || weapon.name || "Halberd",
      canHook: weapon.canHook ?? true,
      canChop: weapon.canChop ?? true,
      poorInClinch: weapon.poorInClinch ?? true,
    }, "halberd");
  }
  if (isCanonicalInfantrySpear(weapon)) {
    return normalizePolearmWeapon({
      ...weapon,
      id: weapon.id || "weapon.infantry-spear",
      weaponId: weapon.weaponId || weapon.id || "weapon.infantry-spear",
      profileKey: weapon.profileKey || weapon.weaponId || weapon.id || "weapon.infantry-spear",
      name: weapon.name || "Spear",
      displayName: weapon.displayName || weapon.name || "Spear",
      handedness: "two-handed",
      handsRequired: 2,
      requiresTwoHands: true,
      twoHanded: true,
      shieldCompatible: false,
    }, "long-spear");
  }
  if (isCanonicalOneHandedSpear(weapon)) {
    return normalizePolearmWeapon({
      ...weapon,
      name: weapon.name || "Spear",
      displayName: weapon.displayName || weapon.name || "Spear",
      handedness: "one-handed",
      handsRequired: 1,
      requiresTwoHands: false,
      twoHanded: false,
      shieldCompatible: true,
    }, "one-handed-spear");
  }
  if (isCanonicalGreatsword(weapon)) {
    return {
      ...weapon,
      type: "weapon",
      kind: "melee",
      attackType: "melee",
      weaponType: "melee",
      deliveryType: "melee",
      handedness: "two-handed",
      handsRequired: 2,
      requiresTwoHands: true,
      twoHanded: true,
      shieldCompatible: false,
      isMelee: true,
      isRanged: false,
      isProjectile: false,
      canTargetShaft: weapon.canTargetShaft ?? true,
      canBeatPolearm: weapon.canBeatPolearm ?? true,
      halfSwordCapable: weapon.halfSwordCapable ?? true,
      reach: getCanonicalWeaponReachFeet(weapon, 5.5),
      reachFeet: getCanonicalWeaponReachFeet(weapon, 5.5),
      lengthFt: getCanonicalWeaponLengthFeet(weapon, 5),
    };
  }
  return weapon;
};

export const normalizeCanonicalActorWeapons = (actor = {}) => {
  const normalizeList = (list) => Array.isArray(list)
    ? list.map((weapon) => normalizeCanonicalCombatWeapon(weapon))
    : list;
  return {
    ...actor,
    equipment: normalizeList(actor.equipment),
    inventory: normalizeList(actor.inventory),
    attacks: normalizeList(actor.attacks),
    weaponProfiles: normalizeList(actor.weaponProfiles),
    equistaminadWeapons: normalizeList(actor.equistaminadWeapons),
  };
};
