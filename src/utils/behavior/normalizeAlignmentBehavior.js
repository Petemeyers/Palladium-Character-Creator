const clean = (value) => String(value || "").trim().toLowerCase().replaceAll("_", "-");

const profile = (alignmentName, lawChaosAxis, goodEvilAxis, dimensions, surrenderWeights) => ({
  alignmentName,
  lawChaosAxis,
  goodEvilAxis,
  behaviorProfile: clean(alignmentName).replaceAll(" ", "-"),
  dimensions,
  surrenderWeights,
});

const PROFILES = Object.freeze({
  "lawful-good": profile("Lawful Good", "lawful", "good", { honor: 92, mercy: 88, discipline: 90, greed: 12, cruelty: 4, pride: 50, respectForAuthority: 92, respectForFreedom: 58, selfInterest: 18 }, { accept: 94, prisoner: 86, ransom: 38, confiscate: 18, release: 58, yield: 72, refuse: 8, execute: 2 }),
  "neutral-good": profile("Neutral Good", "neutral", "good", { honor: 80, mercy: 94, discipline: 68, greed: 18, cruelty: 4, pride: 42, respectForAuthority: 58, respectForFreedom: 72, selfInterest: 16 }, { accept: 96, prisoner: 78, ransom: 35, confiscate: 14, release: 76, yield: 84, refuse: 6, execute: 2 }),
  "chaotic-good": profile("Chaotic Good", "chaotic", "good", { honor: 72, mercy: 88, discipline: 42, greed: 20, cruelty: 6, pride: 50, respectForAuthority: 22, respectForFreedom: 96, selfInterest: 22 }, { accept: 90, prisoner: 52, ransom: 26, confiscate: 12, release: 90, yield: 88, refuse: 10, execute: 3 }),
  "lawful-neutral": profile("Lawful Neutral", "lawful", "neutral", { honor: 76, mercy: 50, discipline: 94, greed: 30, cruelty: 24, pride: 52, respectForAuthority: 96, respectForFreedom: 30, selfInterest: 38 }, { accept: 70, prisoner: 84, ransom: 52, confiscate: 50, release: 34, yield: 42, refuse: 30, execute: 16 }),
  "true-neutral": profile("True Neutral", "neutral", "neutral", { honor: 50, mercy: 52, discipline: 52, greed: 48, cruelty: 24, pride: 46, respectForAuthority: 50, respectForFreedom: 50, selfInterest: 52 }, { accept: 58, prisoner: 56, ransom: 58, confiscate: 48, release: 44, yield: 48, refuse: 42, execute: 12 }),
  "chaotic-neutral": profile("Chaotic Neutral", "chaotic", "neutral", { honor: 36, mercy: 44, discipline: 28, greed: 58, cruelty: 30, pride: 60, respectForAuthority: 16, respectForFreedom: 90, selfInterest: 70 }, { accept: 48, prisoner: 36, ransom: 66, confiscate: 54, release: 58, yield: 52, refuse: 52, execute: 18 }),
  "lawful-evil": profile("Lawful Evil", "lawful", "evil", { honor: 42, mercy: 16, discipline: 86, greed: 52, cruelty: 72, pride: 72, respectForAuthority: 88, respectForFreedom: 18, selfInterest: 76 }, { accept: 42, prisoner: 72, ransom: 64, confiscate: 72, release: 10, yield: 18, refuse: 58, execute: 58 }),
  "neutral-evil": profile("Neutral Evil", "neutral", "evil", { honor: 18, mercy: 14, discipline: 46, greed: 86, cruelty: 72, pride: 64, respectForAuthority: 38, respectForFreedom: 42, selfInterest: 94 }, { accept: 30, prisoner: 48, ransom: 82, confiscate: 88, release: 8, yield: 12, refuse: 70, execute: 64 }),
  "chaotic-evil": profile("Chaotic Evil", "chaotic", "evil", { honor: 6, mercy: 4, discipline: 24, greed: 60, cruelty: 96, pride: 84, respectForAuthority: 6, respectForFreedom: 70, selfInterest: 88 }, { accept: 12, prisoner: 20, ransom: 34, confiscate: 68, release: 3, yield: 4, refuse: 92, execute: 94 }),
});

