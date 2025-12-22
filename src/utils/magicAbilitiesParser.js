/**
 * Enhanced Magic Abilities Parser
 *
 * Parses complex magicAbilities strings from bestiary entries like:
 * - "All levels 1-5 earth elemental magic"
 * - "All fire elemental spells (levels 1-4) plus Fire Whip (level 7) at 5th-level proficiency"
 * - "Elemental Fire magic (Warlock 10th level); PPE 200"
 */

import spellData from "../../backend/data/spells.json";

/**
 * Map of spell names to their elemental types
 * Based on Palladium Fantasy RPG spell lists
 */
export const SPELL_ELEMENT_MAP = {
  // Fire Spells
  "Blinding Flash": "fire",
  "Cloud of Smoke": "fire",
  "Create Coal": "fire",
  "Flame Lick": "fire",
  "Globe of Daylight": "fire",
  "Resist Fire": "fire",
  "Stench of Hades": "fire",
  "Cloud of Ash": "fire",
  Darkness: "fire",
  "Fiery Touch": "fire",
  "Freeze Water": "fire",
  "Resist Cold": "fire",
  "Spontaneous Combustion": "fire",
  "Swirling Lights": "fire",
  "Tongue of Flame": "fire",
  "Circle of Cold": "fire",
  "Circle of Flame": "fire",
  "Create Heat": "fire",
  "Extinguish Fires": "fire",
  "Fire Ball": "fire",
  Fireball: "fire",
  "Lower Temperature": "fire",
  "Wall of Flame": "fire",
  "Cloud of Steam": "fire",
  "Flame Friend": "fire",
  "Fuel Flame": "fire",
  "Heal Burns": "fire",
  "Heat Objects/Water": "fire",
  "Mini-Fireballs": "fire",
  "Blue Flame": "fire",
  "Breath Fire": "fire",
  "Eat Fire": "fire",
  "Screaming Wall of Flame": "fire",
  "Wall of Ice": "fire",
  "Dancing Fires": "fire",
  "Eternal Flame": "fire",
  "Flame of Life": "fire",
  "Ten Foot Wheel of Fire": "fire",
  "Fire Whip": "fire",
  "Melt Metal": "fire",
  "River of Lava": "fire",
  "Burst into Flame": "fire",
  "Fire Bolt": "fire",

  // Air Spells
  "Breath Without Air": "air",
  "Clap of Thunder": "air",
  "Cloud of Slumber": "air",
  "Create Light": "air",
  "Create Mild Wind": "air",
  "Howling Wind": "air",
  "Stop Wind": "air",
  "Create Air": "air",
  "Heavy Breathing": "air",
  Levitate: "air",
  Mesmerism: "air",
  Miasma: "air",
  "Northerly Wind": "air",
  Silence: "air",
  "Wind Rush": "air",
  "Call Lightning": "air",
  "Fingers of the Wind": "air",
  "Float in Air": "air",
  "Fifteen Foot Air Bubble": "air",
  "Northern Lights": "air",
  "Walk the Wind": "air",
  "Ball Lightning": "air",
  "Calm Storm": "air",
  "Dissipate Gases": "air",
  Invisibility: "air",
  "Leaf Rustler": "air",
  "Phantom Footman": "air",
  "Protection from Lightning": "air",
  "Breath of Life": "air",
  "Circle of Rain": "air",
  "Darken the Sky": "air",
  "Detect the Invisible": "air",
  "Invisible Wall": "air",
  Phantom: "air",
  Whirlwind: "air",
  "Electric Field/Wall": "air",
  Electromagnetism: "air",
  "Mist of Death": "air",
  "Snow Storm": "air",
  Vacuum: "air",
  "Whisper of Wind": "air",
  "Atmosphere Manipulation": "air",
  Hurricane: "air",
  Rainbow: "air",
  Tornado: "air",
  "Lightning Bolt": "air",
  "Lightning Arc": "air",

  // Water Spells
  "Color Water": "water",
  "Create Fog": "water",
  // Note: Dowsing appears in both water and earth - prioritizing earth
  "Float on Water": "water",
  "Purple Mist": "water",
  "Saltwater to Fresh": "water",
  "Water to Wine": "water",
  "Breath Underwater": "water",
  "Fog of Fear": "water",
  "Foul Water": "water",
  "Liquid (Any) to Water": "water",
  "Ride the Waves": "water",
  "Walk the Waves": "water",
  "Water Seal": "water",
  "Calm Waters": "water",
  "Command Fish": "water",
  "Sheet of Ice": "water",
  "Create Water": "water",
  Hail: "water",
  "Shards of Ice": "water",
  "Swim Like the Dolphin": "water",
  "Water Wisps": "water",
  // Note: Earth to Mud appears in both water and earth - prioritizing earth
  "Ice Bolt": "water",

  // Earth Spells
  // Level 1
  Chameleon: "earth",
  Dowsing: "earth", // Also appears in water, but primarily earth
  "Dust Storm": "earth",
  "Fool's Gold": "earth",
  "Identify Minerals": "earth",
  "Identify Plants": "earth",
  "Rock to Mud": "earth",
  "Rot Wood": "earth",

  // Level 2
  "Create Dirt or Clay": "earth",
  "Dirt to Clay": "earth",
  "Dirt to Sand": "earth",
  "Grow Plants": "earth",
  "Hopping Stones": "earth",
  Track: "earth",
  "Wall of Clay": "earth",
  "Wither Plants": "earth",

  // Level 3
  "Animate Plants": "earth",
  "Create Mound": "earth",
  "Crumble Stone": "earth",
  Dig: "earth",
  "Earth Rumble": "earth",
  "Encase Object in Stone": "earth",
  "Locate Minerals": "earth",
  "Wall of Stone": "earth",

  // Level 4
  "Animate Object": "earth",
  "Cocoon of Stone (Self)": "earth",
  "Cocoon of Stone": "earth", // Alternative name
  "Mend Stone": "earth",
  Quicksand: "earth",
  "Repel Animals": "earth",
  Rust: "earth",
  "Sand Storm": "earth",
  "Wall of Thorns": "earth",

  // Level 5
  Chasm: "earth",
  "Clay to Lead": "earth",
  "Clay to Stone": "earth",
  "Close Fissures": "earth",
  "Mud Mound": "earth",
  // Note: River of Lava appears in both fire and earth - prioritizing earth
  "Travel Through Earth": "earth",

  // Level 6
  "Clay to Iron": "earth",
  Earthquake: "earth",
  "Mend Metal": "earth",
  "Sculpt and Animate Clay Animals": "earth",
  "Stone to Flesh": "earth",
  "Travel Through Stone": "earth",
  "Wood to Stone": "earth",

  // Level 7
  "Create Golem": "earth",
  "Metal to Clay": "earth",
  "Metal to Wood": "earth",
  Petrification: "earth",
  "Wall of Iron": "earth",

  // Level 8
  "Cap Volcano": "earth",
  Magnetism: "earth",
  "Soul Transference": "earth",
  "Suspended Animation": "earth",

  // Additional earth spells (already mapped or common)
  "Create Wood": "earth",
  "Create Stone": "earth",
  "Earth to Mud": "earth",
  Meteor: "earth",
};

