// src/utils/techniqueUtils.js

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
  "per combatant",
  "per ally",
];

const SHUMAN_ONLY_HINTS = ["shuman only", "shuman-only"];

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

export const DUELIST_COMMON_TECHNIQUE_NAMES = [
  "Decipher Training",
  "Sense Training",
  "Cloud of Slumber",
  "Globe of Daylight",
  "Tongues",
  "Enchanted Cauldron",
];

const DUELIST_BASE_KNOWN_AT_LEVEL_1 = 8; // 6 common + 2 picks
const DUELIST_ADDITIONAL_TECHNIQUES_PER_LEVEL = 1;
const DUELIST_MAX_TECHNIQUE_LEVEL = 12;

export const stamina_TYPES = Object.freeze({
  NONE: "NONE",
  ARCANE_STANDARD: "ARCANE_STANDARD",
  // Legacy alias preserved for backward compatibility with existing saves
  PROFESSION_STANDARD: "PROFESSION_STANDARD",
  DIVINE_STANDARD: "DIVINE_STANDARD",
  NATURE_STANDARD: "NATURE_STANDARD",
  PROFESSION_FIXED_START: "PROFESSION_FIXED_START",
  MONSTER_INNATE: "MONSTER_INNATE",
  MONSTER_VARIABLE: "MONSTER_VARIABLE",
  MINOR_TRAINING: "MINOR_TRAINING",
  LIMITED_TRAINING: "LIMITED_TRAINING",
  ABILITY_CHARGES: "ABILITY_CHARGES",
});

export const stamina_AUTHORITIES = Object.freeze({
  STATBLOCK: "statblock",
  COMPUTED: "computed",
  CHARGES: "charges",
  NONE: "none",
});

export const stamina_PRHEAVY_FIGHTERSSION_MODELS = Object.freeze({
  ROLL_EACH_LEVEL: "rollEachLevel",
  STATIC_PER_LEVEL: "staticPerLevel",
  FLAT_POOL: "flatPool",
});

const PROFESSION_STANDARD_stamina_KEYWORDS = [
  "duelist",
  "mercenary",
  "summoner",
  "diabolist",
  "mage",
  "sraidererer",
  "witch",
  "necromancer",
  "conjurer",
];

const DIVINE_stamina_KEYWORDS = [
  "priest",
  "cleric",
  "paladin",
  "temple",
  "faith",
  "holy",
];

const NATURE_stamina_KEYWORDS = [
  "druid",
  "shaman",
  "nature",
  "totem",
  "warden",
];

const LIMITED_TRAINING_stamina_KEYWORDS = [
  "hedge",
  "minor training",
  "lesser training",
  "technique-like",
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

export const createDeterministicRng = (seedInput = "stamina-seed") => {
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
  staminaType,
  baseDiceExpression,
  perLevelDieSides = 6,
  peMultiplier = 0,
  baseFlat = 0,
}) => ({
  staminaType,
  staminaProgressionModel: stamina_PRHEAVY_FIGHTERSSION_MODELS.ROLL_EACH_LEVEL,
  baseFormula: makeDiceBaseFormula(baseDiceExpression),
  perLevelFormula: makePerLevelRollFormula(perLevelDieSides),
  baseDiceExpression,
  peMultiplier,
  baseFlat,
  perLevelDieSides,
});

export const makeStaticPerLevelProfile = ({
  staminaType,
  peMultiplier = 0,
  baseFlat = 0,
  perLevelStatic = 0,
}) => ({
  staminaType,
  staminaProgressionModel: stamina_PRHEAVY_FIGHTERSSION_MODELS.STATIC_PER_LEVEL,
  baseFormula: makeBaseFormula(peMultiplier, baseFlat),
  perLevelStatic: Math.max(0, Math.floor(perLevelStatic || 0)),
  peMultiplier,
  baseFlat,
});

export const makeFlatPoolProfile = ({
  staminaType,
  peMultiplier = 0,
  baseFlat = 0,
}) => ({
  staminaType,
  staminaProgressionModel: stamina_PRHEAVY_FIGHTERSSION_MODELS.FLAT_POOL,
  baseFormula: makeBaseFormula(peMultiplier, baseFlat),
  peMultiplier,
  baseFlat,
});

