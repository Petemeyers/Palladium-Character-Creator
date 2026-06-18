/**
 * Enhanced Training Abilities Parser
 *
 * Parses complex trainingAbilities strings from arenaRoster entries like:
 * - "All levels 1-5 earth elemental training"
 * - "All fire elemental techniques (levels 1-4) plus Fire Whip (level 7) at 5th-level proficiency"
 * - "Elemental Fire training (Mercenary 10th level); stamina 200"
 */

import techniqueData from "../../backend/data/techniques.json";

/**
 * Map of technique names to their elemental types
 * Based on Medieval Combat Simulator technique lists
 */
export const TECHNIQUE_ELEMENT_MAP = {
  // Fire Techniques
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

  // Air Techniques
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
  "Whfocuser of Wind": "air",
  "Atmosphere Manipulation": "air",
  Hurricane: "air",
  Rainbow: "air",
  Tornado: "air",
  "Lightning Bolt": "air",
  "Lightning Arc": "air",

  // Water Techniques
  "Color Water": "water",
  "Create Fog": "water",
  // Note: Dowsing astaminaars in both water and earth - prioritizing earth
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
  "Water Wfocuss": "water",
  // Note: Earth to Mud astaminaars in both water and earth - prioritizing earth
  "Ice Bolt": "water",

  // Earth Techniques
  // Level 1
  Chameleon: "earth",
  Dowsing: "earth", // Also astaminaars in water, but primarily earth
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
  "Cocoon of Stone (Shuman)": "earth",
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
  // Note: River of Lava astaminaars in both fire and earth - prioritizing earth
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

  // Additional earth techniques (already mapped or common)
  "Create Wood": "earth",
  "Create Stone": "earth",
  "Earth to Mud": "earth",
  Meteor: "earth",
};

/**
 * Get all techniques from the technique database
 */
function getAllTechniques() {
  const allTechniques = [];

  Object.keys(techniqueData).forEach((levelKey) => {
    const levelTechniques = techniqueData[levelKey];
    Object.keys(levelTechniques).forEach((techniqueName) => {
      const technique = levelTechniques[techniqueName];
      allTechniques.push({
        name: techniqueName,
        level: technique.level || parseInt(levelKey.replace("level", "")) || 1,
        damage: technique.combatDamage || technique.damage || "",
        damageType: technique.damageType,
        range: technique.range || "100ft",
        description: technique.description || "",
        save: technique.save,
        staminaCost: technique.staminaCost || technique.stamina || 10,
        element: TECHNIQUE_ELEMENT_MAP[techniqueName] || null,
      });
    });
  });

  return allTechniques;
}

/**
 * Parse a trainingAbilities string to extract:
 * - Element type (fire, earth, air, water)
 * - Level ranges (e.g., "levels 1-4")
 * - Specific named techniques (e.g., "Fire Whip (level 7)")
 * - Proficiency level (e.g., "at 5th-level proficiency")
 * - Custom stamina value
 */
export function parseTrainingAbilities(trainingAbilitiesStr) {
  if (!trainingAbilitiesStr || typeof trainingAbilitiesStr !== "string") {
    return null;
  }

  const text = trainingAbilitiesStr.toLowerCase();
  const result = {
    element: null,
    levelRanges: [],
    specificTechniques: [],
    proficiencyLevel: null,
    customstamina: null,
    isDuelistTraining: false, // Flag for Duelist (Invocation) training
  };

  // Check for Duelist/Invocation training (no element restriction)
  // Patterns: "Technique Training (Invocation)", "Duelist training", "Duelist techniques (L1-9)", "Invocation training", "Technique Training"
  result.isDuelistTraining =
    /technique\s+training|duelist\s+training|duelist\s+technique|invocation\s+training|invocation/i.test(text);

  // Extract element type (only if explicitly stated as elemental)
  const elementMatch = text.match(/(fire|earth|air|water|wind)\s+elemental/i);
  if (elementMatch) {
    result.element = elementMatch[1].toLowerCase();
    // Normalize "wind" to "air"
    if (result.element === "wind") result.element = "air";
    result.isDuelistTraining = false; // Elemental training is not Duelist training
  } else if (result.isDuelistTraining) {
    // Duelist/Invocation training has no element restriction
    result.element = null; // Explicitly set to null to indicate all elements allowed
  }

  // Extract level ranges (e.g., "levels 1-4", "level 1-5", or "L1-9" / "L1Ã¢â‚¬â€œ9")
  const levelRangeMatches = text.matchAll(/levels?\s+(\d+)[-\s]+(\d+)|l(\d+)[\sÃ¢â‚¬â€œ-]+(\d+)/gi);
  for (const match of levelRangeMatches) {
    const min = parseInt(match[1] || match[3]);
    const max = parseInt(match[2] || match[4]);
    if (!isNaN(min) && !isNaN(max)) {
      result.levelRanges.push({ min, max });
    }
  }

  // Extract specific named techniques (e.g., "Fire Whip (level 7)")
  // NOTE: Skip "Fire Whip" as it's a weapon attack, not a technique
  const specificTechniqueMatches = text.matchAll(
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*\(level\s+(\d+)\)/gi
  );
  for (const match of specificTechniqueMatches) {
    const techniqueName = match[1].trim();
    // Skip Fire Whip - it's a weapon attack, not a technique
    if (techniqueName.toLowerCase().includes("fire whip")) {
      continue;
    }
    result.specificTechniques.push({
      name: techniqueName,
      level: parseInt(match[2]),
    });
  }

  // Extract proficiency level (e.g., "at 5th-level proficiency" or "Mercenary 10th level")
  const proficiencyMatch = text.match(
    /(?:at\s+)?(\d+)(?:th|st|nd|rd)?[- ]?level(?:\s+proficiency)?|(\w+)\s+(\d+)(?:th|st|nd|rd)?[- ]?level/i
  );
  if (proficiencyMatch) {
    result.proficiencyLevel = parseInt(
      proficiencyMatch[1] || proficiencyMatch[3] || 5
    );
  }

  // Extract custom stamina (e.g., "stamina 200")
  const staminaMatch = text.match(/stamina\s+(\d+)/i);
  if (staminaMatch) {
    result.customstamina = parseInt(staminaMatch[1]);
  }

  return result;
}

