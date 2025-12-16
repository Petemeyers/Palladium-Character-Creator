// src/utils/horrorSystem.js
/**
 * Centralized Horror Factor System
 *
 * Ensures Horror Factor checks happen only once per scary creature per character per encounter.
 * Similar to bleedingSystem.js pattern for Stop Bleeding.
 */

import CryptoSecureDice from "./cryptoDice.js";
import { resolveMoraleCheck, isFearImmune } from "./moraleSystem.js";

/**
 * Robust fear immunity check based on category/creatureType/species/race/name.
 * This makes demons like Baal-Rog immune even if isDemonFighter() is imperfect,
 * because bestiary reliably includes "category": "demon"
 *
 * @param {Object} f - Fighter object to check
 * @returns {boolean} True if fighter is immune to fear
 */
function isFearImmuneFighter(f) {
  if (!f) return false;

  // Explicit flags always win
  if (f.isFearless || f.immuneToFear || f.neverFlee) return true;

  const blob = `${f.category || ""} ${f.creatureType || ""} ${
    f.species || ""
  } ${f.race || ""} ${f.name || ""}`.toLowerCase();

  // Core fearless buckets (tweak list if you want demons to sometimes flee)
  return (
    blob.includes("undead") ||
    blob.includes("demon") ||
    blob.includes("devil") ||
    blob.includes("construct") ||
    blob.includes("golem") ||
    blob.includes("elemental")
  );
}

// --- Shared humanoid/scary source classification ---
// Centralized here so CombatPage only calls hasHorrorFactor/resolveHorrorCheck,
// and never re-implements humanoid logic (no drift).
const HUMANOID_TAGS = [
  "human",
  "elf",
  "dwarf",
  "gnome",
  "halfling",
  "kobold",
  "goblin",
  "orc",
  "hobgoblin",
  "bugbear",
  "ogre",
  "troll",
  "troglodyte",
];

const SCARY_CATEGORY_HINTS = [
  "monster",
  "undead",
  "demon",
  "devil",
  "dragon",
  "beast",
  "creature",
  "aberration",
  "elemental",
  "construct",
  "fiend",
  "horror",
  "alien",
];