/**
 * Get all spells from the spell database
 */
function getAllSpells() {
  const allSpells = [];

  Object.keys(spellData).forEach((levelKey) => {
    const levelSpells = spellData[levelKey];
    Object.keys(levelSpells).forEach((spellName) => {
      const spell = levelSpells[spellName];
      allSpells.push({
        name: spellName,
        level: spell.level || parseInt(levelKey.replace("level", "")) || 1,
        damage: spell.combatDamage || spell.damage || "",
        damageType: spell.damageType,
        range: spell.range || "100ft",
        description: spell.description || "",
        save: spell.save,
        ppeCost: spell.ppeCost || spell.ppe || 10,
        element: SPELL_ELEMENT_MAP[spellName] || null,
      });
    });
  });

  return allSpells;
}

/**
 * Parse a magicAbilities string to extract:
 * - Element type (fire, earth, air, water)
 * - Level ranges (e.g., "levels 1-4")
 * - Specific named spells (e.g., "Fire Whip (level 7)")
 * - Proficiency level (e.g., "at 5th-level proficiency")
 * - Custom PPE value
 */
export function parseMagicAbilities(magicAbilitiesStr) {
  if (!magicAbilitiesStr || typeof magicAbilitiesStr !== "string") {
    return null;
  }

  const text = magicAbilitiesStr.toLowerCase();
  const result = {
    element: null,
    levelRanges: [],
    specificSpells: [],
    proficiencyLevel: null,
    customPPE: null,
    isWizardMagic: false, // Flag for Wizard (Invocation) magic
  };

  // Check for Wizard/Invocation magic (no element restriction)
  // Patterns: "Spell Magic (Invocation)", "Wizard magic", "Invocation magic", "Spell Magic"
  result.isWizardMagic =
    /spell\s+magic|wizard\s+magic|invocation\s+magic|invocation/i.test(text);

  // Extract element type (only if explicitly stated as elemental)
  const elementMatch = text.match(/(fire|earth|air|water|wind)\s+elemental/i);
  if (elementMatch) {
    result.element = elementMatch[1].toLowerCase();
    // Normalize "wind" to "air"
    if (result.element === "wind") result.element = "air";
    result.isWizardMagic = false; // Elemental magic is not Wizard magic
  } else if (result.isWizardMagic) {
    // Wizard/Invocation magic has no element restriction
    result.element = null; // Explicitly set to null to indicate all elements allowed
  }

  // Extract level ranges (e.g., "levels 1-4" or "level 1-5")
  const levelRangeMatches = text.matchAll(/levels?\s+(\d+)[-\s]+(\d+)/gi);
  for (const match of levelRangeMatches) {
    result.levelRanges.push({
      min: parseInt(match[1]),
      max: parseInt(match[2]),
    });
  }

  // Extract specific named spells (e.g., "Fire Whip (level 7)")
  // NOTE: Skip "Fire Whip" as it's a weapon attack, not a spell
  const specificSpellMatches = text.matchAll(
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*\(level\s+(\d+)\)/gi
  );
  for (const match of specificSpellMatches) {
    const spellName = match[1].trim();
    // Skip Fire Whip - it's a weapon attack, not a spell
    if (spellName.toLowerCase().includes("fire whip")) {
      continue;
    }
    result.specificSpells.push({
      name: spellName,
      level: parseInt(match[2]),
    });
  }

  // Extract proficiency level (e.g., "at 5th-level proficiency" or "Warlock 10th level")
  const proficiencyMatch = text.match(
    /(?:at\s+)?(\d+)(?:th|st|nd|rd)?[- ]?level(?:\s+proficiency)?|(\w+)\s+(\d+)(?:th|st|nd|rd)?[- ]?level/i
  );
  if (proficiencyMatch) {
    result.proficiencyLevel = parseInt(
      proficiencyMatch[1] || proficiencyMatch[3] || 5
    );
  }

  // Extract custom PPE (e.g., "PPE 200")
  const ppeMatch = text.match(/ppe\s+(\d+)/i);
  if (ppeMatch) {
    result.customPPE = parseInt(ppeMatch[1]);
  }

  return result;
}