const LEGACY_ALIASES = Object.freeze({
  principled: "lawful-good", scrupulous: "neutral-good", unprincipled: "true-neutral",
  anarchist: "chaotic-neutral", miscreant: "neutral-evil", aberrant: "lawful-evil", diabolic: "chaotic-evil",
});
const GENERAL_ALIASES = Object.freeze({
  good: "neutral-good", neutral: "true-neutral", selfish: "true-neutral", evil: "neutral-evil",
  "lawful good": "lawful-good", "neutral good": "neutral-good", "chaotic good": "chaotic-good",
  "lawful neutral": "lawful-neutral", "true neutral": "true-neutral", "chaotic neutral": "chaotic-neutral",
  "lawful evil": "lawful-evil", "neutral evil": "neutral-evil", "chaotic evil": "chaotic-evil",
});

function alignmentInput(value) {
  if (!value || typeof value !== "object") return value;
  return value.alignmentKey || value.alignmentName || value.name || value.value || value.alignment;
}

export function getCanonicalAlignmentKey(value) {
  const text = clean(alignmentInput(value));
  if (!text) return null;
  if (PROFILES[text]) return text;
  const embeddedLegacyAlias = Object.keys(LEGACY_ALIASES).find((alias) => new RegExp(`(^|[^a-z])${alias}([^a-z]|$)`).test(text));
  return LEGACY_ALIASES[text] || (embeddedLegacyAlias ? LEGACY_ALIASES[embeddedLegacyAlias] : null) || GENERAL_ALIASES[text] || GENERAL_ALIASES[text.replaceAll("-", " ")] || null;
}

export function getLegacyAlignmentKey(value) {
  return getCanonicalAlignmentKey(value);
}

export function hasAlignmentBehaviorMapping(value) {
  return Boolean(getCanonicalAlignmentKey(value));
}

export function normalizeAlignmentBehavior(value, overrides = {}) {
  const alignmentKey = getCanonicalAlignmentKey(value);
  if (!alignmentKey) return null;
  const base = PROFILES[alignmentKey];
  const sourceObject = value && typeof value === "object" ? value : {};
  const explicitDimensions = { ...(sourceObject.dimensions || {}), ...(sourceObject.behavior || {}) };
  const explicitWeights = { ...(sourceObject.surrenderWeights || {}) };
  const dimensionKeys = Object.keys(base.dimensions);
  const weightKeys = Object.keys(base.surrenderWeights);
  for (const key of dimensionKeys) {
    if (sourceObject[key] !== undefined) explicitDimensions[key] = sourceObject[key];
    if (overrides[key] !== undefined) explicitDimensions[key] = overrides[key];
  }
  for (const key of weightKeys) {
    if (sourceObject[key] !== undefined) explicitWeights[key] = sourceObject[key];
    if (overrides[key] !== undefined) explicitWeights[key] = overrides[key];
  }
  const oldWeightAliases = {
    accept: "acceptsSurrenderWeight", prisoner: "prisonerWeight", ransom: "ransomWeight",
    confiscate: "confiscationWeight", release: "releaseWeight", execute: "executionWeight",
  };
  for (const [key, alias] of Object.entries(oldWeightAliases)) {
    if (sourceObject[alias] !== undefined) explicitWeights[key] = sourceObject[alias];
    if (overrides[alias] !== undefined) explicitWeights[key] = overrides[alias];
  }
  const dimensions = Object.freeze({ ...base.dimensions, ...explicitDimensions });
  const surrenderWeights = Object.freeze({ ...base.surrenderWeights, ...explicitWeights });
  const rawLabel = clean(alignmentInput(value));
  const legacyAlignmentAlias = LEGACY_ALIASES[rawLabel] ? String(alignmentInput(value)) : sourceObject.legacyAlignmentAlias;
  return Object.freeze({
    alignmentKey,
    alignmentName: base.alignmentName,
    alignmentSource: legacyAlignmentAlias ? "legacy-alias" : (sourceObject.alignmentSource || "canonical"),
    ...(legacyAlignmentAlias ? { legacyAlignmentAlias } : {}),
    lawChaosAxis: base.lawChaosAxis,
    goodEvilAxis: base.goodEvilAxis,
    behaviorProfile: base.behaviorProfile,
    dimensions,
    surrenderWeights,
    ...dimensions,
    acceptsSurrenderWeight: surrenderWeights.accept,
    prisonerWeight: surrenderWeights.prisoner,
    ransomWeight: surrenderWeights.ransom,
    confiscationWeight: surrenderWeights.confiscate,
    releaseWeight: surrenderWeights.release,
    executionWeight: surrenderWeights.execute,
  });
}

export function getAlignmentDisplayName(value, fallback = "Unaligned") {
  return normalizeAlignmentBehavior(value)?.alignmentName || fallback;
}

export const ALIGNMENT_BEHAVIOR_PROFILES = PROFILES;
export const LEGACY_ALIGNMENT_ALIASES = LEGACY_ALIASES;
export default normalizeAlignmentBehavior;
