/**
 * Get Fighter Techniques
 * Retrieves all available techniques for a fighter from various sources
 */

import { getUnifiedAbilities } from "./unifiedAbilities.js";
import {
  getTechniqueCost,
  isDuelistClassName,
  buildDuelistTechniqueBookForLevel,
} from "./techniqueUtils.js";
import { getAllTechniquesFromDB } from "../data/combatTechniques.js";

/**
 * Convert unified technique format to combat technique format
 * @param {Object} technique - Unified technique object
 * @returns {Object|null} Combat technique object or null
 */
export function convertTechniqueToCombatTechnique(technique) {
  if (!technique) return null;

  // If already in combat format, return as-is
  if (technique.damage || technique.combatDamage || technique.cost || technique.stamina) {
    return technique;
  }

  // Convert unified format to combat format
  const combatTechnique = {
    name: technique.name || technique.technique || technique.title || "Unknown Technique",
    cost: technique.cost || technique.stamina || technique.staminaCost || getTechniqueCost(technique),
    damage: technique.damage || technique.combatDamage || "",
    effect: technique.effect || technique.description || "",
    range: technique.range || "100ft",
    duration: technique.duration || "Instant",
    level: technique.level || 1,
    type: "training",
  };

  return combatTechnique;
}

/**
 * Get all available techniques for a fighter
 * Checks multiple sources: techniqueBook, training, techniques, knownTechniques, abilities, unified abilities
 * @param {Object} fighter - Fighter object
 * @param {Function} convertTechniqueToCombatTechniqueFn - Optional converter function (for backward compatibility)
 * @returns {Array} Array of technique objects
 */
