import { buildOriginalActorMetadata } from "./originalActorMetadata.js";

export const ORIGINAL_ATTRIBUTE_LABELS = [
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
];

const displayValue = (value, fallback = "Not set") => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
};

const displayRecord = (record = {}) => Object.entries(record)
  .map(([key, value]) => `${key}: ${displayValue(value)}`)
  .join(", ") || "None";

const displayList = (items = []) => items
  .map((item) => {
    if (typeof item === "string" || typeof item === "number") return String(item);
    return displayValue(item?.name || item?.id);
  })
  .filter((item) => item !== "Not set")
  .join(", ") || "None";

export function summarizeOriginalActorMetadata(actor = {}) {
  const metadata = actor?.originalActorMetadata || buildOriginalActorMetadata(actor);
  const movement = metadata.movement || {};
  const training = metadata.training || {};
  const state = metadata.state || {};
  const reputation = metadata.reputation || {};
  const favor = metadata.favor || {};
  const behavior = metadata.behavior || {};

  return {
    attributes: ORIGINAL_ATTRIBUTE_LABELS.map(([key, label]) => ({
      key,
      label,
      value: displayValue(metadata.attributes?.[key]),
    })),
    movement: {
      modes: Array.isArray(movement.modes) ? movement.modes.join(", ") || "None" : "None",
      pace: displayValue(movement.pace),
      burst: displayValue(movement.burst),
      recoveryStep: displayValue(movement.recoveryStep),
      pursuit: displayValue(movement.pursuit),
      withdrawal: displayValue(movement.withdrawal),
      turnControl: displayValue(movement.turnControl),
      formationPace: displayValue(movement.formationPace),
      terrainMobility: displayRecord(movement.terrainMobility),
    },
    training: {
      weapons: displayRecord(training.weapons),
      formationDrill: displayValue(training.formationDrill),
      fieldcraft: displayValue(training.fieldcraft),
      healing: displayValue(training.healing),
      horsemanship: displayValue(training.horsemanship),
    },
    traits: displayList(metadata.traits),
    state: {
      morale: displayValue(state.morale),
      fatigue: displayValue(state.fatigue),
      fear: displayValue(state.fear),
      wounds: displayList(state.wounds),
      cohesion: displayValue(state.cohesion),
    },
    reputation: {
      local: displayValue(reputation.local),
      regional: displayValue(reputation.regional),
      legendary: displayValue(reputation.legendary),
      faction: displayRecord(reputation.faction),
      titles: displayList(reputation.titles),
      knownDeeds: displayList(reputation.knownDeeds),
    },
    favor: {
      sacred: displayValue(favor.sacred),
      royal: displayValue(favor.royal),
      folk: displayValue(favor.folk),
      ancestral: displayValue(favor.ancestral),
      cursed: displayValue(favor.cursed),
      faction: displayRecord(favor.faction),
    },
    behavior: {
      instinct: displayValue(behavior.instinct),
      aggression: displayValue(behavior.aggression),
      caution: displayValue(behavior.caution),
      loyalty: displayValue(behavior.loyalty),
    },
  };
}

export default summarizeOriginalActorMetadata;
