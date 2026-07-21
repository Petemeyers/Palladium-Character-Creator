export const LONGSWORD_ATTACK_MODES = Object.freeze({
  CUT: "longsword-cut",
  THRUST: "longsword-thrust",
  HALF_SWORD_THRUST: "half-sword-thrust",
  POMMEL_OR_CROSSGUARD_STRIKE: "pommel-or-crossguard-strike",
});

export const ARMOR_CONTACT_TYPES = Object.freeze({
  MISS: "miss",
  SOLID_PLATE: "solid-plate",
  ARMOR_GAP: "armor-gap",
  UNARMORED: "unarmored",
  PENETRATED_ARMOR: "penetrated-armor",
  BLUNT_THROUGH_ARMOR: "blunt-through-armor",
  SHIELD_CONTACT: "shield-contact",
});

export const ARMOR_COVERAGE_TYPES = Object.freeze({
  SOLID_PLATE: "solid-plate",
  ARMOR_GAP: "armor-gap",
  UNARMORED: "unarmored",
  LIGHT_OR_FLEXIBLE: "light-or-flexible",
});

export const GAP_DEFENSE_MODIFIERS = Object.freeze({
  BASE_PLATE_GAP_BONUS: 5,
  LONGSWORD_THRUST_EXTRA_DIFFICULTY: 2,
  HALF_SWORD_EXTRA_DIFFICULTY: 0,
  OFF_BALANCE: -2,
  PRONE: -3,
  GRAPPLED: -3,
  PINNED: -5,
  STUNNED: -2,
});

export const PLATE_COVERED_LOCATIONS = Object.freeze([
  "head",
  "torso",
  "weaponArm",
  "shieldArm",
  "hands",
  "legs",
]);

export const PLATE_GAP_BY_LOCATION = Object.freeze({
  head: "visor/face opening",
  torso: "throat or armpit",
  weaponArm: "inner elbow",
  shieldArm: "inner elbow",
  hands: "gauntlet opening",
  legs: "back of knee",
});

function normalizeText(...values) {
  return values
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value).toLowerCase())
    .join(" ");
}

export function isLongswordWeapon(weapon = {}) {
  const text = normalizeText(
    weapon?.name,
    weapon?.label,
    weapon?.weaponName,
    weapon?.originalWeaponName,
    weapon?.type,
    weapon?.category,
  );
  return /\blong\s*sword\b|\blongsword\b/.test(text);
}

export function getWeaponArmorTraits(weapon = {}) {
  if (weapon?.armorContactTraits) return weapon.armorContactTraits;
  if (!isLongswordWeapon(weapon)) {
    return {
      edgeAgainstPlate: "normal",
      thrustAgainstPlate: "normal",
      halfSwordCapable: false,
      pommelStrikeCapable: false,
      gapCapableModes: [],
    };
  }
  return {
    edgeAgainstPlate: "ineffective",
    thrustAgainstPlate: "gap-only",
    halfSwordCapable: true,
    pommelStrikeCapable: true,
    gapCapableModes: [
      LONGSWORD_ATTACK_MODES.THRUST,
      LONGSWORD_ATTACK_MODES.HALF_SWORD_THRUST,
    ],
  };
}

export function normalizeLongswordAttackMode({ weapon = {}, attackMode, attackData = {} } = {}) {
  const explicit = normalizeText(
    attackMode,
    attackData?.attackMode,
    attackData?.mode,
    attackData?.techniqueMode,
    attackData?.armorContactMode,
  );
  const name = normalizeText(attackData?.name, weapon?.name, weapon?.label);
  const text = `${explicit} ${name}`;

  if (explicit.includes("dagger-clinch-gap-attack")) {
    return "dagger-clinch-gap-attack";
  }
  if (explicit.includes("misericorde-thrust")) {
    return "misericorde-thrust";
  }
  if (explicit.includes("unarmed-clinch-attack")) {
    return "unarmed-clinch-attack";
  }
  if (/half[-\s]?sword|mordhau gap|armored thrust/.test(text)) {
    return LONGSWORD_ATTACK_MODES.HALF_SWORD_THRUST;
  }
  if (/pommel|crossguard|hilt strike|mordhau|blunt/.test(text)) {
    return LONGSWORD_ATTACK_MODES.POMMEL_OR_CROSSGUARD_STRIKE;
  }
  if (/thrust|stab|pierc/.test(text)) {
    return LONGSWORD_ATTACK_MODES.THRUST;
  }
  if (isLongswordWeapon(weapon) || isLongswordWeapon(attackData)) {
    return LONGSWORD_ATTACK_MODES.CUT;
  }
  return explicit || "melee";
}

