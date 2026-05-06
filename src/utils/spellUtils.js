// src/utils/spellUtils.js

const HEAL_KEYWORDS = [
  "heal",
  "restor",
  "regenerat",
  "revive",
  "resurrect",
  "resurrection",
  "lay on hands",
];

const TOUCH_RANGE_HINTS = [
  "touch",
  "target",
  "per person",
  "per target",
  "per creature",
  "per ally",
];

const SELF_ONLY_HINTS = ["self only", "self-only"];

const SUPPORT_KEYWORDS = [
  "fly",
  "invisibility",
  "invisible",
  "shield",
  "armor",
  "protection",
  "protect",
  "bless",
  "speed",
  "strength",
  "resist",
  "resistance",
  "levitate",
  "levitation",
  "globe",
  "light",
  "darkness",
  "circle",
  "ward",
  "flight",
  "float",
  "haste",
  "boost",
  "enhance",
];

const HARMFUL_KEYWORDS = [
  "immobilize",
  "trap",
  "paralyze",
  "blind",
  "curse",
  "ensnare",
  "sleep",
  "disease",
  "poison",
  "stun",
  "control",
  "dominate",
  "fear",
  "agonize",
  "pain",
  "hold",
  "silence",
];

export const WIZARD_COMMON_SPELL_NAMES = [
  "Decipher Magic",
  "Sense Magic",
  "Cloud of Slumber",
  "Globe of Daylight",
  "Tongues",
  "Enchanted Cauldron",
];

const WIZARD_BASE_KNOWN_AT_LEVEL_1 = 8; // 6 common + 2 picks
const WIZARD_ADDITIONAL_SPELLS_PER_LEVEL = 1;
const WIZARD_MAX_SPELL_LEVEL = 12;

export const PPE_TYPES = Object.freeze({
  NONE: "NONE",
  ARCANE_STANDARD: "ARCANE_STANDARD",
  // Legacy alias preserved for backward compatibility with existing saves
  OCC_STANDARD: "OCC_STANDARD",
  DIVINE_STANDARD: "DIVINE_STANDARD",
  NATURE_STANDARD: "NATURE_STANDARD",
  OCC_FIXED_START: "OCC_FIXED_START",
  MONSTER_INNATE: "MONSTER_INNATE",
  MONSTER_VARIABLE: "MONSTER_VARIABLE",
  MINOR_MAGIC: "MINOR_MAGIC",
  LIMITED_MAGIC: "LIMITED_MAGIC",
  ABILITY_CHARGES: "ABILITY_CHARGES",
});

export const PPE_AUTHORITIES = Object.freeze({
  STATBLOCK: "statblock",
  COMPUTED: "computed",
  CHARGES: "charges",
  NONE: "none",
});

export const PPE_PROGRESSION_MODELS = Object.freeze({
  ROLL_EACH_LEVEL: "rollEachLevel",
  STATIC_PER_LEVEL: "staticPerLevel",
  FLAT_POOL: "flatPool",
});

const OCC_STANDARD_PPE_KEYWORDS = [
  "wizard",
  "warlock",
  "summoner",
  "diabolist",
  "mage",
  "sorcerer",
  "witch",
  "necromancer",
  "conjurer",
];

const DIVINE_PPE_KEYWORDS = [
  "priest",
  "cleric",
  "paladin",
  "temple",
  "faith",
  "holy",
];

const NATURE_PPE_KEYWORDS = [
  "druid",
  "shaman",
  "nature",
  "totem",
  "warden",
];

const LIMITED_MAGIC_PPE_KEYWORDS = [
  "hedge",
  "minor magic",
  "lesser magic",
  "spell-like",
  "charges/day",
];

