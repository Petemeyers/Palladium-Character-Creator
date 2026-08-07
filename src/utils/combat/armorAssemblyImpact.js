const finite = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, finite(value, min)));
const round = (value, places = 2) => {
  const factor = 10 ** places;
  return Math.round(finite(value) * factor) / factor;
};

const normalizedText = (...values) => values
  .filter((value) => value !== undefined && value !== null)
  .map((value) => String(value).toLowerCase())
  .join(" ");

const firstFinite = (...values) => {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
};

export const ARMOR_ASSEMBLY_SCHEMA_VERSION = 1;

export const ARMOR_MATERIAL_PROFILES = Object.freeze({
  "hardened-steel": Object.freeze({
    label: "hardened steel",
    deformationCapacityJ: 1050,
    hardnessFactor: 1.18,
    toughnessFactor: 1.12,
    restitution: 0.2,
  }),
  steel: Object.freeze({
    label: "steel",
    deformationCapacityJ: 880,
    hardnessFactor: 1,
    toughnessFactor: 1,
    restitution: 0.18,
  }),
  "low-carbon-steel": Object.freeze({
    label: "low-carbon steel",
    deformationCapacityJ: 700,
    hardnessFactor: 0.82,
    toughnessFactor: 0.98,
    restitution: 0.15,
  }),
  "wrought-iron": Object.freeze({
    label: "wrought iron",
    deformationCapacityJ: 560,
    hardnessFactor: 0.68,
    toughnessFactor: 0.9,
    restitution: 0.12,
  }),
  bronze: Object.freeze({
    label: "bronze",
    deformationCapacityJ: 470,
    hardnessFactor: 0.62,
    toughnessFactor: 0.82,
    restitution: 0.11,
  }),
  "hardened-leather": Object.freeze({
    label: "hardened leather",
    deformationCapacityJ: 210,
    hardnessFactor: 0.3,
    toughnessFactor: 0.62,
    restitution: 0.08,
  }),
  textile: Object.freeze({
    label: "layered textile",
    deformationCapacityJ: 110,
    hardnessFactor: 0.12,
    toughnessFactor: 0.45,
    restitution: 0.03,
  }),
});

export const PADDING_PROFILES = Object.freeze({
  "helmet-liner": Object.freeze({
    label: "helmet liner",
    energyCapacityPerMmJ: 18,
    attenuation: 0.56,
    compressionResistance: 1.15,
  }),
  gambeson: Object.freeze({
    label: "gambeson",
    energyCapacityPerMmJ: 17,
    attenuation: 0.54,
    compressionResistance: 1.1,
  }),
  "arming-doublet": Object.freeze({
    label: "arming doublet",
    energyCapacityPerMmJ: 14,
    attenuation: 0.46,
    compressionResistance: 1,
  }),
  "quilted-jack": Object.freeze({
    label: "quilted jack",
    energyCapacityPerMmJ: 15,
    attenuation: 0.49,
    compressionResistance: 1.02,
  }),
  "thin-clothing": Object.freeze({
    label: "thin clothing",
    energyCapacityPerMmJ: 5,
    attenuation: 0.15,
    compressionResistance: 0.55,
  }),
  none: Object.freeze({
    label: "no padding",
    energyCapacityPerMmJ: 0,
    attenuation: 0.02,
    compressionResistance: 0,
  }),
});

const LOCATION_PROFILES = Object.freeze({
  head: Object.freeze({
    shellCapacityFactor: 0.88,
    curvature: 1.24,
    defaultThicknessMm: 2,
    bodyInjuryThresholdJ: 48,
    dentRadiusM: 0.13,
    fragility: 1.35,
  }),
  torso: Object.freeze({
    shellCapacityFactor: 1,
    curvature: 1.1,
    defaultThicknessMm: 1.8,
    bodyInjuryThresholdJ: 95,
    dentRadiusM: 0.17,
    fragility: 1,
  }),
  weaponArm: Object.freeze({
    shellCapacityFactor: 0.68,
    curvature: 1.05,
    defaultThicknessMm: 1.45,
    bodyInjuryThresholdJ: 72,
    dentRadiusM: 0.1,
    fragility: 1.05,
  }),
  shieldArm: Object.freeze({
    shellCapacityFactor: 0.68,
    curvature: 1.05,
    defaultThicknessMm: 1.45,
    bodyInjuryThresholdJ: 72,
    dentRadiusM: 0.1,
    fragility: 1.05,
  }),
  hands: Object.freeze({
    shellCapacityFactor: 0.48,
    curvature: 1.12,
    defaultThicknessMm: 1.2,
    bodyInjuryThresholdJ: 42,
    dentRadiusM: 0.075,
    fragility: 1.25,
  }),
  legs: Object.freeze({
    shellCapacityFactor: 0.74,
    curvature: 1.08,
    defaultThicknessMm: 1.5,
    bodyInjuryThresholdJ: 78,
    dentRadiusM: 0.12,
    fragility: 1.12,
  }),
  feet: Object.freeze({
    shellCapacityFactor: 0.42,
    curvature: 1.08,
    defaultThicknessMm: 1.15,
    bodyInjuryThresholdJ: 44,
    dentRadiusM: 0.075,
    fragility: 1.18,
  }),
});

const SIZE_MASS_KG = Object.freeze({
  tiny: 10,
  small: 40,
  medium: 82,
  large: 260,
  huge: 650,
  gargantuan: 1500,
});

