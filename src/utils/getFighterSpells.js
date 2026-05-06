/**
 * Get Fighter Spells
 * Retrieves all available spells for a fighter from various sources
 */

import { getUnifiedAbilities } from "./unifiedAbilities.js";
import {
  getSpellCost,
  isWizardClassName,
  buildWizardSpellbookForLevel,
} from "./spellUtils.js";
import { getAllSpellsFromDB } from "../data/combatSpells.js";

/**
 * Convert unified spell format to combat spell format
 * @param {Object} spell - Unified spell object
 * @returns {Object|null} Combat spell object or null
 */
export function convertUnifiedSpellToCombatSpell(spell) {
  if (!spell) return null;

  // If already in combat format, return as-is
  if (spell.damage || spell.combatDamage || spell.cost || spell.ppe) {
    return spell;
  }

  // Convert unified format to combat format
  const combatSpell = {
    name: spell.name || spell.spell || spell.title || "Unknown Spell",
    cost: spell.cost || spell.ppe || spell.ppeCost || getSpellCost(spell),
    damage: spell.damage || spell.combatDamage || "",
    effect: spell.effect || spell.description || "",
    range: spell.range || "100ft",
    duration: spell.duration || "Instant",
    level: spell.level || 1,
    type: "magic",
  };

  return combatSpell;
}

/**
 * Get all available spells for a fighter
 * Checks multiple sources: spellbook, magic, spells, knownSpells, abilities, unified abilities
 * @param {Object} fighter - Fighter object
 * @param {Function} convertUnifiedSpellToCombatSpellFn - Optional converter function (for backward compatibility)
 * @returns {Array} Array of spell objects
 */
