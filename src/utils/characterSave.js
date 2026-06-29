import { clearStoredAuthState, getStoredAuthToken } from "./authStorage.js";

export const CHARACTER_SAVE_AUTH_MESSAGE = "Please log in before saving a character to your account.";

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

export async function saveCharacterWithAuth({
  character,
  onSave,
  storage = globalThis.localStorage,
} = {}) {
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
    const savedCharacter = await onSave(character, { suppressAuthPrompt: true });
    return {
      saved: true,
      authRequired: false,
      character: savedCharacter || character,
      message: "Character saved.",
    };
  } catch (error) {
    if (isCharacterSaveAuthenticationError(error)) {
      clearStoredAuthState(storage);
      return {
        saved: false,
        authRequired: true,
        character,
        message: CHARACTER_SAVE_AUTH_MESSAGE,
      };
    }
    throw error;
  }
}