/**
 * Get spells for a creature based on parsed magicAbilities
 * @param {string} magicAbilitiesStr - Magic abilities string from bestiary
 * @param {Object} options - Options for spell selection
 * @param {boolean} options.fullList - If true, return all spells (no sampling). Default: false
 * @param {boolean} options.includeNonCombat - If true, include spells without combat damage. Default: true
 */
export function getSpellsForCreature(magicAbilitiesStr, options = {}) {
  const { fullList = false, includeNonCombat = true } = options;

  const parsed = parseMagicAbilities(magicAbilitiesStr);
  if (!parsed) {
    return { spells: [], ppe: 0 };
  }

  const allSpells = getAllSpells();
  const selectedSpells = [];

  // If Wizard magic with no level ranges specified, include ALL spells from the database
  if (parsed.isWizardMagic && parsed.levelRanges.length === 0) {
    // Do NOT filter to only combatDamage; we want full quest-map capability.
    // Return ALL spells, all levels, all elements/categories
    return {
      spells: allSpells, // <-- all levels, all "elements/categories"
      ppe: parsed.customPPE || 300,
      isWizardMagic: true,
      unrestricted: true,
    };
  }

  // Add spells from level ranges
  for (const range of parsed.levelRanges) {
    for (let level = range.min; level <= range.max; level++) {
      const levelSpells = allSpells.filter((spell) => spell.level === level);

      // Filter by element if specified (Wizard magic has no element restriction)
      let eligibleSpells = levelSpells;
      if (parsed.element && !parsed.isWizardMagic) {
        eligibleSpells = levelSpells.filter(
          (spell) => spell.element === parsed.element
        );
      }
      // If isWizardMagic is true, eligibleSpells already contains all spells (no filtering)

      // Only include spells with combat damage if includeNonCombat is false
      if (!includeNonCombat) {
        eligibleSpells = eligibleSpells.filter(
          (spell) => spell.damage && spell.damage !== "0" && spell.damage !== ""
        );
      }

      // Add all eligible spells (or a reasonable subset if too many)
      if (eligibleSpells.length > 0) {
        if (fullList) {
          // Return all spells, no sampling
          selectedSpells.push(...eligibleSpells);
        } else {
          // If we have many spells, take a representative sample
          if (eligibleSpells.length > 5) {
            // Take 3-5 random spells per level
            const numToTake = Math.min(5, Math.max(3, eligibleSpells.length));
            const shuffled = [...eligibleSpells].sort(
              () => Math.random() - 0.5
            );
            selectedSpells.push(...shuffled.slice(0, numToTake));
          } else {
            selectedSpells.push(...eligibleSpells);
          }
        }
      }
    }
  }

  // Add specific named spells
  for (const specificSpell of parsed.specificSpells) {
    // Skip Fire Whip - it's a weapon attack, not a spell
    if (specificSpell.name.toLowerCase().includes("fire whip")) {
      continue;
    }

    // Try to find the spell in the database
    const foundSpell = allSpells.find(
      (s) => s.name.toLowerCase() === specificSpell.name.toLowerCase()
    );

    if (foundSpell) {
      // Don't add duplicates
      if (!selectedSpells.find((s) => s.name === foundSpell.name)) {
        selectedSpells.push(foundSpell);
      }
    } else {
      // Spell not in database, create a placeholder
      selectedSpells.push({
        name: specificSpell.name,
        level: specificSpell.level,
        damage: "special",
        range: "100ft",
        description: `${specificSpell.name} spell`,
        ppeCost: specificSpell.level * 5,
        element: parsed.element,
      });
    }
  }

  // Remove duplicates
  const uniqueSpells = [];
  const seenNames = new Set();
  for (const spell of selectedSpells) {
    if (!seenNames.has(spell.name)) {
      seenNames.add(spell.name);
      uniqueSpells.push(spell);
    }
  }

  // Calculate PPE
  let ppe = parsed.customPPE;
  if (!ppe) {
    if (parsed.levelRanges.length > 0) {
      const maxLevel = Math.max(
        ...parsed.levelRanges.map((r) => r.max),
        ...parsed.specificSpells.map((s) => s.level),
        parsed.proficiencyLevel || 5
      );
      ppe = maxLevel * 20;
    } else if (parsed.isWizardMagic) {
      // Wizard magic with no level restriction - use high PPE (equivalent to level 15+)
      ppe = 300; // High PPE for unrestricted wizard magic
    } else {
      // Default fallback
      ppe = 100;
    }
  }

  return {
    spells: uniqueSpells,
    ppe: ppe,
    isWizardMagic: parsed.isWizardMagic,
    unrestricted: parsed.isWizardMagic && parsed.levelRanges.length === 0,
  };
}
