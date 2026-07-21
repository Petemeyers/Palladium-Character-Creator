import { clearStoredAuthState, getStoredAuthToken } from "./authStorage.js";
import { normalizeAlignmentBehavior } from "./behavior/normalizeAlignmentBehavior.js";

export const CHARACTER_SAVE_AUTH_MESSAGE = "Please log in before saving a character to your account.";
export const CHARACTER_SAVE_REAUTH_MESSAGE = "Please log in again before saving this character.";
export const CHARACTER_SAVE_VALIDATION_MESSAGE = "Character could not be saved because required data is missing or invalid.";
export const CHARACTER_SAVE_SERVER_MESSAGE = "Server error while saving character.";
export const CHARACTER_SAVE_NETWORK_MESSAGE = "Could not reach the local backend.";
export const CHARACTER_SAVE_SUCCESS_MESSAGE = "Character saved successfully.";

export function normalizeCharacterSavePayload(character = {}) {
  const safeCharacter = character && typeof character === "object" && !Array.isArray(character)
    ? character
    : {};
  const characterClass = String(safeCharacter.class || safeCharacter.profession || "General").trim() || "General";
  const profession = String(safeCharacter.profession || safeCharacter.class || "General").trim() || "General";
  const numericLevel = Number(safeCharacter.level);
  const numericHP = Number(safeCharacter.hp);
  const alignment = normalizeAlignmentBehavior(safeCharacter.alignment || safeCharacter.alignmentName);
  return {
    ...safeCharacter,
    name: String(safeCharacter.name || "Unnamed Character").trim() || "Unnamed Character",
    species: String(safeCharacter.species || safeCharacter.race || "HUMAN").trim() || "HUMAN",
    class: characterClass,
    profession,
    attributes: safeCharacter.attributes && typeof safeCharacter.attributes === "object" && !Array.isArray(safeCharacter.attributes)
      ? { ...safeCharacter.attributes }
      : {},
    level: Number.isFinite(numericLevel) && numericLevel >= 1 ? numericLevel : 1,
    hp: Number.isFinite(numericHP) && numericHP >= 1 ? numericHP : 10,
    origin: String(safeCharacter.origin || "Unknown"),
    socialBackground: String(safeCharacter.socialBackground || "Unknown"),
    age: safeCharacter.age ?? "Not set",
    disposition: String(safeCharacter.disposition || "Unknown"),
    hostility: String(safeCharacter.hostility || "Unknown"),
    gender: String(safeCharacter.gender || "Unknown"),
    alignment: alignment?.alignmentKey || "true-neutral",
  };
}

export function getCharacterSaveToken(storage = globalThis.localStorage) {
  return getStoredAuthToken(storage);
}

export function isCharacterSaveAuthenticationError(error) {
  const status = Number(error?.status ?? error?.response?.status);
  const message = String(
    error?.response?.data?.message || error?.details?.message || error?.message || ""
  ).toLowerCase();
  return status === 401 || message.includes("no authentication token");
}

export function getCharacterSaveFailure(error) {
  const status = Number(error?.status ?? error?.response?.status);
  if (isCharacterSaveAuthenticationError(error)) {
    return { status, kind: "auth", message: CHARACTER_SAVE_REAUTH_MESSAGE };
  }
  if ([400, 422].includes(status)) {
    return { status, kind: "validation", message: CHARACTER_SAVE_VALIDATION_MESSAGE };
  }
  if (status >= 500) {
    return { status, kind: "server", message: CHARACTER_SAVE_SERVER_MESSAGE };
  }
  if (
    error?.name === "NetworkError" ||
    error?.request ||
    error?.originalError?.request ||
    (!Number.isFinite(status) && /network|failed to fetch|no response/i.test(String(error?.message || "")))
  ) {
    return { status: null, kind: "network", message: CHARACTER_SAVE_NETWORK_MESSAGE };
  }
  return {
    status: Number.isFinite(status) ? status : null,
    kind: "unknown",
    message: String(error?.message || "Character could not be saved."),
  };
}

export async function saveCharacterWithAuth({
  character,
  onSave,
  storage = globalThis.localStorage,
} = {}) {
  const payload = normalizeCharacterSavePayload(character);
  if (!getCharacterSaveToken(storage)) {
    clearStoredAuthState(storage);
    return {
      saved: false,
      authRequired: true,
      character,
      message: CHARACTER_SAVE_AUTH_MESSAGE,
    };
  }

  try {
    const savedCharacter = await onSave(payload, { suppressAuthPrompt: true });
    return {
      saved: true,
      authRequired: false,
      character: savedCharacter || payload,
      message: CHARACTER_SAVE_SUCCESS_MESSAGE,
    };
  } catch (error) {
    const failure = getCharacterSaveFailure(error);
    if (failure.kind === "auth") {
      clearStoredAuthState(storage);
    }
    return {
      saved: false,
      authRequired: failure.kind === "auth",
      character: payload,
      message: failure.message,
      errorKind: failure.kind,
      status: failure.status,
    };
  }
}