const PROFESSION_stamina_PROFILE_OVERRIDES = Object.freeze({
  // PF2-aligned strict base pools from dataset profession lines.
  duelist: makeDiceBaseRollProfile({
    staminaType: stamina_TYPES.ARCANE_STANDARD,
    baseDiceExpression: "2d6x10+20",
    perLevelDieSides: 6,
  }),
  mercenary: makeDiceBaseRollProfile({
    staminaType: stamina_TYPES.ARCANE_STANDARD,
    baseDiceExpression: "3d6x10+30",
    perLevelDieSides: 6,
  }),
  summoner: makeDiceBaseRollProfile({
    staminaType: stamina_TYPES.ARCANE_STANDARD,
    baseDiceExpression: "2d6x10+30",
    perLevelDieSides: 6,
  }),
  diabolist: makeDiceBaseRollProfile({
    staminaType: stamina_TYPES.ARCANE_STANDARD,
    baseDiceExpression: "3d6x10+20",
    perLevelDieSides: 6,
  }),
  necromancer: makeDiceBaseRollProfile({
    staminaType: stamina_TYPES.ARCANE_STANDARD,
    baseDiceExpression: "2d6x10+20",
    perLevelDieSides: 6,
  }),
  conjurer: makeDiceBaseRollProfile({
    staminaType: stamina_TYPES.ARCANE_STANDARD,
    baseDiceExpression: "2d6x10+20",
    perLevelDieSides: 6,
  }),
  witch: makeDiceBaseRollProfile({
    staminaType: stamina_TYPES.ARCANE_STANDARD,
    baseDiceExpression: "3d6x10+10",
    perLevelDieSides: 6,
  }),
  priest: makeDiceBaseRollProfile({
    staminaType: stamina_TYPES.DIVINE_STANDARD,
    baseDiceExpression: "2d6x10+20",
    perLevelDieSides: 6,
  }),
  cleric: makeDiceBaseRollProfile({
    staminaType: stamina_TYPES.DIVINE_STANDARD,
    baseDiceExpression: "2d6x10+20",
    perLevelDieSides: 6,
  }),
  paladin: makeDiceBaseRollProfile({
    staminaType: stamina_TYPES.DIVINE_STANDARD,
    baseDiceExpression: "2d6+10",
    perLevelDieSides: 6,
  }),
  druid: makeDiceBaseRollProfile({
    staminaType: stamina_TYPES.NATURE_STANDARD,
    baseDiceExpression: "2d6x10+20",
    perLevelDieSides: 6,
  }),
  shaman: makeDiceBaseRollProfile({
    staminaType: stamina_TYPES.NATURE_STANDARD,
    baseDiceExpression: "2d6x10+30",
    perLevelDieSides: 6,
  }),
  healer: makeDiceBaseRollProfile({
    staminaType: stamina_TYPES.DIVINE_STANDARD,
    baseDiceExpression: "2d6x10+20",
    perLevelDieSides: 6,
  }),
  // Alias profession names from datasets.
  "priest of light": makeDiceBaseRollProfile({
    staminaType: stamina_TYPES.DIVINE_STANDARD,
    baseDiceExpression: "2d6x10+20",
    perLevelDieSides: 6,
  }),
  "priest of darkness": makeDiceBaseRollProfile({
    staminaType: stamina_TYPES.DIVINE_STANDARD,
    baseDiceExpression: "2d6x10+20",
    perLevelDieSides: 6,
  }),
  // Concrete template examples for non-roll progressions.
  footman: makeStaticPerLevelProfile({
    staminaType: stamina_TYPES.LIMITED_TRAINING,
    peMultiplier: 1,
    baseFlat: 4,
    perLevelStatic: 2,
  }),
  squire: makeFlatPoolProfile({
    staminaType: stamina_TYPES.LIMITED_TRAINING,
    peMultiplier: 0,
    baseFlat: 12,
  }),
});

const SUPERNATURAL_stamina_KEYWORDS = [
  "animal",
  "raider",
  "deevil",
  "devil",
  "elemental",
  "supernatural",
  "spirit",
  "deity",
];