const hashString = (value = "") => {
  let h = 2166136261 >>> 0;
  const str = String(value);
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const createDeterministicRng = (seedInput = "ppe-seed") => {
  let seed = hashString(seedInput) || 1;
  return () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const roll1d = (sides = 6, rng = Math.random) =>
  1 + Math.floor((rng?.() ?? Math.random()) * Math.max(2, Math.floor(sides || 6)));

const rollDiceExpression = (expression, rng = Math.random) => {
  const text = String(expression || "").toLowerCase().replace(/\s+/g, "");
  const match = text.match(/^(\d+)d(\d+)(?:x(\d+))?(?:\+(\d+))?$/);
  if (!match) return null;
  const count = Math.max(1, parseInt(match[1], 10) || 1);
  const sides = Math.max(2, parseInt(match[2], 10) || 6);
  const multiplier = Math.max(1, parseInt(match[3] || "1", 10) || 1);
  const flat = Math.max(0, parseInt(match[4] || "0", 10) || 0);
  let total = 0;
  for (let i = 0; i < count; i += 1) total += roll1d(sides, rng);
  return total * multiplier + flat;
};

const makeBaseFormula = (peMultiplier = 0, baseFlat = 0) => ({ pe }) =>
  Math.max(0, (Number(pe) || 0) * peMultiplier + baseFlat);

const makePerLevelRollFormula = (dieSides = 6) => ({ rng }) => roll1d(dieSides, rng);

const makeDiceBaseFormula = (diceExpression) => ({ rng }) => {
  const rolled = rollDiceExpression(diceExpression, rng);
  return Math.max(0, Math.floor(rolled || 0));
};

const makeDiceBaseRollProfile = ({
  ppeType,
  baseDiceExpression,
  perLevelDieSides = 6,
  peMultiplier = 0,
  baseFlat = 0,
}) => ({
  ppeType,
  ppeProgressionModel: PPE_PROGRESSION_MODELS.ROLL_EACH_LEVEL,
  baseFormula: makeDiceBaseFormula(baseDiceExpression),
  perLevelFormula: makePerLevelRollFormula(perLevelDieSides),
  baseDiceExpression,
  peMultiplier,
  baseFlat,
  perLevelDieSides,
});

export const makeStaticPerLevelProfile = ({
  ppeType,
  peMultiplier = 0,
  baseFlat = 0,
  perLevelStatic = 0,
}) => ({
  ppeType,
  ppeProgressionModel: PPE_PROGRESSION_MODELS.STATIC_PER_LEVEL,
  baseFormula: makeBaseFormula(peMultiplier, baseFlat),
  perLevelStatic: Math.max(0, Math.floor(perLevelStatic || 0)),
  peMultiplier,
  baseFlat,
});

export const makeFlatPoolProfile = ({
  ppeType,
  peMultiplier = 0,
  baseFlat = 0,
}) => ({
  ppeType,
  ppeProgressionModel: PPE_PROGRESSION_MODELS.FLAT_POOL,
  baseFormula: makeBaseFormula(peMultiplier, baseFlat),
  peMultiplier,
  baseFlat,
});

const OCC_PPE_PROFILE_OVERRIDES = Object.freeze({
  // PF2-aligned strict base pools from dataset O.C.C. lines.
  wizard: makeDiceBaseRollProfile({
    ppeType: PPE_TYPES.ARCANE_STANDARD,
    baseDiceExpression: "2d6x10+20",
    perLevelDieSides: 6,
  }),
  warlock: makeDiceBaseRollProfile({
    ppeType: PPE_TYPES.ARCANE_STANDARD,
    baseDiceExpression: "3d6x10+30",
    perLevelDieSides: 6,
  }),
  summoner: makeDiceBaseRollProfile({
    ppeType: PPE_TYPES.ARCANE_STANDARD,
    baseDiceExpression: "2d6x10+30",
    perLevelDieSides: 6,
  }),
  diabolist: makeDiceBaseRollProfile({
    ppeType: PPE_TYPES.ARCANE_STANDARD,
    baseDiceExpression: "3d6x10+20",
    perLevelDieSides: 6,
  }),
  necromancer: makeDiceBaseRollProfile({
    ppeType: PPE_TYPES.ARCANE_STANDARD,
    baseDiceExpression: "2d6x10+20",
    perLevelDieSides: 6,
  }),
  conjurer: makeDiceBaseRollProfile({
    ppeType: PPE_TYPES.ARCANE_STANDARD,
    baseDiceExpression: "2d6x10+20",
    perLevelDieSides: 6,
  }),
  witch: makeDiceBaseRollProfile({
    ppeType: PPE_TYPES.ARCANE_STANDARD,
    baseDiceExpression: "3d6x10+10",
    perLevelDieSides: 6,
  }),
  priest: makeDiceBaseRollProfile({
    ppeType: PPE_TYPES.DIVINE_STANDARD,
    baseDiceExpression: "2d6x10+20",
    perLevelDieSides: 6,
  }),
  cleric: makeDiceBaseRollProfile({
    ppeType: PPE_TYPES.DIVINE_STANDARD,
    baseDiceExpression: "2d6x10+20",
    perLevelDieSides: 6,
  }),
  paladin: makeDiceBaseRollProfile({
    ppeType: PPE_TYPES.DIVINE_STANDARD,
    baseDiceExpression: "2d6+10",
    perLevelDieSides: 6,
  }),
  druid: makeDiceBaseRollProfile({
    ppeType: PPE_TYPES.NATURE_STANDARD,
    baseDiceExpression: "2d6x10+20",
    perLevelDieSides: 6,
  }),
  shaman: makeDiceBaseRollProfile({
    ppeType: PPE_TYPES.NATURE_STANDARD,
    baseDiceExpression: "2d6x10+30",
    perLevelDieSides: 6,
  }),
  healer: makeDiceBaseRollProfile({
    ppeType: PPE_TYPES.DIVINE_STANDARD,
    baseDiceExpression: "2d6x10+20",
    perLevelDieSides: 6,
  }),
  // Alias O.C.C. names from datasets.
  "priest of light": makeDiceBaseRollProfile({
    ppeType: PPE_TYPES.DIVINE_STANDARD,
    baseDiceExpression: "2d6x10+20",
    perLevelDieSides: 6,
  }),
  "priest of darkness": makeDiceBaseRollProfile({
    ppeType: PPE_TYPES.DIVINE_STANDARD,
    baseDiceExpression: "2d6x10+20",
    perLevelDieSides: 6,
  }),
  // Concrete template examples for non-roll progressions.
  // These keys are safe to keep until strict PF2 OCC lines are finalized.
  "hedge mage": makeStaticPerLevelProfile({
    ppeType: PPE_TYPES.LIMITED_MAGIC,
    peMultiplier: 1,
    baseFlat: 4,
    perLevelStatic: 2,
  }),
  "cantrip adept": makeFlatPoolProfile({
    ppeType: PPE_TYPES.LIMITED_MAGIC,
    peMultiplier: 0,
    baseFlat: 12,
  }),
});

const SUPERNATURAL_PPE_KEYWORDS = [
  "dragon",
  "demon",
  "deevil",
  "devil",
  "elemental",
  "supernatural",
  "spirit",
  "deity",
];

const PPE_PROFILES = Object.freeze({
  [PPE_TYPES.ARCANE_STANDARD]: {
    peMultiplier: 2,
    baseFlat: 0,
    ppeProgressionModel: PPE_PROGRESSION_MODELS.ROLL_EACH_LEVEL,
    perLevelDieSides: 6,
  },
  [PPE_TYPES.OCC_STANDARD]: {
    peMultiplier: 2,
    baseFlat: 0,
    ppeProgressionModel: PPE_PROGRESSION_MODELS.ROLL_EACH_LEVEL,
    perLevelDieSides: 6,
  },
  [PPE_TYPES.DIVINE_STANDARD]: {
    peMultiplier: 1,
    baseFlat: 10,
    ppeProgressionModel: PPE_PROGRESSION_MODELS.ROLL_EACH_LEVEL,
    perLevelDieSides: 6,
  },
  [PPE_TYPES.NATURE_STANDARD]: {
    peMultiplier: 1,
    baseFlat: 8,
    ppeProgressionModel: PPE_PROGRESSION_MODELS.ROLL_EACH_LEVEL,
    perLevelDieSides: 6,
  },
  [PPE_TYPES.OCC_FIXED_START]: {
    peMultiplier: 0,
    baseFlat: 20,
    ppeProgressionModel: PPE_PROGRESSION_MODELS.ROLL_EACH_LEVEL,
    perLevelDieSides: 6,
  },
  [PPE_TYPES.MONSTER_VARIABLE]: {
    peMultiplier: 2,
    baseFlat: 0,
    ppeProgressionModel: PPE_PROGRESSION_MODELS.ROLL_EACH_LEVEL,
    perLevelDieSides: 6,
  },
  [PPE_TYPES.LIMITED_MAGIC]: {
    peMultiplier: 1,
    baseFlat: 4,
    ppeProgressionModel: PPE_PROGRESSION_MODELS.ROLL_EACH_LEVEL,
    perLevelDieSides: 4,
  },
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const normalizeKey = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const toNumberOrNull = (value) => {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const firstFinite = (...values) => {
  for (const value of values) {
    const numeric = toNumberOrNull(value);
    if (numeric != null) return numeric;
  }
  return null;
};

const parseLevelFromText = (text) => {
  const lower = String(text || "").toLowerCase();
  if (!lower) return null;
  const match =
    lower.match(/(?:as|at|of)\s+(\d+)(?:st|nd|rd|th)?\s+level/i) ||
    lower.match(/levels?\s+(\d+)\s*[-to]+\s*(\d+)/i);
  if (!match) return null;
  if (match[2]) return Math.max(1, parseInt(match[2], 10) || 1);
  return Math.max(1, parseInt(match[1], 10) || 1);
};

export function getEntityLevel(entity = {}) {
  const derivedFromText = parseLevelFromText(
    entity?.magicAbilities || entity?.magic || entity?.description || ""
  );
  const level = firstFinite(
    entity?.level,
    entity?.Level,
    entity?.levels?.spellcaster,
    entity?.levels?.mage,
    entity?.magicLevel,
    derivedFromText
  );
  return Math.max(1, Math.floor(level || 1));
}

export function hasMagicCapability(entity = {}) {
  const magicListLike =
    (Array.isArray(entity?.magic) && entity.magic.length > 0) ||
    (Array.isArray(entity?.spellbook) && entity.spellbook.length > 0) ||
    (Array.isArray(entity?.spells) && entity.spells.length > 0) ||
    (Array.isArray(entity?.knownSpells) && entity.knownSpells.length > 0);
  const magicText = [
    entity?.magicAbilities,
    entity?.magic,
    entity?.description,
    entity?.occ,
    entity?.class,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    magicListLike ||
    magicText.includes("magic") ||
    magicText.includes("spell") ||
    OCC_STANDARD_PPE_KEYWORDS.some((k) => magicText.includes(k)) ||
    DIVINE_PPE_KEYWORDS.some((k) => magicText.includes(k)) ||
    NATURE_PPE_KEYWORDS.some((k) => magicText.includes(k)) ||
    LIMITED_MAGIC_PPE_KEYWORDS.some((k) => magicText.includes(k))
  );
}

export function getOccPPEOverride(entity = {}) {
  const occClass = normalizeKey(
    [entity?.occ, entity?.class, entity?.occName, entity?.archetype]
      .filter(Boolean)
      .join(" ")
  );
  if (!occClass) return null;

  for (const [key, profile] of Object.entries(OCC_PPE_PROFILE_OVERRIDES)) {
    if (occClass.includes(key)) return profile;
  }
  return null;
}

export function inferPPEType(entity = {}) {
  const explicitType = String(entity?.ppeType || "").trim();
  if (explicitType) return explicitType;

  const occOverride = getOccPPEOverride(entity);
  if (occOverride?.ppeType) return occOverride.ppeType;

  const hasMagic = hasMagicCapability(entity);
  const occText = String(entity?.occ || entity?.class || "").toLowerCase();
  const categoryText = String(entity?.category || entity?.race || "").toLowerCase();
  const nameText = String(entity?.name || "").toLowerCase();
  const mergedText = `${occText} ${categoryText} ${nameText}`;
  const explicitPPE = firstFinite(
    entity?.maxPPE,
    entity?.PPE,
    entity?.ppe,
    entity?.derived?.maxPPE,
    entity?.derived?.PPE,
    entity?.unified?.magic?.maxPPE,
    entity?.unified?.energy?.PPE
  );
  const spellCount =
    (Array.isArray(entity?.spells) ? entity.spells.length : 0) +
    (Array.isArray(entity?.spellbook) ? entity.spellbook.length : 0) +
    (Array.isArray(entity?.knownSpells) ? entity.knownSpells.length : 0);

  if (!hasMagic && !(explicitPPE > 0)) return PPE_TYPES.NONE;

  if (
    SUPERNATURAL_PPE_KEYWORDS.some((k) => mergedText.includes(k)) &&
    explicitPPE != null
  ) {
    return PPE_TYPES.MONSTER_INNATE;
  }

  if (DIVINE_PPE_KEYWORDS.some((k) => occText.includes(k))) {
    return PPE_TYPES.DIVINE_STANDARD;
  }

  if (NATURE_PPE_KEYWORDS.some((k) => occText.includes(k))) {
    return PPE_TYPES.NATURE_STANDARD;
  }

  if (OCC_STANDARD_PPE_KEYWORDS.some((k) => occText.includes(k))) {
    return PPE_TYPES.ARCANE_STANDARD;
  }

  if (
    LIMITED_MAGIC_PPE_KEYWORDS.some((k) => mergedText.includes(k)) ||
    (spellCount > 0 && spellCount <= 2)
  ) {
    return PPE_TYPES.LIMITED_MAGIC;
  }

  if (spellCount > 0 && spellCount <= 3 && (explicitPPE || 0) <= 30) {
    return PPE_TYPES.MINOR_MAGIC;
  }

  if (hasMagic && explicitPPE != null && entity?.type !== "player") {
    return PPE_TYPES.MONSTER_INNATE;
  }

  if (hasMagic && firstFinite(entity?.PE, entity?.pe, entity?.attributes?.PE, entity?.attributes?.pe) != null) {
    return entity?.type === "player"
      ? PPE_TYPES.ARCANE_STANDARD
      : PPE_TYPES.MONSTER_VARIABLE;
  }

  return hasMagic ? PPE_TYPES.OCC_FIXED_START : PPE_TYPES.NONE;
}

const coerceRollArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => Math.floor(toNumberOrNull(v) || 0))
    .filter((v) => v > 0);
};

const rollDiceSeries = (count, sides = 6, rng = Math.random) => {
  const safeCount = Math.max(0, Math.floor(count || 0));
  const dieSides = Math.max(2, Math.floor(sides || 6));
  const out = [];
  for (let i = 0; i < safeCount; i += 1) {
    const roll = 1 + Math.floor((rng?.() ?? Math.random()) * dieSides);
    out.push(clamp(roll, 1, dieSides));
  }
  return out;
};

const sumRolls = (rolls) =>
  (Array.isArray(rolls) ? rolls : []).reduce(
    (acc, n) => acc + (Number.isFinite(n) ? Number(n) : 0),
    0
  );

export function computePPEForEntity(entity = {}, options = {}) {
  const {
    rollMissingLevelGains = false,
    rng = null,
    preserveExplicitPPE = true,
    preserveExplicitPPEAsAuthority = true,
  } = options;

  const ppeType = inferPPEType(entity);
  const occOverride = getOccPPEOverride(entity);
  const progressionProfile = occOverride || PPE_PROFILES[ppeType] || null;
  const level = getEntityLevel(entity);
  const pe = firstFinite(
    entity?.PE,
    entity?.pe,
    entity?.attributes?.PE,
    entity?.attributes?.pe
  );
  const explicitMax = firstFinite(
    entity?.maxPPE,
    entity?.PPE,
    entity?.ppe,
    entity?.derived?.maxPPE,
    entity?.derived?.PPE,
    entity?.unified?.magic?.maxPPE,
    entity?.unified?.energy?.PPE
  );
  const explicitCurrent = firstFinite(
    entity?.currentPPE,
    entity?.derived?.currentPPE
  );
  const entityType = String(entity?.type || "").toLowerCase();
  const isPlayerEntity =
    entityType === "player" ||
    entity?.isPlayer === true ||
    entity?.isPC === true;
  const strictExplicitAuthority =
    preserveExplicitPPEAsAuthority &&
    explicitMax != null &&
    explicitMax > 0 &&
    !isPlayerEntity;
  const fallbackSeed = [
    entity?.id,
    entity?.name,
    entity?.occ || entity?.class,
    level,
    ppeType,
  ]
    .filter(Boolean)
    .join("|");
  const seededRng = createDeterministicRng(fallbackSeed || "ppe-fallback-seed");
  const useRng = typeof rng === "function" ? rng : seededRng;
  const formulaContext = {
    entity,
    ppeType,
    level,
    pe,
    rng: useRng,
  };

  let ppeBase = firstFinite(entity?.ppeBase, entity?.basePPE);
  let ppeLevelGainRolls = coerceRollArray(
    entity?.ppeLevelGainRolls || entity?.ppeGainsRolls
  );
  let ppeLevelGainsTotal = firstFinite(
    entity?.ppeLevelGainsTotal,
    entity?.ppeGains
  );

  if (ppeLevelGainRolls.length > 0) {
    ppeLevelGainsTotal = sumRolls(ppeLevelGainRolls);
  }

  const canLevelGain =
    ppeType === PPE_TYPES.ARCANE_STANDARD ||
    ppeType === PPE_TYPES.OCC_STANDARD ||
    ppeType === PPE_TYPES.DIVINE_STANDARD ||
    ppeType === PPE_TYPES.NATURE_STANDARD ||
    ppeType === PPE_TYPES.MONSTER_VARIABLE ||
    ppeType === PPE_TYPES.OCC_FIXED_START ||
    ppeType === PPE_TYPES.LIMITED_MAGIC;
  const ppeProgressionModel =
    progressionProfile?.ppeProgressionModel ||
    (canLevelGain
      ? PPE_PROGRESSION_MODELS.ROLL_EACH_LEVEL
      : PPE_PROGRESSION_MODELS.FLAT_POOL);
  const usesLevelGainProgression =
    canLevelGain && ppeProgressionModel !== PPE_PROGRESSION_MODELS.FLAT_POOL;
  const expectedGainCount = Math.max(0, level - 1);

  if (
    usesLevelGainProgression &&
    ppeLevelGainsTotal == null &&
    explicitMax != null &&
    ppeBase != null
  ) {
    ppeLevelGainsTotal = Math.max(0, explicitMax - ppeBase);
  }

  if (usesLevelGainProgression && expectedGainCount > 0 && rollMissingLevelGains) {
    const existingGainCount = ppeLevelGainRolls.length;
    const missingGainCount = Math.max(0, expectedGainCount - existingGainCount);
    const perLevelFormula = progressionProfile?.perLevelFormula;
    if (missingGainCount > 0 && typeof perLevelFormula === "function") {
      const generated = Array.from({ length: missingGainCount }, (_, idx) => {
        const value = toNumberOrNull(
          perLevelFormula({
            ...formulaContext,
            levelGainIndex: existingGainCount + idx + 1,
            gainedAtLevel: existingGainCount + idx + 2,
          })
        );
        return Math.max(0, Math.floor(value || 0));
      });
      ppeLevelGainRolls = [...ppeLevelGainRolls, ...generated.filter((v) => v > 0)];
      ppeLevelGainsTotal = sumRolls(ppeLevelGainRolls);
    } else if (
      missingGainCount > 0 &&
      ppeProgressionModel === PPE_PROGRESSION_MODELS.STATIC_PER_LEVEL
    ) {
      const perLevelStatic = Math.max(
        0,
        Math.floor(firstFinite(progressionProfile?.perLevelStatic, 0) || 0)
      );
      ppeLevelGainRolls = [
        ...ppeLevelGainRolls,
        ...Array.from({ length: missingGainCount }, () => perLevelStatic).filter(
          (v) => v > 0
        ),
      ];
      ppeLevelGainsTotal =
        ppeLevelGainRolls.length > 0
          ? sumRolls(ppeLevelGainRolls)
          : perLevelStatic * expectedGainCount;
    } else if (missingGainCount > 0) {
      const dieSides = progressionProfile?.perLevelDieSides || 6;
      ppeLevelGainRolls = [
        ...ppeLevelGainRolls,
        ...rollDiceSeries(missingGainCount, dieSides, useRng),
      ];
      ppeLevelGainsTotal = sumRolls(ppeLevelGainRolls);
    }
  }

  if (
    usesLevelGainProgression &&
    ppeLevelGainsTotal == null &&
    ppeLevelGainRolls.length === 0 &&
    expectedGainCount > 0 &&
    !rollMissingLevelGains
  ) {
    if (ppeProgressionModel === PPE_PROGRESSION_MODELS.STATIC_PER_LEVEL) {
      const perLevelStatic = Math.max(
        0,
        Math.floor(firstFinite(progressionProfile?.perLevelStatic, 0) || 0)
      );
      ppeLevelGainsTotal = perLevelStatic * expectedGainCount;
    } else {
      const dieSides = progressionProfile?.perLevelDieSides || 6;
      ppeLevelGainRolls = rollDiceSeries(expectedGainCount, dieSides, useRng);
      ppeLevelGainsTotal = sumRolls(ppeLevelGainRolls);
    }
  }

  if (ppeLevelGainsTotal == null) ppeLevelGainsTotal = 0;

  if (ppeBase == null) {
    const baseFormula = progressionProfile?.baseFormula;
    if (usesLevelGainProgression && typeof baseFormula === "function") {
      const computedBase = toNumberOrNull(baseFormula(formulaContext));
      if (computedBase != null) {
        ppeBase = Math.max(0, Math.floor(computedBase));
      }
    }
    if (ppeBase == null && usesLevelGainProgression && pe != null) {
      const peMultiplier = progressionProfile?.peMultiplier ?? 2;
      const baseFlat = progressionProfile?.baseFlat ?? 0;
      ppeBase = Math.max(0, pe * peMultiplier + baseFlat);
    } else if (explicitMax != null && usesLevelGainProgression) {
      ppeBase = Math.max(0, explicitMax - ppeLevelGainsTotal);
    } else if (canLevelGain && ppeProgressionModel === PPE_PROGRESSION_MODELS.FLAT_POOL) {
      ppeBase = Math.max(0, explicitMax ?? progressionProfile?.baseFlat ?? 20);
    } else if (ppeType === PPE_TYPES.MINOR_MAGIC) {
      ppeBase = 10;
    } else if (ppeType === PPE_TYPES.MONSTER_INNATE) {
      ppeBase = explicitMax ?? 0;
    } else if (canLevelGain) {
      ppeBase = 20;
    } else {
      ppeBase = 0;
    }
  }

  let maxPPE = 0;
  switch (ppeType) {
    case PPE_TYPES.ARCANE_STANDARD:
    case PPE_TYPES.OCC_STANDARD:
    case PPE_TYPES.DIVINE_STANDARD:
    case PPE_TYPES.NATURE_STANDARD:
    case PPE_TYPES.MONSTER_VARIABLE:
    case PPE_TYPES.OCC_FIXED_START:
    case PPE_TYPES.LIMITED_MAGIC:
      maxPPE = Math.max(0, ppeBase + ppeLevelGainsTotal);
      break;
    case PPE_TYPES.MONSTER_INNATE:
      maxPPE = Math.max(0, explicitMax ?? ppeBase ?? 0);
      break;
    case PPE_TYPES.MINOR_MAGIC:
      maxPPE = Math.max(
        0,
        explicitMax ?? clamp(Math.round(10 + level * 2), 10, 30)
      );
      break;
    case PPE_TYPES.ABILITY_CHARGES:
    case PPE_TYPES.NONE:
    default:
      maxPPE = Math.max(0, explicitMax ?? 0);
      break;
  }

  if (preserveExplicitPPE && explicitMax != null && explicitMax > 0) {
    maxPPE = explicitMax;
    if (usesLevelGainProgression && ppeBase != null) {
      ppeLevelGainsTotal = Math.max(0, maxPPE - ppeBase);
    }
  }
  if (strictExplicitAuthority) {
    maxPPE = Math.max(0, explicitMax);
    if (ppeBase == null) ppeBase = maxPPE;
    if (usesLevelGainProgression) {
      ppeLevelGainsTotal = Math.max(0, maxPPE - ppeBase);
    } else {
      ppeLevelGainsTotal = 0;
      ppeLevelGainRolls = [];
    }
  }

  let currentPPE = explicitCurrent;
  if (currentPPE == null) currentPPE = maxPPE;
  currentPPE = clamp(currentPPE, 0, maxPPE);

  const ppeAuthority =
    strictExplicitAuthority || ppeType === PPE_TYPES.MONSTER_INNATE
      ? PPE_AUTHORITIES.STATBLOCK
      : ppeType === PPE_TYPES.ABILITY_CHARGES
      ? PPE_AUTHORITIES.CHARGES
      : ppeType === PPE_TYPES.NONE
      ? PPE_AUTHORITIES.NONE
      : PPE_AUTHORITIES.COMPUTED;

  return {
    ppeType,
    ppeAuthority,
    ppeProgressionModel,
    level,
    ppeBase: Math.max(0, Math.round(ppeBase || 0)),
    ppeLevelGainsTotal: Math.max(0, Math.round(ppeLevelGainsTotal || 0)),
    ppeLevelGainRolls,
    maxPPE: Math.max(0, Math.round(maxPPE || 0)),
    ppeMax: Math.max(0, Math.round(maxPPE || 0)),
    ppeCurrent: Math.max(0, Math.round(currentPPE || 0)),
    // Legacy compatibility: existing systems treat PPE as max pool.
    PPE: Math.max(0, Math.round(maxPPE || 0)),
    currentPPE: Math.max(0, Math.round(currentPPE || 0)),
  };
}

export function normalizePPEState(entity = {}, options = {}) {
  const profile = computePPEForEntity(entity, {
    preserveExplicitPPEAsAuthority: true,
    ...options,
  });
  return {
    ...entity,
    ...profile,
  };
}

export function migrateEntityPPEState(entity = {}, options = {}) {
  return normalizePPEState(entity, {
    rollMissingLevelGains: true,
    preserveExplicitPPE: true,
    preserveExplicitPPEAsAuthority: true,
    ...options,
  });
}

export function migratePPEStateForCollection(entities = [], options = {}) {
  if (!Array.isArray(entities)) return [];
  return entities.map((entity) =>
    migrateEntityPPEState(entity, {
      rng: createDeterministicRng(
        [entity?.id, entity?.name, entity?.occ || entity?.class || "entity"].join(
          "|"
        )
      ),
      ...options,
    })
  );
}

export function getEffectivePPE(entity = {}, options = {}) {
  const { onLeyLine = false, onNexus = false, temporaryBonus = 0 } = options;
  const current = firstFinite(
    entity?.ppeCurrent,
    entity?.currentPPE,
    entity?.PPE,
    entity?.maxPPE,
    0
  ) || 0;
  const multiplier = onNexus ? 3 : onLeyLine ? 2 : 1;
  return Math.max(0, Math.round(current * multiplier + (temporaryBonus || 0)));
}

export function normalizeSpellName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/['']/g, "'")
    .trim();
}

export function isWizardClassName(className) {
  const text = String(className || "").toLowerCase();
  return text.includes("wizard");
}

export function getWizardSpellProgression(level) {
  const lvl = Math.max(1, Math.floor(Number(level) || 1));
  const maxSpellLevel = Math.min(WIZARD_MAX_SPELL_LEVEL, lvl);
  const totalKnownSpells =
    WIZARD_BASE_KNOWN_AT_LEVEL_1 +
    Math.max(0, (lvl - 1) * WIZARD_ADDITIONAL_SPELLS_PER_LEVEL);
  const requiredPickCount = Math.max(
    0,
    totalKnownSpells - WIZARD_COMMON_SPELL_NAMES.length
  );

  return {
    level: lvl,
    maxSpellLevel,
    totalKnownSpells,
    requiredPickCount,
  };
}

export function getWizardEligibleSpells(allSpells, level) {
  const { maxSpellLevel } = getWizardSpellProgression(level);
  const list = Array.isArray(allSpells) ? allSpells : [];

  return list
    .filter((sp) => sp && sp.name)
    .filter((sp) => {
      const spellLevel = Math.max(1, Math.floor(Number(sp.level) || 1));
      if (spellLevel > maxSpellLevel) return false;

      // If class metadata exists, enforce wizard-only for wizard spellbooks.
      if (sp.class != null && String(sp.class).trim() !== "") {
        return String(sp.class).toLowerCase() === "wizard";
      }
      return true;
    })
    .sort((a, b) => {
      const la = Math.max(1, Math.floor(Number(a.level) || 1));
      const lb = Math.max(1, Math.floor(Number(b.level) || 1));
      if (la !== lb) return la - lb;
      return String(a.name).localeCompare(String(b.name));
    });
}

export function buildWizardSpellbookForLevel({
  allSpells,
  level,
  pickedSpellNames = [],
}) {
  const progression = getWizardSpellProgression(level);
  const eligible = getWizardEligibleSpells(allSpells, progression.level);

  const byName = new Map();
  for (const sp of eligible) {
    byName.set(normalizeSpellName(sp.name), sp);
  }

  const lockedCommon = WIZARD_COMMON_SPELL_NAMES.map((name) =>
    byName.get(normalizeSpellName(name))
  ).filter(Boolean);

  const cappedPickCount = Math.max(
    0,
    progression.totalKnownSpells - lockedCommon.length
  );

  const picked = [];
  const pickedSeen = new Set();
  for (const name of pickedSpellNames || []) {
    const key = normalizeSpellName(name);
    if (!key || pickedSeen.has(key)) continue;
    if (
      lockedCommon.some((sp) => normalizeSpellName(sp.name) === key) ||
      !byName.has(key)
    ) {
      continue;
    }
    pickedSeen.add(key);
    picked.push(byName.get(key));
    if (picked.length >= cappedPickCount) break;
  }

  const fallback = [];
  if (picked.length < cappedPickCount) {
    for (const sp of eligible) {
      const key = normalizeSpellName(sp.name);
      const isCommon = lockedCommon.some(
        (common) => normalizeSpellName(common.name) === key
      );
      if (isCommon || pickedSeen.has(key)) continue;
      pickedSeen.add(key);
      fallback.push(sp);
      if (picked.length + fallback.length >= cappedPickCount) break;
    }
  }

  const finalSpellbook = [...lockedCommon, ...picked, ...fallback];

  return {
    ...progression,
    lockedCommon,
    eligible,
    spellbook: finalSpellbook,
    picked,
  };
}

export function parseRangeToFeet(rangeValue) {
  if (!rangeValue) return Infinity;
  const range = String(rangeValue).toLowerCase();
  if (
    range.includes("line of sight") ||
    range.includes("line-of-sight") ||
    range.includes("any target")
  )
    return Infinity;
  if (range.includes("self")) return 0;
  if (range.includes("touch") || range.includes("melee")) return 5;

  const numberMatch = range.match(/(\d+(\.\d+)?)/);
  if (!numberMatch) return Infinity;

  const value = parseFloat(numberMatch[1]);
  if (Number.isNaN(value)) return Infinity;

  if (range.includes("mile")) {
    return value * 5280;
  }

  return value;
}

export function getSpellCost(spell) {
  if (!spell) return 0;
  const candidates = [
    spell.cost,
    spell.ppe,
    spell.PPE,
    spell.ppeCost,
    spell.PPECOST,
    spell.ppCost,
    spell.ispCost,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && !Number.isNaN(candidate)) {
      return candidate;
    }
    if (typeof candidate === "string") {
      const numeric = parseInt(candidate.replace(/[^\d-]+/g, ""), 10);
      if (!Number.isNaN(numeric)) {
        return numeric;
      }
    }
  }

  return 0;
}

