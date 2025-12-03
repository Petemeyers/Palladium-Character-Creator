import CryptoSecureDice from "../cryptoDice";
import { getHexNeighbors, isValidPosition } from "../../data/movementRules";
import { getGrappleStatus, breakGrappleWithTrip, breakGrappleWithPush, GRAPPLE_STATES } from "../grapplingSystem";

/**
 * Execute a trip maneuver
 * @param {Object} attacker - The attacker fighter object
 * @param {Object} defender - The defender fighter object
 * @param {Object} context - Context object containing:
 *   - fighters: Array of all fighters
 *   - combatActive: Boolean indicating if combat is active
 *   - addLog: Function to add log messages
 *   - setFighters: Function to update fighters state
 *   - setPositions: Function to update positions state
 */
export function executeTripManeuver(attacker, defender, context) {
  const { fighters, combatActive, addLog, setFighters, setPositions } = context;
  
  if (!combatActive) return;
  
  const attackerInArray = fighters.find(f => f.id === attacker.id);
  const defenderInArray = fighters.find(f => f.id === defender.id);
  
  if (!attackerInArray || !defenderInArray) {
    addLog(`Invalid target for trip maneuver!`, "error");
    return;
  }
  
  // Check if attacker can act
  if (attackerInArray.remainingAttacks <= 0) {
    addLog(`⚠️ ${attacker.name} is out of attacks this turn!`, "error");
    return;
  }
  
  // Check if in grapple - if so, use breakGrappleWithTrip
  const attackerGrapple = getGrappleStatus(attackerInArray);
  const defenderGrapple = getGrappleStatus(defenderInArray);
  const inGrapple = attackerGrapple.state === GRAPPLE_STATES.CLINCH && 
                    defenderGrapple.state === GRAPPLE_STATES.CLINCH &&
                    attackerGrapple.opponent === defender.id &&
                    defenderGrapple.opponent === attacker.id;
  
  if (inGrapple) {
    // Break grapple with trip
    const result = breakGrappleWithTrip({ defender: attackerInArray, attacker: defenderInArray });
    
    if (result.success) {
      addLog(result.message, "success");
      
      // Update fighters with new positions and states
      setFighters(prev => prev.map(f => {
        if (f.id === result.attacker.id) {
          const updated = { ...f, ...result.attacker };
          if (result.attacker.hex) {
            updated.hex = result.attacker.hex;
            updated.position = result.attacker.position || result.attacker.hex;
          }
          return updated;
        }
        if (f.id === result.defender.id) {
          return { ...f, ...result.defender };
        }
        return f;
      }));
      
      // Update positions
      if (result.attacker.hex) {
        setPositions(prev => ({
          ...prev,
          [result.attacker.id]: result.attacker.hex,
        }));
      }
      
      // Deduct action
      setFighters(prev => prev.map(f => 
        f.id === attacker.id 
          ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
          : f
      ));
    } else {
      addLog(result.reason, "info");
    }
    return;
  }
  
  // Not in grapple - contested roll
  // Get P.P. bonuses
  const attackerPP = attacker.attributes?.PP || attacker.PP || 10;
  const defenderPP = defender.attributes?.PP || defender.PP || 10;
  
  const attackerPPBonus = Math.floor((attackerPP - 10) / 2);
  const defenderPPBonus = Math.floor((defenderPP - 10) / 2);
  
  // Get hand-to-hand bonuses
  const attackerStrikeBonus = attacker.bonuses?.strike || attacker.handToHand?.strikeBonus || 0;
  const defenderParryBonus = defender.bonuses?.parry || defender.handToHand?.parryBonus || 0;
  const defenderDodgeBonus = defender.bonuses?.dodge || defender.handToHand?.dodgeBonus || 0;
  
  // Attacker rolls strike
  const attackerRoll = CryptoSecureDice.rollD20();
  const attackerTotal = attackerRoll + attackerStrikeBonus + attackerPPBonus;
  
  // Defender can parry or dodge (use the higher of the two)
  const defenderRoll = CryptoSecureDice.rollD20();
  const defenderParryTotal = defenderRoll + defenderParryBonus + defenderPPBonus;
  const defenderDodgeTotal = defenderRoll + defenderDodgeBonus + defenderPPBonus;
  const defenderTotal = Math.max(defenderParryTotal, defenderDodgeTotal);
  
  addLog(`🎲 ${attacker.name} attempts trip: ${attackerRoll} + ${attackerStrikeBonus} (strike) + ${attackerPPBonus} (PP) = ${attackerTotal}`, "info");
  addLog(`🎲 ${defender.name} defends: ${defenderRoll} + ${Math.max(defenderParryBonus, defenderDodgeBonus)} (parry/dodge) + ${defenderPPBonus} (PP) = ${defenderTotal}`, "info");
  
  if (attackerTotal > defenderTotal) {
    // Trip successful!
    addLog(`✅ ${attacker.name} successfully trips ${defender.name}!`, "success");
    
    // Knockdown effect: defender loses 1 action to recover and is prone
    setFighters(prev => prev.map(f => 
      f.id === defender.id 
        ? { ...f, remainingAttacks: Math.max(0, (f.remainingAttacks || 0) - 1), isProne: true }
        : f
    ));
    
    addLog(`💥 ${defender.name} is knocked down! Loses 1 action to recover.`, "warning");
  } else {
    // Trip failed
    addLog(`❌ ${defender.name} avoids the trip!`, "info");
  }
  
  // Deduct attacker's action
  setFighters(prev => prev.map(f => 
    f.id === attacker.id 
      ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
      : f
  ));
}

