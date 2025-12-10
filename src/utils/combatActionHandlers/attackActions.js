import { executeChargeAttack } from "../distanceCombatSystem.js";
import { getChargeMomentumModifiers, canChargeInTerrain } from "../reachCombatRules.js";
import { getDynamicWidth, getActorsInProximity, getDynamicHeight } from "../environmentMetrics.js";
import { TERRAIN_TYPES } from "../terrainSystem.js";
import { calculateDistance } from "../../data/movementRules";

/**
 * Handle charge attack (move and attack with bonuses)
 * @param {Object} attacker - The attacker fighter object
 * @param {Object} target - The target fighter object
 * @param {Object} context - Context object containing:
 *   - positions: Object mapping fighter IDs to positions
 *   - fighters: Array of all fighters
 *   - selectedAttackWeapon: Selected weapon for attack
 *   - combatTerrain: Combat terrain data
 *   - attack: Function to execute attack
 *   - addLog: Function to add log messages
 *   - setPositions: Function to update positions state
 *   - setFighters: Function to update fighters state
 *   - positionsRef: Ref to positions
 */
export function handleChargeAttack(attacker, target, context) {
  const {
    positions,
    fighters,
    selectedAttackWeapon,
    combatTerrain,
    attack,
    addLog,
    setPositions,
    setFighters,
    positionsRef,
  } = context;

  if (!positions[attacker.id] || !positions[target.id]) {
    addLog("Cannot charge: invalid positions", "error");
    return;
  }
  
  // Get terrain data for charge feasibility check
  const terrain = combatTerrain?.terrain || "OPEN_GROUND";
  const terrainData = TERRAIN_TYPES[terrain];
  
  // Get nearby actors for dynamic width calculation
  const nearbyActors = getActorsInProximity(
    positions[attacker.id],
    fighters,
    positions,
    3
  );
  
  // Get dynamic width and height for charge modifiers
  const chargeWidth = getDynamicWidth(terrain, nearbyActors, {
    attackerPos: positions[attacker.id],
    positions: positions
  });
  const chargeHeight = getDynamicHeight(terrain, nearbyActors);
  
  // Calculate charge distance
  const chargeDistance = calculateDistance(positions[attacker.id], positions[target.id]);
  
  // Get terrain data for charge feasibility
  const terrainDensity = TERRAIN_TYPES[terrain]?.density || combatTerrain?.terrainData?.density || 0;
  const hasObstructions = TERRAIN_TYPES[terrain]?.hasObstructions || combatTerrain?.terrainData?.hasObstructions || false;
  const isMounted = attacker.isMounted || false;
  
  // Check if charge is possible in terrain
  const chargeCheck = canChargeInTerrain(terrainDensity, hasObstructions, isMounted);
  if (!chargeCheck.canCharge && terrainDensity >= 0.8) {
    addLog(`❌ ${chargeCheck.reason}`, "error");
    return;
  }
  
  // Check if this is a charge in a tight space (large creature charging)
  const isChargeInTightSpace = chargeWidth <= 6 && attacker.weight > 200;
  
  // Get charge momentum modifiers (for large creatures in tunnels)
  let chargeMomentumMods = null;
  if (isChargeInTightSpace || chargeCheck.reason.includes("narrow")) {
    const defenderWeapon = target.equippedWeapons?.primary || target.equippedWeapons?.secondary || null;
    const isBrace = defenderWeapon && (defenderWeapon.name?.toLowerCase().includes("spear") || 
                                      defenderWeapon.name?.toLowerCase().includes("pike"));
    
    chargeMomentumMods = getChargeMomentumModifiers(
      attacker,
      target,
      chargeDistance,
      chargeWidth,
      terrainDensity,
      hasObstructions,
      isBrace,
      isMounted
    );
  }
  
  const chargeResult = executeChargeAttack(
    attacker, 
    target, 
    positions[attacker.id], 
    positions[target.id], 
    selectedAttackWeapon,
    {
      terrain: terrain,
      terrainData: terrainData,
      actors: nearbyActors,
      positions: positions,
      attackerPos: positions[attacker.id],
      chargeHeight: chargeHeight
    }
  );
  
  if (!chargeResult.success) {
    addLog(`❌ ${chargeResult.reason}`, "error");
    return;
  }
  
  // Move to new position
  setPositions(prev => {
    const updated = {
    ...prev,
    [attacker.id]: chargeResult.newPosition
    };
    positionsRef.current = updated;
    return updated;
  });
  
  addLog(`⚡ ${attacker.name} charges! ${chargeResult.description}`, "info");
  
  if (chargeResult.terrainModifiers) {
    addLog(`🌲 ${chargeResult.terrainModifiers}`, "info");
  }
  
  // Log charge momentum modifiers for large creatures in tight spaces
  if (chargeMomentumMods && chargeMomentumMods.notes.length > 0) {
    chargeMomentumMods.notes.forEach(note => {
      addLog(`💥 ${note}`, "warning");
    });
  }
  
  // Attack with charge bonuses (merge with momentum modifiers if applicable)
  setTimeout(() => {
    // executeChargeAttack returns bonuses.strike and bonuses.damage
    // attack() expects strikeBonus and damageMultiplier
    const baseStrikeBonus = chargeResult.bonuses.strike || 0;
    const baseDamageMultiplier = chargeResult.bonuses.damage || 1;
    
    // Apply momentum modifiers if applicable (momentum adds on top of base charge)
    const momentumStrikeBonus = chargeMomentumMods ? chargeMomentumMods.strike - 2 : 0; // Base charge is +2, momentum adds more
    const momentumDamageMultiplier = chargeMomentumMods?.damageMultiplier || 1;
    
    const finalChargeBonuses = {
      strikeBonus: baseStrikeBonus + momentumStrikeBonus,
      damageMultiplier: momentumDamageMultiplier > 1 ? momentumDamageMultiplier : baseDamageMultiplier
    };
    
    attack(attacker, target.id, finalChargeBonuses);
    
    // Apply charge penalty (lose next attack)
    if (chargeResult.penalties.loseNextAttack) {
      setFighters(prev => prev.map(f => {
        if (f.id === attacker.id) {
          return { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) };
        }
        return f;
      }));
      
      addLog(`⚠️ ${attacker.name} loses next attack due to charge recovery`, "info");
    }
  }, 500);
}

