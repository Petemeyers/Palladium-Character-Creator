import {
  awardOriginalTrait,
  getOriginalTraitDefinition,
  hasOriginalTrait,
} from "../../src/utils/originalActorTraits.js";

const cleanText = (value) => (
  typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : ""
);

export function normalizeSavedTraitAwardPayload(payload = {}, options = {}) {
  const traitId = cleanText(payload.traitId).toLowerCase();
  if (!traitId || !getOriginalTraitDefinition(traitId)) return null;

  const nowValue = typeof options.now === "function" ? options.now() : options.now ?? Date.now();
  const requestedDate = payload.awardedAt ? new Date(payload.awardedAt) : new Date(nowValue);
  if (Number.isNaN(requestedDate.getTime())) return null;

  return {
    traitId,
    source: cleanText(payload.source) || "combat",
    reason: cleanText(payload.reason),
    encounterId: cleanText(payload.encounterId),
    awardedAt: requestedDate.toISOString(),
  };
}

export function addSavedOriginalTraitAward(character = {}, payload = {}, options = {}) {
  const normalizedPayload = normalizeSavedTraitAwardPayload(payload, options);
  if (!normalizedPayload) {
    return { ok: false, reason: "invalid_trait_payload", character };
  }

  const alreadyApplied = hasOriginalTrait(character, normalizedPayload.traitId);
  const awardedCharacter = awardOriginalTrait(character, normalizedPayload.traitId, {
    source: normalizedPayload.source,
  });

  if (alreadyApplied) {
    return {
      ok: true,
      added: false,
      character: awardedCharacter,
      trait: awardedCharacter.originalActorMetadata.traits.find(
        (trait) => trait?.id === normalizedPayload.traitId
      ),
    };
  }

  const traits = awardedCharacter.originalActorMetadata.traits.map((trait) => (
    trait?.id === normalizedPayload.traitId
      ? {
        ...trait,
        awardedAt: normalizedPayload.awardedAt,
        ...(normalizedPayload.reason ? { reason: normalizedPayload.reason } : {}),
        ...(normalizedPayload.encounterId ? { encounterId: normalizedPayload.encounterId } : {}),
      }
      : trait
  ));

  return {
    ok: true,
    added: true,
    character: {
      ...awardedCharacter,
      originalActorMetadata: {
        ...awardedCharacter.originalActorMetadata,
        traits,
      },
    },
    trait: traits.find((trait) => trait?.id === normalizedPayload.traitId),
  };
}

export function isSavedCharacterOwnedByUser(character = {}, userId = "") {
  const ownerId = cleanText(character?.user?._id || character?.user);
  return Boolean(ownerId && cleanText(userId) && ownerId === cleanText(userId));
}

export default addSavedOriginalTraitAward;