export function getPsionicCost(power) {
  if (!power) return 0;
  const candidates = [power.isp, power.cost, power.ISP];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && !Number.isNaN(candidate)) {
      return candidate;
    }
    if (typeof candidate === "string") {
      const numeric = parseInt(candidate.replace(/[^\d-]+/g, ""), 10);
      if (!Number.isNaN(numeric)) {
        return numeric;
      }
    }
  }
  return 0;
}

export function extractHealingFormulaFromText(text) {
  if (!text || typeof text !== "string") return null;
  const lower = text.toLowerCase();
  if (!HEAL_KEYWORDS.some((keyword) => lower.includes(keyword))) return null;

  const diceMatch = text.match(/(\d+d\d+(\s*[+-]\s*\d+)?)/i);
  if (diceMatch) {
    return { type: "dice", expression: diceMatch[1].replace(/\s+/g, "") };
  }

  const flatMatch = text.match(
    /(\d+)\s*(hp|hit points|points|s\.?d\.?c\.?|sdc)/i
  );
  if (flatMatch) {
    return { type: "flat", amount: parseInt(flatMatch[1], 10) };
  }

  return null;
}

export function getSpellHealingFormula(spell) {
  if (!spell) return null;

  if (typeof spell.healingAmount === "number") {
    return { type: "flat", amount: spell.healingAmount };
  }

  if (typeof spell.healing === "number") {
    return { type: "flat", amount: spell.healing };
  }

  const healingFields = [
    spell.healing,
    spell.effect,
    spell.damage,
    spell.description,
    spell.notes,
  ];

  for (const field of healingFields) {
    const formula = extractHealingFormulaFromText(field);
    if (formula) return formula;
  }

  return null;
}