const TECHNIQUE_IMPACT_PROFILES = Object.freeze({
  rockThrow: Object.freeze({
    massKg: 15,
    velocityMps: 14,
    contactRadiusM: 0.12,
    forceStability: true,
    damageType: "bludgeoning",
    visualKind: "heavy-projectile",
  }),
  rockSmash: Object.freeze({
    massKg: 24,
    velocityMps: 10.5,
    contactRadiusM: 0.14,
    forceStability: true,
    damageType: "bludgeoning",
    visualKind: "heavy-melee-impact",
  }),
  chargingGore: Object.freeze({
    massKg: 185,
    velocityMps: 6.4,
    contactRadiusM: 0.09,
    forceStability: true,
    minimumDisplacementFeet: 5,
    damageType: "piercing",
    visualKind: "charge-collision",
  }),
  gore: Object.freeze({
    massKg: 90,
    velocityMps: 4.2,
    contactRadiusM: 0.075,
    forceStability: true,
    damageType: "piercing",
    visualKind: "body-collision",
  }),
  headbutt: Object.freeze({
    massKg: 52,
    velocityMps: 4.25,
    contactRadiusM: 0.1,
    forceStability: true,
    damageType: "bludgeoning",
    visualKind: "natural-blunt-impact",
  }),
  heavyAxe: Object.freeze({
    massKg: 14,
    velocityMps: 9.2,
    contactRadiusM: 0.045,
    forceStability: true,
    damageType: "slashing",
    visualKind: "heavy-weapon-impact",
  }),
  slam: Object.freeze({
    massKg: 115,
    velocityMps: 5.4,
    contactRadiusM: 0.22,
    forceStability: true,
    minimumDisplacementFeet: 5,
    damageType: "bludgeoning",
    visualKind: "fall-collision",
  }),
  throw: Object.freeze({
    massKg: 115,
    velocityMps: 4.6,
    contactRadiusM: 0.24,
    forceStability: true,
    minimumDisplacementFeet: 5,
    damageType: "bludgeoning",
    visualKind: "thrown-body",
  }),
  crush: Object.freeze({
    massKg: 120,
    velocityMps: 2.8,
    contactRadiusM: 0.2,
    forceStability: false,
    damageType: "bludgeoning",
    visualKind: "compression",
  }),
  trample: Object.freeze({
    massKg: 135,
    velocityMps: 4.2,
    contactRadiusM: 0.16,
    forceStability: true,
    minimumDisplacementFeet: 5,
    damageType: "bludgeoning",
    visualKind: "body-collision",
  }),
  "pommel-or-crossguard-strike": Object.freeze({
    massKg: 4,
    velocityMps: 7.5,
    contactRadiusM: 0.035,
    forceStability: false,
    damageType: "bludgeoning",
    visualKind: "compact-blunt-impact",
  }),
  default: Object.freeze({
    massKg: 7,
    velocityMps: 7,
    contactRadiusM: 0.055,
    forceStability: false,
    damageType: "bludgeoning",
    visualKind: "generic-impact",
  }),
});

const QUALITY_FACTORS = Object.freeze({
  poor: 0.7,
  improvised: 0.6,
  worn: 0.78,
  serviceable: 1,
  professional: 1.08,
  fine: 1.16,
  masterwork: 1.27,
});

const getActorId = (actor = {}) => actor?.id ?? actor?._id ?? actor?.actorId ?? null;

const getSize = (actor = {}) => String(
  actor?.size || actor?.sizeCategory || actor?.creatureSize || "medium",
).toLowerCase();

function estimateActorMassKg(actor = {}) {
  const explicit = firstFinite(
    actor?.massKg,
    actor?.bodyMassKg,
    actor?.weightKg,
    actor?.physicalProfile?.massKg,
  );
  if (explicit !== null && explicit > 0) return explicit;
  const size = getSize(actor);
  const base = SIZE_MASS_KG[size] || SIZE_MASS_KG.medium;
  const might = firstFinite(
    actor?.attributes?.might,
    actor?.abilityScores?.strength,
    actor?.finalAbilityScores?.strength,
    actor?.strength,
    actor?.PS,
  );
  const buildFactor = might === null ? 1 : clamp(1 + ((might - 10) * 0.018), 0.82, 1.35);
  return round(base * buildFactor, 1);
}

function getArmorLayer(defender = {}) {
  return defender?.equistaminadArmor || defender?.equippedArmor || defender?.wornArmor || defender?.armor || defender?.publicArmor || {};
}

function inferWealthTier(defender = {}, armor = {}) {
  const explicit = normalizedText(
    defender?.wealthTier,
    defender?.socialClass,
    defender?.equipmentQuality,
    armor?.wealthTier,
    armor?.quality,
  );
  const tags = normalizedText(
    ...(Array.isArray(defender?.tags) ? defender.tags : []),
    ...(Array.isArray(defender?.traits) ? defender.traits : []),
    defender?.profession,
    defender?.name,
  );
  const text = `${explicit} ${tags}`;
  if (/masterwork|royal|princely|ducal|elite/.test(text)) return "masterwork";
  if (/wealthy|noble|rich|veteran/.test(text)) return "fine";
  if (/poor|impoverished|militia|levy|ragged|salvaged/.test(text)) return "poor";
  if (/knight|professional|soldier|man-at-arms|men-at-arms/.test(text)) return "professional";
  return "serviceable";
}

function inferMaterial(armor = {}, quality = "serviceable") {
  const explicit = String(
    armor?.material || armor?.shellMaterial || armor?.armorAssembly?.outerLayer?.material || "",
  ).toLowerCase();
  if (ARMOR_MATERIAL_PROFILES[explicit]) return explicit;
  const text = normalizedText(armor?.name, armor?.type, armor?.category, explicit);
  if (/bronze/.test(text)) return "bronze";
  if (/leather|hide/.test(text)) return "hardened-leather";
  if (/textile|gambeson|jack|cloth/.test(text)) return "textile";
  if (/iron/.test(text)) return "wrought-iron";
  if (quality === "poor" || quality === "improvised") return "low-carbon-steel";
  if (quality === "fine" || quality === "masterwork") return "hardened-steel";
  return "steel";
}

function hasExplicitMissingPadding(defender = {}, armor = {}) {
  const candidates = [
    defender?.armorAssembly?.paddingLayer?.present,
    defender?.armorAssemblyState?.paddingLayer?.present,
    armor?.armorAssembly?.paddingLayer?.present,
    armor?.paddingLayer?.present,
    armor?.paddingPresent,
    defender?.paddingPresent,
  ];
  if (candidates.some((value) => value === false)) return true;
  const text = normalizedText(
    armor?.condition,
    armor?.lootState,
    armor?.salvageState,
    defender?.armorWearState,
  );
  return /no-padding|padding-missing|bare-plate|liner-missing/.test(text);
}

