// ==========================================
// ArenaRoster Validator
// ==========================================
// Validates arenaRoster.js structure
// to ensure every opponent has required fields
// and valid data types (guardRating, HP, attacks, etc.)
// ==========================================

import arenaRoster from "../data/arenaRoster.js" assert { type: "json" };
import { getAllArenaRosterEntries } from "./arenaRosterUtils.js";

const REQUIRED_FIELDS = ["id", "name", "guardRating", "HP", "attacks", "description"];

function isDiceFormula(str) {
  return /^\d+d\d+([+\-]\d+)?$/.test(str);
}

export function validateArenaRoster(verbose = true) {
  const opponents = getAllArenaRosterEntries(arenaRoster);
  const errors = [];

  opponents.forEach((m) => {
    if (!m) {
      errors.push(
        "[Unknown] Encountered malformed combatant entry (null/undefined)."
      );
      return;
    }

    const id = m.id || m.name || "Unknown";
    REQUIRED_FIELDS.forEach((field) => {
      if (!(field in m)) {
        errors.push(`[${id}] Missing required field: ${field}`);
      }
    });

    if (typeof m.guardRating !== "number") {
      errors.push(`[${id}] guardRating should be a number`);
    }

    if (typeof m.HP !== "string" && typeof m.HP !== "number") {
      errors.push(`[${id}] HP must be a number or dice string`);
    }

    if (typeof m.HP === "string" && !isDiceFormula(m.HP)) {
      errors.push(`[${id}] HP dice format invalid: ${m.HP}`);
    }

    if (!Array.isArray(m.attacks)) {
      errors.push(`[${id}] Attacks must be an array`);
    }

    if (!m.description || m.description.trim().length < 5) {
      errors.push(`[${id}] Description too short or missing`);
    }
  });

  if (verbose) {
    if (errors.length === 0) {
      console.log(`Ã¢Å“â€¦ ArenaRoster validation passed (${opponents.length} entries)`);
    } else {
      console.warn(`Ã¢Å¡Â Ã¯Â¸Â ArenaRoster validation found ${errors.length} issues:`);
      errors.forEach((e) => console.warn(" - " + e));
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---- Optional CLI run ----
if (import.meta.url === process?.argv?.[1]) {
  validateArenaRoster(true);
}
