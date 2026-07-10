export const SIMULATOR_ATTRIBUTE_DEFINITIONS = Object.freeze([
  ["might", "Might"],
  ["deftness", "Deftness"],
  ["vigor", "Vigor"],
  ["endurance", "Endurance"],
  ["mobility", "Mobility"],
  ["intellect", "Intellect"],
  ["awareness", "Awareness"],
  ["cunning", "Cunning"],
  ["resolve", "Resolve"],
  ["discipline", "Discipline"],
  ["presence", "Presence"],
  ["renown", "Renown"],
  ["favor", "Favor"],
]);

export const ROLLABLE_SIMULATOR_ATTRIBUTE_KEYS = Object.freeze(
  SIMULATOR_ATTRIBUTE_DEFINITIONS
    .map(([key]) => key)
    .filter((key) => key !== "renown" && key !== "favor"),
);

export const FIXED_SIMULATOR_ATTRIBUTE_DEFAULTS = Object.freeze({
  renown: 0,
  favor: 0,
});

export default {
  SIMULATOR_ATTRIBUTE_DEFINITIONS,
  ROLLABLE_SIMULATOR_ATTRIBUTE_KEYS,
  FIXED_SIMULATOR_ATTRIBUTE_DEFAULTS,
};
