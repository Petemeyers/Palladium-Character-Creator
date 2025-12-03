import CryptoSecureDice from "../cryptoDice";
import {
  attemptGrapple,
  maintainGrapple,
  performTakedown,
  groundStrike,
  breakFree,
  grapplerPushOff,
  defenderPushBreak,
  defenderReversal,
  applyDamageWithArmor,
} from "../grapplingSystem.js";
import { getCombinedGrappleModifiers } from "../sizeStrengthModifiers.js";

// Debug flag for grapple system
const DEBUG_GRAPPLE = process.env.NODE_ENV === 'development' && false;

/**
 * Handle grapple actions
 * @param {string} actionType - Type of grapple action ('grapple', 'maintain', 'takedown', 'groundStrike', 'breakFree', etc.)
 * @param {Object} attacker - The attacker fighter object
 * @param {string} defenderId - ID of the defender fighter
 * @param {Object} context - Context object containing:
 *   - fighters: Array of all fighters
 *   - combatActive: Boolean indicating if combat is active
 *   - addLog: Function to add log messages
 *   - positions: Object mapping fighter IDs to positions
 *   - setFighters: Function to update fighters state
 *   - setPositions: Function to update positions state
 *   - clampHP: Function to clamp HP values
 *   - getFighterHP: Function to get fighter HP
 *   - applyHPToFighter: Function to apply HP changes
 */
