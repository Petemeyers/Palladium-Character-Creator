const clean = (value) => String(value || "").trim().toLowerCase();

const PROFILES = Object.freeze({
  principled: { behaviorProfile: "lawful-merciful", honor: 90, mercy: 90, discipline: 85, greed: 15, cruelty: 5, pride: 55, acceptsSurrenderWeight: 90, prisonerWeight: 80, ransomWeight: 35, releaseWeight: 55, confiscationWeight: 20, executionWeight: 3 },
  scrupulous: { behaviorProfile: "honorable-merciful", honor: 80, mercy: 82, discipline: 72, greed: 22, cruelty: 8, pride: 48, acceptsSurrenderWeight: 86, prisonerWeight: 76, ransomWeight: 48, releaseWeight: 52, confiscationWeight: 24, executionWeight: 5 },
  unprincipled: { behaviorProfile: "pragmatic-self-interested", honor: 45, mercy: 48, discipline: 48, greed: 62, cruelty: 28, pride: 48, acceptsSurrenderWeight: 58, prisonerWeight: 56, ransomWeight: 72, releaseWeight: 30, confiscationWeight: 62, executionWeight: 20 },
  anarchist: { behaviorProfile: "independent-opportunist", honor: 35, mercy: 42, discipline: 28, greed: 58, cruelty: 34, pride: 60, acceptsSurrenderWeight: 48, prisonerWeight: 42, ransomWeight: 62, releaseWeight: 35, confiscationWeight: 55, executionWeight: 28 },
  miscreant: { behaviorProfile: "self-serving-cruel", honor: 18, mercy: 20, discipline: 38, greed: 74, cruelty: 70, pride: 62, acceptsSurrenderWeight: 30, prisonerWeight: 42, ransomWeight: 68, releaseWeight: 10, confiscationWeight: 78, executionWeight: 62 },
  aberrant: { behaviorProfile: "ordered-ruthless", honor: 38, mercy: 16, discipline: 72, greed: 46, cruelty: 76, pride: 72, acceptsSurrenderWeight: 32, prisonerWeight: 54, ransomWeight: 42, releaseWeight: 8, confiscationWeight: 58, executionWeight: 72 },
  diabolic: { behaviorProfile: "destructive-cruel", honor: 5, mercy: 4, discipline: 30, greed: 52, cruelty: 95, pride: 84, acceptsSurrenderWeight: 10, prisonerWeight: 18, ransomWeight: 28, releaseWeight: 2, confiscationWeight: 66, executionWeight: 94 },
  lawful_good: { aliasOf: "principled" },
  neutral_good: { aliasOf: "scrupulous" },
  chaotic_good: { aliasOf: "scrupulous" },
  lawful_neutral: { aliasOf: "unprincipled" },
  true_neutral: { aliasOf: "unprincipled" },
  chaotic_neutral: { aliasOf: "anarchist" },
  lawful_evil: { aliasOf: "aberrant" },
  neutral_evil: { aliasOf: "miscreant" },
  chaotic_evil: { aliasOf: "diabolic" },
});

const ALIASES = Object.freeze({
  good: "scrupulous", selfish: "unprincipled", neutral: "unprincipled", evil: "miscreant",
  "lawful good": "lawful_good", "neutral good": "neutral_good", "chaotic good": "chaotic_good",
  "lawful neutral": "lawful_neutral", "true neutral": "true_neutral", "chaotic neutral": "chaotic_neutral",
  "lawful evil": "lawful_evil", "neutral evil": "neutral_evil", "chaotic evil": "chaotic_evil",
});

export function getLegacyAlignmentKey(value) {
  const text = clean(typeof value === "object" ? value?.name || value?.value || value?.alignment : value);
  if (!text) return null;
  const direct = Object.keys(PROFILES).find((key) => text === key || text.includes(key.replaceAll("_", " ")));
  return ALIASES[text] || direct || null;
}

export function hasAlignmentBehaviorMapping(value) {
  return Boolean(getLegacyAlignmentKey(value));
}

export function normalizeAlignmentBehavior(value, overrides = {}) {
  const requestedKey = getLegacyAlignmentKey(value);
  if (!requestedKey) return null;
  const requested = PROFILES[requestedKey];
  const alignmentKey = requested?.aliasOf || requestedKey;
  const profile = PROFILES[alignmentKey];
  return Object.freeze({ alignmentKey, ...profile, ...overrides });
}

export const ALIGNMENT_BEHAVIOR_PROFILES = PROFILES;
export default normalizeAlignmentBehavior;
