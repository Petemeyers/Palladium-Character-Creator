import { clearStoredAuthState, getStoredAuthToken } from "./authStorage.js";

export const CHARACTER_LIST_LOGIN_MESSAGE = "Please log in to view saved characters.";
export const CHARACTER_LIST_EXPIRED_MESSAGE = "Your login expired. Please log in again to view saved characters.";

const isUnauthorizedError = (error) => (
  Number(error?.status ?? error?.response?.status) === 401
);

export async function loadSavedCharacters({
  request,
  storage = globalThis.localStorage,
} = {}) {
  if (!getStoredAuthToken(storage)) {
    return {
      ok: false,
      skipped: true,
      characters: [],
      message: CHARACTER_LIST_LOGIN_MESSAGE,
    };
  }

  try {
    const response = await request({ suppressAuthPrompt: true });
    const characters = Array.isArray(response?.data)
      ? response.data
      : response?.data?.data || response?.data?.characters || [];
    return { ok: true, skipped: false, characters, message: "" };
  } catch (error) {
    if (isUnauthorizedError(error)) {
      clearStoredAuthState(storage);
      return {
        ok: false,
        skipped: false,
        characters: [],
        message: CHARACTER_LIST_EXPIRED_MESSAGE,
      };
    }
    return {
      ok: false,
      skipped: false,
      characters: [],
      message: "Saved characters could not be loaded.",
    };
  }
}

export default loadSavedCharacters;