/**
 * Execute a shove maneuver
 * @param {Object} attacker - The attacker fighter object
 * @param {Object} defender - The defender fighter object
 * @param {Object} context - Context object containing:
 *   - fighters: Array of all fighters
 *   - combatActive: Boolean indicating if combat is active
 *   - addLog: Function to add log messages
 *   - setFighters: Function to update fighters state
 *   - setPositions: Function to update positions state
 *   - positions: Object mapping fighter IDs to positions
 */
export function executeShoveManeuver(attacker, defender, context) {
  const { fighters, combatActive, addLog, setFighters, setPositions, positions } = context;
  
  if (!combatActive) return;
  
  const attackerInArray = fighters.find(f => f.id === attacker.id);
  const defenderInArray = fighters.find(f => f.id === defender.id);
  
  if (!attackerInArray || !defenderInArray) {
    addLog(`Invalid target for shove maneuver!`, "error");
    return;
  }
  
  // Check if attacker can act
  if (attackerInArray.remainingAttacks <= 0) {
    addLog(`⚠️ ${attacker.name} is out of attacks this turn!`, "error");
    return;
  }
  
  // Check if in grapple - if so, use breakGrappleWithPush
  const attackerGrapple = getGrappleStatus(attackerInArray);
  const defenderGrapple = getGrappleStatus(defenderInArray);
  const inGrapple = attackerGrapple.state === GRAPPLE_STATES.CLINCH && 
                    defenderGrapple.state === GRAPPLE_STATES.CLINCH &&
                    attackerGrapple.opponent === defender.id &&
                    defenderGrapple.opponent === attacker.id;
  
  if (inGrapple) {
    // Break grapple with push (defender pushes attacker back)
    const result = breakGrappleWithPush({ defender: attackerInArray, attacker: defenderInArray });
    
    if (result.success) {
      addLog(result.message, "success");
      
      // Update fighters with new positions and states
      setFighters(prev => prev.map(f => {
        if (f.id === result.attacker.id) {
          const updated = { ...f, ...result.attacker };
          if (result.attacker.hex) {
            updated.hex = result.attacker.hex;
            updated.position = result.attacker.position || result.attacker.hex;
          }
          return updated;
        }
        if (f.id === result.defender.id) {
          return { ...f, ...result.defender };
        }
        return f;
      }));
      
      // Update positions
      if (result.attacker.hex) {
        setPositions(prev => ({
          ...prev,
          [result.attacker.id]: result.attacker.hex,
        }));
      }
      
      // Deduct action
      setFighters(prev => prev.map(f => 
        f.id === attacker.id 
          ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
          : f
      ));
    } else {
      addLog(result.reason, "info");
    }
    return;
  }
  
  // Not in grapple - contested strength roll
  const attackerPS = attacker.attributes?.PS || attacker.PS || 10;
  const defenderPS = defender.attributes?.PS || defender.PS || 10;
  
  const attackerPSBonus = Math.floor((attackerPS - 10) / 2);
  const defenderPSBonus = Math.floor((defenderPS - 10) / 2);
  
  // Attacker rolls strength
  const attackerRoll = CryptoSecureDice.rollD20();
  const attackerTotal = attackerRoll + attackerPSBonus;
  
  // Defender resists with strength
  const defenderRoll = CryptoSecureDice.rollD20();
  const defenderTotal = defenderRoll + defenderPSBonus;
  
  addLog(`🎲 ${attacker.name} attempts shove: ${attackerRoll} + ${attackerPSBonus} (PS) = ${attackerTotal}`, "info");
  addLog(`🎲 ${defender.name} resists: ${defenderRoll} + ${defenderPSBonus} (PS) = ${defenderTotal}`, "info");
  
  if (attackerTotal > defenderTotal) {
    // Shove successful - push defender back 1 hex
    addLog(`✅ ${attacker.name} successfully shoves ${defender.name}!`, "success");
    
    // Move defender back 1 hex (simplified - could be enhanced with direction)
    const defenderPos = positions[defender.id] || { x: 0, y: 0 };
    const attackerPos = positions[attacker.id] || { x: 0, y: 0 };
    
    // Calculate direction away from attacker
    const dx = defenderPos.x - attackerPos.x;
    const dy = defenderPos.y - attackerPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      const newX = defenderPos.x + (dx / distance) * 5; // Push back 5 feet
      const newY = defenderPos.y + (dy / distance) * 5;
      
      setPositions(prev => ({
        ...prev,
        [defender.id]: { x: newX, y: newY },
      }));
      
      addLog(`💥 ${defender.name} is pushed back!`, "warning");
    }
  } else {
    // Shove failed
    addLog(`❌ ${defender.name} resists the shove!`, "info");
  }
  
  // Deduct attacker's action
  setFighters(prev => prev.map(f => 
    f.id === attacker.id 
      ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
      : f
  ));
}