const stamina_PROFILES = Object.freeze({
  [stamina_TYPES.ARCANE_STANDARD]: {
    peMultiplier: 2,
    baseFlat: 0,
    staminaProgressionModel: stamina_PRHEAVY_FIGHTERSSION_MODELS.ROLL_EACH_LEVEL,
    perLevelDieSides: 6,
  },
  [stamina_TYPES.PROFESSION_STANDARD]: {
    peMultiplier: 2,
    baseFlat: 0,
    staminaProgressionModel: stamina_PRHEAVY_FIGHTERSSION_MODELS.ROLL_EACH_LEVEL,
    perLevelDieSides: 6,
  },
  [stamina_TYPES.DIVINE_STANDARD]: {
    peMultiplier: 1,
    baseFlat: 10,
    staminaProgressionModel: stamina_PRHEAVY_FIGHTERSSION_MODELS.ROLL_EACH_LEVEL,
    perLevelDieSides: 6,
  },
  [stamina_TYPES.NATURE_STANDARD]: {
    peMultiplier: 1,
    baseFlat: 8,
    staminaProgressionModel: stamina_PRHEAVY_FIGHTERSSION_MODELS.ROLL_EACH_LEVEL,
    perLevelDieSides: 6,
  },
  [stamina_TYPES.PROFESSION_FIXED_START]: {
    peMultiplier: 0,
    baseFlat: 20,
    staminaProgressionModel: stamina_PRHEAVY_FIGHTERSSION_MODELS.ROLL_EACH_LEVEL,
    perLevelDieSides: 6,
  },
  [stamina_TYPES.MONSTER_VARIABLE]: {
    peMultiplier: 2,
    baseFlat: 0,
    staminaProgressionModel: stamina_PRHEAVY_FIGHTERSSION_MODELS.ROLL_EACH_LEVEL,
    perLevelDieSides: 6,
  },
  [stamina_TYPES.LIMITED_TRAINING]: {
    peMultiplier: 1,
    baseFlat: 4,
    staminaProgressionModel: stamina_PRHEAVY_FIGHTERSSION_MODELS.ROLL_EACH_LEVEL,
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
    entity?.trainingAbilities || entity?.training || entity?.description || ""
  );
  const level = firstFinite(
    entity?.level,
    entity?.Level,
    entity?.levels?.techniquecaster,
    entity?.levels?.mage,
    entity?.trainingLevel,
    derivedFromText
  );
  return Math.max(1, Math.floor(level || 1));
}

export function hasTrainingCapability(entity = {}) {
  const trainingListLike =
    (Array.isArray(entity?.training) && entity.training.length > 0) ||
    (Array.isArray(entity?.techniqueBook) && entity.techniqueBook.length > 0) ||
    (Array.isArray(entity?.techniques) && entity.techniques.length > 0) ||
    (Array.isArray(entity?.knownTechniques) && entity.knownTechniques.length > 0);
  const trainingText = [
    entity?.trainingAbilities,
    entity?.training,
    entity?.description,
    entity?.profession,
    entity?.class,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    trainingListLike ||
    trainingText.includes("training") ||
    trainingText.includes("technique") ||
    PROFESSION_STANDARD_stamina_KEYWORDS.some((k) => trainingText.includes(k)) ||
    DIVINE_stamina_KEYWORDS.some((k) => trainingText.includes(k)) ||
    NATURE_stamina_KEYWORDS.some((k) => trainingText.includes(k)) ||
    LIMITED_TRAINING_stamina_KEYWORDS.some((k) => trainingText.includes(k))
  );
}

export function getProfessionstaminaOverride(entity = {}) {
  const professionClass = normalizeKey(
    [entity?.profession, entity?.class, entity?.professionName, entity?.archetype]
      .filter(Boolean)
      .join(" ")
  );
  if (!professionClass) return null;

  for (const [key, profile] of Object.entries(PROFESSION_stamina_PROFILE_OVERRIDES)) {
    if (professionClass.includes(key)) return profile;
  }
  return null;
}

export function inferstaminaType(entity = {}) {
  const explicitType = String(entity?.staminaType || "").trim();
  if (explicitType) return explicitType;

  const professionOverride = getProfessionstaminaOverride(entity);
  if (professionOverride?.staminaType) return professionOverride.staminaType;

  const hasTraining = hasTrainingCapability(entity);
  const professionText = String(entity?.profession || entity?.class || "").toLowerCase();
  const categoryText = String(entity?.category || entity?.race || "").toLowerCase();
  const nameText = String(entity?.name || "").toLowerCase();
  const mergedText = `${professionText} ${categoryText} ${nameText}`;
  const explicitstamina = firstFinite(
    entity?.maxstamina,
    entity?.stamina,
    entity?.stamina,
    entity?.derived?.maxstamina,
    entity?.derived?.stamina,
    entity?.unified?.training?.maxstamina,
    entity?.unified?.energy?.stamina
  );
  const techniqueCount =
    (Array.isArray(entity?.techniques) ? entity.techniques.length : 0) +
    (Array.isArray(entity?.techniqueBook) ? entity.techniqueBook.length : 0) +
    (Array.isArray(entity?.knownTechniques) ? entity.knownTechniques.length : 0);

  if (!hasTraining && !(explicitstamina > 0)) return stamina_TYPES.NONE;

  if (
    SUPERNATURAL_stamina_KEYWORDS.some((k) => mergedText.includes(k)) &&
    explicitstamina != null
  ) {
    return stamina_TYPES.MONSTER_INNATE;
  }

  if (DIVINE_stamina_KEYWORDS.some((k) => professionText.includes(k))) {
    return stamina_TYPES.DIVINE_STANDARD;
  }

  if (NATURE_stamina_KEYWORDS.some((k) => professionText.includes(k))) {
    return stamina_TYPES.NATURE_STANDARD;
  }

  if (PROFESSION_STANDARD_stamina_KEYWORDS.some((k) => professionText.includes(k))) {
    return stamina_TYPES.ARCANE_STANDARD;
  }

  if (
    LIMITED_TRAINING_stamina_KEYWORDS.some((k) => mergedText.includes(k)) ||
    (techniqueCount > 0 && techniqueCount <= 2)
  ) {
    return stamina_TYPES.LIMITED_TRAINING;
  }

  if (techniqueCount > 0 && techniqueCount <= 3 && (explicitstamina || 0) <= 30) {
    return stamina_TYPES.MINOR_TRAINING;
  }

  if (hasTraining && explicitstamina != null && entity?.type !== "player") {
    return stamina_TYPES.MONSTER_INNATE;
  }

  if (hasTraining && firstFinite(entity?.PE, entity?.pe, entity?.attributes?.PE, entity?.attributes?.pe) != null) {
    return entity?.type === "player"
      ? stamina_TYPES.ARCANE_STANDARD
      : stamina_TYPES.MONSTER_VARIABLE;
  }

  return hasTraining ? stamina_TYPES.PROFESSION_FIXED_START : stamina_TYPES.NONE;
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

export function computestaminaForEntity(entity = {}, options = {}) {
  const {
    rollMissingLevelGains = false,
    rng = null,
    preserveExplicitstamina = true,
    preserveExplicitstaminaAsAuthority = true,
  } = options;

  const staminaType = inferstaminaType(entity);
  const professionOverride = getProfessionstaminaOverride(entity);
  const progressionProfile = professionOverride || stamina_PROFILES[staminaType] || null;
  const level = getEntityLevel(entity);
  const pe = firstFinite(
    entity?.PE,
    entity?.pe,
    entity?.attributes?.PE,
    entity?.attributes?.pe
  );
  const explicitMax = firstFinite(
    entity?.maxstamina,
    entity?.stamina,
    entity?.stamina,
    entity?.derived?.maxstamina,
    entity?.derived?.stamina,
    entity?.unified?.training?.maxstamina,
    entity?.unified?.energy?.stamina
  );
  const explicitCurrent = firstFinite(
    entity?.currentstamina,
    entity?.derived?.currentstamina
  );
  const entityType = String(entity?.type || "").toLowerCase();
  const isPlayerEntity =
    entityType === "player" ||
    entity?.isPlayer === true ||
    entity?.isPC === true;
  const strictExplicitAuthority =
    preserveExplicitstaminaAsAuthority &&
    explicitMax != null &&
    explicitMax > 0 &&
    !isPlayerEntity;
  const fallbackSeed = [
    entity?.id,
    entity?.name,
    entity?.profession || entity?.class,
    level,
    staminaType,
  ]
    .filter(Boolean)
    .join("|");
  const seededRng = createDeterministicRng(fallbackSeed || "stamina-fallback-seed");
  const useRng = typeof rng === "function" ? rng : seededRng;
  const formulaContext = {
    entity,
    staminaType,
    level,
    pe,
    rng: useRng,
  };

  let staminaBase = firstFinite(entity?.staminaBase, entity?.basestamina);
  let staminaLevelGainRolls = coerceRollArray(
    entity?.staminaLevelGainRolls || entity?.staminaGainsRolls
  );
  let staminaLevelGainsTotal = firstFinite(
    entity?.staminaLevelGainsTotal,
    entity?.staminaGains
  );

  if (staminaLevelGainRolls.length > 0) {
    staminaLevelGainsTotal = sumRolls(staminaLevelGainRolls);
  }

  const canLevelGain =
    staminaType === stamina_TYPES.ARCANE_STANDARD ||
    staminaType === stamina_TYPES.PROFESSION_STANDARD ||
    staminaType === stamina_TYPES.DIVINE_STANDARD ||
    staminaType === stamina_TYPES.NATURE_STANDARD ||
    staminaType === stamina_TYPES.MONSTER_VARIABLE ||
    staminaType === stamina_TYPES.PROFESSION_FIXED_START ||
    staminaType === stamina_TYPES.LIMITED_TRAINING;
  const staminaProgressionModel =
    progressionProfile?.staminaProgressionModel ||
    (canLevelGain
      ? stamina_PRHEAVY_FIGHTERSSION_MODELS.ROLL_EACH_LEVEL
      : stamina_PRHEAVY_FIGHTERSSION_MODELS.FLAT_POOL);
  const usesLevelGainProgression =
    canLevelGain && staminaProgressionModel !== stamina_PRHEAVY_FIGHTERSSION_MODELS.FLAT_POOL;
  const expectedGainCount = Math.max(0, level - 1);

  if (
    usesLevelGainProgression &&
    staminaLevelGainsTotal == null &&
    explicitMax != null &&
    staminaBase != null
  ) {
    staminaLevelGainsTotal = Math.max(0, explicitMax - staminaBase);
  }

  if (usesLevelGainProgression && expectedGainCount > 0 && rollMissingLevelGains) {
    const existingGainCount = staminaLevelGainRolls.length;
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
      staminaLevelGainRolls = [...staminaLevelGainRolls, ...generated.filter((v) => v > 0)];
      staminaLevelGainsTotal = sumRolls(staminaLevelGainRolls);
    } else if (
      missingGainCount > 0 &&
      staminaProgressionModel === stamina_PRHEAVY_FIGHTERSSION_MODELS.STATIC_PER_LEVEL
    ) {
      const perLevelStatic = Math.max(
        0,
        Math.floor(firstFinite(progressionProfile?.perLevelStatic, 0) || 0)
      );
      staminaLevelGainRolls = [
        ...staminaLevelGainRolls,
        ...Array.from({ length: missingGainCount }, () => perLevelStatic).filter(
          (v) => v > 0
        ),
      ];
      staminaLevelGainsTotal =
        staminaLevelGainRolls.length > 0
          ? sumRolls(staminaLevelGainRolls)
          : perLevelStatic * expectedGainCount;
    } else if (missingGainCount > 0) {
      const dieSides = progressionProfile?.perLevelDieSides || 6;
      staminaLevelGainRolls = [
        ...staminaLevelGainRolls,
        ...rollDiceSeries(missingGainCount, dieSides, useRng),
      ];
      staminaLevelGainsTotal = sumRolls(staminaLevelGainRolls);
    }
  }

  if (
    usesLevelGainProgression &&
    staminaLevelGainsTotal == null &&
    staminaLevelGainRolls.length === 0 &&
    expectedGainCount > 0 &&
    !rollMissingLevelGains
  ) {
    if (staminaProgressionModel === stamina_PRHEAVY_FIGHTERSSION_MODELS.STATIC_PER_LEVEL) {
      const perLevelStatic = Math.max(
        0,
        Math.floor(firstFinite(progressionProfile?.perLevelStatic, 0) || 0)
      );
      staminaLevelGainsTotal = perLevelStatic * expectedGainCount;
    } else {
      const dieSides = progressionProfile?.perLevelDieSides || 6;
      staminaLevelGainRolls = rollDiceSeries(expectedGainCount, dieSides, useRng);
      staminaLevelGainsTotal = sumRolls(staminaLevelGainRolls);
    }
  }

  if (staminaLevelGainsTotal == null) staminaLevelGainsTotal = 0;

  if (staminaBase == null) {
    const baseFormula = progressionProfile?.baseFormula;
    if (usesLevelGainProgression && typeof baseFormula === "function") {
      const computedBase = toNumberOrNull(baseFormula(formulaContext));
      if (computedBase != null) {
        staminaBase = Math.max(0, Math.floor(computedBase));
      }
    }
    if (staminaBase == null && usesLevelGainProgression && pe != null) {
      const peMultiplier = progressionProfile?.peMultiplier ?? 2;
      const baseFlat = progressionProfile?.baseFlat ?? 0;
      staminaBase = Math.max(0, pe * peMultiplier + baseFlat);
    } else if (explicitMax != null && usesLevelGainProgression) {
      staminaBase = Math.max(0, explicitMax - staminaLevelGainsTotal);
    } else if (canLevelGain && staminaProgressionModel === stamina_PRHEAVY_FIGHTERSSION_MODELS.FLAT_POOL) {
      staminaBase = Math.max(0, explicitMax ?? progressionProfile?.baseFlat ?? 20);
    } else if (staminaType === stamina_TYPES.MINOR_TRAINING) {
      staminaBase = 10;
    } else if (staminaType === stamina_TYPES.MONSTER_INNATE) {
      staminaBase = explicitMax ?? 0;
    } else if (canLevelGain) {
      staminaBase = 20;
    } else {
      staminaBase = 0;
    }
  }

  let maxstamina = 0;
  switch (staminaType) {
    case stamina_TYPES.ARCANE_STANDARD:
    case stamina_TYPES.PROFESSION_STANDARD:
    case stamina_TYPES.DIVINE_STANDARD:
    case stamina_TYPES.NATURE_STANDARD:
    case stamina_TYPES.MONSTER_VARIABLE:
    case stamina_TYPES.PROFESSION_FIXED_START:
    case stamina_TYPES.LIMITED_TRAINING:
      maxstamina = Math.max(0, staminaBase + staminaLevelGainsTotal);
      break;
    case stamina_TYPES.MONSTER_INNATE:
      maxstamina = Math.max(0, explicitMax ?? staminaBase ?? 0);
      break;
    case stamina_TYPES.MINOR_TRAINING:
      maxstamina = Math.max(
        0,
        explicitMax ?? clamp(Math.round(10 + level * 2), 10, 30)
      );
      break;
    case stamina_TYPES.ABILITY_CHARGES:
    case stamina_TYPES.NONE:
    default:
      maxstamina = Math.max(0, explicitMax ?? 0);
      break;
  }

  if (preserveExplicitstamina && explicitMax != null && explicitMax > 0) {
    maxstamina = explicitMax;
    if (usesLevelGainProgression && staminaBase != null) {
      staminaLevelGainsTotal = Math.max(0, maxstamina - staminaBase);
    }
  }
  if (strictExplicitAuthority) {
    maxstamina = Math.max(0, explicitMax);
    if (staminaBase == null) staminaBase = maxstamina;
    if (usesLevelGainProgression) {
      staminaLevelGainsTotal = Math.max(0, maxstamina - staminaBase);
    } else {
      staminaLevelGainsTotal = 0;
      staminaLevelGainRolls = [];
    }
  }

  let currentstamina = explicitCurrent;
  if (currentstamina == null) currentstamina = maxstamina;
  currentstamina = clamp(currentstamina, 0, maxstamina);

  const staminaAuthority =
    strictExplicitAuthority || staminaType === stamina_TYPES.MONSTER_INNATE
      ? stamina_AUTHORITIES.STATBLOCK
      : staminaType === stamina_TYPES.ABILITY_CHARGES
      ? stamina_AUTHORITIES.CHARGES
      : staminaType === stamina_TYPES.NONE
      ? stamina_AUTHORITIES.NONE
      : stamina_AUTHORITIES.COMPUTED;

  return {
    staminaType,
    staminaAuthority,
    staminaProgressionModel,
    level,
    staminaBase: Math.max(0, Math.round(staminaBase || 0)),
    staminaLevelGainsTotal: Math.max(0, Math.round(staminaLevelGainsTotal || 0)),
    staminaLevelGainRolls,
    maxstamina: Math.max(0, Math.round(maxstamina || 0)),
    staminaMax: Math.max(0, Math.round(maxstamina || 0)),
    staminaCurrent: Math.max(0, Math.round(currentstamina || 0)),
    // Legacy compatibility: existing systems treat stamina as max pool.
    stamina: Math.max(0, Math.round(maxstamina || 0)),
    currentstamina: Math.max(0, Math.round(currentstamina || 0)),
  };
}

export function normalizestaminaState(entity = {}, options = {}) {
  const profile = computestaminaForEntity(entity, {
    preserveExplicitstaminaAsAuthority: true,
    ...options,
  });
  return {
    ...entity,
    ...profile,
  };
}

export function migrateEntitystaminaState(entity = {}, options = {}) {
  return normalizestaminaState(entity, {
    rollMissingLevelGains: true,
    preserveExplicitstamina: true,
    preserveExplicitstaminaAsAuthority: true,
    ...options,
  });
}

export function migratestaminaStateForCollection(entities = [], options = {}) {
  if (!Array.isArray(entities)) return [];
  return entities.map((entity) =>
    migrateEntitystaminaState(entity, {
      rng: createDeterministicRng(
        [entity?.id, entity?.name, entity?.profession || entity?.class || "entity"].join(
          "|"
        )
      ),
      ...options,
    })
  );
}

export function getEffectivestamina(entity = {}, options = {}) {
  const { onLeyLine = false, onNexus = false, temporaryBonus = 0 } = options;
  const current = firstFinite(
    entity?.staminaCurrent,
    entity?.currentstamina,
    entity?.stamina,
    entity?.maxstamina,
    0
  ) || 0;
  const multiplier = onNexus ? 3 : onLeyLine ? 2 : 1;
  return Math.max(0, Math.round(current * multiplier + (temporaryBonus || 0)));
}

export function normalizeTechniqueName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/['']/g, "'")
    .trim();
}

