let offlineWarningShown = false;
let backendOffline = false;

export const OFFLINE_BACKEND_MESSAGE =
  "Local backend is not running. Frontend is using offline mode.";

export function isBackendOfflineError(error) {
  return Boolean(
    error?.name === "NetworkError" ||
      error?.code === "ERR_NETWORK" ||
      error?.message?.toLowerCase?.().includes("network error") ||
      (error?.request && !error?.response)
  );
}

export function markBackendOffline() {
  backendOffline = true;

  if (!offlineWarningShown && (import.meta.env?.DEV || import.meta.env?.MODE === "development")) {
    console.warn(OFFLINE_BACKEND_MESSAGE);
    offlineWarningShown = true;
  }
}

export function isBackendOffline() {
  return backendOffline;
}
