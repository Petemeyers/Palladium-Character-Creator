import { getMovementRange } from "../../data/movementRules";

/**
 * Handle movement selection from TacticalMap
 * @param {number} x - Target x coordinate
 * @param {number} y - Target y coordinate
 * @param {Object} context - Context object containing:
 *   - movementMode: Object with active and isRunning properties
 *   - selectedMovementFighter: ID of fighter moving
 *   - positions: Object mapping fighter IDs to positions
 *   - currentFighter: Current fighter object
 *   - addLog: Function to add log messages
 *   - fighters: Array of all fighters
 *   - isHexOccupied: Function to check if hex is occupied
 *   - getWeaponRange: Function to get weapon range
 *   - turnCounter: Current turn counter
 *   - endTurn: Function to end turn
 *   - setPositions: Function to update positions state
 *   - setFighters: Function to update fighters state
 *   - setMovementMode: Function to update movement mode
 *   - setShowMovementSelection: Function to show/hide movement selection
 *   - setSelectedMovementHex: Function to set selected movement hex
 *   - setSelectedMovementFighter: Function to set selected movement fighter
 *   - setTemporaryHexSharing: Function to set temporary hex sharing
 *   - positionsRef: Ref to positions
 *   - attackRef: Ref to attack function
 */
export function handleMoveSelect(x, y, context) {
  const {
    movementMode,
    selectedMovementFighter,
    positions,
    currentFighter,
    addLog,
    fighters,
    isHexOccupied,
    getWeaponRange,
    turnCounter,
    endTurn,
    setPositions,
    setFighters,
    setMovementMode,
    setShowMovementSelection,
    setSelectedMovementHex,
    setSelectedMovementFighter,
    setTemporaryHexSharing,
    positionsRef,
    attackRef,
  } = context;

  if (movementMode.active && selectedMovementFighter && positions[selectedMovementFighter]) {
    const oldPos = positions[selectedMovementFighter];
    
    // Additional safety check: verify this is a valid move and check action cost
    const combatant = fighters.find(f => f.id === selectedMovementFighter);
    let selectedMove = null;
    
    if (combatant) {
      // Check if combatant has enough action points
      if (combatant.remainingAttacks <= 0) {
        addLog(`⚠️ ${combatant.name} has no actions remaining!`, "error");
        return;
      }
      
      const speed = combatant.Spd || combatant.spd || combatant.attributes?.Spd || combatant.attributes?.spd || 10;
      const attacksPerMelee = combatant.attacksPerMelee || 1;
      const validPositions = getMovementRange(oldPos, speed, attacksPerMelee, {}, movementMode.isRunning);
      selectedMove = validPositions.find(pos => pos.x === x && pos.y === y);
      
      if (!selectedMove) {
        addLog(`❌ Invalid move! ${combatant.name} cannot reach (${x}, ${y})`, "error");
        return;
      }
      
      // Check if player has enough action points for this movement
      if (combatant.remainingAttacks < selectedMove.actionCost) {
        addLog(`❌ Not enough actions! ${combatant.name} needs ${selectedMove.actionCost} actions but only has ${combatant.remainingAttacks}`, "error");
        return;
      }
    }
    
    // Check if destination is occupied - allow "closing" for short weapons
    const occupant = isHexOccupied(x, y, selectedMovementFighter);
    const isClosingToMelee = occupant && occupant.type !== combatant.type;
    
    if (isClosingToMelee) {
      // Character is closing into melee range - temporarily occupy same hex
      const weaponRange = combatant.equippedWeapons?.find(w => w)?.range || 
                         (combatant.weapons?.length > 0 && getWeaponRange(combatant.weapons[0])) || 
                         5.5;
      
      if (weaponRange <= 5) {
        // Short weapon - allowed to close
        addLog(`⚔️ ${combatant.name} closes into melee with ${occupant.name} (temporarily occupying same hex)`, "info");
        
        // Store original position for reset
        setTemporaryHexSharing(prev => ({
          ...prev,
          [selectedMovementFighter]: {
            originalPos: oldPos,
            targetHex: { x, y },
            targetCharId: occupant.id,
            turnCreated: turnCounter
          }
        }));
        
        // Update position to enemy's hex
        setPositions(prev => {
          const updated = {
          ...prev,
          [selectedMovementFighter]: { x, y }
          };
          positionsRef.current = updated;
          return updated;
        });
        
        // Enemy gets an attack of opportunity (free attack)
        addLog(`⚠️ ${occupant.name} gets an attack of opportunity against ${combatant.name}!`, "warning");
        
        // Store attack info for later execution after attack function is initialized
        const attackerForAoO = occupant;
        const targetForAoO = selectedMovementFighter;
        
        // Queue the attack of opportunity after a brief delay
        setTimeout(() => {
          addLog(`⚔️ ${attackerForAoO.name} makes attack of opportunity!`, "info");
          // Execute attack of opportunity - will be called via ref after attack is defined
          if (attackRef.current) {
            attackRef.current(attackerForAoO, targetForAoO, {});
          } else {
            addLog(`⚠️ Attack of opportunity delayed - attack function not ready`, "info");
            // Retry after a longer delay
            setTimeout(() => {
              if (attackRef.current) {
                attackRef.current(attackerForAoO, targetForAoO, {});
              }
            }, 1000);
          }
        }, 500);
        
      } else {
        addLog(`❌ ${combatant.name} cannot close into melee - weapon range too long!`, "error");
        return;
      }
    } else {
      // Normal movement
      setPositions(prev => {
        const updated = {
        ...prev,
        [selectedMovementFighter]: { x, y }
        };
        positionsRef.current = updated;
        return updated;
      });
    }
    
    // Deduct action points based on movement distance
    const actionCost = selectedMove ? selectedMove.actionCost : 1;
    
    // Calculate remaining attacks before updating state
    const remainingAfterMove = Math.max(0, combatant.remainingAttacks - actionCost);
    
    setFighters(prev => prev.map(f => {
      if (f.id === selectedMovementFighter) {
        const updatedFighter = { ...f, remainingAttacks: remainingAfterMove };
        addLog(`⏭️ ${f.name} used ${actionCost} action(s) for movement, ${remainingAfterMove} remaining this melee`, "info");
        return updatedFighter;
      }
      return f;
    }));
    
    const movementType = movementMode.isRunning ? "runs" : "moves";
    const actionText = actionCost > 1 ? ` (${actionCost} actions)` : "";
    addLog(`🚶 ${currentFighter?.name} ${movementType} from (${oldPos.x}, ${oldPos.y}) to (${x}, ${y})${actionText}`, "info");
    // Clear movement mode
    setMovementMode({ active: false, isRunning: false });
    setShowMovementSelection(false); // Hide movement selection UI
    setSelectedMovementHex(null); // Clear selected movement hex
    setSelectedMovementFighter(null);
    
    // ALWAYS end turn after movement - this ensures alternating action system
    // endTurn() will cycle to the next fighter with actions remaining
    // If this fighter still has actions, they'll get another turn after others act
    if (remainingAfterMove <= 0) {
      addLog(`⏭️ ${combatant.name} has no actions remaining - will pass to next fighter in initiative order`, "info");
    } else {
      addLog(`🎮 ${combatant.name} has ${remainingAfterMove} action(s) remaining this melee round`, "info");
    }
    // Always end turn after movement to alternate actions
    setTimeout(() => endTurn(), 500);
  }
}