function inferPadding(defender = {}, armor = {}, location = "torso", quality = "serviceable", rigidCoverage = true) {
  const explicitLayer =
    defender?.armorAssembly?.paddingLayer ||
    defender?.armorAssemblyState?.paddingLayer ||
    armor?.armorAssembly?.paddingLayer ||
    armor?.paddingLayer ||
    {};
  const missing = hasExplicitMissingPadding(defender, armor);
  const explicitType = String(explicitLayer?.type || armor?.paddingType || "").toLowerCase();
  const inferredType = rigidCoverage
    ? (location === "head" ? "helmet-liner" : "arming-doublet")
    : "thin-clothing";
  const type = missing
    ? "none"
    : (PADDING_PROFILES[explicitType] ? explicitType : inferredType);
  const profile = PADDING_PROFILES[type] || PADDING_PROFILES.none;
  const qualityFactor = QUALITY_FACTORS[quality] || 1;
  const defaultThickness = type === "helmet-liner"
    ? 16
    : type === "arming-doublet"
      ? 12
      : type === "none"
        ? 0
        : 10;
  const thicknessMm = Math.max(0, firstFinite(
    explicitLayer?.thicknessMm,
    armor?.paddingThicknessMm,
    defender?.paddingThicknessMm,
  ) ?? round(defaultThickness * clamp(qualityFactor, 0.65, 1.2), 1));
  return {
    present: type !== "none" && thicknessMm > 0,
    type,
    label: profile.label,
    thicknessMm,
    quality,
    integrity: clamp(firstFinite(explicitLayer?.integrity, armor?.paddingIntegrity) ?? 100, 0, 100),
    compression: clamp(firstFinite(explicitLayer?.compression, armor?.paddingCompression) ?? 0, 0, 1),
    energyCapacityPerMmJ: profile.energyCapacityPerMmJ,
    attenuation: profile.attenuation,
    compressionResistance: profile.compressionResistance,
  };
}

function inferFit(defender = {}, armor = {}, quality = "serviceable") {
  const fittedFor =
    armor?.fittedForActorId ||
    armor?.armorAssembly?.attachmentLayer?.fittedForActorId ||
    defender?.armorAssembly?.attachmentLayer?.fittedForActorId ||
    defender?.armorAssemblyState?.attachmentLayer?.fittedForActorId ||
    null;
  const wearerId = getActorId(defender);
  const mismatch = Boolean(fittedFor && wearerId && String(fittedFor) !== String(wearerId));
  const explicit = firstFinite(
    armor?.fitQuality,
    armor?.armorAssembly?.attachmentLayer?.fitQuality,
    defender?.armorAssembly?.attachmentLayer?.fitQuality,
    defender?.armorAssemblyState?.attachmentLayer?.fitQuality,
  );
  const qualityDefault = {
    poor: 0.72,
    improvised: 0.62,
    worn: 0.78,
    serviceable: 0.88,
    professional: 0.94,
    fine: 0.98,
    masterwork: 1,
  }[quality] || 0.88;
  return {
    fittedForActorId: fittedFor || wearerId,
    mismatch,
    fitQuality: clamp(explicit ?? (mismatch ? qualityDefault * 0.72 : qualityDefault), 0.45, 1),
  };
}

function getTechniqueKey(attack = {}, explicitTechniqueKey = null) {
  const direct = String(
    explicitTechniqueKey ||
    attack?.techniqueKey ||
    attack?.selectedTechnique ||
    attack?.attackMode ||
    attack?.mode ||
    "",
  );
  if (TECHNIQUE_IMPACT_PROFILES[direct]) return direct;
  const text = normalizedText(direct, attack?.name, attack?.armorContactProfile, attack?.resolverRoute);
  if (/charging.*gore|charge.*horn/.test(text)) return "chargingGore";
  if (/\bgore\b/.test(text)) return "gore";
  if (/rock.*throw|heavy.*projectile/.test(text)) return "rockThrow";
  if (/rock.*smash|heavy.*melee/.test(text)) return "rockSmash";
  if (/headbutt|helmet-blunt/.test(text)) return "headbutt";
  if (/heavy.*axe|axe-edge-or-haft/.test(text)) return "heavyAxe";
  if (/\bslam\b|fall-collision/.test(text)) return "slam";
  if (/\bthrow\b|thrown-body/.test(text)) return "throw";
  if (/\bcrush\b|compression/.test(text)) return "crush";
  if (/trample|overrun/.test(text)) return "trample";
  if (/pommel|crossguard/.test(text)) return "pommel-or-crossguard-strike";
  return "default";
}

function resolveTechniqueProfile({ attacker = {}, defender = {}, attack = {}, techniqueKey, movement = {} } = {}) {
  const key = getTechniqueKey(attack, techniqueKey);
  const base = TECHNIQUE_IMPACT_PROFILES[key] || TECHNIQUE_IMPACT_PROFILES.default;
  const might = firstFinite(
    attacker?.attributes?.might,
    attacker?.abilityScores?.strength,
    attacker?.finalAbilityScores?.strength,
    attacker?.strength,
    attacker?.PS,
  ) ?? 10;
  const strengthVelocityFactor = clamp(1 + ((might - 10) * 0.025), 0.8, 1.35);
  const explicitMass = firstFinite(
    attack?.impactMassKg,
    attack?.projectileMassKg,
    attack?.effectiveMassKg,
  );
  const explicitVelocity = firstFinite(
    attack?.impactVelocityMps,
    attack?.projectileVelocityMps,
    movement?.impactVelocityMps,
  );
  let massKg = explicitMass ?? base.massKg;
  let velocityMps = explicitVelocity ?? (base.velocityMps * strengthVelocityFactor);

  if (["slam", "throw"].includes(key)) {
    massKg = explicitMass ?? estimateActorMassKg(defender);
  }
  if (key === "chargingGore") {
    const straightLineFeet = Math.max(0, finite(movement?.straightLineFeet, movement?.distanceFeet));
    velocityMps += clamp((straightLineFeet - 15) / 30, 0, 1.8);
    massKg = explicitMass ?? Math.max(base.massKg, estimateActorMassKg(attacker) * 0.52);
  }
  if (key === "gore") {
    massKg = explicitMass ?? Math.max(base.massKg, estimateActorMassKg(attacker) * 0.25);
  }
  if (key === "headbutt") {
    massKg = explicitMass ?? Math.max(base.massKg, estimateActorMassKg(attacker) * 0.14);
  }

  return {
    ...base,
    key,
    massKg: round(Math.max(0.1, massKg), 2),
    velocityMps: round(Math.max(0.1, velocityMps), 2),
    contactRadiusM: round(Math.max(0.01, firstFinite(attack?.contactRadiusM) ?? base.contactRadiusM), 3),
  };
}