export function getFighterSpells(
  fighter,
  convertUnifiedSpellToCombatSpellFn = convertUnifiedSpellToCombatSpell
) {
  if (!fighter) return [];
  const isPlayerSide = fighter.type === "player" || fighter.playable === true;

  const normalised = [];
  const seen = new Set();

  const spellDbByName = new Map(); // cache: spell name (lower) -> full spell from DB
  const ensureSpellEnriched = (entry) => {
    const name = entry?.name || entry?.spell || entry?.title;
    if (!name) return entry;
    if (!spellDbByName.size) {
      getAllSpellsFromDB().forEach((s) => spellDbByName.set((s.name || "").toLowerCase(), s));
    }
    const fromDb = spellDbByName.get(name.toLowerCase());
    return fromDb ? { ...fromDb, ...entry, name } : entry; // DB fills damage/range when entry is name-only
  };

  const applyPlayerWizardBounds = (spells) => {
    const list = Array.isArray(spells) ? spells : [];
    if (!isPlayerSide) return list;
    if (!isWizardClassName(fighter.OCC || fighter.occ || fighter.class || "")) return list;
    const fighterLevel = Number(fighter.level || fighter.Level || 1) || 1;
    const bounded = buildWizardSpellbookForLevel({
      allSpells: list.length > 0 ? list : getAllSpellsFromDB(),
      level: fighterLevel,
      pickedSpellNames: list.map((s) => s?.name).filter(Boolean),
    });
    return bounded.spellbook.map((sp) => ({ ...sp, cost: getSpellCost(sp) }));
  };

  const addSpellEntry = (entry) => {
    if (!entry) return;
    let normalizedEntry = entry;
    if (typeof entry === "string") {
      normalizedEntry = { name: entry };
    }
    normalizedEntry = ensureSpellEnriched(normalizedEntry);

    // Clean up spell name - remove "Spell: " prefix if present
    if (normalizedEntry.name && normalizedEntry.name.startsWith("Spell: ")) {
      normalizedEntry.name = normalizedEntry.name.replace(/^Spell: /i, "");
    }

    // Check if this is a unified spell and convert it
    if (
      normalizedEntry.type === "magic" ||
      normalizedEntry.source === "unified"
    ) {
      const converted = convertUnifiedSpellToCombatSpellFn(normalizedEntry);
      if (converted) {
        normalizedEntry = converted;
      }
    }

    const name =
      normalizedEntry.name || normalizedEntry.spell || normalizedEntry.title;
    if (!name || seen.has(name)) return;
    seen.add(name);

    normalised.push({
      ...normalizedEntry,
      name,
      cost: getSpellCost(normalizedEntry),
    });
  };

  const addSpellList = (list) => {
    if (!list) return;
    if (Array.isArray(list)) {
      list.forEach(addSpellEntry);
      return;
    }
    if (Array.isArray(list?.spells)) {
      list.spells.forEach(addSpellEntry);
    }
  };

  // Debug logging for wizards
  const isWizard =
    fighter.OCC?.toLowerCase().includes("wizard") ||
    fighter.occ?.toLowerCase().includes("wizard") ||
    fighter.class?.toLowerCase().includes("wizard");

  if (isWizard && import.meta.env.DEV && typeof window !== 'undefined' && window?.localStorage?.getItem('debugSpells') === '1') {
    const magicAbilities = Array.isArray(fighter.abilities)
      ? fighter.abilities.filter(
          (a) => a.type === "magic" || a.type === "spell"
        )
      : [];
    console.log(`🔮 [getFighterSpells] Checking spells for ${fighter.name}:`);
    console.log(
      `  - magic:`,
      fighter.magic,
      `(length: ${fighter.magic?.length || 0})`
    );
    if (fighter.magic && fighter.magic.length > 0) {
      console.log(
        `  - magic contents:`,
        JSON.stringify(fighter.magic, null, 2)
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
      `  - magicAbilities:`,
      magicAbilities,
      `(length: ${magicAbilities.length})`
    );
    if (magicAbilities.length > 0) {
      console.log(
        `  - First magic ability:`,
        JSON.stringify(magicAbilities[0], null, 2)
      );
    }
    console.log(`  - OCC:`, fighter.OCC || fighter.occ || fighter.class);
    console.log(`  - level:`, fighter.level);
  }

  // Check spellbook first (full catalog for Wizard magic)
  if (
    fighter?.spellbook &&
    Array.isArray(fighter.spellbook) &&
    fighter.spellbook.length > 0
  ) {
    addSpellList(fighter.spellbook);
    // If spellbook exists, prefer it over other sources
    return applyPlayerWizardBounds(normalised);
  }

  // Check for unrestricted wizard magic - if found, pull from full catalog
  let hasUnrestrictedWizardMagic =
    fighter?.unrestricted === true ||
    fighter?.magicProfile?.isWizardMagic ||
    fighter?.magicProfile?.unrestricted ||
    (Array.isArray(fighter.magic) &&
      fighter.magic.some((m) => m?.unrestricted)) ||
    (Array.isArray(fighter.abilities) &&
      fighter.abilities.some(
        (a) => a?.unrestricted && (a.type === "magic" || a.type === "spell")
      ));

  // Also check unified abilities for unrestricted wizard magic
  let unified = null;
  try {
    unified = getUnifiedAbilities(fighter);
    if (unified?.magic?.isWizardMagic || unified?.magic?.unrestricted) {
      hasUnrestrictedWizardMagic = true;
    }
  } catch (error) {
    // Silently fail if getUnifiedAbilities has issues
    if (isWizard && import.meta.env.DEV && typeof window !== 'undefined' && window?.localStorage?.getItem('debugSpells') === '1') {
      console.warn(
        `🔮 [getFighterSpells] Error getting unified abilities:`,
        error
      );
    }
  }

  if (hasUnrestrictedWizardMagic && !isPlayerSide) {
    // Pull from full spell catalog
    const allSpells = getAllSpellsFromDB();
    allSpells.forEach(addSpellEntry);
    return normalised;
  }

  addSpellList(fighter.magic);
  addSpellList(fighter.spells);
  addSpellList(fighter.knownSpells);
  addSpellList(fighter.spellList);

  // Also check abilities array for spells (type: "magic")
  if (Array.isArray(fighter.abilities)) {
    fighter.abilities.forEach((ability) => {
      if (ability.type === "magic" || ability.type === "spell") {
        addSpellEntry(ability);
      }
    });
  }

  // Also check unified abilities if available
  if (unified?.magic) {
    if (Array.isArray(unified.magic)) {
      unified.magic.forEach(addSpellEntry);
    } else if (unified.magic && typeof unified.magic === "object") {
      // Check knownSpells, spells, or any array property
      if (Array.isArray(unified.magic.knownSpells)) {
        unified.magic.knownSpells.forEach(addSpellEntry);
      }
      if (Array.isArray(unified.magic.spells)) {
        unified.magic.spells.forEach(addSpellEntry);
      }
      // Also check if magic itself has spell-like properties
      Object.values(unified.magic).forEach((value) => {
        if (Array.isArray(value)) {
          value.forEach(addSpellEntry);
        }
      });
    }
  }

  // Fallback: non-player wizards with no spells yet get full catalog.
  // Player-side wizards should use creation-time progression data as source of truth.
  if (isWizard && normalised.length === 0 && !isPlayerSide) {
    const allSpells = getAllSpellsFromDB();
    allSpells.forEach(addSpellEntry);
  }

  if (isWizard && import.meta.env.DEV && typeof window !== 'undefined' && window?.localStorage?.getItem('debugSpells') === '1') {
    console.log(
      `🔮 [getFighterSpells] Found ${normalised.length} spells for ${fighter.name}:`,
      normalised.map((s) => s.name)
    );
  }

  return applyPlayerWizardBounds(normalised);
}