export function hasSpellDamage(spell) {
  if (!spell) return false;

  const damageCandidates = [
    spell.combatDamage,
    spell.damage,
    spell.effect,
    spell.description,
  ];

  for (const candidate of damageCandidates) {
    if (!candidate) continue;
    if (typeof candidate === "number") {
      if (candidate > 0) return true;
      continue;
    }
    if (typeof candidate === "string") {
      const lower = candidate.toLowerCase();
      if (lower.includes("damage") || /\d+d\d+/.test(lower)) return true;
    }
  }

  return false;
}

export function getSpellRangeInFeet(spell) {
  if (!spell) return Infinity;
  return parseRangeToFeet(spell.range);
}

export function isHealingSpell(spell) {
  if (!spell) return false;
  if (
    typeof spell.damageType === "string" &&
    spell.damageType.toLowerCase().includes("healing")
  ) {
    return true;
  }
  if (
    typeof spell.category === "string" &&
    spell.category.toLowerCase().includes("healing")
  ) {
    return true;
  }
  return Boolean(getSpellHealingFormula(spell));
}

export function isOffensiveSpell(spell) {
  return !isHealingSpell(spell) && hasSpellDamage(spell);
}

export function isSupportSpell(spell) {
  if (!spell) return false;
  if (isHealingSpell(spell)) return true;
  if (hasSpellDamage(spell)) return false;

  const name = (spell.name || "").toLowerCase();
  const description = (spell.description || spell.effect || "").toLowerCase();
  const range = (spell.range || "").toLowerCase();

  if (
    HARMFUL_KEYWORDS.some(
      (keyword) => name.includes(keyword) || description.includes(keyword)
    )
  ) {
    return false;
  }

  if (range.includes("self")) return true;
  if (range.includes("touch") || range.includes("per person") || range.includes("per target")) {
    if (
      SUPPORT_KEYWORDS.some(
        (keyword) => name.includes(keyword) || description.includes(keyword)
      )
    ) {
      return true;
    }
  }

  return SUPPORT_KEYWORDS.some(
    (keyword) => name.includes(keyword) || description.includes(keyword)
  );
}