function normalizeLocation(hitLocation) {
  const raw = typeof hitLocation === "string"
    ? hitLocation
    : hitLocation?.location || hitLocation?.zone || "torso";
  const compact = String(raw || "torso").replace(/[\s_-]+/g, "").toLowerCase();
  return {
    head: "head",
    helmet: "head",
    skull: "head",
    torso: "torso",
    chest: "torso",
    abdomen: "torso",
    weaponarm: "weaponArm",
    rightarm: "weaponArm",
    shieldarm: "shieldArm",
    leftarm: "shieldArm",
    arms: "weaponArm",
    hands: "hands",
    hand: "hands",
    legs: "legs",
    leg: "legs",
    feet: "feet",
    foot: "feet",
  }[compact] || "torso";
}

function getLocationState(existingState = {}, location = "torso") {
  const prior = existingState?.locations?.[location] || {};
  return {
    shellIntegrity: clamp(prior.shellIntegrity ?? 100, 0, 100),
    deformationMm: Math.max(0, finite(prior.deformationMm)),
    paddingIntegrity: clamp(prior.paddingIntegrity ?? 100, 0, 100),
    paddingCompression: clamp(prior.paddingCompression ?? 0, 0, 1),
    attachmentIntegrity: clamp(prior.attachmentIntegrity ?? 100, 0, 100),
    impacts: Math.max(0, Math.floor(finite(prior.impacts))),
    condition: prior.condition || "intact",
  };
}

export function normalizeArmorAssembly(defender = {}, hitLocation = "torso") {
  const armor = getArmorLayer(defender);
  const location = normalizeLocation(hitLocation);
  const locationProfile = LOCATION_PROFILES[location] || LOCATION_PROFILES.torso;
  const existingState = defender?.armorAssemblyState || {};
  const explicitAssembly = defender?.armorAssembly || armor?.armorAssembly || {};
  const quality = String(
    explicitAssembly?.outerLayer?.quality ||
    armor?.quality ||
    existingState?.outerLayer?.quality ||
    inferWealthTier(defender, armor),
  ).toLowerCase();
  const qualityFactor = QUALITY_FACTORS[quality] || 1;
  const armorText = normalizedText(
    armor?.name,
    armor?.type,
    armor?.category,
    armor?.armorClass,
    defender?.armorProfile?.armorClass,
  );
  const rigidCoverage =
    explicitAssembly?.outerLayer?.rigid === true ||
    armor?.rigidCoverage === true ||
    defender?.armorProfile?.rigidCoverage === true ||
    /plate|cuirass|helmet|steel harness|iron harness/.test(armorText);
  const armorPresent = Boolean(
    armor?.name || armor?.id || armor?.profileKey || armor?.type || armor?.category ||
    defender?.armorName || explicitAssembly?.outerLayer,
  );
  const material = String(
    explicitAssembly?.outerLayer?.material ||
    existingState?.outerLayer?.material ||
    (armorPresent ? inferMaterial(armor, quality) : "textile"),
  ).toLowerCase();
  const materialProfile = ARMOR_MATERIAL_PROFILES[material] || ARMOR_MATERIAL_PROFILES.steel;
  const fit = inferFit(defender, armor, quality);
  const locationState = getLocationState(existingState, location);
  const padding = inferPadding(defender, armor, location, quality, rigidCoverage);
  padding.integrity = Math.min(padding.integrity, locationState.paddingIntegrity);
  padding.compression = Math.max(padding.compression, locationState.paddingCompression);
  const explicitThickness = firstFinite(
    explicitAssembly?.outerLayer?.thicknessByLocation?.[location],
    explicitAssembly?.outerLayer?.thicknessMm,
    existingState?.outerLayer?.thicknessByLocation?.[location],
    armor?.thicknessMm,
  );
  const thicknessMm = rigidCoverage
    ? Math.max(0.5, explicitThickness ?? round(
        locationProfile.defaultThicknessMm * clamp(qualityFactor, 0.75, 1.18),
        2,
      ))
    : Math.max(0.1, explicitThickness ?? 0.25);
  const explicitCurvature = firstFinite(
    explicitAssembly?.outerLayer?.curvatureByLocation?.[location],
    explicitAssembly?.outerLayer?.curvature,
    existingState?.outerLayer?.curvatureByLocation?.[location],
    armor?.curvature,
  );
  const curvature = clamp(explicitCurvature ?? locationProfile.curvature, 0.55, 1.4);

  return {
    schemaVersion: ARMOR_ASSEMBLY_SCHEMA_VERSION,
    armorId: armor?.id || armor?.profileKey || armor?.name || (armorPresent ? "armor" : null),
    armorName: armor?.name || defender?.armorName || (armorPresent ? "armor" : "unarmored"),
    armorPresent,
    rigidCoverage,
    location,
    quality,
    qualityFactor,
    outerLayer: {
      material,
      materialLabel: materialProfile.label,
      thicknessMm,
      curvature,
      shellIntegrity: locationState.shellIntegrity,
      deformationMm: locationState.deformationMm,
      profile: materialProfile,
    },
    paddingLayer: padding,
    attachmentLayer: {
      ...fit,
      integrity: locationState.attachmentIntegrity,
    },
    locationState,
    existingState,
    locationProfile,
  };
}

function calculateContactAngleDegrees({ explicitAngle, attackMargin = 0, critical = false, location = "torso" } = {}) {
  if (Number.isFinite(Number(explicitAngle))) return clamp(explicitAngle, 0, 89);
  const base = location === "head" ? 34 : 29;
  return clamp(base - (Math.max(0, finite(attackMargin)) * 1.55) - (critical ? 9 : 0), 4, 58);
}

