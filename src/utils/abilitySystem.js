/**
 * Ability System (Universal)
 *
 * Parses both creature "abilities" from bestiary.json
 * and O.C.C. or secondary skills from Rulebook data
 * into structured effects usable by the combat engine.
 *
 * Integrated with: nightvisionSystem.js, terrainSystem.js, skillSystem.js
 *
 * Converts ability strings like:
 * - "Night vision 60 ft" → { senses: { nightvision: { range: 60, active: true } } }
 * - "Bio-regeneration 1d8 every melee" → { healing: { type: "bio", rate: "1d8", interval: "per_melee" } }
 * - "Resistant to fire/cold (half damage)" → { resistances: { fire: 0.5, cold: 0.5 } }
 * - "Track: 74%" → { skills: { track: 74 } }
 *
 * These normalized abilities are then used by the combat engine for:
 * - Damage resistance/immunity checks
 * - Healing/regeneration per melee
 * - Vision range extensions
 * - Flight/movement modifications
 * - Skill percentages (Prowl, Track, etc.)
 * - Special attack/defense modifiers
 */

import { rollDice } from "./dice.js";
import { lookupSkill } from "./skillSystem.js";

/**
 * Parse a single ability string into structured data
 * @param {string} abilityStr - Raw ability string from bestiary.json
 * @returns {Object} Normalized ability object
 */
