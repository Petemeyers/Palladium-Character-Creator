import { buildOriginalAttributes } from "../originalActorMetadata.js";

export const ORIGINAL_ATTRIBUTE_KEYS = Object.freeze([
  "might",
  "deftness",
  "vigor",
  "endurance",
  "mobility",
  "intellect",
  "awareness",
  "cunning",
  "resolve",
  "discipline",
  "presence",
  "renown",
  "favor",
]);

const DEFAULT_ATTRIBUTES = Object.freeze({
  might: 10,
  deftness: 10,
  vigor: 10,
  endurance: 10,
  mobility: 10,
  intellect: 10,
  awareness: 10,
  cunning: 10,
  resolve: 10,
  discipline: 10,
  presence: 10,
  renown: 0,
  favor: 0,
});

const finiteOr = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export function getAttributeMod(score = 10) {
  return Math.floor((finiteOr(score, 10) - 10) / 2);
}

export function getHiddenMoraleMod(value = 2) {
  return finiteOr(value, 2) - 2;
}

export function getActorAttributes(actor = {}) {
  const normalized = buildOriginalAttributes(actor);
  return Object.fromEntries(ORIGINAL_ATTRIBUTE_KEYS.map((key) => [
    key,
    finiteOr(normalized[key], DEFAULT_ATTRIBUTES[key]),
  ]));
}

export function getMoraleProfile(actor = {}) {
  const supplied = actor?.moraleProfile || actor?.behavior?.moraleProfile || {};
  return {
    courageTendency: 2,
    survivalInstinct: 2,
    aggressionUnderFear: 2,
    loyaltyBond: 2,
    commandTrust: 2,
    shamePressure: 2,
    oathPressure: 0,
    woundPanic: 2,
    traumaLoad: 0,
    routSusceptibility: 2,
    temperament: "calm",
    ...supplied,
    fearMemory: { ...(supplied.fearMemory || {}) },
  };
}

const normalizeTraitText = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/[\s-]+/g, "_");

export function hasTrait(actor, traitIdOrName) {
  const wanted = normalizeTraitText(traitIdOrName);
  return (Array.isArray(actor?.traits) ? actor.traits : []).some((trait) => {
    if (typeof trait === "string") return normalizeTraitText(trait) === wanted;
    return normalizeTraitText(trait?.id) === wanted || normalizeTraitText(trait?.name) === wanted;
  });
}
