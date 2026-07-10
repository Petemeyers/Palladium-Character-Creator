import { ROLLABLE_SIMULATOR_ATTRIBUTE_KEYS } from "./simulatorAttributes.js";

export const SOURCE_ATTRIBUTE_ABBREVIATIONS = Object.freeze([
  "IQ",
  "ME",
  "MA",
  "PS",
  "PP",
  "PE",
  "PB",
  "PR",
  "PD",
  "Spd",
]);

export const SOURCE_ABBREV_TO_SIMULATOR_ATTRIBUTES = Object.freeze({
  PS: ["might"],
  PP: ["deftness"],
  PE: ["vigor", "endurance"],
  IQ: ["intellect"],
  ME: ["awareness", "cunning", "resolve", "discipline"],
  MA: ["presence"],
  PB: ["presence"],
  PR: ["presence"],
  PD: ["presence"],
  Spd: ["mobility"],
});

export const SIMULATOR_ATTRIBUTE_TO_SOURCE_ABBREV = Object.freeze({
  might: "PS",
  deftness: "PP",
  vigor: "PE",
  endurance: "PE",
  mobility: "Spd",
  intellect: "IQ",
  awareness: "ME",
  cunning: "ME",
  resolve: "ME",
  discipline: "ME",
  presence: "MA",
});

export const DEFAULT_HUMAN_ATTRIBUTE_DICE = Object.freeze({
  IQ: "3d6",
  ME: "3d6",
  MA: "3d6",
  PS: "3d6",
  PP: "3d6",
  PE: "3d6",
  PB: "3d6",
  Spd: "2d6",
});

export const ANIMAL_ATTRIBUTE_DICE = Object.freeze({
  ...DEFAULT_HUMAN_ATTRIBUTE_DICE,
  PS: "5d6",
  PE: "4d6",
});

export const SPECIES_ATTRIBUTE_DICE_PROFILES = Object.freeze({
  HUMAN: DEFAULT_HUMAN_ATTRIBUTE_DICE,
  human: DEFAULT_HUMAN_ATTRIBUTE_DICE,
  ANIMAL: ANIMAL_ATTRIBUTE_DICE,
  animal: ANIMAL_ATTRIBUTE_DICE,
});

const normalizeProfileKey = (value) => String(value || "").trim();

export function resolveSpeciesAttributeDiceProfile({
  species = "",
  publicSpeciesId = "",
  profile = null,
} = {}) {
  if (profile?.attributeDice && typeof profile.attributeDice === "object") {
    return { ...profile.attributeDice };
  }

  const candidates = [
    normalizeProfileKey(publicSpeciesId),
    normalizeProfileKey(species),
    normalizeProfileKey(publicSpeciesId).toUpperCase(),
    normalizeProfileKey(species).toUpperCase(),
    normalizeProfileKey(publicSpeciesId).toLowerCase(),
    normalizeProfileKey(species).toLowerCase(),
  ].filter(Boolean);

  for (const key of candidates) {
    if (SPECIES_ATTRIBUTE_DICE_PROFILES[key]) {
      return { ...SPECIES_ATTRIBUTE_DICE_PROFILES[key] };
    }
  }

  return { ...DEFAULT_HUMAN_ATTRIBUTE_DICE };
}

export function mapSourceAttributeRollsToSimulatorBase(sourceRolls = {}) {
  const base = {};

  SOURCE_ATTRIBUTE_ABBREVIATIONS.forEach((abbrev) => {
    const score = Number(sourceRolls[abbrev]);
    if (!Number.isFinite(score)) return;
    const targets = SOURCE_ABBREV_TO_SIMULATOR_ATTRIBUTES[abbrev] || [];
    targets.forEach((key) => {
      if (!ROLLABLE_SIMULATOR_ATTRIBUTE_KEYS.includes(key)) return;
      if (base[key] === undefined) {
        base[key] = score;
      }
    });
  });

  return base;
}

export default {
  SOURCE_ATTRIBUTE_ABBREVIATIONS,
  SOURCE_ABBREV_TO_SIMULATOR_ATTRIBUTES,
  SIMULATOR_ATTRIBUTE_TO_SOURCE_ABBREV,
  DEFAULT_HUMAN_ATTRIBUTE_DICE,
  ANIMAL_ATTRIBUTE_DICE,
  SPECIES_ATTRIBUTE_DICE_PROFILES,
  resolveSpeciesAttributeDiceProfile,
  mapSourceAttributeRollsToSimulatorBase,
};