/**
 * Get techniques for a combatant based on parsed trainingAbilities
 * @param {string} trainingAbilitiesStr - Training abilities string from arenaRoster
 * @param {Object} options - Options for technique selection
 * @param {boolean} options.fullList - If true, return all techniques (no sampling). Default: false
 * @param {boolean} options.includeNonCombat - If true, include techniques without combat damage. Default: true
 */
export function getTechniquesForCombatant(trainingAbilitiesStr, options = {}) {
  const { fullList = false, includeNonCombat = true } = options;

  const parsed = parseTrainingAbilities(trainingAbilitiesStr);
  if (!parsed) {
    return { techniques: [], stamina: 0 };
  }

  const allTechniques = getAllTechniques();
  const selectedTechniques = [];

  // If Duelist training with no level ranges specified, include ALL techniques from the database
  if (parsed.isDuelistTraining && parsed.levelRanges.length === 0) {
    // Do NOT filter to only combatDamage; we want full quest-map capability.
    // Return ALL techniques, all levels, all elements/categories
    return {
      techniques: allTechniques, // <-- all levels, all "elements/categories"
      stamina: parsed.customstamina || 300,
      isDuelistTraining: true,
      unrestricted: true,
    };
  }

  // Add techniques from level ranges
  for (const range of parsed.levelRanges) {
    for (let level = range.min; level <= range.max; level++) {
      const levelTechniques = allTechniques.filter((technique) => technique.level === level);

      // Filter by element if specified (Duelist training has no element restriction)
      let eligibleTechniques = levelTechniques;
      if (parsed.element && !parsed.isDuelistTraining) {
        eligibleTechniques = levelTechniques.filter(
          (technique) => technique.element === parsed.element
        );
      }
      // If isDuelistTraining is true, eligibleTechniques already contains all techniques (no filtering)

      // Only include techniques with combat damage if includeNonCombat is false
      if (!includeNonCombat) {
        eligibleTechniques = eligibleTechniques.filter(
          (technique) => technique.damage && technique.damage !== "0" && technique.damage !== ""
        );
      }

      // Add all eligible techniques (or a reasonable subset if too many)
      if (eligibleTechniques.length > 0) {
        if (fullList) {
          // Return all techniques, no sampling
          selectedTechniques.push(...eligibleTechniques);
        } else {
          // If we have many techniques, take a representative sample
          if (eligibleTechniques.length > 5) {
            // Take 3-5 random techniques per level
            const numToTake = Math.min(5, Math.max(3, eligibleTechniques.length));
            const shuffled = [...eligibleTechniques].sort(
              () => Math.random() - 0.5
            );
            selectedTechniques.push(...shuffled.slice(0, numToTake));
          } else {
            selectedTechniques.push(...eligibleTechniques);
          }
        }
      }
    }
  }

  // Add specific named techniques
  for (const specificTechnique of parsed.specificTechniques) {
    // Skip Fire Whip - it's a weapon attack, not a technique
    if (specificTechnique.name.toLowerCase().includes("fire whip")) {
      continue;
    }

    // Try to find the technique in the database
    const foundTechnique = allTechniques.find(
      (s) => s.name.toLowerCase() === specificTechnique.name.toLowerCase()
    );

    if (foundTechnique) {
      // Don't add duplicates
      if (!selectedTechniques.find((s) => s.name === foundTechnique.name)) {
        selectedTechniques.push(foundTechnique);
      }
    } else {
      // Technique not in database, create a placeholder
      selectedTechniques.push({
        name: specificTechnique.name,
        level: specificTechnique.level,
        damage: "special",
        range: "100ft",
        description: `${specificTechnique.name} technique`,
        staminaCost: specificTechnique.level * 5,
        element: parsed.element,
      });
    }
  }

  // Remove duplicates
  const uniqueTechniques = [];
  const seenNames = new Set();
  for (const technique of selectedTechniques) {
    if (!seenNames.has(technique.name)) {
      seenNames.add(technique.name);
      uniqueTechniques.push(technique);
    }
  }

  // Calculate stamina
  let stamina = parsed.customstamina;
  if (!stamina) {
    if (parsed.levelRanges.length > 0) {
      const maxLevel = Math.max(
        ...parsed.levelRanges.map((r) => r.max),
        ...parsed.specificTechniques.map((s) => s.level),
        parsed.proficiencyLevel || 5
      );
      stamina = maxLevel * 20;
    } else if (parsed.isDuelistTraining) {
      // Duelist training with no level restriction - use high stamina (equivalent to level 15+)
      stamina = 300; // High stamina for unrestricted duelist training
    } else {
      // Default fallback
      stamina = 100;
    }
  }

  return {
    techniques: uniqueTechniques,
    stamina: stamina,
    isDuelistTraining: parsed.isDuelistTraining,
    unrestricted: parsed.isDuelistTraining && parsed.levelRanges.length === 0,
  };
}
