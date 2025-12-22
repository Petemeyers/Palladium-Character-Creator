// src/utils/captureSystem.js

/**
 * Can this fighter be captured right now?
 * Typically: surrendered, alive, on the field, not already captured.
 */
export function canBeCaptured(fighter) {
  if (!fighter) return false;

  const isAlive =
    (fighter.currentHP ?? fighter.totalHP ?? 1) > 0 &&
    !fighter.isDead &&
    !fighter.isKO;

  const surrendered =
    fighter.moraleState?.status === "SURRENDERED" || fighter.hasSurrendered;

  const alreadyCaptured = !!fighter.isCaptured;

  return isAlive && surrendered && !alreadyCaptured;
}

/**
 * Mark a fighter as captured and tied up.
 * Removes their ability to act.
 */
export function applyCapture(fighter, captorId) {
  if (!fighter) return fighter;

  const baseMorale = fighter.moraleState || {};
  return {
    ...fighter,
    remainingAttacks: 0,
    isCaptured: true,
    hasSurrendered: true,
    captiveOf: captorId || null,
    moraleState: {
      ...baseMorale,
      status: "SURRENDERED"
    },
    conditions: {
      ...(fighter.conditions || {}),
      restrained: {
        type: "restrained",
        source: "capture",
        // You can add rules here if you want:
        // e.g., cannot move, cannot attack, -10 to escape attempts, etc.
      }
    }
  };
}

/**
 * Simple "tie up" operation – a wrapper for capture with flavor.
 */
export function tieUpPrisoner(fighter, captorId) {
  return applyCapture(fighter, captorId);
}

/**
 * Loot a prisoner: return their loot and strip their carried gear.
 * The exact fields depend on your character data shape – keep it generic.
 */
export function lootPrisoner(fighter) {
  if (!fighter) return { updatedFighter: fighter, loot: [] };

  const inventory = fighter.inventory || fighter.items || [];
  const equippedWeapons = fighter.equippedWeapons || [];
  const weapons = fighter.weapons || [];
  
  // Include equipped weapons in loot (including natural attacks like Fire Whip)
  // Exclude "Unarmed", "None", and "Claw" (natural attacks that can't be removed)
  const allWeapons = [...weapons, ...equippedWeapons.filter(w => 
    w && w.name && w.name !== "Unarmed" && w.name !== "None" && w.name !== "Claw"
  )];
  
  const armor = fighter.equippedArmor || fighter.armor || null;

  const loot = {
    inventory,
    weapons: allWeapons,
    armor
  };

  const updated = {
    ...fighter,
    inventory: [],
    items: [],
    weapons: [],
    equippedWeapons: fighter.equippedWeapons?.map(w => {
      // If weapon was looted, replace with Unarmed (unless it's already Unarmed, None, or Claw)
      if (w && w.name && w.name !== "Unarmed" && w.name !== "None" && w.name !== "Claw") {
        return { name: "Unarmed", damage: "1d3", type: "unarmed", category: "unarmed", slot: w.slot || "Right Hand" };
      }
      // Keep Unarmed, None, and Claw as-is (they weren't looted)
      return w;
    }) || [],
    equippedArmor: null,
    armor: null
  };

  return { updatedFighter: updated, loot };
}

