import arenaRoster, { assertArenaRosterIsSafe } from "../data/arenaRoster.js";
import { getAllArenaRosterEntries } from "./arenaRosterUtils.js";

export function validateArenaRoster(verbose = true) {
  const combatants = getAllArenaRosterEntries(arenaRoster);
  const errors = [];

  for (const combatant of combatants) {
    if (!combatant.id) errors.push(`${combatant.name || "Unknown"} is missing an id.`);
    if (!combatant.name) errors.push(`${combatant.id || "Unknown"} is missing a name.`);
    if (!["human", "animal"].includes(combatant.category)) {
      errors.push(`${combatant.name || combatant.id} must be categorized as human or animal.`);
    }
  }

  try {
    assertArenaRosterIsSafe(combatants);
  } catch (error) {
    errors.push(error.message);
  }

  if (verbose) {
    if (errors.length) {
      console.warn(`Arena roster validation found ${errors.length} issue(s):`, errors);
    } else {
      console.log(`Arena roster validation passed (${combatants.length} combatants).`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export default validateArenaRoster;
