export const AUTH_TOKEN_KEY = "token";
export const AUTH_STATE_CHANGED_EVENT = "auth-state-changed";

const AUTH_STATE_KEYS = Object.freeze([
  AUTH_TOKEN_KEY,
  "user",
  "username",
  "role",
  "currentUser",
  "authToken",
]);

const notifyAuthStateChanged = () => {
  if (typeof globalThis.window?.dispatchEvent !== "function") return;
  globalThis.window.dispatchEvent(new Event(AUTH_STATE_CHANGED_EVENT));
};

export function getStoredAuthToken(storage = globalThis.localStorage) {
  if (!storage || typeof storage.getItem !== "function") return "";
  const token = storage.getItem(AUTH_TOKEN_KEY);
  return typeof token === "string" ? token.trim() : "";
}

export function hasStoredAuthToken(storage = globalThis.localStorage) {
  return getStoredAuthToken(storage).length > 0;
}

export function getStoredAuthDisplayName(storage = globalThis.localStorage) {
  if (!hasStoredAuthToken(storage)) return "";
  try {
    const user = JSON.parse(storage.getItem("user") || "null");
    const displayName = user?.username || user?.name || storage.getItem("username");
    return typeof displayName === "string" && displayName.trim()
      ? displayName.trim()
      : "Player";
  } catch (_error) {
    const username = storage.getItem("username");
    return typeof username === "string" && username.trim() ? username.trim() : "Player";
  }
}

export function clearStoredAuthState(storage = globalThis.localStorage) {
  if (storage && typeof storage.removeItem === "function") {
    AUTH_STATE_KEYS.forEach((key) => storage.removeItem(key));
  }
  if (storage === globalThis.localStorage) notifyAuthStateChanged();
}

export function storeAuthSession(token, user, storage = globalThis.localStorage) {
  if (!storage || typeof storage.setItem !== "function") return false;
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!normalizedToken) {
    clearStoredAuthState(storage);
    return false;
  }
  storage.setItem(AUTH_TOKEN_KEY, normalizedToken);
  if (user !== undefined) storage.setItem("user", JSON.stringify(user));
  if (storage === globalThis.localStorage) notifyAuthStateChanged();
  return true;
}
