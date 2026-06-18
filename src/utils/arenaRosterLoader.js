import arenaRoster from "../data/arenaRoster.js";
import { getAllArenaRosterEntries } from "./arenaRosterUtils.js";

export function loadCombatant(idOrName) {
  if (!idOrName) return null;
  const key = String(idOrName).toLowerCase();
  return getAllArenaRosterEntries(arenaRoster).find((entry) => {
    return String(entry.id).toLowerCase() === key || String(entry.name).toLowerCase() === key;
  }) || null;
}

export function loadCombatants(idsOrNames = []) {
  return idsOrNames.map(loadCombatant).filter(Boolean);
}

export default {
  loadCombatant,
  loadCombatants,
};
