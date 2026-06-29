import {
  getOriginalTraitDefinition,
  hasOriginalTrait,
} from "./originalActorTraits.js";

const EVENT_TRAIT_MAP = Object.freeze({
  actor_survived_combat: "blooded",
  line_held: "line_holder",
  formation_held: "line_holder",
  rout_survived: "rout_survivor",
  serious_wound_survived: "scarred_survivor",
  duel_won: "duel_proven",
  duel_victory: "duel_proven",
  monster_dread_survived: "monster_dread_tested",
  monster_fear_survived: "monster_dread_tested",
  oath_kept: "oath_fast",
  oath_broken: "oathbreaker",
  village_defended: "village_defender",
});

const normalizeText = (value) => String(value || "").trim().toLowerCase();
const normalizeDisplayText = (value, fallback) => {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const text = String(value).trim();
  return text || fallback;
};
const normalizeEventType = (value) => normalizeText(value).replace(/[\s-]+/g, "_");

const getActorId = (actor) => String(
  actor?.id || actor?._id || actor?.fighterId || actor?.characterId || ""
).trim();

const getActorName = (actor) => String(actor?.name || actor?.displayName || "Unnamed actor");

const getEventActorId = (event) => String(
  event?.actorId ||
  event?.combatantId ||
  event?.fighterId ||
  event?.subjectId ||
  event?.winnerId ||
  ""
).trim();

const getEventType = (event) => normalizeEventType(
  event?.type || event?.eventType || event?.kind || event?.name
);

const getWounds = (actor) => {
  const wounds = actor?.originalActorMetadata?.state?.wounds ?? actor?.state?.wounds ?? actor?.wounds;
  return Array.isArray(wounds) ? wounds : [];
};

const isDead = (actor, context = {}) => {
  const status = normalizeText(actor?.status || actor?.condition);
  if (
    actor?.isDead === true ||
    actor?.dead === true ||
    actor?.isKO === true ||
    actor?.isDefeated === true ||
    actor?.defeated === true ||
    ["dead", "defeated"].includes(status)
  ) return true;
  const hp = Number(actor?.currentHP ?? actor?.currentHp ?? actor?.hp ?? actor?.HP);
  const deathThreshold = Number(context.deathThreshold ?? -20);
  return Number.isFinite(hp) && (
    hp <= 0 ||
    (Number.isFinite(deathThreshold) && hp < deathThreshold)
  );
};

const isRouted = (actor) => (
  actor?.routed === true ||
  normalizeText(actor?.status) === "routed" ||
  normalizeText(actor?.moraleState?.status) === "routed"
);

const isEligibleParticipant = (actor, participantIds) => {
  const actorId = getActorId(actor);
  if (!actorId) return false;
  if (participantIds && !participantIds.has(actorId)) return false;
  if (actor?.nonCombatant === true) return false;
  if (["passive"].includes(normalizeText(actor?.controlMode))) return false;
  return true;
};

const getParticipantIds = (context) => {
  const explicitIds = Array.isArray(context?.participantActorIds)
    ? context.participantActorIds.map(String).filter(Boolean)
    : [];
  return explicitIds.length > 0 ? new Set(explicitIds) : null;
};

const normalizeConfidence = (value, fallback = "high") => {
  const confidence = normalizeText(value);
  return ["high", "medium", "low"].includes(confidence) ? confidence : fallback;
};

const buildProposal = (actor, traitId, reason, confidence = "high") => {
  const definition = getOriginalTraitDefinition(traitId);
  if (!definition) return null;
  return {
    actorId: getActorId(actor),
    actorName: getActorName(actor),
    traitId: definition.id,
    traitName: definition.name,
    reason,
    layer: definition.layer,
    source: definition.source,
    confidence: normalizeConfidence(confidence),
  };
};

export function proposeOriginalTraitAwards({
  combatantsBefore = [],
  combatantsAfter = [],
  battleEvents = [],
  context = {},
} = {}) {
  const beforeActors = Array.isArray(combatantsBefore) ? combatantsBefore.filter(Boolean) : [];
  const afterActors = Array.isArray(combatantsAfter) ? combatantsAfter.filter(Boolean) : [];
  const events = Array.isArray(battleEvents) ? battleEvents.filter((event) => event && typeof event === "object") : [];
  const beforeById = new Map(beforeActors.map((actor) => [getActorId(actor), actor]).filter(([id]) => id));
  const afterById = new Map(afterActors.map((actor) => [getActorId(actor), actor]).filter(([id]) => id));
  const participantIds = getParticipantIds(context);
  const proposals = [];
  const proposalKeys = new Set();

  const addProposal = (actor, traitId, reason, confidence) => {
    if (!actor || hasOriginalTrait(actor, traitId)) return;
    const proposal = buildProposal(actor, traitId, reason, confidence);
    if (!proposal?.actorId) return;
    const key = `${proposal.actorId}:${proposal.traitId}`;
    if (proposalKeys.has(key)) return;
    proposalKeys.add(key);
    proposals.push(proposal);
  };

  afterActors.forEach((actor) => {
    if (!isEligibleParticipant(actor, participantIds) || isDead(actor, context)) return;
    const actorId = getActorId(actor);
    const before = beforeById.get(actorId) || {};

    addProposal(
      actor,
      "blooded",
      "Survived combat and did not already have Blooded.",
      "high",
    );

    if (getWounds(actor).length > getWounds(before).length) {
      addProposal(
        actor,
        "scarred_survivor",
        "Survived combat with a new recorded wound.",
        "high",
      );
    }

    if (isRouted(actor)) {
      addProposal(
        actor,
        "rout_survivor",
        "Survived after being routed during the encounter.",
        "medium",
      );
    }
  });

  events.forEach((event) => {
    const actorId = getEventActorId(event);
    const actor = afterById.get(actorId) || beforeById.get(actorId);
    if (!actor || isDead(afterById.get(actorId) || actor, context)) return;
    const explicitTraitId = normalizeText(event.traitId || event.proposedTraitId);
    const traitId = getOriginalTraitDefinition(explicitTraitId)
      ? explicitTraitId
      : EVENT_TRAIT_MAP[getEventType(event)];
    if (!traitId) return;
    const definition = getOriginalTraitDefinition(traitId);
    addProposal(
      actor,
      traitId,
      String(event.reason || `${definition.name} was indicated by the recorded battle event.`),
      normalizeConfidence(event.confidence, "high"),
    );
  });

  return proposals;
}

export function summarizeOriginalTraitAwardProposal(proposal = {}) {
  const actorName = normalizeDisplayText(proposal?.actorName, "Unnamed actor");
  const traitName = normalizeDisplayText(proposal?.traitName, "Unnamed trait");
  return {
    actorId: normalizeDisplayText(proposal?.actorId, ""),
    traitId: normalizeDisplayText(proposal?.traitId, ""),
    actorName,
    traitName,
    headline: `${actorName} may gain ${traitName}`,
    reason: normalizeDisplayText(proposal?.reason, "No proposal reason recorded."),
    layer: normalizeDisplayText(proposal?.layer, ""),
    source: normalizeDisplayText(proposal?.source, ""),
    confidence: normalizeDisplayText(proposal?.confidence, ""),
  };
}

export function summarizeOriginalTraitAwardProposals(proposals = []) {
  if (!Array.isArray(proposals)) return [];
  return proposals
    .filter((proposal) => proposal && typeof proposal === "object")
    .map(summarizeOriginalTraitAwardProposal);
}

export default proposeOriginalTraitAwards;