/**
 * Execute a disarm maneuver
 * @param {Object} attacker - The attacker fighter object
 * @param {Object} defender - The defender fighter object
 * @param {Object} context - Context object containing:
 *   - fighters: Array of all fighters
 *   - combatActive: Boolean indicating if combat is active
 *   - addLog: Function to add log messages
 *   - setFighters: Function to update fighters state
 *   - positions: Object mapping fighter IDs to positions
 */
export function executeDisarmManeuver(attacker, defender, context) {
  const { fighters, combatActive, addLog, setFighters, positions } = context;
  
  if (!combatActive) return;
  
  const attackerInArray = fighters.find(f => f.id === attacker.id);
  const defenderInArray = fighters.find(f => f.id === defender.id);
  
  if (!attackerInArray || !defenderInArray) {
    addLog(`Invalid target for disarm maneuver!`, "error");
    return;
  }
  
  // Check if attacker can act
  if (attackerInArray.remainingAttacks <= 0) {
    addLog(`⚠️ ${attacker.name} is out of attacks this turn!`, "error");
    return;
  }
  
  // Check if defender has a weapon - try multiple formats
  let defenderWeapon = null;
  let weaponIndex = -1;
  
  // Try array format first (most common)
  if (Array.isArray(defenderInArray.equippedWeapons)) {
    for (let i = 0; i < defenderInArray.equippedWeapons.length; i++) {
      const weapon = defenderInArray.equippedWeapons[i];
      if (weapon && weapon.name && weapon.name !== "Unarmed" && weapon.type !== "unarmed") {
        defenderWeapon = weapon;
        weaponIndex = i;
        break;
      }
    }
  }
  
  // Try object format with primary/secondary
  if (!defenderWeapon && defenderInArray.equippedWeapons) {
    const primary = defenderInArray.equippedWeapons.primary;
    const secondary = defenderInArray.equippedWeapons.secondary;
    
    if (primary && primary.name && primary.name !== "Unarmed" && primary.type !== "unarmed") {
      defenderWeapon = primary;
    } else if (secondary && secondary.name && secondary.name !== "Unarmed" && secondary.type !== "unarmed") {
      defenderWeapon = secondary;
    }
  }
  
  // Try checking if equippedWeapons is an object with array-like properties
  if (!defenderWeapon && defenderInArray.equippedWeapons) {
    const weapons = defenderInArray.equippedWeapons;
    if (weapons[0] && weapons[0].name && weapons[0].name !== "Unarmed" && weapons[0].type !== "unarmed") {
      defenderWeapon = weapons[0];
      weaponIndex = 0;
    }
  }
  
  if (!defenderWeapon || defenderWeapon.name === "Unarmed" || defenderWeapon.type === "unarmed") {
    addLog(`❌ ${defender.name} has no weapon to disarm!`, "error");
    if (process.env.NODE_ENV === 'development') {
      console.log('[Disarm] Defender equippedWeapons:', defenderInArray.equippedWeapons);
    }
    return;
  }
  
  // Contested roll: attacker's strike vs defender's parry
  const attackerPP = attacker.attributes?.PP || attacker.PP || 10;
  const defenderPP = defender.attributes?.PP || defender.PP || 10;
  
  const attackerPPBonus = Math.floor((attackerPP - 10) / 2);
  const defenderPPBonus = Math.floor((defenderPP - 10) / 2);
  
  const attackerStrikeBonus = attacker.bonuses?.strike || attacker.handToHand?.strikeBonus || 0;
  const defenderParryBonus = defender.bonuses?.parry || defender.handToHand?.parryBonus || 0;
  
  // Attacker rolls strike
  const attackerRoll = CryptoSecureDice.rollD20();
  const attackerTotal = attackerRoll + attackerStrikeBonus + attackerPPBonus;
  
  // Defender rolls parry
  const defenderRoll = CryptoSecureDice.rollD20();
  const defenderTotal = defenderRoll + defenderParryBonus + defenderPPBonus;
  
  addLog(`🎲 ${attacker.name} attempts disarm: ${attackerRoll} + ${attackerStrikeBonus} (strike) + ${attackerPPBonus} (PP) = ${attackerTotal}`, "info");
  addLog(`🎲 ${defender.name} defends: ${defenderRoll} + ${defenderParryBonus} (parry) + ${defenderPPBonus} (PP) = ${defenderTotal}`, "info");
  
  if (attackerTotal > defenderTotal) {
    // Disarm successful!
    addLog(`✅ ${attacker.name} successfully disarms ${defender.name}!`, "success");
    
    // Get defender's position
    const defenderPos = positions[defender.id] || defender.hex || defender.position || { x: 0, y: 0 };
    
    // Get adjacent hexes
    const neighbors = getHexNeighbors(defenderPos.x, defenderPos.y);
    
    // Filter out occupied hexes
    const availableHexes = neighbors.filter(hex => {
      // Check if hex is occupied by another fighter
      const isOccupied = Object.values(positions).some(pos => 
        pos && Math.abs(pos.x - hex.x) < 0.5 && Math.abs(pos.y - hex.y) < 0.5
      );
      return !isOccupied && isValidPosition(hex.x, hex.y);
    });
    
    // Choose a random hex (or fallback to first available, or defender's position if none)
    let dropHex = defenderPos;
    if (availableHexes.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableHexes.length);
      dropHex = availableHexes[randomIndex];
    }
    
    // Remove weapon from defender
    setFighters(prev => prev.map(f => {
      if (f.id === defender.id) {
        const updated = { ...f };
        
        // Handle array format
        if (Array.isArray(updated.equippedWeapons) && weaponIndex >= 0) {
          const newWeapons = [...updated.equippedWeapons];
          newWeapons[weaponIndex] = {
            name: "Unarmed",
            damage: "1d3",
            type: "unarmed",
            category: "unarmed",
            slot: newWeapons[weaponIndex]?.slot || "Right Hand",
          };
          updated.equippedWeapons = newWeapons;
        } 
        // Handle object format with primary/secondary
        else if (updated.equippedWeapons && typeof updated.equippedWeapons === 'object') {
          const unarmedWeapon = { 
            name: "Unarmed", 
            damage: "1d3", 
            type: "unarmed",
            category: "unarmed",
            slot: defenderWeapon.slot || "Right Hand",
          };
          
          if (updated.equippedWeapons.primary?.name === defenderWeapon.name || 
              (updated.equippedWeapons.primary && !Array.isArray(updated.equippedWeapons))) {
            updated.equippedWeapons = {
              ...updated.equippedWeapons,
              primary: unarmedWeapon,
            };
          } else if (updated.equippedWeapons.secondary?.name === defenderWeapon.name) {
            updated.equippedWeapons = {
              ...updated.equippedWeapons,
              secondary: unarmedWeapon,
            };
          } else if (updated.equippedWeapons[0] && updated.equippedWeapons[0].name === defenderWeapon.name) {
            // Handle object with indexed properties
            updated.equippedWeapons[0] = unarmedWeapon;
          }
        }
        
        return updated;
      }
      return f;
    }));
    
    addLog(`💥 ${defender.name} drops ${defenderWeapon.name} at hex (${Math.round(dropHex.x)}, ${Math.round(dropHex.y)})!`, "warning");
    addLog(`🗡️ ${defenderWeapon.name} is now on the ground and can be picked up.`, "info");
  } else {
    // Disarm failed
    addLog(`❌ ${defender.name} maintains grip on ${defenderWeapon.name}!`, "info");
  }
  
  // Deduct attacker's action
  setFighters(prev => prev.map(f => 
    f.id === attacker.id 
      ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
      : f
  ));
}

