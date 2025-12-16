/**
 * Enhanced Magic Abilities Parser
 * 
 * Parses complex magicAbilities strings from bestiary entries like:
 * - "All levels 1-5 earth elemental magic"
 * - "All fire elemental spells (levels 1-4) plus Fire Whip (level 7) at 5th-level proficiency"
 * - "Elemental Fire magic (Warlock 10th level); PPE 200"
 */

import { getSpellsForLevel } from "../data/combatSpells.js";
import spellData from "../../backend/data/spells.json";

/**
 * Map of spell names to their elemental types
 * Based on Palladium Fantasy RPG spell lists
 */
const SPELL_ELEMENT_MAP = {
  // Fire Spells
  "Blinding Flash": "fire",
  "Cloud of Smoke": "fire",
  "Create Coal": "fire",
  "Flame Lick": "fire",
  "Globe of Daylight": "fire",
  "Resist Fire": "fire",
  "Stench of Hades": "fire",
  "Cloud of Ash": "fire",
  "Darkness": "fire",
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
  "Fireball": "fire",
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
  "Levitate": "air",
  "Mesmerism": "air",
  "Miasma": "air",
  "Northerly Wind": "air",
  "Silence": "air",
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
  "Invisibility": "air",
  "Leaf Rustler": "air",
  "Phantom Footman": "air",
  "Protection from Lightning": "air",
  "Breath of Life": "air",
  "Circle of Rain": "air",
  "Darken the Sky": "air",
  "Detect the Invisible": "air",
  "Invisible Wall": "air",
  "Phantom": "air",
  "Whirlwind": "air",
  "Electric Field/Wall": "air",
  "Electromagnetism": "air",
  "Mist of Death": "air",
  "Snow Storm": "air",
  "Vacuum": "air",
  "Whisper of Wind": "air",
  "Atmosphere Manipulation": "air",
  "Hurricane": "air",
  "Rainbow": "air",
  "Tornado": "air",
  "Lightning Bolt": "air",
  "Lightning Arc": "air",
  
  // Water Spells
  "Color Water": "water",
  "Create Fog": "water",
  "Dowsing": "water",
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
  "Hail": "water",
  "Shards of Ice": "water",
  "Swim Like the Dolphin": "water",
  "Water Wisps": "water",
  "Earth to Mud": "water",
  "Ice Bolt": "water",
  
  // Earth Spells (common ones)
  "Create Wood": "earth",
  "Create Stone": "earth",
  "Earth to Mud": "earth",
  "Meteor": "earth",
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
  };
  
  // Extract element type
  const elementMatch = text.match(/(fire|earth|air|water|wind)\s+elemental/i);
  if (elementMatch) {
    result.element = elementMatch[1].toLowerCase();
    // Normalize "wind" to "air"
    if (result.element === "wind") result.element = "air";
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
  const specificSpellMatches = text.matchAll(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*\(level\s+(\d+)\)/gi);
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
  const proficiencyMatch = text.match(/(?:at\s+)?(\d+)(?:th|st|nd|rd)?[- ]?level(?:\s+proficiency)?|(\w+)\s+(\d+)(?:th|st|nd|rd)?[- ]?level/i);
  if (proficiencyMatch) {
    result.proficiencyLevel = parseInt(proficiencyMatch[1] || proficiencyMatch[3] || 5);
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
 */
export function getSpellsForCreature(magicAbilitiesStr) {
  const parsed = parseMagicAbilities(magicAbilitiesStr);
  if (!parsed) {
    return { spells: [], ppe: 0 };
  }
  
  const allSpells = getAllSpells();
  const selectedSpells = [];
  
  // Add spells from level ranges
  for (const range of parsed.levelRanges) {
    for (let level = range.min; level <= range.max; level++) {
      const levelSpells = allSpells.filter(
        (spell) => spell.level === level
      );
      
      // Filter by element if specified
      let eligibleSpells = levelSpells;
      if (parsed.element) {
        eligibleSpells = levelSpells.filter(
          (spell) => spell.element === parsed.element
        );
      }
      
      // Only include spells with combat damage
      eligibleSpells = eligibleSpells.filter(
        (spell) => spell.damage && spell.damage !== "0" && spell.damage !== ""
      );
      
      // Add all eligible spells (or a reasonable subset if too many)
      if (eligibleSpells.length > 0) {
        // If we have many spells, take a representative sample
        if (eligibleSpells.length > 5) {
          // Take 3-5 random spells per level
          const numToTake = Math.min(5, Math.max(3, eligibleSpells.length));
          const shuffled = [...eligibleSpells].sort(() => Math.random() - 0.5);
          selectedSpells.push(...shuffled.slice(0, numToTake));
        } else {
          selectedSpells.push(...eligibleSpells);
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
    const maxLevel = Math.max(
      ...parsed.levelRanges.map((r) => r.max),
      ...parsed.specificSpells.map((s) => s.level),
      parsed.proficiencyLevel || 5
    );
    ppe = maxLevel * 20;
  }
  
  return {
    spells: uniqueSpells,
    ppe: ppe,
  };
}

