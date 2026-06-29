import { addOriginalActorMetadata } from "./originalActorMetadata.js";

export const ORIGINAL_TRAIT_DEFINITIONS = Object.freeze({
  blooded: {
    id: "blooded",
    name: "Blooded",
    layer: "tempered",
    rank: 1,
    source: "combat",
    description: "Has survived real combat and is less likely to freeze during first shock.",
    effects: { resolveVsFear: 1, moraleShockReduction: 1 },
    drawbacks: {},
  },
  line_holder: {
    id: "line_holder",
    name: "Line Holder",
    layer: "formation",
    rank: 1,
    source: "combat",
    description: "Held formation under pressure when the line might otherwise have broken.",
    effects: { formationResolve: 1, cohesionShockReduction: 1 },
    drawbacks: {},
  },
  rout_survivor: {
    id: "rout_survivor",
    name: "Rout Survivor",
    layer: "tempered",
    rank: 1,
    source: "combat",
    description: "Survived a broken line or rout and learned how to escape collapse.",
    effects: { withdrawalUnderPressure: 1, rallyAfterRout: 1 },
    drawbacks: { surroundedFear: 1 },
  },
  scarred_survivor: {
    id: "scarred_survivor",
    name: "Scarred Survivor",
    layer: "wound",
    rank: 1,
    source: "combat",
    description: "Survived a serious wound and carries its lasting memory.",
    effects: { resolveVsPain: 1, woundShockReduction: 1 },
    drawbacks: {},
  },
  duel_proven: {
    id: "duel_proven",
    name: "Duel Proven",
    layer: "tempered",
    rank: 1,
    source: "combat",
    description: "Prevailed in a direct duel before witnesses or worthy opponents.",
    effects: { duelPresence: 1, renownFromDuels: 1 },
    drawbacks: { attractsChallenges: 1 },
  },
  monster_dread_tested: {
    id: "monster_dread_tested",
    name: "Monster-Dread Tested",
    layer: "mythic",
    rank: 1,
    source: "combat",
    description: "Faced a legendary creature's terror and endured the encounter.",
    effects: { resolveVsMonsterFear: 1, moraleShockReduction: 1 },
    drawbacks: {},
  },
  oath_fast: {
    id: "oath_fast",
    name: "Oath-Fast",
    layer: "quest",
    rank: 1,
    source: "scripted-event",
    description: "Kept a sworn oath despite danger, hardship, or personal cost.",
    effects: { oathResolve: 1, trustedRenown: 1, sacredFavor: 1 },
    drawbacks: { publicExpectation: 1 },
  },
  oathbreaker: {
    id: "oathbreaker",
    name: "Oathbreaker",
    layer: "reputation",
    rank: 1,
    source: "scripted-event",
    description: "Broke a sworn oath and carries the social or sacred consequence.",
    effects: { fearedCunning: 1 },
    drawbacks: { trustPenalty: 1, sacredFavorPenalty: 1 },
  },
  village_defender: {
    id: "village_defender",
    name: "Village Defender",
    layer: "quest",
    rank: 1,
    source: "scripted-event",
    description: "Defended a settlement and became known among its people.",
    effects: { localRenown: 1, folkFavor: 1 },
    drawbacks: {},
  },
});

const normalizeTraitId = (traitId) => String(traitId || "").trim().toLowerCase();

const cloneTrait = (trait) => {
  if (!trait || typeof trait !== "object" || Array.isArray(trait)) return trait;
  return {
    ...trait,
    effects: { ...(trait.effects || {}) },
    drawbacks: { ...(trait.drawbacks || {}) },
  };
};

const getTraitId = (trait) => normalizeTraitId(typeof trait === "string" ? trait : trait?.id);

export function getOriginalTraitDefinition(traitId) {
  const definition = ORIGINAL_TRAIT_DEFINITIONS[normalizeTraitId(traitId)];
  return definition ? cloneTrait(definition) : null;
}

export function getOriginalTraits(actor = {}) {
  const traits = Array.isArray(actor?.originalActorMetadata?.traits)
    ? actor.originalActorMetadata.traits
    : Array.isArray(actor?.traits)
      ? actor.traits
      : [];
  return traits.map(cloneTrait);
}

export function hasOriginalTrait(actor = {}, traitId = "") {
  const targetId = normalizeTraitId(traitId);
  return Boolean(targetId) && getOriginalTraits(actor).some((trait) => getTraitId(trait) === targetId);
}

export function awardOriginalTrait(actor = {}, traitId = "", options = {}) {
  const definition = getOriginalTraitDefinition(traitId);
  if (!definition) {
    throw new RangeError(`Unknown original trait: ${traitId || "(empty)"}`);
  }

  const normalizedActor = addOriginalActorMetadata(actor);
  const currentTraits = getOriginalTraits(normalizedActor);
  const existingIndex = currentTraits.findIndex((trait) => getTraitId(trait) === definition.id);
  const nextTraits = currentTraits.map(cloneTrait);

  if (existingIndex < 0) {
    nextTraits.push({
      ...definition,
      source: options.source || definition.source,
      ...(options.eventId ? { eventId: String(options.eventId) } : {}),
      ...(options.evidence ? { evidence: String(options.evidence) } : {}),
    });
  } else if (options.incrementRank === true) {
    const existing = typeof nextTraits[existingIndex] === "object"
      ? nextTraits[existingIndex]
      : definition;
    const currentRank = Number(existing.rank ?? definition.rank);
    nextTraits[existingIndex] = {
      ...definition,
      ...existing,
      rank: (Number.isFinite(currentRank) ? currentRank : definition.rank) + 1,
      effects: { ...definition.effects, ...(existing.effects || {}) },
      drawbacks: { ...definition.drawbacks, ...(existing.drawbacks || {}) },
    };
  } else if (typeof nextTraits[existingIndex] !== "object") {
    nextTraits[existingIndex] = definition;
  }

  return {
    ...normalizedActor,
    traits: actor?.traits === undefined || Array.isArray(actor?.traits)
      ? nextTraits.map(cloneTrait)
      : actor.traits,
    originalActorMetadata: {
      ...normalizedActor.originalActorMetadata,
      traits: nextTraits.map(cloneTrait),
    },
  };
}

export function awardOriginalTraits(actor = {}, traitIds = [], options = {}) {
  const ids = Array.isArray(traitIds) ? traitIds : [traitIds];
  return ids.reduce(
    (currentActor, traitId) => awardOriginalTrait(currentActor, traitId, options),
    addOriginalActorMetadata(actor),
  );
}

export default ORIGINAL_TRAIT_DEFINITIONS;