function parseAbility(abilityStr) {
  if (!abilityStr || typeof abilityStr !== "string") return null;

  const str = abilityStr.trim().toLowerCase();
  const result = {};

  // === Night Vision / Darkvision ===
  const nightVisionMatch = str.match(/night\s*vision\s*(\d+)\s*ft/i);
  if (nightVisionMatch) {
    result.senses = result.senses || {};
    result.senses.nightvision = {
      range: parseInt(nightVisionMatch[1]),
      active: true,
    };
  }

  // === Bio-Regeneration / Healing ===
  const bioRegenMatch = str.match(
    /bio[- ]?regeneration\s*(\d+d\d+)\s*(?:every|per)\s*(\d+)?\s*(melee|melees|round|rounds)?/i
  );
  if (bioRegenMatch) {
    const rate = bioRegenMatch[1];
    const intervalCount = bioRegenMatch[2] ? parseInt(bioRegenMatch[2]) : 1;
    const intervalType = (bioRegenMatch[3] || "melee").toLowerCase();

    result.healing = {
      type: "bio",
      rate: rate,
      interval: intervalType.includes("melee") ? "per_melee" : "per_round",
      intervalCount: intervalCount,
      active: true,
    };
  }

  // === Regeneration (general) ===
  const regenMatch = str.match(
    /regenerat(?:es|ion)?\s*(?:if\s*)?(?:within|after)?\s*(\d+)?\s*(?:h|hours?|hrs?)?/i
  );
  if (regenMatch && !result.healing) {
    const hours = regenMatch[1] ? parseInt(regenMatch[1]) : 12;
    result.healing = {
      type: "regenerate",
      intervalHours: hours,
      active: true,
    };
  }

  // === Resistance to Damage Types ===
  const resistantMatch = str.match(/resistant\s+to\s+([^\(]+)/i);
  if (resistantMatch) {
    const damageTypes = resistantMatch[1]
      .split(/[\/,]/)
      .map((s) => s.trim().toLowerCase());
    const multiplierMatch = str.match(/half\s+damage|\(0\.5\)|50%/i);
    const multiplier = multiplierMatch ? 0.5 : 0.75; // Default to 75% if not specified

    if (!result.resistances) result.resistances = {};
    damageTypes.forEach((type) => {
      if (type === "fire" || type.includes("fire"))
        result.resistances.fire = multiplier;
      if (type === "cold" || type.includes("cold"))
        result.resistances.cold = multiplier;
      if (type === "magic" || type.includes("magic"))
        result.resistances.magic = multiplier;
      if (type === "poison" || type.includes("poison"))
        result.resistances.poison = multiplier;
      if (type === "psionic" || type.includes("psionic"))
        result.resistances.psionic = multiplier;
    });
  }

  // === Immunity to Damage Types ===
  const immuneMatch = str.match(/immune\s+to\s+([^\(]+)/i);
  if (immuneMatch) {
    const damageTypes = immuneMatch[1]
      .split(/[\/,]/)
      .map((s) => s.trim().toLowerCase());

    if (!result.immunities) result.immunities = [];
    damageTypes.forEach((type) => {
      if (type.includes("normal") && type.includes("weapon")) {
        result.immunities.push("normal_weapons");
      } else if (type.includes("fire")) {
        result.immunities.push("fire");
      } else if (type.includes("cold")) {
        result.immunities.push("cold");
      } else if (type.includes("magic")) {
        result.immunities.push("magic");
      } else if (type.includes("poison")) {
        result.immunities.push("poison");
      }
    });
  }

  // === Impervious to Damage Types ===
  const imperviousMatch = str.match(/impervious\s+to\s+([^\(]+)/i);
  if (imperviousMatch) {
    const damageTypes = imperviousMatch[1]
      .split(/[\/,]/)
      .map((s) => s.trim().toLowerCase());

    if (!result.impervious_to) result.impervious_to = [];
    damageTypes.forEach((type) => {
      if (type.includes("normal") && type.includes("weapon")) {
        result.impervious_to.push("normal_weapons");
      } else if (type.includes("all")) {
        result.impervious_to.push("all");
      } else if (type.includes("fire")) {
        result.impervious_to.push("fire");
      } else if (type.includes("cold")) {
        result.impervious_to.push("cold");
      }
    });
  }

  // === Flight ===
  // Parse flight abilities like "Flying (Spd ×8)", "Flight (Spd ×5)", "Fly 30 mph", etc.
  const flightMatch = str.match(
    /(?:flying|flight)\s*(?:\(|:)?\s*(?:spd|speed)\s*×\s*(\d+)|fly\s+(\d+)\s*mph|flying\s+speed\s+(\d+)\s*mph/i
  );
  if (flightMatch) {
    let speedMultiplier = null;
    let mphSpeed = null;
    
    // Check for Spd multiplier format: "Flying (Spd ×8)" or "Flight (Spd ×5)"
    if (flightMatch[1]) {
      speedMultiplier = parseInt(flightMatch[1]);
    }
    // Check for mph format: "Fly 30 mph" or "Flying speed 60 mph"
    else if (flightMatch[2]) {
      mphSpeed = parseInt(flightMatch[2]);
    }
    else if (flightMatch[3]) {
      mphSpeed = parseInt(flightMatch[3]);
    }
    
    result.movement = result.movement || {};
    result.movement.flight = {
      speedMultiplier: speedMultiplier, // e.g., 8 for "Spd ×8"
      mphSpeed: mphSpeed, // e.g., 30 for "30 mph"
      mode: "air",
      active: true,
      cannotRunFast: str.includes("cannot run fast"),
    };
  }

  // === Running Speed ===
  const runningMatch = str.match(/running\s+speed\s+(\d+)\s*mph/i);
  if (runningMatch) {
    result.movement = result.movement || {};
    result.movement.run = {
      speed: parseInt(runningMatch[1]) || 20,
    };
  }

  // === See Invisible / Invisibility ===
  if (str.includes("see invisible") || str.includes("see invisibility")) {
    result.senses = result.senses || {};
    result.senses.seeInvisible = true;
  }

  // === Turn Invisible ===
  if (str.includes("turn invisible") || str.includes("invisibility")) {
    result.senses = result.senses || {};
    result.senses.invisibility = true;
  }

  // === Telepathy / Empathy ===
  if (str.includes("telepathy")) {
    result.senses = result.senses || {};
    result.senses.telepathy = true;
  }

  if (str.includes("empathy")) {
    result.senses = result.senses || {};
    result.senses.empathy = true;
  }

  // === Psionics ===
  const psionicMatch = str.match(
    /psionics?[:\s]+level[s]?\s*(\d+)[-\s]+(\d+)[,\s]+i\.?s\.?p\.?\s*(\d+)/i
  );
  if (psionicMatch) {
    result.psionics = {
      levels: [parseInt(psionicMatch[1]), parseInt(psionicMatch[2])],
      isp: parseInt(psionicMatch[3]),
      active: true,
    };
  } else if (str.includes("psionic")) {
    // General psionic flag
    result.psionics = {
      active: true,
      isp: 0, // Will be set from character data
    };
  }

  // === Magic User ===
  if (
    str.includes("spell") ||
    str.includes("wizard") ||
    str.includes("magic") ||
    str.includes("magic user")
  ) {
    result.magic = {
      active: true,
    };
  }

  // === Skills (Track, Prowl, Climb, Swim, Horsemanship, etc.) ===
  // Many monsters and OCCs list these explicitly (Track: 74%, Prowl: 66%, etc.)
  const skillMatches = [
    "track",
    "prowl",
    "climb",
    "swim",
    "horsemanship",
    "detect concealment",
    "detect ambush",
    "scale walls",
    "pick locks",
    "pick pockets",
  ];

  skillMatches.forEach((skillName) => {
    if (str.includes(skillName)) {
      const match = str.match(/(\d+)%/);
      const percent = match
        ? parseInt(match[1])
        : lookupSkill(skillName)?.base || 40;
      result.skills = result.skills || {};
      result.skills[skillName] = percent;
    }
  });

  // === Only Affected By ===
  const onlyAffectedMatch = str.match(
    /only\s+([^,]+?)(?:\s+affect|damage|harm)/i
  );
  if (onlyAffectedMatch) {
    const affects = onlyAffectedMatch[1]
      .split(/[\/,]/)
      .map((s) => s.trim().toLowerCase());
    result.only_affected_by = affects;
  }

  // === Fire Destroys (Double Damage) ===
  if (str.includes("only fire") && str.includes("destroy")) {
    if (!result.resistances) result.resistances = {};
    result.resistances.fire = -1; // -1 means vulnerable (double damage)
    if (!result.only_affected_by) result.only_affected_by = [];
    if (!result.only_affected_by.includes("fire")) {
      result.only_affected_by.push("fire");
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Parse an array of ability strings into a normalized abilities object
 * Unified structure for both creatures and player characters
 * @param {Array<string>} abilities - Array of ability strings from bestiary.json or OCC data
 * @returns {Object} Normalized abilities object with senses, resistances, skills, psionics, magic, movement
 */
export function parseAbilities(abilities = []) {
  if (!Array.isArray(abilities) || abilities.length === 0) {
    return {
      senses: {},
      resistances: {},
      skills: {},
      psionics: {},
      magic: {},
      movement: {},
      healing: null,
      impervious_to: [],
      only_affected_by: null,
    };
  }

  const normalized = {
    senses: {},
    resistances: {},
    skills: {},
    psionics: {},
    magic: {},
    movement: {},
    healing: null,
    impervious_to: [],
    only_affected_by: null,
    other: [], // Store unrecognized abilities for reference
  };

  abilities.forEach((abilityStr) => {
    const parsed = parseAbility(abilityStr);
    if (parsed) {
      // Merge parsed abilities into normalized object (unified structure)
      if (parsed.senses) Object.assign(normalized.senses, parsed.senses);
      if (parsed.resistances)
        Object.assign(normalized.resistances, parsed.resistances);
      if (parsed.skills) Object.assign(normalized.skills, parsed.skills);
      if (parsed.psionics)
        normalized.psionics = { ...normalized.psionics, ...parsed.psionics };
      if (parsed.magic)
        normalized.magic = { ...normalized.magic, ...parsed.magic };
      if (parsed.movement) Object.assign(normalized.movement, parsed.movement);
      if (parsed.healing) normalized.healing = parsed.healing;
      if (parsed.immunities) {
        if (!normalized.immunities) normalized.immunities = [];
        normalized.immunities.push(...parsed.immunities);
      }
      if (parsed.impervious_to)
        normalized.impervious_to.push(...parsed.impervious_to);
      if (parsed.only_affected_by)
        normalized.only_affected_by = parsed.only_affected_by;
    } else {
      // Store unrecognized abilities
      normalized.other.push(abilityStr);
    }
  });

  // Clean up empty arrays/objects
  if (Object.keys(normalized.senses).length === 0) delete normalized.senses;
  if (Object.keys(normalized.resistances).length === 0)
    delete normalized.resistances;
  if (Object.keys(normalized.skills).length === 0) delete normalized.skills;
  if (Object.keys(normalized.psionics).length === 0) delete normalized.psionics;
  if (Object.keys(normalized.magic).length === 0) delete normalized.magic;
  if (Object.keys(normalized.movement).length === 0) delete normalized.movement;
  if (normalized.immunities && normalized.immunities.length === 0)
    delete normalized.immunities;
  if (normalized.impervious_to.length === 0) delete normalized.impervious_to;
  if (normalized.other.length === 0) delete normalized.other;
  if (!normalized.only_affected_by) delete normalized.only_affected_by;
  if (!normalized.healing) delete normalized.healing;

  return normalized;
}

/**
 * Apply bio-regeneration healing for a fighter
 * @param {Object} fighter - Fighter object with parsed abilities
 * @returns {Object} { healed: number, log: string } or null if no regeneration
 */
export function applyBioRegeneration(fighter) {
  if (!fighter.abilities?.healing || fighter.abilities.healing.type !== "bio")
    return null;

  const regen = fighter.abilities.healing;
  if (!regen.active) return null;

  // Check if it's time to regenerate (simplified - assumes called each melee)
  const healed = rollDice(regen.rate);
  const maxHP = fighter.maxHP || fighter.HP || 100;
  const currentHP = fighter.currentHP || fighter.hp || fighter.currentHP || 0;

  if (currentHP >= maxHP) return null; // Already at full HP

  const newHP = Math.min(currentHP + healed, maxHP);
  const actualHealed = newHP - currentHP;

  if (fighter.currentHP !== undefined) fighter.currentHP = newHP;
  if (fighter.hp !== undefined) fighter.hp = newHP;

  return {
    healed: actualHealed,
    log: `${fighter.name} regenerates ${actualHealed} HP (${regen.rate})`,
  };
}

/**
 * Check if damage type should be resisted or ignored
 * @param {Object} fighter - Fighter object with parsed abilities
 * @param {string} damageType - Type of damage ("fire", "cold", "magic", "normal", etc.)
 * @param {boolean} isMagicWeapon - Whether the weapon is magical
 * @returns {Object} { multiplier: number, ignored: boolean, reason: string }
 */
export function checkDamageResistance(
  fighter,
  damageType,
  isMagicWeapon = false
) {
  const abilities = fighter.abilities || {};

  // Check immunities
  if (abilities.immunities && abilities.immunities.includes(damageType)) {
    return { multiplier: 0, ignored: true, reason: `Immune to ${damageType}` };
  }

  // Check impervious to normal weapons
  if (damageType === "normal" && abilities.impervious_to) {
    if (abilities.impervious_to.includes("normal_weapons") && !isMagicWeapon) {
      return {
        multiplier: 0,
        ignored: true,
        reason: "Impervious to normal weapons",
      };
    }
    if (abilities.impervious_to.includes("all") && !isMagicWeapon) {
      return {
        multiplier: 0,
        ignored: true,
        reason: "Impervious to all non-magical attacks",
      };
    }
  }

  // Check only_affected_by
  if (abilities.only_affected_by && abilities.only_affected_by.length > 0) {
    const canBeAffected = abilities.only_affected_by.some(
      (type) =>
        damageType.includes(type) ||
        (damageType === "normal" &&
          (type.includes("magic") || type.includes("psionic")))
    );
    if (
      !canBeAffected &&
      (!isMagicWeapon || !abilities.only_affected_by.includes("magic"))
    ) {
      return {
        multiplier: 0,
        ignored: true,
        reason: `Only affected by ${abilities.only_affected_by.join(", ")}`,
      };
    }
  }

  // Check resistances
  if (abilities.resistances) {
    const resistance = abilities.resistances[damageType];
    if (resistance !== undefined) {
      if (resistance === -1) {
        // Vulnerable (double damage)
        return {
          multiplier: 2,
          ignored: false,
          reason: `Vulnerable to ${damageType} (double damage)`,
        };
      } else {
        // Resistant (reduced damage)
        return {
          multiplier: resistance,
          ignored: false,
          reason: `Resistant to ${damageType} (${Math.round(
            resistance * 100
          )}% damage)`,
        };
      }
    }
  }

  return { multiplier: 1, ignored: false, reason: "Normal damage" };
}

/**
 * Check if character has nightvision (from parsed abilities)
 * @param {Object} abilities - Parsed abilities object or character object
 * @returns {boolean} True if character has nightvision
 */
export function hasNightvision(abilities) {
  if (!abilities) return false;
  // Handle both direct abilities object and character object
  const abilitiesObj = abilities.abilities || abilities;
  return abilitiesObj?.senses?.nightvision?.active === true;
}

/**
 * Get night vision range (from parsed abilities)
 * @param {Object} abilities - Parsed abilities object or character object
 * @returns {number} Night vision range in feet, or 0 if none
 */
export function getNightVisionRange(abilities) {
  if (!abilities) return 0;
  // Handle both direct abilities object and character object
  const abilitiesObj = abilities.abilities || abilities;
  return abilitiesObj?.senses?.nightvision?.range || 0;
}

/**
 * Get resistance multiplier for a damage type
 * @param {Object} abilities - Parsed abilities object or character object
 * @param {string} type - Damage type ("fire", "cold", "magic", "poison")
 * @returns {number} Resistance multiplier (0.5 = half damage, 1.0 = normal)
 */
export function getResistance(abilities, type) {
  if (!abilities) return 1.0;
  const abilitiesObj = abilities.abilities || abilities;
  return abilitiesObj?.resistances?.[type] ?? 1.0;
}

/**
 * Check if character is impervious to a damage type
 * @param {Object} abilities - Parsed abilities object or character object
 * @param {string} type - Damage type ("normal_weapons", "fire", "cold", etc.)
 * @returns {boolean} True if impervious
 */
export function isImperviousTo(abilities, type) {
  if (!abilities) return false;
  const abilitiesObj = abilities.abilities || abilities;
  return abilitiesObj?.impervious_to?.includes(type) || false;
}

/**
 * Check if character has a skill
 * @param {Object} abilities - Parsed abilities object or character object
 * @param {string} skill - Skill name ("prowl", "track", etc.)
 * @returns {boolean} True if character has the skill
 */
export function hasSkill(abilities, skill) {
  if (!abilities) return false;
  const abilitiesObj = abilities.abilities || abilities;
  return !!abilitiesObj?.skills?.[skill];
}

/**
 * Get skill percentage
 * @param {Object} abilities - Parsed abilities object or character object
 * @param {string} skill - Skill name ("prowl", "track", etc.)
 * @returns {number} Skill percentage (0-98)
 */
export function getSkillPercent(abilities, skill) {
  if (!abilities) return 0;
  const abilitiesObj = abilities.abilities || abilities;
  return abilitiesObj?.skills?.[skill] || lookupSkill(skill)?.base || 0;
}

/**
 * Check if fighter can fly (has flight capability)
 * @param {Object} fighter - Fighter object with parsed abilities
 * @returns {boolean} True if fighter has flight capability
 */
export function canFly(fighter) {
  if (!fighter) return false;
  const abilities = fighter.abilities || fighter;
  return abilities?.movement?.flight?.active === true;
}

/**
 * Check if fighter is currently flying (airborne)
 * @param {Object} fighter - Fighter object
 * @returns {boolean} True if fighter is currently airborne
 */
export function isFlying(fighter) {
  if (!fighter) return false;
  // Check if fighter has altitude > 0 (currently airborne)
  const altitude = fighter.altitude || fighter.altitudeFeet || 0;
  return altitude > 0;
}

/**
 * Get fighter's current altitude in feet
 * @param {Object} fighter - Fighter object
 * @returns {number} Altitude in feet (0 = ground level)
 * Note: Altitude is tracked in 5ft increments, similar to hex distances
 */
export function getAltitude(fighter) {
  if (!fighter) return 0;
  // Prefer altitudeFeet, fallback to altitude, default to 0
  return fighter.altitudeFeet !== undefined ? fighter.altitudeFeet : 
         fighter.altitude !== undefined ? fighter.altitude : 0;
}

/**
 * Set fighter's altitude
 * @param {Object} fighter - Fighter object (will be modified)
 * @param {number} altitudeFeet - New altitude in feet (should be in 5ft increments)
 */
export function setAltitude(fighter, altitudeFeet) {
  if (!fighter) return;
  fighter.altitude = altitudeFeet;
  fighter.altitudeFeet = altitudeFeet;
}

/**
 * Get flight speed multiplier from fighter's abilities
 * @param {Object} fighter - Fighter object
 * @returns {number|null} Flight speed multiplier (e.g., 8 for "Spd ×8") or null if not found
 */
export function getFlightSpeedMultiplier(fighter) {
  if (!fighter) return null;
  const abilities = fighter.abilities || fighter;
  return abilities?.movement?.flight?.speedMultiplier || null;
}

/**
 * Calculate flight movement speed based on Spd and flight multiplier
 * Uses official Palladium rules: Flight speed = Spd × multiplier × 18 feet per melee
 * @param {Object} fighter - Fighter object with Spd attribute and flight ability
 * @param {number} attacksPerMelee - Number of attacks per melee round
 * @returns {Object} Flight movement calculations
 */
export function calculateFlightMovement(fighter, attacksPerMelee = 1) {
  if (!fighter) return null;
  
  const speed = fighter.Spd || fighter.spd || fighter.attributes?.Spd || fighter.attributes?.spd || 10;
  const flightMultiplier = getFlightSpeedMultiplier(fighter);
  
  if (!flightMultiplier) {
    // Fallback: if no multiplier, use mph speed if available
    const abilities = fighter.abilities || fighter;
    const mphSpeed = abilities?.movement?.flight?.mphSpeed;
    if (mphSpeed) {
      // Convert mph to feet per melee: mph × 5280 ft/mile ÷ 3600 sec/hour × 15 sec/melee
      // Simplified: mph × 22 = feet per melee (approximate)
      const feetPerMelee = Math.round(mphSpeed * 22);
      const feetPerAction = feetPerMelee / attacksPerMelee;
      return {
        feetPerMelee,
        feetPerAction,
        combatMovementPerAction: Math.floor(feetPerAction * 0.5), // Combat flight speed
        fullMovementPerAction: feetPerAction,
        source: "mph",
      };
    }
    return null;
  }
  
  // Official Palladium: Flight speed = Spd × multiplier × 18 feet per melee
  // (Same base formula as ground movement, but multiplied by flight multiplier)
  const feetPerMelee = speed * flightMultiplier * 18;
  const feetPerAction = feetPerMelee / attacksPerMelee;
  
  return {
    feetPerMelee,
    feetPerAction,
    combatMovementPerAction: Math.floor(feetPerAction * 0.5), // Combat flight speed (can move and attack)
    fullMovementPerAction: feetPerAction, // Full flight speed
    multiplier: flightMultiplier,
    source: "spd_multiplier",
  };
}

/**
 * Check if fighter can see invisible
 * @param {Object} fighter - Fighter object with parsed abilities
 * @returns {boolean} True if fighter can see invisible
 */
export function canSeeInvisible(fighter) {
  if (!fighter) return false;
  const abilities = fighter.abilities || fighter;
  return abilities?.senses?.seeInvisible === true;
}

export default {
  parseAbilities,
  applyBioRegeneration,
  checkDamageResistance,
  hasNightvision,
  getNightVisionRange,
  getResistance,
  isImperviousTo,
  hasSkill,
  getSkillPercent,
  canFly,
  isFlying,
  getAltitude,
  setAltitude,
  getFlightSpeedMultiplier,
  calculateFlightMovement,
  canSeeInvisible,
};
