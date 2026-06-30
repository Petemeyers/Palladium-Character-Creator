import {
  awardOriginalTrait,
  getOriginalTraitDefinition,
  hasOriginalTrait,
} from "./originalActorTraits.js";

const normalizeId = (value) => (
  typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : ""
);

const getActorId = (actor) => normalizeId(
  actor?.id || actor?._id || actor?.fighterId || actor?.characterId
);

const getProposalKey = (proposal) => (
  `${normalizeId(proposal?.actorId)}:${normalizeId(proposal?.traitId).toLowerCase()}`
);

export function createOriginalTraitAwardProposalState(proposals = []) {
  if (!Array.isArray(proposals)) return [];
  return proposals
    .filter((proposal) => proposal && typeof proposal === "object")
    .map((proposal) => ({ ...proposal, status: "pending" }));
}

export function applyOriginalTraitAwardProposalToCombatants(
  combatants = [],
  proposal = {},
  options = {}
) {
  const currentCombatants = Array.isArray(combatants) ? combatants : [];
  const actorId = normalizeId(proposal?.actorId);
  const traitId = normalizeId(proposal?.traitId).toLowerCase();
  const actorIndex = currentCombatants.findIndex((actor) => getActorId(actor) === actorId);

  if (!actorId || actorIndex < 0) {
    return {
      combatants: currentCombatants,
      applied: false,
      alreadyApplied: false,
      status: "actor_not_found",
      reason: "Current combatant was not found.",
    };
  }

  if (!getOriginalTraitDefinition(traitId)) {
    return {
      combatants: currentCombatants,
      applied: false,
      alreadyApplied: false,
      status: "invalid_trait",
      reason: "Proposed trait is not recognized.",
    };
  }

  const actor = currentCombatants[actorIndex];
  if (hasOriginalTrait(actor, traitId)) {
    return {
      combatants: currentCombatants,
      applied: false,
      alreadyApplied: true,
      status: "already_applied",
      reason: "Trait is already applied to the current combatant.",
    };
  }

  const nextActor = awardOriginalTrait(actor, traitId, options);
  const nextCombatants = currentCombatants.map((combatant, index) => (
    index === actorIndex ? nextActor : combatant
  ));

  return {
    combatants: nextCombatants,
    applied: true,
    alreadyApplied: false,
    status: "applied",
    reason: "Trait applied to current combatant only.",
  };
}

export function markOriginalTraitAwardProposalApplied(
  proposals = [],
  proposal = {},
  result = {},
  options = {}
) {
  if (!Array.isArray(proposals)) return [];
  const targetKey = getProposalKey(proposal);
  if (targetKey === ":") return proposals.map((entry) => ({ ...entry }));
  const now = typeof options.now === "function" ? options.now : Date.now;
  const status = normalizeId(result?.status).toLowerCase() || "pending";
  const shouldTimestamp = ["applied", "already_applied"].includes(status);

  return proposals.map((entry) => {
    if (getProposalKey(entry) !== targetKey) return entry;
    return {
      ...entry,
      status,
      ...(shouldTimestamp ? { appliedAt: Number(now()) } : {}),
      ...(result?.reason ? { applicationMessage: String(result.reason) } : {}),
    };
  });
}

export function applyAllOriginalTraitAwardProposalsToCombatants(
  combatants = [],
  proposals = [],
  options = {}
) {
  let nextCombatants = Array.isArray(combatants) ? combatants : [];
  let nextProposals = Array.isArray(proposals)
    ? proposals.map((proposal) => ({ ...proposal }))
    : [];
  const results = [];

  nextProposals
    .filter((proposal) => proposal?.status === "pending")
    .forEach((proposal) => {
      const result = applyOriginalTraitAwardProposalToCombatants(
        nextCombatants,
        proposal,
        { ...options, source: proposal?.source || options.source }
      );
      nextCombatants = result.combatants;
      nextProposals = markOriginalTraitAwardProposalApplied(
        nextProposals,
        proposal,
        result,
        options
      );
      results.push({
        actorId: normalizeId(proposal.actorId),
        traitId: normalizeId(proposal.traitId).toLowerCase(),
        status: result.status,
      });
    });

  return {
    combatants: nextCombatants,
    proposals: nextProposals,
    results,
  };
}

export default applyOriginalTraitAwardProposalToCombatants;
