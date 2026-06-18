import CryptoSecureDice from "../cryptoDice";
import { getHexNeighbors, isValidPosition } from "../../data/movementRules";
import { getGrappleStatus, breakGrappleWithTrip, breakGrappleWithPush, GRAPPLE_STATES } from "../grapplingSystem";

function revealConcealment(fighter) {
  if (!fighter) return fighter;
  const wasHidden = !!(fighter.hidden || fighter.isProwling || fighter.prowlState?.hidden);
  if (!wasHidden) return fighter;

  return {
    ...fighter,
    hidden: false,
    isProwling: false,
    prowlState: {
      ...(fighter.prowlState || {}),
      hidden: false,
      prowlSuccess: false,
      brokenBy: "movement",
    },
  };
}

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
  if (attackerInArray.remainingActions <= 0) {
    addLog(`âš ï¸ ${attacker.name} is out of attacks this turn!`, "error");
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
      const movedAttacker = revealConcealment(result.attacker);
      const updatedDefenderResult = revealConcealment(result.defender);
      
      // Update fighters with new positions and states
      setFighters(prev => prev.map(f => {
        if (f.id === movedAttacker.id) {
          const updated = { ...f, ...movedAttacker };
          if (movedAttacker.hex) {
            updated.hex = movedAttacker.hex;
            updated.position = movedAttacker.position || movedAttacker.hex;
          }
          return updated;
        }
        if (f.id === updatedDefenderResult.id) {
          return { ...f, ...updatedDefenderResult };
        }
        return f;
      }));
      
      // Update positions
      if (result.attacker.hex) {
        setPositions(prev => ({
          ...prev,
          [movedAttacker.id]: movedAttacker.hex,
        }));
      }
      if (movedAttacker !== result.attacker) {
        addLog(`ðŸ‘ï¸ ${result.attacker.name} is revealed after being thrown off balance!`, "info");
      }
      
      // Deduct action
      setFighters(prev => prev.map(f => 
        f.id === attacker.id 
          ? { ...f, remainingActions: Math.max(0, f.remainingActions - 1) }
          : f
      ));
    } else {
      addLog(result.reason, "info");
    }
    return;
  }
  
  // Not in grapple - contested roll
  // Get agility bonuses
  const attackerPP = attacker.attributes?.PP || attacker.PP || 10;
  const defenderPP = defender.attributes?.PP || defender.PP || 10;
  
  const attackerPPBonus = Math.floor((attackerPP - 10) / 2);
  const defenderPPBonus = Math.floor((defenderPP - 10) / 2);
  
  // Get hand-to-hand bonuses
  const attackerAttackBonus = attacker.bonuses?.attack || attacker.handToHand?.attackBonus || 0;
  const defenderBlockBonus = defender.bonuses?.block || defender.handToHand?.blockBonus || 0;
  const defenderEvadeBonus = defender.bonuses?.evade || defender.handToHand?.evadeBonus || 0;
  
  // Attacker rolls attack
  const attackerRoll = CryptoSecureDice.rollD20();
  const attackerTotal = attackerRoll + attackerAttackBonus + attackerPPBonus;
  
  // Defender can block or evade (use the higher of the two)
  const defenderRoll = CryptoSecureDice.rollD20();
  const defenderBlockTotal = defenderRoll + defenderBlockBonus + defenderPPBonus;
  const defenderEvadeTotal = defenderRoll + defenderEvadeBonus + defenderPPBonus;
  const defenderTotal = Math.max(defenderBlockTotal, defenderEvadeTotal);
  
  addLog(`ðŸŽ² ${attacker.name} attempts trip: ${attackerRoll} + ${attackerAttackBonus} (attack) + ${attackerPPBonus} (PP) = ${attackerTotal}`, "info");
  addLog(`ðŸŽ² ${defender.name} defends: ${defenderRoll} + ${Math.max(defenderBlockBonus, defenderEvadeBonus)} (block/evade) + ${defenderPPBonus} (PP) = ${defenderTotal}`, "info");
  
  if (attackerTotal > defenderTotal) {
    // Trip successful!
    addLog(`âœ… ${attacker.name} successfully trips ${defender.name}!`, "success");
    
    // Knockdown effect: defender loses 1 action to recover and is prone
    setFighters(prev => prev.map(f => 
      f.id === defender.id 
        ? { ...f, remainingActions: Math.max(0, (f.remainingActions || 0) - 1), isProne: true }
        : f
    ));
    
    addLog(`ðŸ’¥ ${defender.name} is knocked down! Loses 1 action to recover.`, "warning");
  } else {
    // Trip failed
    addLog(`âŒ ${defender.name} avoids the trip!`, "info");
  }
  
  // Deduct attacker's action
  setFighters(prev => prev.map(f => 
    f.id === attacker.id 
      ? { ...f, remainingActions: Math.max(0, f.remainingActions - 1) }
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
  if (attackerInArray.remainingActions <= 0) {
    addLog(`âš ï¸ ${attacker.name} is out of attacks this turn!`, "error");
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
          ? { ...f, remainingActions: Math.max(0, f.remainingActions - 1) }
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
  
  addLog(`ðŸŽ² ${attacker.name} attempts shove: ${attackerRoll} + ${attackerPSBonus} (PS) = ${attackerTotal}`, "info");
  addLog(`ðŸŽ² ${defender.name} resists: ${defenderRoll} + ${defenderPSBonus} (PS) = ${defenderTotal}`, "info");
  
  if (attackerTotal > defenderTotal) {
    // Shove successful - push defender back 1 hex
    addLog(`âœ… ${attacker.name} successfully shoves ${defender.name}!`, "success");
    
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
      
      addLog(`ðŸ’¥ ${defender.name} is pushed back!`, "warning");
      if (defender.hidden || defender.isProwling || defender.prowlState?.hidden) {
        setFighters(prev =>
          prev.map(f => (f.id === defender.id ? revealConcealment(f) : f))
        );
        addLog(`ðŸ‘ï¸ ${defender.name} is revealed after being shoved out of position!`, "info");
      }
    }
  } else {
    // Shove failed
    addLog(`âŒ ${defender.name} resists the shove!`, "info");
  }
  
  // Deduct attacker's action
  setFighters(prev => prev.map(f => 
    f.id === attacker.id 
      ? { ...f, remainingActions: Math.max(0, f.remainingActions - 1) }
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
  if (attackerInArray.remainingActions <= 0) {
    addLog(`âš ï¸ ${attacker.name} is out of attacks this turn!`, "error");
    return;
  }
  
  // Check if defender has a weapon - try multiple formats
  let defenderWeapon = null;
  let weaponIndex = -1;
  
  // Try array format first (most common)
  if (Array.isArray(defenderInArray.equistaminadWeapons)) {
    for (let i = 0; i < defenderInArray.equistaminadWeapons.length; i++) {
      const weapon = defenderInArray.equistaminadWeapons[i];
      if (weapon && weapon.name && weapon.name !== "Unarmed" && weapon.type !== "unarmed") {
        defenderWeapon = weapon;
        weaponIndex = i;
        break;
      }
    }
  }
  
  // Try object format with primary/secondary
  if (!defenderWeapon && defenderInArray.equistaminadWeapons) {
    const primary = defenderInArray.equistaminadWeapons.primary;
    const secondary = defenderInArray.equistaminadWeapons.secondary;
    
    if (primary && primary.name && primary.name !== "Unarmed" && primary.type !== "unarmed") {
      defenderWeapon = primary;
    } else if (secondary && secondary.name && secondary.name !== "Unarmed" && secondary.type !== "unarmed") {
      defenderWeapon = secondary;
    }
  }
  
  // Try checking if equistaminadWeapons is an object with array-like properties
  if (!defenderWeapon && defenderInArray.equistaminadWeapons) {
    const weapons = defenderInArray.equistaminadWeapons;
    if (weapons[0] && weapons[0].name && weapons[0].name !== "Unarmed" && weapons[0].type !== "unarmed") {
      defenderWeapon = weapons[0];
      weaponIndex = 0;
    }
  }
  
  if (!defenderWeapon || defenderWeapon.name === "Unarmed" || defenderWeapon.type === "unarmed") {
    addLog(`âŒ ${defender.name} has no weapon to disarm!`, "error");
    return;
  }
  
  // Contested roll: attacker's attack vs defender's block
  const attackerPP = attacker.attributes?.PP || attacker.PP || 10;
  const defenderPP = defender.attributes?.PP || defender.PP || 10;
  
  const attackerPPBonus = Math.floor((attackerPP - 10) / 2);
  const defenderPPBonus = Math.floor((defenderPP - 10) / 2);
  
  const attackerAttackBonus = attacker.bonuses?.attack || attacker.handToHand?.attackBonus || 0;
  const defenderBlockBonus = defender.bonuses?.block || defender.handToHand?.blockBonus || 0;
  
  // Attacker rolls attack
  const attackerRoll = CryptoSecureDice.rollD20();
  const attackerTotal = attackerRoll + attackerAttackBonus + attackerPPBonus;
  
  // Defender rolls block
  const defenderRoll = CryptoSecureDice.rollD20();
  const defenderTotal = defenderRoll + defenderBlockBonus + defenderPPBonus;
  
  addLog(`ðŸŽ² ${attacker.name} attempts disarm: ${attackerRoll} + ${attackerAttackBonus} (attack) + ${attackerPPBonus} (PP) = ${attackerTotal}`, "info");
  addLog(`ðŸŽ² ${defender.name} defends: ${defenderRoll} + ${defenderBlockBonus} (block) + ${defenderPPBonus} (PP) = ${defenderTotal}`, "info");
  
  if (attackerTotal > defenderTotal) {
    // Disarm successful!
    addLog(`âœ… ${attacker.name} successfully disarms ${defender.name}!`, "success");
    
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
        if (Array.isArray(updated.equistaminadWeapons) && weaponIndex >= 0) {
          const newWeapons = [...updated.equistaminadWeapons];
          newWeapons[weaponIndex] = {
            name: "Unarmed",
            damage: "1d3",
            type: "unarmed",
            category: "unarmed",
            slot: newWeapons[weaponIndex]?.slot || "Right Hand",
          };
          updated.equistaminadWeapons = newWeapons;
        } 
        // Handle object format with primary/secondary
        else if (updated.equistaminadWeapons && typeof updated.equistaminadWeapons === 'object') {
          const unarmedWeapon = { 
            name: "Unarmed", 
            damage: "1d3", 
            type: "unarmed",
            category: "unarmed",
            slot: defenderWeapon.slot || "Right Hand",
          };
          
          if (updated.equistaminadWeapons.primary?.name === defenderWeapon.name || 
              (updated.equistaminadWeapons.primary && !Array.isArray(updated.equistaminadWeapons))) {
            updated.equistaminadWeapons = {
              ...updated.equistaminadWeapons,
              primary: unarmedWeapon,
            };
          } else if (updated.equistaminadWeapons.secondary?.name === defenderWeapon.name) {
            updated.equistaminadWeapons = {
              ...updated.equistaminadWeapons,
              secondary: unarmedWeapon,
            };
          } else if (updated.equistaminadWeapons[0] && updated.equistaminadWeapons[0].name === defenderWeapon.name) {
            // Handle object with indexed properties
            updated.equistaminadWeapons[0] = unarmedWeapon;
          }
        }
        
        return updated;
      }
      return f;
    }));
    
    addLog(`ðŸ’¥ ${defender.name} drops ${defenderWeapon.name} at hex (${Math.round(dropHex.x)}, ${Math.round(dropHex.y)})!`, "warning");
    addLog(`ðŸ—¡ï¸ ${defenderWeapon.name} is now on the ground and can be picked up.`, "info");
  } else {
    // Disarm failed
    addLog(`âŒ ${defender.name} maintains grip on ${defenderWeapon.name}!`, "info");
  }
  
  // Deduct attacker's action
  setFighters(prev => prev.map(f => 
    f.id === attacker.id 
      ? { ...f, remainingActions: Math.max(0, f.remainingActions - 1) }
      : f
  ));
}

