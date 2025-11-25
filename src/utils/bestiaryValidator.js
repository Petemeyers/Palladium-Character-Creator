// ==========================================
// Bestiary Validator
// ==========================================
// Validates bestiary.json structure
// to ensure every monster has required fields
// and valid data types (AR, HP, attacks, etc.)
// ==========================================

import bestiary from "../data/bestiary.json" assert { type: "json" };
import { getAllBestiaryEntries } from "./bestiaryUtils.js";

const REQUIRED_FIELDS = ["id", "name", "AR", "HP", "attacks", "description"];

function isDiceFormula(str) {
  return /^\d+d\d+([+\-]\d+)?$/.test(str);
}

export function validateBestiary(verbose = true) {
  const monsters = getAllBestiaryEntries(bestiary);
  const errors = [];

  monsters.forEach((m) => {
    if (!m) {
      errors.push(
        "[Unknown] Encountered malformed creature entry (null/undefined)."
      );
      return;
    }

    const id = m.id || m.name || "Unknown";
    REQUIRED_FIELDS.forEach((field) => {
      if (!(field in m)) {
        errors.push(`[${id}] Missing required field: ${field}`);
      }
    });

    if (typeof m.AR !== "number") {
      errors.push(`[${id}] AR should be a number`);
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
      console.log(`✅ Bestiary validation passed (${monsters.length} entries)`);
    } else {
      console.warn(`⚠️ Bestiary validation found ${errors.length} issues:`);
      errors.forEach((e) => console.warn(" - " + e));
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---- Optional CLI run ----
if (import.meta.url === process?.argv?.[1]) {
  validateBestiary(true);
}