function classifyDent(dentDepthMm, shellIntegrity, penetrated) {
  if (penetrated) return "breached";
  if (shellIntegrity <= 15 || dentDepthMm >= 14) return "buckled";
  if (dentDepthMm >= 8) return "severely-dented";
  if (dentDepthMm >= 3) return "functionally-dented";
  if (dentDepthMm >= 0.6) return "minor-dent";
  return "intact";
}

function getDamageMultiplier(bodyEnergyJ, thresholdJ, location, penetrated) {
  if (penetrated) return 1;
  const ratio = thresholdJ > 0 ? bodyEnergyJ / thresholdJ : 0;
  let multiplier = 0;
  if (ratio >= 7) multiplier = 0.9;
  else if (ratio >= 4) multiplier = 0.7;
  else if (ratio >= 2.5) multiplier = 0.52;
  else if (ratio >= 1.5) multiplier = 0.38;
  else if (ratio >= 1) multiplier = 0.24;
  if (location === "head" && multiplier > 0) multiplier += 0.08;
  return round(clamp(multiplier, 0, 1), 2);
}

function buildBodyStatuses({ location, energyRatio, displacementFeet, prone, paddingBottomedOut }) {
  const statuses = new Set();
  if (location === "head") {
    if (energyRatio >= 1) statuses.add("STAGGERED");
    if (energyRatio >= 2.5) statuses.add("DAZED");
    if (energyRatio >= 5) statuses.add("CONCUSSION_RISK");
  } else if (location === "torso") {
    if (energyRatio >= 1.4) statuses.add("WINDED");
    if (energyRatio >= 3.5) statuses.add("RIB_INJURY_RISK");
  } else if (["weaponArm", "shieldArm", "legs", "feet"].includes(location)) {
    if (energyRatio >= 2) statuses.add("LIMB_INJURY_RISK");
    if (energyRatio >= 5) statuses.add("FRACTURE_RISK");
  } else if (location === "hands") {
    if (energyRatio >= 1.5) statuses.add("WEAPON_DROP_RISK");
    if (energyRatio >= 4) statuses.add("FRACTURE_RISK");
  }
  if (paddingBottomedOut) statuses.add("PADDING_BOTTOMED_OUT");
  if (displacementFeet > 0) statuses.add("OFF_BALANCE");
  if (prone) statuses.add("PRONE");
  return [...statuses];
}

function deriveVisualState({ technique, locationProfile, shell, body, stability, angleDegrees }) {
  const dentDepthM = round(shell.dentDepthMm / 1000, 5);
  const dentRadiusM = round(
    locationProfile.dentRadiusM * clamp(0.75 + (shell.impactRatio * 0.3), 0.65, 1.65),
    3,
  );
  const blendShape = shell.penetrated
    ? "armor-breached"
    : shell.condition === "buckled"
      ? "armor-buckled"
      : shell.dentDepthMm >= 8
        ? "armor-major-dent"
        : shell.dentDepthMm >= 0.6
          ? "armor-minor-dent"
          : "armor-impact-mark";
  return {
    kind: technique.visualKind,
    location: body.location,
    contactAngleDegrees: angleDegrees,
    dentDepthM,
    dentRadiusM,
    blendShape,
    persistent: shell.dentDepthMm >= 0.6,
    impulseNewtonSeconds: stability.transferredImpulseNs,
    displacementFeet: stability.displacementFeet,
    prone: stability.prone,
    rendererContractVersion: 1,
  };
}

/**
 * Physics-informed gameplay approximation. It conserves the distinction among
 * projectile energy, momentum, shell deformation, padding absorption, bodily
 * transfer, and whole-body displacement, but it is deliberately calibrated for
 * deterministic combat simulation rather than finite-element engineering.
 */
