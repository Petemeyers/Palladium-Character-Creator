const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const lerp = (a, b, t) => a + (b - a) * t;

const BASE_VALUES = {
  shoulderWidth: 0.3685185185185185,
  armThickness: 0.3574074074074074,
  chestDepth: 0.36851851851851847,
  legThickness: 0.3425925925925926,
  waistTightness: 0.575925925925926,
  leanness: 0.35888888888888887,
  postureBalance: 0.41851851851851857,
  facialSymmetry: 0.39444444444444443,
  browHarshness: 0.6333333333333333,
  cheekFullness: 0.29074074074074074,
  eyeWarmth: 0.3314814814814815,
  gazeStability: 0.39444444444444443,
  weathering: 0.2111111111111111,
};

const ARM_TIER_TABLE = [
  { min: 3, max: 4, tier: 1, label: "very thin" },
  { min: 5, max: 6, tier: 2, label: "slim" },
  { min: 7, max: 8, tier: 3, label: "lean" },
  { min: 9, max: 10, tier: 4, label: "fit" },
  { min: 11, max: 12, tier: 5, label: "average" },
  { min: 13, max: 14, tier: 6, label: "athletic" },
  { min: 15, max: 16, tier: 7, label: "strong" },
  { min: 17, max: 20, tier: 8, label: "muscular" },
  { min: 21, max: 25, tier: 9, label: "very muscular" },
  { min: 26, max: 30, tier: 10, label: "massive" },
];

function readStatTotal(stat, fallback = 10) {
  if (typeof stat === "number") return stat;
  if (!stat || typeof stat !== "object") return fallback;

  if (typeof stat.final === "number") return stat.final;
  if (typeof stat.total === "number") return stat.total;
  if (typeof stat.value === "number" && typeof stat.bonus === "number") {
    return stat.value + stat.bonus;
  }
  if (typeof stat.base === "number" && typeof stat.bonus === "number") {
    return stat.base + stat.bonus;
  }
  if (typeof stat.value === "number") return stat.value;

  return fallback;
}

export function getHumanArmTierFromPS(psTotal = 10) {
  const ps = clamp(Number(psTotal) || 10, 3, 30);
  return (
    ARM_TIER_TABLE.find((row) => ps >= row.min && ps <= row.max) ||
    ARM_TIER_TABLE[4]
  );
}

export function getHumanArmMorphWeight(psTotal = 10) {
  const { tier } = getHumanArmTierFromPS(psTotal);
  return (tier - 1) / 9;
}

export function buildHumanVisualProfileFromAttributes(stats = {}) {
  const psTotal = clamp(readStatTotal(stats?.PS, 10), 3, 30);
  const armTier = getHumanArmTierFromPS(psTotal);
  const armMorphWeight = getHumanArmMorphWeight(psTotal);

  const values = {
    ...BASE_VALUES,
    shoulderWidth: lerp(0.30, 0.44, armMorphWeight),
    armThickness: lerp(0.22, 0.53, armMorphWeight),
    chestDepth: lerp(0.28, 0.45, armMorphWeight),
  };

  const body =
    armTier.tier <= 3
      ? "lean"
      : armTier.tier <= 6
        ? "average"
        : armTier.tier <= 8
          ? "athletic"
          : "powerful";

  const descriptors =
    body === "average"
      ? ["average", "plain", "steady", "calm"]
      : [armTier.label, "plain", "steady", "calm"];

  return {
    body,
    face: "plain",
    idle: "idle_unsteady",
    descriptors,
    armMorphTier: armTier.tier,
    armMorphLabel: armTier.label,
    armMorphWeight,
    armMorph: {
      stat: "PS",
      psTotal,
      tier: armTier.tier,
      label: armTier.label,
      weight: armMorphWeight,
      target: "arms_bulk",
    },
    morphTargets: {
      arms_bulk: armMorphWeight,
    },
    values,
  };
}

export const buildHumanVisualProfile = buildHumanVisualProfileFromAttributes;