/**
 * Handle strike with movement (move then attack in one action)
 * @param {Object} attacker - The attacker fighter object
 * @param {Object} movementHex - Target hex for movement
 * @param {Object} target - The target fighter object
 * @param {Object} weapon - Weapon to use for attack
 * @param {Object} context - Context object containing:
 *   - positions: Object mapping fighter IDs to positions
 *   - selectedAttackWeapon: Selected weapon for attack
 *   - attack: Function to execute attack
 *   - addLog: Function to add log messages
 *   - setPositions: Function to update positions state
 *   - setSelectedMovementHex: Function to clear selected movement hex
 *   - setShowMovementSelection: Function to hide movement selection
 *   - positionsRef: Ref to positions
 */
export function handleStrikeWithMovement(attacker, movementHex, target, weapon, context) {
  const {
    positions,
    selectedAttackWeapon,
    attack,
    addLog,
    setPositions,
    setSelectedMovementHex,
    setShowMovementSelection,
    positionsRef,
  } = context;

  // First, move the character
  if (movementHex) {
    setPositions(prev => {
      const updated = {
      ...prev,
      [attacker.id]: movementHex
      };
      positionsRef.current = updated;
      return updated;
    });
    
    const distance = calculateDistance(positions[attacker.id] || { x: 0, y: 0 }, movementHex);
    addLog(`🏃 ${attacker.name} moves ${Math.round(distance)}ft and attacks!`, "info");
  }
  
  // Then attack (this will deduct 1 attack automatically)
  setTimeout(() => {
    // Use the provided weapon if available, otherwise use selectedAttackWeapon
    const weaponToUse = weapon || selectedAttackWeapon;
    attack(attacker, target.id, {}, weaponToUse);
  }, movementHex ? 500 : 0); // Delay if moved
  
  // Clear movement selection
  setSelectedMovementHex(null);
  setShowMovementSelection(false);
}