function normStr(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function containsWord(haystack, needle) {
  if (!haystack || !needle) return false;
  const re = new RegExp(
    `\\b${needle.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`,
    "i"
  );
  return re.test(String(haystack));
}

/**
 * Centralized "normal humanoid" classifier.
 * Handles variants like "Elf Longbowman", "Human Bandit", etc.
 * Explicit monster-ish categories override name/species matches.
 */
export function isNormalHumanoid(source) {
  if (!source) return false;

  // If the source is explicitly monster-ish, it is NOT a normal humanoid.
  const category = normStr(source.category);
  const creatureType = normStr(source.creatureType);
  const typeBlob = `${category} ${creatureType}`;
  if (SCARY_CATEGORY_HINTS.some((h) => typeBlob.includes(h))) {
    return false;
  }

  // Category-level humanoid buckets
  if (
    category === "humanoid" ||
    category.includes("humanoid") ||
    category.includes("pc_playable") ||
    category.includes("pc playable") ||
    category.includes("npc")
  ) {
    return true;
  }

  // Direct species/race labels
  const species = normStr(source.species);
  const race = normStr(source.race);
  if (HUMANOID_TAGS.includes(species) || HUMANOID_TAGS.includes(race)) {
    return true;
  }

  // Name/id/type fallbacks (handles "Elf Longbowman", "Human Bandit", etc.)
  const name = normStr(source.name);
  const id = normStr(source.id);
  const blob = `${name} ${id} ${species} ${race} ${creatureType}`;
  return HUMANOID_TAGS.some((tag) => containsWord(blob, tag));
}

/**
 * Centralized HF gating:
 * - Normal humanoids NEVER trigger HF unless `forceHorrorFactor: true`.
 * - Everything else triggers HF when HF > 0.
 */
export function canTriggerHorrorFactor(source) {
  if (!source) return false;
  const hf = getHorrorFactor(source);
  if (!hf || hf <= 0) return false;
  if (source.forceHorrorFactor === true) return true;
  if (isNormalHumanoid(source)) return false;
  return true;
}

/**
 * Get Horror Factor from a creature
 * @param {Object} creature - Creature/combatant object
 * @returns {number} Horror Factor (0 if none)
 */
export function getHorrorFactor(creature) {
  if (!creature) return 0;
  return (
    creature.HF ||
    creature.hf ||
    creature.horrorFactor ||
    creature.horror_factor ||
    0
  );
}

/**
 * Check if a creature has a Horror Factor
 * @param {Object} creature - Creature/combatant object
 * @returns {boolean} True if creature has HF > 0
 */
export function hasHorrorFactor(creature) {
  return canTriggerHorrorFactor(creature);
}

/**
 * Check if a target has already rolled Horror Factor save vs a source
 * @param {Object} target - Fighter who would make the save
 * @param {Object} source - Creature with Horror Factor
 * @returns {boolean} True if already checked
 */
export function hasAlreadyCheckedHorror(target, source) {
  if (!target || !source) return false;

  const sourceId = source.id || source.name;
  if (!sourceId) return false;

  const horrorChecks = target.meta?.horrorChecks || {};
  return !!horrorChecks[sourceId];
}

/**
 * Get exposure bonus based on prior encounters with a specific horror
 * @param {Object} fighter - Fighter making the save
 * @param {string} sourceId - ID of the horror source
 * @returns {number} Exposure bonus (+1 per 3 prior encounters)
 */
function getHorrorExposureBonus(fighter, sourceId) {
  const mentalState = ensureMentalState(fighter);
  if (!mentalState) return 0;

  const encounters =
    (mentalState.horrorEncountersById &&
      mentalState.horrorEncountersById[sourceId]) ||
    0;

  // Example: +1 to save for every 3 prior encounters with this horror
  // This represents desensitization - the more you see it, the less shocking it becomes
  const exposureBonus = Math.floor(encounters / 3);

  return exposureBonus;
}

/**
 * Get Horror Factor save bonus for a character
 * @param {Object} character - Character making the save
 * @param {Object} source - Optional: the horror source (for exposure bonus)
 * @returns {number} Bonus to Horror Factor save
 */
function getHorrorSaveBonus(character, source = null) {
  // ME (Mental Endurance) bonus
  const ME =
    character.attributes?.ME || character.ME || character.stats?.ME || 10;
  const meBonus = Math.floor((ME - 10) / 2); // +1 per 2 points above 10

  // Courage aura bonus (if present)
  const courageBonus = character.tempBonuses?.horrorSave || 0;

  // Class bonuses (Knights, Paladins, etc. are braver)
  const occ = (character.OCC || character.occ || "").toLowerCase();
  let classBonus = 0;
  if (/knight|paladin|soldier|men-at-arms/i.test(occ)) {
    classBonus = 2;
  }

  // Exposure bonus: based on prior encounters with this specific horror
  let exposureBonus = 0;
  if (source) {
    const sourceId = source.id || source.name || "UNKNOWN_SOURCE";
    exposureBonus = getHorrorExposureBonus(character, sourceId);
  }

  // Phobia penalty: -2 if they have a phobia matching this creature type
  let phobiaPenalty = 0;
  if (source) {
    const mentalState = ensureMentalState(character);
    const sourceId = source.id || source.name || "UNKNOWN_SOURCE";
    const sourceType = (
      source.creatureType ||
      source.species ||
      source.name ||
      ""
    ).toLowerCase();

    // Check both disorders array and phobias array
    const hasMatchingPhobia =
      (mentalState.disorders &&
        mentalState.disorders.some(
          (d) =>
            d.type === "phobia" &&
            (d.tag === sourceId ||
              d.sourceId === sourceId ||
              String(d.target || "")
                .toLowerCase()
                .includes(sourceType) ||
              sourceType.includes(String(d.target || "").toLowerCase()))
        )) ||
      (mentalState.phobias &&
        mentalState.phobias.some(
          (p) =>
            p.tag === sourceId ||
            p.sourceId === sourceId ||
            String(p.label || "")
              .toLowerCase()
              .includes(sourceType)
        ));

    if (hasMatchingPhobia) {
      phobiaPenalty = -2;
    }
  }

  return meBonus + courageBonus + classBonus + exposureBonus + phobiaPenalty;
}

/**
 * Ensure meta structure exists on target
 * @param {Object} target - Fighter object
 * @returns {Object} Target with ensured meta structure (only creates new object if needed)
 */
function ensureMeta(target) {
  // If meta and horrorChecks already exist, return target as-is to preserve reference equality
  if (target.meta?.horrorChecks) {
    return target;
  }

  // Only create new object if meta structure is missing
  return {
    ...target,
    meta: {
      ...(target.meta || {}),
      horrorChecks: {
        ...(target.meta?.horrorChecks || {}),
      },
    },
  };
}

/**
 * Main Horror Factor resolver.
 * - Only rolls ONCE per (source, target) for the entire encounter.
 * - Later calls just return the target unchanged.
 * @param {Object} params
 * @param {Object} params.source - Creature with Horror Factor
 * @param {Object} params.target - Fighter making the save
 * @param {Object} params.combatState - Combat state with currentRound/meleeRound
 * @param {Function} params.log - Logging function
 * @returns {Object} Updated target fighter (unchanged if already checked)
 */
export function resolveHorrorCheck({
  source,
  target,
  combatState = {},
  log = console.log,
}) {
  if (!source || !target) {
    return target;
  }

  // Extract sourceId early for "already checked" guard
  const sourceId = source?.id || source?.name || "UNKNOWN_SOURCE";
  const round = combatState?.currentRound ?? combatState?.meleeRound ?? 1;

  // 🔒 Already processed for this source -> do nothing (prevents spam)
  let updatedTarget = ensureMeta(target);
  const prevChecks = updatedTarget.meta.horrorChecks;
  const prev = prevChecks[sourceId];
  if (prev) {
    return updatedTarget; // Already checked (success, fail, or immune)
  }

  // 🛠️ Fix #1: Horror Factor must respect fear immunity
  // Check immunity BEFORE rolling dice or applying any effects
  // Use both category-based check (robust) and function-based check (comprehensive)
  if (isFearImmuneFighter(target) || isFearImmune(target)) {
    log?.(
      `🛡️ ${target.name} is immune to fear and ignores Horror Factor routing.`,
      "info"
    );

    // Record immunity check so we don't spam the log on subsequent calls
    return {
      ...target,
      meta: {
        ...(target.meta || {}),
        horrorChecks: {
          ...(target.meta?.horrorChecks || {}),
          [sourceId]: {
            round: round,
            result: "immune",
          },
        },
      },
    };
  }

  const horrorFactor = getHorrorFactor(source);
  if (!horrorFactor) return target;

  // ✅ Normal humanoids never trigger HF unless forceHorrorFactor: true
  if (!canTriggerHorrorFactor(source)) return target;

  // --- First time this target faces this Horror Factor creature ---
  const baseRoll = CryptoSecureDice.rollD20();
  const bonus = getHorrorSaveBonus(updatedTarget, source);
  const total = baseRoll + bonus;
  const success = total >= horrorFactor;

  log(
    `😱 ${updatedTarget.name} makes Horror Factor save vs ${source.name} (HF ${horrorFactor}): ` +
      `roll ${baseRoll} + ${bonus} = ${total} (${success ? "SUCCESS" : "FAIL"})`
  );

  // Update mental state to track exposure (horrorSeen Set)
  updatedTarget = updateHorrorMentalState(updatedTarget, source);

  updatedTarget = {
    ...updatedTarget,
    meta: {
      ...updatedTarget.meta,
      horrorChecks: {
        ...prevChecks,
        [sourceId]: {
          round,
          result: success ? "success" : "fail",
          baseRoll,
          total,
          horrorFactor, // Store HF for later use in recordHorrorFailure
        },
      },
    },
  };

  // Always record the encounter (success or fail) for desensitization tracking
  if (success) {
    updatedTarget = recordHorrorEncounter({
      fighter: updatedTarget,
      sourceId,
    });
  } else {
    // On failure, record both the encounter and the failure
    updatedTarget = applyHorrorFailureEffects({
      source,
      target: updatedTarget,
      combatState,
      log,
    });
  }

  return updatedTarget;
}

/**
 * Apply "failed Horror Factor" effects ONCE when they fail vs a source.
 * Right now: lose 1 action and gain HORROR_SHOCKED status.
 * You can expand this later (penalties, fleeing, etc.).
 * @param {Object} params
 * @param {Object} params.source - Creature with Horror Factor
 * @param {Object} params.target - Fighter who failed the save
 * @param {Object} params.combatState - Combat state
 * @param {Function} params.log - Logging function
 * @returns {Object} Updated target fighter
 */
export function applyHorrorFailureEffects({
  source,
  target,
  combatState,
  log,
}) {
  const round = combatState.currentRound ?? combatState.meleeRound ?? 1;

  // Prevent double-applying in same round even if someone calls us twice
  if (target.meta?.horrorFailedRound === round) {
    return target;
  }

  // 🛠️ Fix #1: Horror Factor must respect fear immunity
  // Fear-immune creatures never route from Horror Factor
  // Use both category-based check (robust) and function-based check (comprehensive)
  if (isFearImmuneFighter(target) || isFearImmune(target)) {
    log(
      `🛡️ ${target.name} is immune to fear and ignores Horror Factor routing.`,
      "info"
    );
    return target; // DO NOT apply ROUTED or any horror effects
  }

  const horrorFactor = getHorrorFactor(source);

  // Scale attacks lost based on HF (very high HF = more actions lost)
  const attacksLost = horrorFactor >= 18 ? 2 : horrorFactor >= 16 ? 2 : 1;

  const attacksKey = "attacksRemaining"; // Primary key
  const attacksRemaining = target[attacksKey] ?? target.remainingAttacks ?? 0;
  const newAttacks = Math.max(0, attacksRemaining - attacksLost);

  log(
    `😱 ${target.name} recoils in horror at the sight of ${
      source.name
    } and loses ${attacksLost} action${attacksLost > 1 ? "s" : ""}!`
  );

  // Calculate HP for morale check
  const maxHP = target.maxHP || target.totalHP || target.currentHP || 1;
  const hpPercent = maxHP > 0 ? (target.currentHP ?? maxHP) / maxHP : 1;

  // Immediate morale check due to horror failure
  const moraleResult = resolveMoraleCheck(target, {
    roundNumber: round,
    reason: "horror",
    hpPercent,
    alliesDownRatio: 0, // Could compute if we have fighters array, but 0 is fine for horror-triggered morale
    horrorFailed: true,
    bigPainHit: false,
  });

  // Log morale outcome if significant
  if (moraleResult.moraleState?.status === "ROUTED") {
    log(`🏃 ${target.name} is so terrified they attempt to flee!`, "warning");
  } else if (moraleResult.moraleState?.status === "SURRENDERED") {
    log(
      `🤚 ${target.name} is overwhelmed by terror and surrenders!`,
      "warning"
    );
  } else if (moraleResult.moraleState?.status === "SHAKEN") {
    log(`😨 ${target.name} is shaken by the horror!`, "info");
  }

  let updated = {
    ...target,
    [attacksKey]: newAttacks,
    remainingAttacks: newAttacks, // Also update alternate key for compatibility
    statusEffects: [...(target.statusEffects || []), "HORROR_SHOCKED"],
    tempMentalPenalties: {
      ...(target.tempMentalPenalties || {}),
      strike: -2,
      parry: -1,
      dodge: -1,
      roundsRemaining: 1,
    },
    meta: {
      ...(target.meta || {}),
      horrorFailedRound: round,
      horrorInitPenalty: -2, // Initiative penalty for this melee round
    },
    moraleState: moraleResult.moraleState,
  };

  // NEW: track long-term trauma
  const sourceId = source.id || source.name || "UNKNOWN_SOURCE";
  updated = recordHorrorFailure({
    fighter: updated,
    sourceId,
    log,
  });

  return updated;
}

/**
 * Update mental state after a horror check
 * Tracks exposure (horrorSeen Set) - just marks that they've encountered this horror
 * @param {Object} target - Fighter who made the save
 * @param {Object} source - Horror source creature
 * @returns {Object} Updated target fighter
 */
function updateHorrorMentalState(target, source) {
  const mental = ensureMentalState(target);
  const sourceId = source.id || source.name || "UNKNOWN_SOURCE";

  // Mark that they've seen this horror
  mental.horrorSeen.add(sourceId);

  return {
    ...target,
    mentalState: {
      ...(target.mentalState || {}),
      horrorSeen: Array.from(mental.horrorSeen),
      // Preserve existing insanity points and disorders (updated in recordHorrorFailure)
      insanityPoints: mental.insanityPoints || 0,
      lastFailedHorrorId: mental.lastFailedHorrorId,
      disorders: mental.disorders || [],
    },
  };
}

/**
 * Record an encounter with a horror (success or fail)
 * Tracks total encounters for desensitization bonus
 * @param {Object} params
 * @param {Object} params.fighter - Fighter who encountered the horror
 * @param {string} params.sourceId - ID of the horror source
 * @returns {Object} Updated fighter
 */
function recordHorrorEncounter({ fighter, sourceId }) {
  const mentalState = ensureMentalState(fighter);

  const encounters = {
    ...(mentalState.horrorEncountersById || {}),
  };

  const prevEncounters = encounters[sourceId] || 0;
  encounters[sourceId] = prevEncounters + 1;

  return {
    ...fighter,
    mentalState: {
      ...(fighter.mentalState || {}),
      ...mentalState,
      horrorEncountersById: encounters,
    },
  };
}

/**
 * Record long-term trauma from a horror failure
 * Tracks cumulative insanity points, per-monster failure counts, and triggers disorders/phobias
 * @param {Object} params
 * @param {Object} params.fighter - Fighter who failed the save
 * @param {string} params.sourceId - ID of the horror source
 * @param {Function} params.log - Logging function
 * @returns {Object} Updated target fighter (may have new disorder/phobia)
 */
function recordHorrorFailure({ fighter, sourceId, log }) {
  const mentalState = ensureMentalState(fighter);

  const failures = {
    ...(mentalState.horrorFailuresById || {}),
  };

  const encounters = {
    ...(mentalState.horrorEncountersById || {}),
  };

  const prevFailures = failures[sourceId] || 0;
  const prevEncounters = encounters[sourceId] || 0;

  const nextFailures = prevFailures + 1;
  const nextEncounters = prevEncounters + 1;

  failures[sourceId] = nextFailures;
  encounters[sourceId] = nextEncounters;

  // Get the horror check result to determine if it was a natural 1 and HF
  const horrorCheck = fighter.meta?.horrorChecks?.[sourceId];
  const isNatural1 = horrorCheck?.baseRoll === 1;
  const horrorFactor = horrorCheck?.horrorFactor || 12; // Default to 12 if not stored

  // Accumulate insanity points
  // High HF (16+) or natural 1 adds +2, otherwise +1
  let insanityIncrement = 1;
  if (horrorFactor >= 16 || isNatural1) {
    insanityIncrement = 2;
  }

  const insanityPoints = (mentalState.insanityPoints || 0) + insanityIncrement;

  const updatedMentalState = {
    ...mentalState,
    horrorFailuresById: failures,
    horrorEncountersById: encounters,
    insanityPoints,
    lastFailedHorrorId: sourceId,
  };

  const updatedFighter = {
    ...fighter,
    mentalState: {
      ...(fighter.mentalState || {}),
      ...updatedMentalState,
    },
  };

  // Optionally roll for a phobia/insanity here
  return maybeTriggerInsanityFromHorror({
    fighter: updatedFighter,
    sourceId,
    log,
  });
}

/**
 * Check if horror exposure should trigger a phobia or disorder
 * Uses per-monster failure counts for more accurate phobia triggers
 * @param {Object} params
 * @param {Object} params.fighter - Fighter who failed horror save
 * @param {string} params.sourceId - ID of the horror source
 * @param {Function} params.log - Logging function
 * @returns {Object} Updated fighter (may have new disorder/phobia)
 */
function maybeTriggerInsanityFromHorror({ fighter, sourceId, log }) {
  const mentalState = ensureMentalState(fighter);
  const failures =
    (mentalState.horrorFailuresById &&
      mentalState.horrorFailuresById[sourceId]) ||
    0;

  const insanityPoints = mentalState.insanityPoints || 0;
  const disorders = mentalState.disorders || [];
  const phobias = mentalState.phobias || [];

  // Check if they already have a phobia for this horror
  const hasPhobiaAlready = phobias.some(
    (p) => p.tag === sourceId || p.sourceId === sourceId
  );

  // Example thresholds (adjust to taste / RAW):
  // - 3 failures vs same horror: minor phobia
  // - 6+ failures or 10 insanity points: major phobia or other insanity
  if (!hasPhobiaAlready && failures >= 3) {
    const sourceName = sourceId; // Could extract name from source if available
    const severity = failures >= 6 ? "major" : "minor";

    const newPhobia = {
      id: `phobia_${sourceId}_${Date.now()}`,
      tag: sourceId,
      label: `Phobia of ${sourceName}`,
      severity: severity,
      origin: "horror_factor",
      sourceId: sourceId,
      appliedAt: Date.now(),
    };

    const newDisorder = {
      type: "phobia",
      tag: sourceId,
      sourceId: sourceId,
      severity: severity,
      appliedAt: Date.now(),
    };

    const updatedMentalState = {
      ...mentalState,
      phobias: [...phobias, newPhobia],
      disorders: [...disorders, newDisorder],
    };

    const updatedFighter = {
      ...fighter,
      mentalState: {
        ...(fighter.mentalState || {}),
        ...updatedMentalState,
      },
    };

    if (log) {
      log(
        `🧠 ${
          fighter.name || "Someone"
        } develops a ${severity} phobia of ${sourceName} after ${failures} Horror Factor failures!`,
        "warning"
      );
    }

    return updatedFighter;
  }

  // Also check total insanity points for major disorders
  if (insanityPoints >= 10 && !disorders.some((d) => d.type === "insanity")) {
    const newDisorder = {
      type: "insanity",
      severity: "major",
      source: "repeated_horror_factor_failures",
      sourceId: sourceId,
      appliedAt: Date.now(),
    };

    if (log) {
      log(
        `🧠 ${
          fighter.name || "Someone"
        } develops a major mental disorder from repeated horror exposure (${insanityPoints} insanity points)!`,
        "warning"
      );
    }

    return {
      ...fighter,
      mentalState: {
        ...(fighter.mentalState || {}),
        ...mentalState,
        disorders: [...disorders, newDisorder],
      },
    };
  }

  return fighter;
}

/**
 * Ensure mentalState structure exists (for backwards compatibility)
 * Extended to track HF history, failures, encounters, and phobias
 * @param {Object} fighter - Fighter object
 * @returns {Object} mentalState object
 */
export function ensureMentalState(fighter) {
  const base = fighter.mentalState || {};
  return {
    horrorSeen:
      base.horrorSeen instanceof Set
        ? base.horrorSeen
        : new Set(base.horrorSeen || []),
    insanityPoints: base.insanityPoints || 0,
    disorders: base.disorders || [],
    // NEW: how many failures vs each horror source/type
    horrorFailuresById: {
      ...(base.horrorFailuresById || {}),
    },
    // NEW: how many *encounters* vs each horror source/type (success or fail)
    horrorEncountersById: {
      ...(base.horrorEncountersById || {}),
    },
    // NEW: long-term phobias keyed by type of horror
    phobias: base.phobias || [], // [{ id, tag, label, severity, notes, sourceId }]
    lastFailedHorrorId: base.lastFailedHorrorId || null,
  };
}