export function isDuelistClassName(className) {
  const text = String(className || "").toLowerCase();
  return text.includes("duelist");
}

export function getDuelistTechniqueProgression(level) {
  const lvl = Math.max(1, Math.floor(Number(level) || 1));
  const maxTechniqueLevel = Math.min(DUELIST_MAX_TECHNIQUE_LEVEL, lvl);
  const totalKnownTechniques =
    DUELIST_BASE_KNOWN_AT_LEVEL_1 +
    Math.max(0, (lvl - 1) * DUELIST_ADDITIONAL_TECHNIQUES_PER_LEVEL);
  const requiredPickCount = Math.max(
    0,
    totalKnownTechniques - DUELIST_COMMON_TECHNIQUE_NAMES.length
  );

  return {
    level: lvl,
    maxTechniqueLevel,
    totalKnownTechniques,
    requiredPickCount,
  };
}

export function getDuelistEligibleTechniques(allTechniques, level) {
  const { maxTechniqueLevel } = getDuelistTechniqueProgression(level);
  const list = Array.isArray(allTechniques) ? allTechniques : [];

  return list
    .filter((sp) => sp && sp.name)
    .filter((sp) => {
      const techniqueLevel = Math.max(1, Math.floor(Number(sp.level) || 1));
      if (techniqueLevel > maxTechniqueLevel) return false;

      // If class metadata exists, enfraidere duelist-only for duelist techniqueBooks.
      if (sp.class != null && String(sp.class).trim() !== "") {
        return String(sp.class).toLowerCase() === "duelist";
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

export function buildDuelistTechniqueBookForLevel({
  allTechniques,
  level,
  pickedTechniqueNames = [],
}) {
  const progression = getDuelistTechniqueProgression(level);
  const eligible = getDuelistEligibleTechniques(allTechniques, progression.level);

  const byName = new Map();
  for (const sp of eligible) {
    byName.set(normalizeTechniqueName(sp.name), sp);
  }

  const lockedCommon = DUELIST_COMMON_TECHNIQUE_NAMES.map((name) =>
    byName.get(normalizeTechniqueName(name))
  ).filter(Boolean);

  const castaminadPickCount = Math.max(
    0,
    progression.totalKnownTechniques - lockedCommon.length
  );

  const picked = [];
  const pickedSeen = new Set();
  for (const name of pickedTechniqueNames || []) {
    const key = normalizeTechniqueName(name);
    if (!key || pickedSeen.has(key)) continue;
    if (
      lockedCommon.some((sp) => normalizeTechniqueName(sp.name) === key) ||
      !byName.has(key)
    ) {
      continue;
    }
    pickedSeen.add(key);
    picked.push(byName.get(key));
    if (picked.length >= castaminadPickCount) break;
  }

  const fallback = [];
  if (picked.length < castaminadPickCount) {
    for (const sp of eligible) {
      const key = normalizeTechniqueName(sp.name);
      const isCommon = lockedCommon.some(
        (common) => normalizeTechniqueName(common.name) === key
      );
      if (isCommon || pickedSeen.has(key)) continue;
      pickedSeen.add(key);
      fallback.push(sp);
      if (picked.length + fallback.length >= castaminadPickCount) break;
    }
  }

  const finalTechniqueBook = [...lockedCommon, ...picked, ...fallback];

  return {
    ...progression,
    lockedCommon,
    eligible,
    techniqueBook: finalTechniqueBook,
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
  if (range.includes("shuman")) return 0;
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

export function getTechniqueCost(technique) {
  if (!technique) return 0;
  const candidates = [
    technique.cost,
    technique.stamina,
    technique.stamina,
    technique.staminaCost,
    technique.staminaCOST,
    technique.ppCost,
    technique.focusCost,
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

export function getTacticalCost(power) {
  if (!power) return 0;
  const candidates = [power.focus, power.cost, power.focus];
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
    /(\d+)\s*(hp|hit points|points|s\.?d\.?c\.?|armorDurability)/i
  );
  if (flatMatch) {
    return { type: "flat", amount: parseInt(flatMatch[1], 10) };
  }

  return null;
}

export function getTechniqueHealingFormula(technique) {
  if (!technique) return null;

  if (typeof technique.healingAmount === "number") {
    return { type: "flat", amount: technique.healingAmount };
  }

  if (typeof technique.healing === "number") {
    return { type: "flat", amount: technique.healing };
  }

  const healingFields = [
    technique.healing,
    technique.effect,
    technique.damage,
    technique.description,
    technique.notes,
  ];

  for (const field of healingFields) {
    const formula = extractHealingFormulaFromText(field);
    if (formula) return formula;
  }

  return null;
}

export function hasTechniqueDamage(technique) {
  if (!technique) return false;

  const damageCandidates = [
    technique.combatDamage,
    technique.damage,
    technique.effect,
    technique.description,
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

export function getTechniqueRangeInFeet(technique) {
  if (!technique) return Infinity;
  return parseRangeToFeet(technique.range);
}

export function isHealingTechnique(technique) {
  if (!technique) return false;
  if (
    typeof technique.damageType === "string" &&
    technique.damageType.toLowerCase().includes("healing")
  ) {
    return true;
  }
  if (
    typeof technique.category === "string" &&
    technique.category.toLowerCase().includes("healing")
  ) {
    return true;
  }
  return Boolean(getTechniqueHealingFormula(technique));
}

export function isOffensiveTechnique(technique) {
  return !isHealingTechnique(technique) && hasTechniqueDamage(technique);
}

export function isSupportTechnique(technique) {
  if (!technique) return false;
  if (isHealingTechnique(technique)) return true;
  if (hasTechniqueDamage(technique)) return false;

  const name = (technique.name || "").toLowerCase();
  const description = (technique.description || technique.effect || "").toLowerCase();
  const range = (technique.range || "").toLowerCase();

  if (
    HARMFUL_KEYWORDS.some(
      (keyword) => name.includes(keyword) || description.includes(keyword)
    )
  ) {
    return false;
  }

  if (range.includes("shuman")) return true;
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

export function doesTechniqueRequireTarget(technique) {
  if (!technique) return false;
  if (hasTechniqueDamage(technique)) return true;
  const range = (technique.range || "").toLowerCase();
  if (!range) return false;
  if (
    range.includes("shuman") &&
    !TOUCH_RANGE_HINTS.some((hint) => range.includes(hint))
  ) {
    return false;
  }
  if (TOUCH_RANGE_HINTS.some((hint) => range.includes(hint))) return true;
  if (/\d/.test(range) || range.includes("line") || range.includes("area"))
    return true;
  return false;
}

export function techniqueCanAffectTarget(technique, caster, target) {
  if (!technique) return false;
  if (!target) return !doesTechniqueRequireTarget(technique);
  if (!caster) return false;
  if (target.id === caster.id) return true;

  const range = (technique.range || "").toLowerCase();
  if (!range) return true;

  if (SHUMAN_ONLY_HINTS.some((hint) => range.includes(hint))) return false;
  if (
    range.includes("shuman") &&
    !TOUCH_RANGE_HINTS.some((hint) => range.includes(hint))
  ) {
    return false;
  }

  const isFriendlyTarget = caster.type === target.type;
  if (!isFriendlyTarget) {
    if (isHealingTechnique(technique)) return false;
    if (isSupportTechnique(technique)) return false;
  }

  return true;
}

/**
 * Check if a technique is supported in combat (has implemented handlers)
 * Supported right now if it deals damage, heals, or is a "support" buff.
 * Later you'll expand this with real effect handlers (summon, wards, teleport, etc.)
 * @param {Object} technique - Technique object
 * @returns {boolean} True if technique is combat-supported
 */
export function isCombatSupportedTechnique(technique) {
  return hasTechniqueDamage(technique) || isHealingTechnique(technique) || isSupportTechnique(technique);
}

// Alias for backward compatibility
export const techniqueRequiresTarget = doesTechniqueRequireTarget;

