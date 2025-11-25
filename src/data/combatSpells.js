// Combat-focused spells for AI enemies to use
// Imports from comprehensive backend spell database
import spellData from "../../backend/data/spells.json";

// Convert backend spell format to combat-ready format
const convertSpellsToCombat = () => {
  const combatSpells = [];

  Object.keys(spellData).forEach((levelKey) => {
    const levelSpells = spellData[levelKey];

    Object.keys(levelSpells).forEach((spellName) => {
      const spell = levelSpells[spellName];

      // Only include spells with combat damage
      if (spell.combatDamage && spell.combatDamage !== "0") {
        combatSpells.push({
          name: spellName,
          level: spell.level,
          damage: spell.combatDamage,
          damageType: spell.damageType,
          range: spell.range,
          description: spell.description,
          save: spell.save,
          ppeCost: spell.ppeCost,
        });
      }
    });
  });

  return combatSpells;
};

export const combatSpells = convertSpellsToCombat();

// Get spells appropriate for a given level wizard
export const getSpellsForLevel = (wizardLevel) => {
  const maxSpellLevel = Math.min(wizardLevel, 12);
  return combatSpells.filter((spell) => spell.level <= maxSpellLevel);
};

// Get a random combat spell for a wizard
export const getRandomCombatSpell = (wizardLevel = 3) => {
  const availableSpells = getSpellsForLevel(wizardLevel);
  if (availableSpells.length === 0) {
    // Fallback to basic attack
    return {
      name: "Energy Bolt",
      level: 1,
      damage: "2d6",
      damageType: "force",
      range: "60ft",
      description: "Basic magical attack",
    };
  }

  const randomIndex = Math.floor(Math.random() * availableSpells.length);
  return availableSpells[randomIndex];
};

export default combatSpells;