export function doesSpellRequireTarget(spell) {
  if (!spell) return false;
  if (hasSpellDamage(spell)) return true;
  const range = (spell.range || "").toLowerCase();
  if (!range) return false;
  if (
    range.includes("self") &&
    !TOUCH_RANGE_HINTS.some((hint) => range.includes(hint))
  ) {
    return false;
  }
  if (TOUCH_RANGE_HINTS.some((hint) => range.includes(hint))) return true;
  if (/\d/.test(range) || range.includes("line") || range.includes("area"))
    return true;
  return false;
}

export function spellCanAffectTarget(spell, caster, target) {
  if (!spell) return false;
  if (!target) return !doesSpellRequireTarget(spell);
  if (!caster) return false;
  if (target.id === caster.id) return true;

  const range = (spell.range || "").toLowerCase();
  if (!range) return true;

  if (SELF_ONLY_HINTS.some((hint) => range.includes(hint))) return false;
  if (
    range.includes("self") &&
    !TOUCH_RANGE_HINTS.some((hint) => range.includes(hint))
  ) {
    return false;
  }

  const isFriendlyTarget = caster.type === target.type;
  if (!isFriendlyTarget) {
    if (isHealingSpell(spell)) return false;
    if (isSupportSpell(spell)) return false;
  }

  return true;
}

/**
 * Check if a spell is supported in combat (has implemented handlers)
 * Supported right now if it deals damage, heals, or is a "support" buff.
 * Later you'll expand this with real effect handlers (summon, wards, teleport, etc.)
 * @param {Object} spell - Spell object
 * @returns {boolean} True if spell is combat-supported
 */
export function isCombatSupportedSpell(spell) {
  return hasSpellDamage(spell) || isHealingSpell(spell) || isSupportSpell(spell);
}

// Alias for backward compatibility
export const spellRequiresTarget = doesSpellRequireTarget;

