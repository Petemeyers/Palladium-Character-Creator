import { normalizeBattlefieldMap } from "./battlefieldMapAuthority.js";

export const BATTLEFIELD_TEST_BATTLE_REQUEST_KEY = "battlefield.testBattle.v1";
export const BATTLEFIELD_TEST_BATTLE_APPLIED_KEY = "battlefield.testBattle.applied.v1";

const storageOrNull = (storage) => storage || globalThis?.localStorage || null;

export function createBattlefieldTestBattleRequest(map, options = {}) {
  const normalized = normalizeBattlefieldMap(map || {});
  return {
    version: 1,
    requestedAt: options.requestedAt || new Date().toISOString(),
    map: normalized,
    rosterPreset: options.rosterPreset || "small-melee-test",
    openSceneSetup: options.openSceneSetup !== false,
    source: "map-maker-test-battle",
  };
}

export function saveBattlefieldTestBattleRequest(map, { storage = null, ...options } = {}) {
  const store = storageOrNull(storage);
  const request = createBattlefieldTestBattleRequest(map, options);
  store?.setItem?.(BATTLEFIELD_TEST_BATTLE_REQUEST_KEY, JSON.stringify(request));
  return request;
}

export function loadBattlefieldTestBattleRequest({ storage = null } = {}) {
  const store = storageOrNull(storage);
  const raw = store?.getItem?.(BATTLEFIELD_TEST_BATTLE_REQUEST_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.map) return null;
    return { ...parsed, map: normalizeBattlefieldMap(parsed.map) };
  } catch {
    return null;
  }
}

export function clearBattlefieldTestBattleRequest({ storage = null } = {}) {
  const store = storageOrNull(storage);
  store?.removeItem?.(BATTLEFIELD_TEST_BATTLE_REQUEST_KEY);
}

export function markBattlefieldTestBattleApplied(request, { storage = null } = {}) {
  const store = storageOrNull(storage);
  const payload = {
    requestVersion: request?.version || 1,
    mapId: request?.map?.id || null,
    appliedAt: new Date().toISOString(),
  };
  store?.setItem?.(BATTLEFIELD_TEST_BATTLE_APPLIED_KEY, JSON.stringify(payload));
  return payload;
}

export function consumeBattlefieldTestBattleRequest({ storage = null } = {}) {
  const store = storageOrNull(storage);
  const request = loadBattlefieldTestBattleRequest({ storage: store });
  if (request) clearBattlefieldTestBattleRequest({ storage: store });
  return request;
}

export function launchBattlefieldTestBattle(map, options = {}) {
  const request = saveBattlefieldTestBattleRequest(map, options);
  if (options.navigate !== false && typeof window !== "undefined") {
    window.location.assign(options.combatPath || "/combat?battlefieldTest=1");
  }
  return request;
}

export default launchBattlefieldTestBattle;