export function handleGrappleAction(actionType, attacker, defenderId, context) {
  const {
    fighters,
    combatActive,
    addLog,
    positions,
    setFighters,
    setPositions,
    clampHP,
    getFighterHP,
    applyHPToFighter,
  } = context;

  if (!combatActive) return;
  
  const attackerInArray = fighters.find(f => f.id === attacker.id);
  const defender = fighters.find(f => f.id === defenderId);
  
  if (!attackerInArray || !defender) {
    addLog(`Invalid target for grapple action!`, "error");
    return;
  }
  
  // Check if attacker can act
  if (attackerInArray.remainingAttacks <= 0) {
    addLog(`⚠️ ${attacker.name} is out of attacks this turn!`, "error");
    return;
  }
  
  // Use CryptoSecureDice for rolling
  const rollDice = () => CryptoSecureDice.rollD20();
  
  let result;
  switch (actionType) {
    case 'grapple': {
      // Get current positions from state to pass to initiateGrapple
      const currentAttackerPos = positions[attacker.id] || attacker.hex || attacker.position;
      const currentDefenderPos = positions[defenderId] || defender.hex || defender.position;
      result = attemptGrapple(attacker, defender, rollDice, currentAttackerPos, currentDefenderPos);
      break;
    }
    case 'maintain':
      result = maintainGrapple(attacker, defender, rollDice);
      // Log dice rolls for maintain grapple
      if (result && result.attackerRoll !== undefined && result.defenderRoll !== undefined) {
        const attackerPS = attacker.attributes?.PS || attacker.PS || 10;
        const defenderPS = defender.attributes?.PS || defender.PS || 10;
        const attackerPSBonus = Math.floor((attackerPS - 10) / 2);
        const defenderPSBonus = Math.floor((defenderPS - 10) / 2);
        const naturalAttacker = result.attackerRoll - attackerPSBonus;
        const naturalDefender = result.defenderRoll - defenderPSBonus;
        addLog(`🎲 ${attacker.name} maintain roll: ${naturalAttacker} + ${attackerPSBonus} = ${result.attackerRoll} vs ${defender.name}: ${naturalDefender} + ${defenderPSBonus} = ${result.defenderRoll}`, "info");
      }
      break;
    case 'takedown':
      result = performTakedown(attacker, defender, rollDice);
      // Log dice roll for takedown
      if (result && result.takedownRoll !== undefined) {
        const attackerPS = attacker.attributes?.PS || attacker.PS || 10;
        const attackerPSBonus = Math.floor((attackerPS - 10) / 2);
        const sizeMod = getCombinedGrappleModifiers(attacker, defender);
        const sizeBonus = sizeMod.attackerStrikeBonus || 0;
        const naturalRoll = result.takedownRoll - attackerPSBonus - sizeBonus;
        const bonusDisplay = (attackerPSBonus + sizeBonus) >= 0 ? `+${attackerPSBonus + sizeBonus}` : `${attackerPSBonus + sizeBonus}`;
        addLog(`🎲 ${attacker.name} takedown roll: ${naturalRoll} ${bonusDisplay} = ${result.takedownRoll} vs DC 15`, "info");
      }
      break;
    case 'groundStrike': {
      // Get equipped weapon (prefer dagger)
      const weapon = attacker.equippedWeapons?.primary || attacker.equippedWeapons?.secondary || null;
      result = groundStrike(attacker, defender, weapon, rollDice);
      
      // Log dice roll for ground strike
      if (result && result.attackRoll !== undefined && result.naturalRoll !== undefined) {
        const strikeBonus = attacker.bonuses?.strike || attacker.handToHand?.strikeBonus || 0;
        const ppBonus = Math.floor(((attacker.attributes?.PP || attacker.PP || 10) - 10) / 2);
        const daggerBonus = weapon && weapon.type === "dagger" ? 1 : 0;
        const totalBonus = ppBonus + strikeBonus + daggerBonus;
        const bonusDisplay = totalBonus >= 0 ? `+${totalBonus}` : `${totalBonus}`;
        
        if (result.critical) {
          addLog(`🎲 ${attacker.name} rolls NATURAL ${result.naturalRoll}! Critical ground strike! (Total: ${result.attackRoll} vs AR 12)`, "critical");
        } else if (result.deathBlow) {
          addLog(`🎲 ${attacker.name} rolls NATURAL 20! DEATH BLOW! (Total: ${result.attackRoll})`, "critical");
        } else {
          addLog(`🎲 ${attacker.name} ground strike roll: ${result.naturalRoll} ${bonusDisplay} = ${result.attackRoll} vs AR 12`, "info");
        }
      }
      
      if (DEBUG_GRAPPLE && result) {
        console.log(
          `[GRAPPLE DEBUG] ${attacker.name} vs ${defender.name} | ` +
            `nat=${result.naturalRoll} total=${result.attackRoll} ` +
            `hit=${result.hit} crit=${result.critical} deathBlow=${result.deathBlow} ` +
            `ignoresArmor=${result.ignoresArmor} dmg=${result.damage}`
        );
      }
      
      if (DEBUG_GRAPPLE) {
        console.log(
          `[GRAPPLE DEBUG] Stamina: ${attacker.name} STA=${attacker.currentStamina}, ` +
            `${defender.name} STA=${defender.currentStamina}`
        );
      }
      break;
    }
    case 'breakFree':
      result = breakFree(attacker, defender, rollDice);
      // Log dice rolls for break free
      if (result && result.characterRoll !== undefined && result.opponentRoll !== undefined) {
        const characterPS = attacker.attributes?.PS || attacker.PS || 10;
        const opponentPS = defender.attributes?.PS || defender.PS || 10;
        const characterPSBonus = Math.floor((characterPS - 10) / 2);
        const opponentPSBonus = Math.floor((opponentPS - 10) / 2);
        // Note: breakFree adds leverage penalty to characterRoll, so we need to account for that
        const naturalCharacter = result.characterRoll - characterPSBonus; // Approximate (leverage penalty not shown separately)
        const naturalOpponent = result.opponentRoll - opponentPSBonus;
        addLog(`🎲 ${attacker.name} break free roll: ${naturalCharacter} + ${characterPSBonus} = ${result.characterRoll} vs ${defender.name}: ${naturalOpponent} + ${opponentPSBonus} = ${result.opponentRoll}`, "info");
      }
      break;
    case 'grapplerPushOff': {
      result = grapplerPushOff({ grappler: attacker, defender });
      break;
    }
    case 'defenderPushBreak': {
      result = defenderPushBreak({ defender: attacker, grappler: defender });
      break;
    }
    case 'defenderReversal': {
      result = defenderReversal({ defender: attacker, grappler: defender });
      break;
    }
    default:
      addLog(`Unknown grapple action: ${actionType}`, "error");
      return;
  }
  
  if (result.success) {
    // Log dice rolls for grapple attempts
    if (result.attackRoll !== undefined && result.defendRoll !== undefined) {
      const attackRoll = result.attackRoll;
      const defendRoll = result.defendRoll;
      const naturalAttack = attackRoll - (attacker.bonuses?.strike || 0) - Math.floor(((attacker.attributes?.PP || attacker.PP || 10) - 10) / 2);
      const naturalDefend = defendRoll - (defender.bonuses?.parry || 0) - Math.floor(((defender.attributes?.PP || defender.PP || 10) - 10) / 2);
      addLog(`🎲 ${attacker.name} grapple roll: ${naturalAttack} + bonuses = ${attackRoll} vs ${defender.name}'s parry: ${naturalDefend} + bonuses = ${defendRoll}`, "info");
    } else if (result.attackRoll !== undefined) {
      addLog(`🎲 ${attacker.name} grapple roll: ${result.attackRoll}`, "info");
    } else if (result.defendRoll !== undefined && result.defendRoll === 20) {
      addLog(`🎲 ${defender.name} escapes with NATURAL 20!`, "critical");
    }
    
    // Safeguard against undefined message
    if (result.message) {
      addLog(result.message, "info");
    }
    
    // Log size modifier information if present
    if (result.autoGrapple) {
      const sizeMod = getCombinedGrappleModifiers(attacker, defender);
      addLog(`💪 ${sizeMod.description}`, "info");
    }
    
    // Apply damage if any
    // For takedown, damage is always applied if result.damage exists (takedown doesn't use hit property)
    // For ground strikes, result.hit indicates if the strike connected
    if (result.damage && (actionType === 'takedown' || result.hit)) {
      const updated = [...fighters];
      const defenderIndex = updated.findIndex(f => f.id === defenderId);
      if (defenderIndex !== -1) {
        const defenderCopy = { ...updated[defenderIndex] };
        
        // Use applyDamageWithArmor to handle armor logic
        const updatedDefender = applyDamageWithArmor(result, attacker, defenderCopy);
        
        if (DEBUG_GRAPPLE) {
          console.log(
            `[GRAPPLE DEBUG] Post-damage: ` +
              `${defender.name} HP=${updatedDefender.currentHP ?? updatedDefender.hp} ` +
              `SDC=${updatedDefender.currentSDC ?? updatedDefender.sdc} ` +
              (updatedDefender.equippedArmor
                ? `ArmorSDC=${updatedDefender.equippedArmor.currentSDC ?? updatedDefender.equippedArmor.sdc}`
                : `No armor`)
          );
        }
        
        // Get final HP for logging
        const finalHP = getFighterHP(updatedDefender);
        const maxHP = updatedDefender.maxHP || updatedDefender.hp || updatedDefender.HP;
        
        // Log damage application
        if (result.ignoresArmor) {
          // Critical hit or death blow - bypasses armor (chink in armor)
          addLog(
            `💥 ${defender.name} takes ${result.damage} damage (armor bypassed - weak point struck)! (HP: ${finalHP}/${maxHP})`,
            result.critical ? "critical" : "warning"
          );
          
          // Log broken armor if any (from calculateArmorDamage)
          if (updatedDefender.equipped) {
            const brokenArmor = Object.values(updatedDefender.equipped)
              .filter(armor => armor && armor.broken && armor.currentSDC <= 0)
              .map(armor => armor.name);
            if (brokenArmor.length > 0) {
              brokenArmor.forEach(name => {
                addLog(`💢 ${defender.name}'s ${name} is destroyed!`, "warning");
              });
            }
          }
        } else {
          // Normal hit - armor may have absorbed some/all damage
          const damageTaken = (getFighterHP(defenderCopy) - finalHP);
          if (damageTaken > 0) {
            addLog(
              `💥 ${defender.name} takes ${damageTaken} damage! (HP: ${finalHP}/${maxHP})`,
              "warning"
            );
          } else {
            addLog(
              `🛡️ ${defender.name}'s armor absorbs the blow! (Armor SDC damaged: ${result.damage})`,
              "info"
            );
          }
        }
        
        // Check for death blow
        if (result.deathBlow) {
          applyHPToFighter(updatedDefender, -999);
          updatedDefender.isDead = true;
          addLog(`💀 ${defender.name} is slain by death blow!`, "error");
        }
        
        // Update fighter state
        updated[defenderIndex] = updatedDefender;
        setFighters(updated);
      }
    } else if (!result.hit && result.message && actionType !== 'takedown') {
      // Miss - log the message
      addLog(result.message, "info");
    }
    
    // Deduct attack action
    const updated = [...fighters];
    const attackerIndex = updated.findIndex(f => f.id === attacker.id);
    if (attackerIndex !== -1) {
      updated[attackerIndex].remainingAttacks = Math.max(0, updated[attackerIndex].remainingAttacks - 1);
      setFighters(updated);
    }
    
    // Update fighter states - handle new format with attacker/defender objects
    setFighters(prev => prev.map(f => {
      if (result.attacker && f.id === result.attacker.id) {
        // Update position/hex if grapple pulled them together
        const updated = { ...f, ...result.attacker };
        if (result.attacker.hex) {
          updated.hex = result.attacker.hex;
          updated.position = result.attacker.position || result.attacker.hex;
        }
        return updated;
      }
      if (result.defender && f.id === result.defender.id) {
        const updated = { ...f, ...result.defender };
        if (result.defender.hex) {
          updated.hex = result.defender.hex;
          updated.position = result.defender.position || result.defender.hex;
        }
        return updated;
      }
      // Fallback to old format
      if (f.id === attacker.id) return { ...f, ...attacker };
      if (f.id === defenderId) return { ...f, ...defender };
      return f;
    }));
    
    // Update positions if grapple pulled fighters together - both fighters should be in same hex
    if (result.attacker && result.attacker.hex) {
      const sharedHex = result.attacker.hex;
      setPositions(prev => {
        const updated = { ...prev };
        // Move attacker to shared hex
        updated[result.attacker.id] = sharedHex;
        // Move defender to same shared hex (both fighters grapple in same hex)
        if (result.defender && result.defender.id) {
          updated[result.defender.id] = sharedHex;
        } else if (defenderId) {
          updated[defenderId] = sharedHex;
        }
        return updated;
      });
    }
  } else {
    // Safeguard against undefined reason/message
    const failureMessage = result.reason || result.message || `Grapple action failed`;
    addLog(failureMessage, "info");
    
    // Still deduct attack if it was attempted
    if (actionType !== 'breakFree') {
      const updated = [...fighters];
      const attackerIndex = updated.findIndex(f => f.id === attacker.id);
      if (attackerIndex !== -1) {
        updated[attackerIndex].remainingAttacks = Math.max(0, updated[attackerIndex].remainingAttacks - 1);
        setFighters(updated);
      }
    }
  }
}