export function resolveLayeredArmorImpact({
  attacker = {},
  defender = {},
  attack = {},
  techniqueKey = null,
  hitLocation = "torso",
  attackMargin = 0,
  critical = false,
  movement = {},
  contactResult = {},
  contactAngleDegrees = null,
} = {}) {
  const location = normalizeLocation(hitLocation);
  const assembly = normalizeArmorAssembly(defender, location);
  const technique = resolveTechniqueProfile({ attacker, defender, attack, techniqueKey, movement });
  const angleDegrees = calculateContactAngleDegrees({
    explicitAngle: contactAngleDegrees ?? attack?.contactAngleDegrees,
    attackMargin,
    critical,
    location,
  });
  const angleRadians = angleDegrees * (Math.PI / 180);
  const normalVelocityMps = technique.velocityMps * Math.max(0.08, Math.cos(angleRadians));
  const kineticEnergyJ = 0.5 * technique.massKg * (technique.velocityMps ** 2);
  const normalEnergyJ = kineticEnergyJ * (normalVelocityMps / technique.velocityMps) ** 2;
  const momentumNs = technique.massKg * technique.velocityMps;
  const normalMomentumNs = momentumNs * Math.max(0.08, Math.cos(angleRadians));

  const shellIntegrityFactor = clamp(assembly.outerLayer.shellIntegrity / 100, 0.08, 1);
  const attachmentFactor = clamp(assembly.attachmentLayer.integrity / 100, 0.2, 1);
  const deformationPenalty = clamp(1 - (assembly.outerLayer.deformationMm / 24), 0.38, 1);
  const thicknessFactor = (assembly.outerLayer.thicknessMm / assembly.locationProfile.defaultThicknessMm) ** 1.55;
  const shellCapacityJ = assembly.rigidCoverage
    ? Math.max(35,
        assembly.outerLayer.profile.deformationCapacityJ *
        assembly.locationProfile.shellCapacityFactor *
        thicknessFactor *
        assembly.qualityFactor *
        assembly.outerLayer.curvature *
        shellIntegrityFactor *
        deformationPenalty *
        clamp(0.72 + (assembly.attachmentLayer.fitQuality * 0.28), 0.6, 1),
      )
    : 18;
  const impactRatio = normalEnergyJ / shellCapacityJ;
  const baseDeflectionFraction = assembly.rigidCoverage
    ? assembly.outerLayer.profile.restitution +
      ((angleDegrees / 90) * 0.44) +
      ((assembly.outerLayer.curvature - 1) * 0.17)
    : 0.015;
  const deflectionFraction = assembly.rigidCoverage
    ? clamp(
        baseDeflectionFraction - (Math.max(0, impactRatio - 0.75) * 0.08),
        0.06,
        0.72,
      )
    : 0.015;
  const deflectedEnergyJ = normalEnergyJ * deflectionFraction;
  const postDeflectionEnergyJ = Math.max(0, normalEnergyJ - deflectedEnergyJ);
  const shellAbsorptionFraction = assembly.rigidCoverage
    ? clamp(0.2 + (Math.min(impactRatio, 1.6) * 0.2), 0.2, 0.52)
    : 0;
  const shellAbsorbedEnergyJ = assembly.rigidCoverage
    ? Math.min(
        postDeflectionEnergyJ * shellAbsorptionFraction,
        shellCapacityJ * 0.52,
      )
    : 0;
  const residualBehindShellJ = Math.max(0, postDeflectionEnergyJ - shellAbsorbedEnergyJ);

  const sharpOrPiercing = /pierc|slash|axe|horn|gore/i.test(normalizedText(
    technique.damageType,
    attack?.damageType,
    technique.key,
  ));
  const penetrationThreshold = sharpOrPiercing ? 1.75 : 2.55;
  const penetrated = assembly.rigidCoverage
    ? (contactResult?.penetration === true || impactRatio >= penetrationThreshold)
    : sharpOrPiercing;
  const dentDepthMm = !assembly.rigidCoverage
    ? 0
    : penetrated
      ? round(clamp(7 + ((impactRatio - penetrationThreshold) * 9), 7, 24), 2)
      : impactRatio < 0.2
        ? 0
        : round(clamp(((impactRatio - 0.18) ** 1.15) * 8.4, 0.15, 18), 2);

  const paddingIntegrityFactor = clamp(assembly.paddingLayer.integrity / 100, 0, 1);
  const remainingCompressionFactor = clamp(1 - assembly.paddingLayer.compression, 0, 1);
  const paddingCapacityJ = assembly.paddingLayer.present
    ? assembly.paddingLayer.thicknessMm *
      assembly.paddingLayer.energyCapacityPerMmJ *
      paddingIntegrityFactor *
      remainingCompressionFactor *
      assembly.paddingLayer.compressionResistance *
      assembly.attachmentLayer.fitQuality
    : 0;
  const paddingAttenuation = assembly.paddingLayer.present
    ? clamp(
        assembly.paddingLayer.attenuation *
        paddingIntegrityFactor *
        (0.55 + (remainingCompressionFactor * 0.45)) *
        assembly.attachmentLayer.fitQuality,
        0.04,
        0.68,
      )
    : PADDING_PROFILES.none.attenuation;
  const desiredPaddingAbsorptionJ = residualBehindShellJ * paddingAttenuation;
  const paddingAbsorbedEnergyJ = Math.min(paddingCapacityJ, desiredPaddingAbsorptionJ);
  const paddingBottomedOut = assembly.paddingLayer.present &&
    desiredPaddingAbsorptionJ > Math.max(1, paddingCapacityJ);
  const bodyTransferEnergyJ = Math.max(0,
    residualBehindShellJ - paddingAbsorbedEnergyJ + (penetrated ? normalEnergyJ * 0.12 : 0),
  );

  const bodyThresholdJ = assembly.locationProfile.bodyInjuryThresholdJ /
    assembly.locationProfile.fragility;
  const energyRatio = bodyThresholdJ > 0 ? bodyTransferEnergyJ / bodyThresholdJ : 0;
  const injuryAuthorized = penetrated || energyRatio >= 1;
  const damageMultiplier = getDamageMultiplier(
    bodyTransferEnergyJ,
    bodyThresholdJ,
    location,
    penetrated,
  );

  const coupling = clamp(
    (1 - deflectionFraction) *
    (0.52 + ((1 - paddingAttenuation) * 0.35)) *
    (0.75 + (assembly.attachmentLayer.fitQuality * 0.25)),
    0.12,
    0.92,
  );
  const transferredImpulseNs = normalMomentumNs * coupling;
  const defenderMassKg = estimateActorMassKg(defender) +
    Math.max(0, finite(getArmorLayer(defender)?.weight) * 0.453592);
  const stabilityThresholdNs = Math.max(35,
    defenderMassKg *
    (0.72 + (assembly.attachmentLayer.fitQuality * 0.2)) *
    clamp(attachmentFactor, 0.65, 1),
  );
  const stabilityRatio = transferredImpulseNs / stabilityThresholdNs;
  const stabilityChecked = technique.forceStability || stabilityRatio >= 0.68;
  let displacementFeet = 0;
  if (stabilityChecked) {
    if (stabilityRatio >= 4) displacementFeet = 20;
    else if (stabilityRatio >= 2.5) displacementFeet = 15;
    else if (stabilityRatio >= 1.55) displacementFeet = 10;
    else if (stabilityRatio >= 0.92) displacementFeet = 5;
  }
  if (technique.minimumDisplacementFeet && stabilityRatio >= 0.68) {
    displacementFeet = Math.max(displacementFeet, technique.minimumDisplacementFeet);
  }
  const prone = stabilityChecked && (
    stabilityRatio >= 1.35 ||
    (["chargingGore", "slam", "throw", "trample"].includes(technique.key) && displacementFeet >= 5)
  );

  const shellIntegrityLoss = assembly.rigidCoverage
    ? Math.round(clamp(
        (Math.max(0, impactRatio - 0.12) * 8) +
        (dentDepthMm * 0.75) +
        (penetrated ? 18 : 0),
        0,
        38,
      ))
    : 0;
  const paddingIntegrityLoss = Math.round(clamp(
    (paddingAbsorbedEnergyJ / 26) +
    (paddingBottomedOut ? 8 : 0),
    0,
    32,
  ));
  const compressionAdded = assembly.paddingLayer.present
    ? round(clamp(
        paddingAbsorbedEnergyJ / Math.max(80, paddingCapacityJ * 2.4),
        0,
        0.38,
      ), 3)
    : 0;
  const attachmentIntegrityLoss = Math.round(clamp(
    (transferredImpulseNs / 32) +
    (displacementFeet > 0 ? 2 : 0),
    0,
    24,
  ));
  const nextShellIntegrity = clamp(
    assembly.outerLayer.shellIntegrity - shellIntegrityLoss,
    0,
    100,
  );
  const nextDeformationMm = round(
    assembly.outerLayer.deformationMm + dentDepthMm,
    2,
  );
  const condition = assembly.rigidCoverage
    ? classifyDent(nextDeformationMm, nextShellIntegrity, penetrated)
    : "not-applicable";
  const statuses = buildBodyStatuses({
    location,
    energyRatio,
    displacementFeet,
    prone,
    paddingBottomedOut,
  });

  const shell = {
    material: assembly.outerLayer.material,
    materialLabel: assembly.outerLayer.materialLabel,
    quality: assembly.quality,
    thicknessMm: assembly.outerLayer.thicknessMm,
    curvature: assembly.outerLayer.curvature,
    capacityJ: round(shellCapacityJ),
    impactRatio: round(impactRatio, 3),
    deflectedEnergyJ: round(deflectedEnergyJ),
    absorbedEnergyJ: round(shellAbsorbedEnergyJ),
    dented: dentDepthMm >= 0.6,
    dentDepthMm,
    penetrated,
    condition,
    integrityBefore: assembly.outerLayer.shellIntegrity,
    integrityLost: shellIntegrityLoss,
    integrityAfter: nextShellIntegrity,
    deformationBeforeMm: assembly.outerLayer.deformationMm,
    deformationAfterMm: nextDeformationMm,
  };
  const padding = {
    present: assembly.paddingLayer.present,
    type: assembly.paddingLayer.type,
    label: assembly.paddingLayer.label,
    thicknessMm: assembly.paddingLayer.thicknessMm,
    fitQuality: assembly.attachmentLayer.fitQuality,
    capacityJ: round(paddingCapacityJ),
    absorbedEnergyJ: round(paddingAbsorbedEnergyJ),
    attenuation: round(paddingAttenuation, 3),
    bottomedOut: paddingBottomedOut,
    integrityBefore: assembly.paddingLayer.integrity,
    integrityLost: paddingIntegrityLoss,
    integrityAfter: clamp(assembly.paddingLayer.integrity - paddingIntegrityLoss, 0, 100),
    compressionBefore: assembly.paddingLayer.compression,
    compressionAdded,
    compressionAfter: clamp(assembly.paddingLayer.compression + compressionAdded, 0, 1),
  };
  const body = {
    location,
    transferredEnergyJ: round(bodyTransferEnergyJ),
    injuryThresholdJ: round(bodyThresholdJ),
    energyRatio: round(energyRatio, 3),
    injuryAuthorized,
    damageMultiplier,
    minimumDamage: injuryAuthorized ? 1 : 0,
    damageType: penetrated
      ? (attack?.damageType || technique.damageType)
      : "bludgeoning",
    statuses,
    noPaddingHazard: !assembly.paddingLayer.present && bodyTransferEnergyJ > 0,
  };
  const stability = {
    checked: stabilityChecked,
    defenderMassKg: round(defenderMassKg, 1),
    incomingMomentumNs: round(momentumNs),
    normalMomentumNs: round(normalMomentumNs),
    transferredImpulseNs: round(transferredImpulseNs),
    thresholdNs: round(stabilityThresholdNs),
    ratio: round(stabilityRatio, 3),
    displacementFeet,
    prone,
  };
  const attachment = {
    integrityBefore: assembly.attachmentLayer.integrity,
    integrityLost: attachmentIntegrityLoss,
    integrityAfter: clamp(assembly.attachmentLayer.integrity - attachmentIntegrityLoss, 0, 100),
    fitQuality: assembly.attachmentLayer.fitQuality,
    fitMismatch: assembly.attachmentLayer.mismatch,
  };

  const result = {
    accepted: true,
    schemaVersion: ARMOR_ASSEMBLY_SCHEMA_VERSION,
    technique,
    assembly: {
      armorId: assembly.armorId,
      armorName: assembly.armorName,
      quality: assembly.quality,
      armorPresent: assembly.armorPresent,
      rigidCoverage: assembly.rigidCoverage,
      location,
    },
    impact: {
      massKg: technique.massKg,
      velocityMps: technique.velocityMps,
      contactRadiusM: technique.contactRadiusM,
      angleDegrees: round(angleDegrees, 1),
      kineticEnergyJ: round(kineticEnergyJ),
      normalEnergyJ: round(normalEnergyJ),
      momentumNs: round(momentumNs),
    },
    shell,
    padding,
    attachment,
    body,
    stability,
  };
  result.visual = deriveVisualState({
    technique,
    locationProfile: assembly.locationProfile,
    shell,
    body,
    stability,
    angleDegrees: result.impact.angleDegrees,
  });
  result.outcome = !assembly.rigidCoverage
    ? "direct-body-impact"
    : penetrated
      ? "armor-breached"
      : condition === "buckled"
      ? "armor-buckled-with-transfer"
      : shell.dented && injuryAuthorized
        ? "armor-dented-with-blunt-injury"
        : shell.dented
          ? "armor-dented-body-protected"
          : injuryAuthorized
            ? "armor-held-with-blunt-transfer"
            : "armor-deflected-impact";
  result.updatedArmorAssemblyState = buildUpdatedArmorAssemblyState(defender, result);
  return result;
}

