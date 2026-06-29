const normalizeText = (value) => (
  typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : ""
);

const getProposalKey = (proposal = {}) => (
  `${normalizeText(proposal.actorId)}:${normalizeText(proposal.traitId).toLowerCase()}`
);

const isSavedCharacterBacked = (actor = {}) => {
  const source = normalizeText(actor.source).toLowerCase();
  const displaySource = normalizeText(actor.publicDisplaySource).toLowerCase();
  return source === "saved-character" || displaySource === "saved-character";
};

const hasAuthenticatedState = (authState) => {
  if (authState === true) return true;
  if (typeof authState === "string") return authState.trim().length > 0;
  return Boolean(authState?.authenticated || normalizeText(authState?.token));
};

export function getSavedCharacterIdForAwardProposal(actor = {}, proposal = {}) {
  if (!isSavedCharacterBacked(actor)) return "";
  if (!normalizeText(proposal.actorId) || !normalizeText(proposal.traitId)) return "";
  return normalizeText(
    actor.savedCharacterId || actor.sourceCharacterId || actor.characterId
  );
}

export function isAwardProposalSaveEligible(actor = {}, proposal = {}, authState = false) {
  const status = normalizeText(proposal.status).toLowerCase();
  return (
    ["applied", "already_applied"].includes(status) &&
    hasAuthenticatedState(authState) &&
    Boolean(getSavedCharacterIdForAwardProposal(actor, proposal))
  );
}

export function buildSavedTraitAwardPayload(actor = {}, proposal = {}, options = {}) {
  const savedCharacterId = getSavedCharacterIdForAwardProposal(actor, proposal);
  const traitId = normalizeText(proposal.traitId).toLowerCase();
  if (!savedCharacterId || !traitId) return null;

  const nowValue = typeof options.now === "function" ? options.now() : options.now ?? Date.now();
  const awardedAt = new Date(nowValue);
  const encounterId = normalizeText(options.encounterId || proposal.encounterId);

  return {
    traitId,
    source: normalizeText(proposal.source) || "combat",
    reason: normalizeText(proposal.reason),
    ...(encounterId ? { encounterId } : {}),
    awardedAt: Number.isNaN(awardedAt.getTime())
      ? new Date().toISOString()
      : awardedAt.toISOString(),
  };
}

const updateProposal = (proposals, proposal, update) => {
  if (!Array.isArray(proposals)) return [];
  const targetKey = getProposalKey(proposal);
  return proposals.map((entry) => (
    getProposalKey(entry) === targetKey ? { ...entry, ...update } : entry
  ));
};

export function markAwardProposalSaving(proposals = [], proposal = {}) {
  return updateProposal(proposals, proposal, {
    saveStatus: "saving",
    saveMessage: "Saving award to character...",
  });
}

export function markAwardProposalSaved(proposals = [], proposal = {}, result = {}, options = {}) {
  const nowValue = typeof options.now === "function" ? options.now() : options.now ?? Date.now();
  return updateProposal(proposals, proposal, {
    saveStatus: "saved",
    savedAt: Number(nowValue),
    savedCharacterId: normalizeText(result.savedCharacterId || result.character?._id),
    saveMessage: "Saved to character",
  });
}

export function getAwardProposalSaveErrorMessage(error = {}) {
  const status = Number(error?.status ?? error?.response?.status);
  if (status === 401) return "Please log in again before saving this award.";
  if (status === 403) return "This saved character does not belong to the current user.";
  if (status === 404) return "Saved character record could not be found.";
  if (status === 422) return "This award could not be saved because the trait data is invalid.";
  if (!status || error?.name === "NetworkError") {
    return "Could not reach the local backend. The award remains applied for this session only.";
  }
  return "The award could not be saved. It remains applied for this session only.";
}

export function markAwardProposalSaveFailed(proposals = [], proposal = {}, error = {}) {
  return updateProposal(proposals, proposal, {
    saveStatus: "save_failed",
    saveMessage: getAwardProposalSaveErrorMessage(error),
  });
}

export default {
  buildSavedTraitAwardPayload,
  getAwardProposalSaveErrorMessage,
  getSavedCharacterIdForAwardProposal,
  isAwardProposalSaveEligible,
  markAwardProposalSaveFailed,
  markAwardProposalSaved,
  markAwardProposalSaving,
};