export function getFighterTechniques(
  fighter,
  convertTechniqueToCombatTechniqueFn = convertTechniqueToCombatTechnique
) {
  if (!fighter) return [];
  const isPlayerSide = fighter.type === "player" || fighter.playable === true;

  const normalised = [];
  const seen = new Set();

  const techniqueDbByName = new Map(); // cache: technique name (lower) -> full technique from DB
  const ensureTechniqueEnriched = (entry) => {
    const name = entry?.name || entry?.technique || entry?.title;
    if (!name) return entry;
    if (!techniqueDbByName.size) {
      getAllTechniquesFromDB().forEach((s) => techniqueDbByName.set((s.name || "").toLowerCase(), s));
    }
    const fromDb = techniqueDbByName.get(name.toLowerCase());
    return fromDb ? { ...fromDb, ...entry, name } : entry; // DB fills damage/range when entry is name-only
  };

  const applyPlayerDuelistBounds = (techniques) => {
    const list = Array.isArray(techniques) ? techniques : [];
    if (!isPlayerSide) return list;
    if (!isDuelistClassName(fighter.PROFESSION || fighter.profession || fighter.class || "")) return list;
    const fighterLevel = Number(fighter.level || fighter.Level || 1) || 1;
    const bounded = buildDuelistTechniqueBookForLevel({
      allTechniques: list.length > 0 ? list : getAllTechniquesFromDB(),
      level: fighterLevel,
      pickedTechniqueNames: list.map((s) => s?.name).filter(Boolean),
    });
    return bounded.techniqueBook.map((sp) => ({ ...sp, cost: getTechniqueCost(sp) }));
  };

  const addTechniqueEntry = (entry) => {
    if (!entry) return;
    let normalizedEntry = entry;
    if (typeof entry === "string") {
      normalizedEntry = { name: entry };
    }
    normalizedEntry = ensureTechniqueEnriched(normalizedEntry);

    // Clean up technique name - remove "Technique: " prefix if present
    if (normalizedEntry.name && normalizedEntry.name.startsWith("Technique: ")) {
      normalizedEntry.name = normalizedEntry.name.replace(/^Technique: /i, "");
    }

    // Check if this is a unified technique and convert it
    if (
      normalizedEntry.type === "training" ||
      normalizedEntry.source === "unified"
    ) {
      const converted = convertTechniqueToCombatTechniqueFn(normalizedEntry);
      if (converted) {
        normalizedEntry = converted;
      }
    }

    const name =
      normalizedEntry.name || normalizedEntry.technique || normalizedEntry.title;
    if (!name || seen.has(name)) return;
    seen.add(name);

    normalised.push({
      ...normalizedEntry,
      name,
      cost: getTechniqueCost(normalizedEntry),
    });
  };

  const addTechniqueList = (list) => {
    if (!list) return;
    if (Array.isArray(list)) {
      list.forEach(addTechniqueEntry);
      return;
    }
    if (Array.isArray(list?.techniques)) {
      list.techniques.forEach(addTechniqueEntry);
    }
  };

  // Debug logging for duelists
  const isDuelist =
    fighter.PROFESSION?.toLowerCase().includes("duelist") ||
    fighter.profession?.toLowerCase().includes("duelist") ||
    fighter.class?.toLowerCase().includes("duelist");

  if (isDuelist && import.meta.env.DEV && typeof window !== 'undefined' && window?.localStorage?.getItem('debugTechniques') === '1') {
    const trainingAbilities = Array.isArray(fighter.abilities)
      ? fighter.abilities.filter(
          (a) => a.type === "training" || a.type === "technique"
        )
      : [];
    console.log(`Ã°Å¸â€Â® [getFighterTechniques] Checking techniques for ${fighter.name}:`);
    console.log(
      `  - training:`,
      fighter.training,
      `(length: ${fighter.training?.length || 0})`
    );
    if (fighter.training && fighter.training.length > 0) {
      console.log(
        `  - training contents:`,
        JSON.stringify(fighter.training, null, 2)
      );
    }
    console.log(
      `  - abilities:`,
      fighter.abilities,
      `(length: ${fighter.abilities?.length || 0})`
    );
    if (fighter.abilities && fighter.abilities.length > 0) {
      console.log(
        `  - abilities contents:`,
        JSON.stringify(fighter.abilities.slice(0, 3), null, 2)
      );
    }
    console.log(
      `  - trainingAbilities:`,
      trainingAbilities,
      `(length: ${trainingAbilities.length})`
    );
    if (trainingAbilities.length > 0) {
      console.log(
        `  - First training ability:`,
        JSON.stringify(trainingAbilities[0], null, 2)
      );
    }
    console.log(`  - PROFESSION:`, fighter.PROFESSION || fighter.profession || fighter.class);
    console.log(`  - level:`, fighter.level);
  }

  // Check techniqueBook first (full catalog for Duelist training)
  if (
    fighter?.techniqueBook &&
    Array.isArray(fighter.techniqueBook) &&
    fighter.techniqueBook.length > 0
  ) {
    addTechniqueList(fighter.techniqueBook);
    // If techniqueBook exists, prefer it over other sources
    return applyPlayerDuelistBounds(normalised);
  }

  // Check for unrestricted duelist training - if found, pull from full catalog
  let hasUnrestrictedDuelistTraining =
    fighter?.unrestricted === true ||
    fighter?.trainingProfile?.isDuelistTraining ||
    fighter?.trainingProfile?.unrestricted ||
    (Array.isArray(fighter.training) &&
      fighter.training.some((m) => m?.unrestricted)) ||
    (Array.isArray(fighter.abilities) &&
      fighter.abilities.some(
        (a) => a?.unrestricted && (a.type === "training" || a.type === "technique")
      ));

  // Also check unified abilities for unrestricted duelist training
  let unified = null;
  try {
    unified = getUnifiedAbilities(fighter);
    if (unified?.training?.isDuelistTraining || unified?.training?.unrestricted) {
      hasUnrestrictedDuelistTraining = true;
    }
  } catch (error) {
    // Silently fail if getUnifiedAbilities has issues
    if (isDuelist && import.meta.env.DEV && typeof window !== 'undefined' && window?.localStorage?.getItem('debugTechniques') === '1') {
      console.warn(
        `Ã°Å¸â€Â® [getFighterTechniques] Error getting unified abilities:`,
        error
      );
    }
  }

  if (hasUnrestrictedDuelistTraining && !isPlayerSide) {
    // Pull from full technique catalog
    const allTechniques = getAllTechniquesFromDB();
    allTechniques.forEach(addTechniqueEntry);
    return normalised;
  }

  addTechniqueList(fighter.training);
  addTechniqueList(fighter.techniques);
  addTechniqueList(fighter.knownTechniques);
  addTechniqueList(fighter.techniqueList);

  // Also check abilities array for techniques (type: "training")
  if (Array.isArray(fighter.abilities)) {
    fighter.abilities.forEach((ability) => {
      if (ability.type === "training" || ability.type === "technique") {
        addTechniqueEntry(ability);
      }
    });
  }

  // Also check unified abilities if available
  if (unified?.training) {
    if (Array.isArray(unified.training)) {
      unified.training.forEach(addTechniqueEntry);
    } else if (unified.training && typeof unified.training === "object") {
      // Check knownTechniques, techniques, or any array property
      if (Array.isArray(unified.training.knownTechniques)) {
        unified.training.knownTechniques.forEach(addTechniqueEntry);
      }
      if (Array.isArray(unified.training.techniques)) {
        unified.training.techniques.forEach(addTechniqueEntry);
      }
      // Also check if training itshuman has technique-like properties
      Object.values(unified.training).forEach((value) => {
        if (Array.isArray(value)) {
          value.forEach(addTechniqueEntry);
        }
      });
    }
  }

  // Fallback: non-player duelists with no techniques yet get full catalog.
  // Player-side duelists should use creation-time progression data as source of truth.
  if (isDuelist && normalised.length === 0 && !isPlayerSide) {
    const allTechniques = getAllTechniquesFromDB();
    allTechniques.forEach(addTechniqueEntry);
  }

  if (isDuelist && import.meta.env.DEV && typeof window !== 'undefined' && window?.localStorage?.getItem('debugTechniques') === '1') {
    console.log(
      `Ã°Å¸â€Â® [getFighterTechniques] Found ${normalised.length} techniques for ${fighter.name}:`,
      normalised.map((s) => s.name)
    );
  }

  return applyPlayerDuelistBounds(normalised);
}