export function buildUpdatedArmorAssemblyState(defender = {}, impactResult = {}) {
  const assembly = normalizeArmorAssembly(defender, impactResult?.assembly?.location || impactResult?.body?.location || "torso");
  const location = impactResult?.assembly?.location || assembly.location;
  const prior = assembly.existingState || {};
  const priorLocations = prior.locations || {};
  return {
    ...prior,
    schemaVersion: ARMOR_ASSEMBLY_SCHEMA_VERSION,
    armorId: impactResult?.assembly?.armorId || assembly.armorId,
    armorName: impactResult?.assembly?.armorName || assembly.armorName,
    ownerId: getActorId(defender),
    outerLayer: {
      ...(prior.outerLayer || {}),
      material: impactResult?.shell?.material || assembly.outerLayer.material,
      quality: impactResult?.shell?.quality || assembly.quality,
      thicknessByLocation: {
        ...(prior.outerLayer?.thicknessByLocation || {}),
        [location]: impactResult?.shell?.thicknessMm || assembly.outerLayer.thicknessMm,
      },
      curvatureByLocation: {
        ...(prior.outerLayer?.curvatureByLocation || {}),
        [location]: impactResult?.shell?.curvature || assembly.outerLayer.curvature,
      },
    },
    paddingLayer: {
      ...(prior.paddingLayer || {}),
      present: impactResult?.padding?.present ?? assembly.paddingLayer.present,
      type: impactResult?.padding?.type || assembly.paddingLayer.type,
      thicknessMm: impactResult?.padding?.thicknessMm ?? assembly.paddingLayer.thicknessMm,
    },
    attachmentLayer: {
      ...(prior.attachmentLayer || {}),
      fittedForActorId: assembly.attachmentLayer.fittedForActorId,
      fitQuality: impactResult?.attachment?.fitQuality ?? assembly.attachmentLayer.fitQuality,
    },
    locations: {
      ...priorLocations,
      [location]: {
        ...(priorLocations[location] || {}),
        shellIntegrity: impactResult?.shell?.integrityAfter ?? assembly.outerLayer.shellIntegrity,
        deformationMm: impactResult?.shell?.deformationAfterMm ?? assembly.outerLayer.deformationMm,
        paddingIntegrity: impactResult?.padding?.integrityAfter ?? assembly.paddingLayer.integrity,
        paddingCompression: impactResult?.padding?.compressionAfter ?? assembly.paddingLayer.compression,
        attachmentIntegrity: impactResult?.attachment?.integrityAfter ?? assembly.attachmentLayer.integrity,
        impacts: (assembly.locationState?.impacts || 0) + 1,
        condition: impactResult?.shell?.condition || assembly.locationState?.condition || "intact",
        lastImpact: {
          techniqueKey: impactResult?.technique?.key || null,
          kineticEnergyJ: impactResult?.impact?.kineticEnergyJ || 0,
          transferredEnergyJ: impactResult?.body?.transferredEnergyJ || 0,
          displacementFeet: impactResult?.stability?.displacementFeet || 0,
        },
      },
    },
    lastImpactVisual: impactResult?.visual || null,
  };
}