export function normalizeArmorProfile(actor = {}) {
  const armor = actor?.equistaminadArmor || actor?.equippedArmor || actor?.armor || actor?.wornArmor || actor?.publicArmor || null;
  const armorName = normalizeText(
    armor?.name,
    typeof armor === "string" ? armor : "",
    actor?.armorName,
    actor?.armorProfile?.name,
    actor?.equistaminad?.chest?.name,
  );
  const armorClass = normalizeText(
    armor?.armorClass,
    armor?.class,
    armor?.category,
    armor?.type,
    actor?.armorProfile?.armorClass,
    actor?.armorProfile?.class,
  );
  const plateLike =
    actor?.armorProfile?.armorClass === "plate" ||
    actor?.armorProfile?.rigidCoverage === true ||
    /\bplate\b|field plate|half plate|plate mail|plate harness|mail and plate/.test(`${armorName} ${armorClass}`);

  if (!plateLike) {
    return {
      armorClass: armorClass || "unknown",
      rigidCoverage: false,
      edgeResistance: "normal",
      gapDefenseBonus: 0,
      coveredLocations: [],
      gapLocations: [],
      armorLayer: armor || null,
      armorName: armor?.name || (typeof armor === "string" ? armor : actor?.armorName || ""),
    };
  }

  return {
    armorClass: "plate",
    rigidCoverage: true,
    edgeResistance: "complete",
    gapDefenseBonus: GAP_DEFENSE_MODIFIERS.BASE_PLATE_GAP_BONUS,
    coveredLocations: actor?.armorProfile?.coveredLocations || PLATE_COVERED_LOCATIONS,
    gapLocations: actor?.armorProfile?.gapLocations || Object.values(PLATE_GAP_BY_LOCATION),
    armorLayer: armor || null,
    armorName: armor?.name || (typeof armor === "string" ? armor : actor?.armorName || "plate armor"),
  };
}

export function getLocationGapName(location) {
  return PLATE_GAP_BY_LOCATION[location] || "armor gap";
}

export function isPlateCoveredLocation(armorProfile = {}, location = "torso") {
  if (armorProfile?.armorClass !== "plate" || armorProfile?.rigidCoverage !== true) return false;
  const covered = Array.isArray(armorProfile.coveredLocations)
    ? armorProfile.coveredLocations
    : PLATE_COVERED_LOCATIONS;
  return covered.includes(location);
}

export function getTargetStateGapDefenseModifier(targetState = {}) {
  let modifier = 0;
  if (targetState.offBalance || targetState.isOffBalance) modifier += GAP_DEFENSE_MODIFIERS.OFF_BALANCE;
  if (targetState.prone || targetState.isProne) modifier += GAP_DEFENSE_MODIFIERS.PRONE;
  if (targetState.grappled || targetState.isGrappled) modifier += GAP_DEFENSE_MODIFIERS.GRAPPLED;
  if (targetState.pinned || targetState.isPinned) modifier += GAP_DEFENSE_MODIFIERS.PINNED;
  if (targetState.stunned || targetState.isStunned) modifier += GAP_DEFENSE_MODIFIERS.STUNNED;
  return modifier;
}

export function getModeGapDifficulty(attackMode) {
  if (attackMode === LONGSWORD_ATTACK_MODES.THRUST) {
    return GAP_DEFENSE_MODIFIERS.LONGSWORD_THRUST_EXTRA_DIFFICULTY;
  }
  if (attackMode === LONGSWORD_ATTACK_MODES.HALF_SWORD_THRUST) {
    return GAP_DEFENSE_MODIFIERS.HALF_SWORD_EXTRA_DIFFICULTY;
  }
  return 0;
}