/**
 * Handle run action update (for charge attacks and regular movement)
 * @param {Object} updatedAttacker - Updated attacker object with position and remaining attacks
 * @param {Object} context - Context object containing:
 *   - addLog: Function to add log messages
 *   - attack: Function to execute attack
 *   - fighters: Array of all fighters
 *   - setFighters: Function to update fighters state
 *   - setPositions: Function to update positions state
 *   - positionsRef: Ref to positions
 */
export function handleRunActionUpdate(updatedAttacker, context) {
  const { addLog, attack, fighters, setFighters, setPositions, positionsRef } = context;
  
  // Check if this is a charge attack (has attack roll data)
  const isChargeAttack = updatedAttacker.log && updatedAttacker.log.some(log => log.includes('CHARGE ATTACK'));
  
  if (isChargeAttack) {
    // For charge attacks, we need to process the attack through the existing attack system
    const target = fighters.find(f => f.type === "enemy" && f.currentHP > 0);
    if (target) {
      // Apply charge bonuses
      const chargeBonus = {
        strikeBonus: 2, // +2 strike for charge
        damageMultiplier: 2, // double damage
        loseNextAttack: true // lose next attack
      };
      
      // Update fighter position and remaining attacks first
      setFighters(prev => prev.map(f => {
        if (f.id === updatedAttacker.id) {
          return {
            ...f,
            remainingAttacks: updatedAttacker.remainingAttacks,
          };
        }
        return f;
      }));
      
      // Update position
      setPositions(prev => {
        const updated = {
        ...prev,
        [updatedAttacker.id]: updatedAttacker.position
        };
        positionsRef.current = updated;
        return updated;
      });
      
      // Add log entries
      if (updatedAttacker.log) {
        updatedAttacker.log.forEach(logEntry => {
          addLog(logEntry, "info");
        });
      }
      
      // Execute the charge attack with bonuses
      setTimeout(() => {
        attack(updatedAttacker, target.id, chargeBonus);
      }, 1000);
      
      return;
    }
  }
  
  // Regular movement - update fighter position and remaining attacks
  setFighters(prev => prev.map(f => {
    if (f.id === updatedAttacker.id) {
      return {
        ...f,
        remainingAttacks: updatedAttacker.remainingAttacks,
      };
    }
    return f;
  }));
  
  // Update position
  setPositions(prev => {
    const updated = {
    ...prev,
    [updatedAttacker.id]: updatedAttacker.position
    };
    positionsRef.current = updated;
    return updated;
  });
  
  // Add log entries
  if (updatedAttacker.log) {
    updatedAttacker.log.forEach(logEntry => {
      addLog(logEntry, "info");
    });
  }
}