export function applyArmorImpactToFighter(fighter = {}, impactResult = {}) {
  if (!impactResult?.accepted) return fighter;
  const existingStatuses = Array.isArray(fighter.statusEffects) ? fighter.statusEffects : [];
  const statuses = [...new Set([...existingStatuses, ...(impactResult?.body?.statuses || [])])];
  const prone = impactResult?.stability?.prone === true ||
    statuses.some((status) => String(status).toUpperCase() === "PRONE");
  return {
    ...fighter,
    ...(impactResult?.assembly?.rigidCoverage === true
      ? {
          armorAssemblyState:
            impactResult.updatedArmorAssemblyState ||
            buildUpdatedArmorAssemblyState(fighter, impactResult),
        }
      : {}),
    statusEffects: statuses,
    ...(prone ? { prone: true, isProne: true, condition: "prone" } : {}),
    lastImpactResult: {
      outcome: impactResult.outcome,
      techniqueKey: impactResult?.technique?.key || null,
      location: impactResult?.body?.location || null,
      transferredEnergyJ: impactResult?.body?.transferredEnergyJ || 0,
      displacementFeet: impactResult?.stability?.displacementFeet || 0,
      visual: impactResult?.visual || null,
    },
  };
}

export function buildLayeredArmorImpactNarration({
  impactResult = {},
  defenderName = "the defender",
} = {}) {
  const shell = impactResult?.shell || {};
  const padding = impactResult?.padding || {};
  const body = impactResult?.body || {};
  const stability = impactResult?.stability || {};
  const armorName = impactResult?.assembly?.armorName || "armor";
  const location = body.location || impactResult?.assembly?.location || "body";
  const pieces = [];

  if (impactResult?.assembly?.rigidCoverage !== true) {
    pieces.push(`The impact lands directly on ${defenderName}'s ${location}.`);
  } else if (shell.penetrated) {
    pieces.push(`The ${armorName} is breached at the ${location}.`);
  } else if (shell.condition === "buckled") {
    pieces.push(`The ${armorName} buckles inward at the ${location}.`);
  } else if (shell.dented) {
    pieces.push(`The ${armorName} dents at the ${location}.`);
  } else {
    pieces.push(`The ${armorName} deflects much of the impact.`);
  }

  if (!padding.present && body.transferredEnergyJ > 0) {
    pieces.push(`With no effective padding beneath it, the shell drives force directly into ${defenderName}.`);
  } else if (padding.bottomedOut) {
    pieces.push(`The ${padding.label || "padding"} compresses completely and bottoms out.`);
  } else if (padding.absorbedEnergyJ > 0) {
    pieces.push(`The ${padding.label || "padding"} spreads and absorbs part of the force.`);
  }

  if (body.injuryAuthorized) {
    pieces.push(`A dangerous blunt impulse reaches the body.`);
  } else if (body.transferredEnergyJ > 0) {
    pieces.push(`Some force reaches the wearer, but not enough for immediate bodily injury.`);
  }
  if (stability.displacementFeet > 0) {
    pieces.push(`${defenderName} is driven ${stability.displacementFeet} feet${stability.prone ? " and knocked down" : ""}.`);
  }
  return pieces.join(" ");
}

export default {
  ARMOR_ASSEMBLY_SCHEMA_VERSION,
  ARMOR_MATERIAL_PROFILES,
  PADDING_PROFILES,
  applyArmorImpactToFighter,
  buildLayeredArmorImpactNarration,
  buildUpdatedArmorAssemblyState,
  normalizeArmorAssembly,
  resolveLayeredArmorImpact,
};
