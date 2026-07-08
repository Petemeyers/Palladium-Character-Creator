import CryptoSecureDice from "../cryptoDice";
import {
  attemptGrapple,
  maintainGrapple,
  performTakedown,
  groundAttack,
  breakFree,
  grapplerPushOff,
  defenderPushBreak,
  defenderReversal,
  applyDamageWithArmor,
  isWeaponGrappleSuitable,
} from "../grapplingSystem.js";
import { getCombinedGrappleModifiers } from "../sizeStrengthModifiers.js";
import {
  applyGrappleFollowUpOutcome,
  selectGrappleFollowUpWeapon,
} from "../grappleFollowUp.js";
import { formatCombatActorLabel } from "../combatActorIdentity.js";

// Debug flag for grapple system
const DEBUG_GRAPPLE = false;

function revealConcealment(fighter, reason = "movement") {
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
      brokenBy: reason,
    },
  };
}

/**
 * Handle grapple actions
 * @param {string} actionType - Type of grapple action ('grapple', 'maintain', 'takedown', 'groundAttack', 'breakFree', etc.)
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
    getFighters,
    setFighters,
    setPositions,
    getFighterHP,
    applyHPToFighter,
    validateGrappleResult,
    grappleActionId,
    onStaleGrappleAbort,
  } = context;

  if (!combatActive) return;
  
  const initialLiveFighters =
    typeof getFighters === "function" ? getFighters() : fighters;
  const attackerInArray = initialLiveFighters.find(f => f.id === attacker.id);
  const defender = initialLiveFighters.find(f => f.id === defenderId);
  
  if (!attackerInArray || !defender) {
    addLog(`Invalid target for grapple action!`, "error");
    return;
  }
  
  // Check if attacker can act
  if (attackerInArray.remainingActions <= 0) {
    addLog(`Ã¢Å¡Â Ã¯Â¸Â ${attacker.name} is out of attacks this turn!`, "error");
    return;
  }
  
  const getStaleGrappleReason = () =>
    typeof validateGrappleResult === "function"
      ? validateGrappleResult(actionType, null, grappleActionId)
      : null;

  const getLiveFighters = () =>
    typeof getFighters === "function" ? getFighters() : fighters;
  const labelActor = (actor, counterpart = null, roster = getLiveFighters()) =>
    formatCombatActorLabel(actor, { roster, counterpart });
  const abortStaleGrapple = (reason) => {
    addLog(`Ã°Å¸Å¡Â« stale grapple follow-up aborted: ${reason}`, "warning");
    addLog("Ã°Å¸Å¡Â« stale grapple callback ignored", "warning");
    onStaleGrappleAbort?.(grappleActionId);
  };

  const preActionStaleReason = getStaleGrappleReason();
  if (preActionStaleReason) {
    abortStaleGrapple(preActionStaleReason);
    return;
  }
  if (preActionStaleReason) {
    addLog(`Ã°Å¸Å¡Â« stale grapple follow-up aborted: ${preActionStaleReason}`, "warning");
    onStaleGrappleAbort?.(grappleActionId);
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
        addLog(`Ã°Å¸Å½Â² ${attacker.name} maintain roll: ${naturalAttacker} + ${attackerPSBonus} = ${result.attackerRoll} vs ${defender.name}: ${naturalDefender} + ${defenderPSBonus} = ${result.defenderRoll}`, "info");
      }
      break;
    case 'takedown':
      result = performTakedown(attacker, defender, rollDice);
      // Log dice roll for takedown
      if (result?.takedownBreakdown) {
        const b = result.takedownBreakdown;
        addLog(
          `${attacker.name} takedown roll: d20 ${b.naturalRoll} + PS ${b.attackerPSBonus} + size ${b.sizeModifier} + leverage ${b.leverageModifier} = ${b.total} vs DC ${b.dc}`,
          "info"
        );
      } else if (result && result.takedownRoll !== undefined) {
        const attackerPS = attacker.attributes?.PS || attacker.PS || 10;
        const attackerPSBonus = Math.floor((attackerPS - 10) / 2);
        const sizeMod = getCombinedGrappleModifiers(attacker, defender);
        const sizeBonus =
          sizeMod.attackerAttackBonus ??
          sizeMod.attackBonus ??
          sizeMod.modifier ??
          0;
        const naturalRoll = result.takedownRoll - attackerPSBonus - sizeBonus;
        const bonusDisplay = (attackerPSBonus + sizeBonus) >= 0 ? `+${attackerPSBonus + sizeBonus}` : `${attackerPSBonus + sizeBonus}`;
        addLog(`Ã°Å¸Å½Â² ${attacker.name} takedown roll: ${naturalRoll} ${bonusDisplay} = ${result.takedownRoll} vs DC 15`, "info");
      }
      break;
    case 'groundAttack': {
      const equistaminadWeapons = [
        attacker.equistaminadWeapons?.primary,
        attacker.equistaminadWeapons?.secondary,
        ...(Array.isArray(attacker.equistaminadWeapons) ? attacker.equistaminadWeapons : []),
      ].filter(Boolean);
      const currentWeapon = equistaminadWeapons[0] || null;
      const followUpSelection = selectGrappleFollowUpWeapon(attacker);
      const weapon = followUpSelection.weapon;
      if (currentWeapon && !isWeaponGrappleSuitable(currentWeapon)) {
        addLog(`Ã¢Å¡Â Ã¯Â¸Â ${attacker.name} cannot use ${currentWeapon.name} effectively in a grapple.`, "warning");
      }
      if (weapon && currentWeapon?.name !== weapon.name) {
        addLog(`${labelActor(attacker, defender)} switches to ${weapon.name} in the clinch.`, "info");
      }
      if (weapon) {
        addLog(`${labelActor(attacker, defender)} attacks ${labelActor(defender, attacker)} with ${weapon.name}.`, "info");
      }
      result = groundAttack(attacker, defender, weapon, rollDice);
      
      // Log dice roll for ground attack
      if (result && result.attackRoll !== undefined && result.naturalRoll !== undefined) {
        const attackBonus = attacker.bonuses?.attack || attacker.handToHand?.attackBonus || 0;
        const ppBonus = Math.floor(((attacker.attributes?.PP || attacker.PP || 10) - 10) / 2);
        const weaponName = String(weapon?.name || weapon?.type || "").toLowerCase();
        const daggerBonus =
          weaponName.includes("dagger") ||
          weaponName.includes("knife") ||
          weaponName.includes("short blade")
            ? 1
            : 0;
        const totalBonus = ppBonus + attackBonus + daggerBonus;
        const bonusDisplay = totalBonus >= 0 ? `+${totalBonus}` : `${totalBonus}`;
        
        if (result.critical) {
          addLog(`Ã°Å¸Å½Â² ${attacker.name} rolls NATURAL ${result.naturalRoll}! Critical ground attack! (Total: ${result.attackRoll} vs guardRating 12)`, "critical");
        } else if (result.deathBlow) {
          addLog(`Ã°Å¸Å½Â² ${attacker.name} rolls NATURAL 20! DEATH BLOW! (Total: ${result.attackRoll})`, "critical");
        } else {
          addLog(`Ã°Å¸Å½Â² ${attacker.name} ground attack roll: ${result.naturalRoll} ${bonusDisplay} = ${result.attackRoll} vs guardRating 12`, "info");
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
        addLog(`Ã°Å¸Å½Â² ${attacker.name} break free roll: ${naturalCharacter} + ${characterPSBonus} = ${result.characterRoll} vs ${defender.name}: ${naturalOpponent} + ${opponentPSBonus} = ${result.opponentRoll}`, "info");
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
  
  const staleReason = getStaleGrappleReason();
  if (staleReason) {
    abortStaleGrapple(staleReason);
    return;
  }
  if (staleReason) {
    addLog(`Ã°Å¸Å¡Â« stale grapple follow-up aborted: ${staleReason}`, "warning");
    onStaleGrappleAbort?.(grappleActionId);
    return;
  }

  if (result.success) {
    const fraideredMovementAction = new Set([
      'grapple',
      'takedown',
      'grapplerPushOff',
      'defenderPushBreak',
      'defenderReversal',
    ]);
    const shouldRevealForMovement =
      fraideredMovementAction.has(actionType) ||
      Boolean(result.attacker?.hex) ||
      Boolean(result.defender?.hex);
    const nextAttacker =
      shouldRevealForMovement && result.attacker
        ? revealConcealment(result.attacker)
        : result.attacker;
    let nextDefender =
      shouldRevealForMovement && result.defender
        ? revealConcealment(result.defender)
        : result.defender;

    // Log dice rolls for grapple attempts
    if (result.attackRoll !== undefined && result.defendRoll !== undefined) {
      const attackRoll = result.attackRoll;
      const defendRoll = result.defendRoll;
      const breakdown = result.rollBreakdown;
      if (breakdown) {
        const attackerPSLabel = breakdown.psStepMod > 0
          ? ` + PS diff ${breakdown.attackerPSDiffBonus}`
          : "";
        const defenderPSLabel = breakdown.psStepMod < 0
          ? ` + PS diff ${breakdown.defenderPSDiffBonus}`
          : "";
        addLog(
          `${attacker.name} grapple roll: d20 ${breakdown.naturalAttackRoll} + PP ${breakdown.attackerPPBonus} + attack ${breakdown.attackerAttackBonus} + size ${breakdown.attackerSizeAttackBonus}${attackerPSLabel} = ${attackRoll}`,
          "info"
        );
        addLog(
          `${defender.name} block roll: d20 ${breakdown.naturalDefendRoll} + PP ${breakdown.defenderPPBonus} + block ${breakdown.defenderBlockBonus} + size ${breakdown.defenderSizeBlockBonus}${defenderPSLabel} = ${defendRoll}`,
          "info"
        );
      } else {
        const naturalAttack = attackRoll - (attacker.bonuses?.attack || 0) - Math.floor(((attacker.attributes?.PP || attacker.PP || 10) - 10) / 2);
        const naturalDefend = defendRoll - (defender.bonuses?.block || 0) - Math.floor(((defender.attributes?.PP || defender.PP || 10) - 10) / 2);
        addLog(`Ã°Å¸Å½Â² ${attacker.name} grapple roll: ${naturalAttack} + bonuses = ${attackRoll} vs ${defender.name}'s block: ${naturalDefend} + bonuses = ${defendRoll}`, "info");
      }
    } else if (result.attackRoll !== undefined) {
      addLog(`Ã°Å¸Å½Â² ${attacker.name} grapple roll: ${result.attackRoll}`, "info");
    } else if (result.defendRoll !== undefined && result.defendRoll === 20) {
      addLog(`Ã°Å¸Å½Â² ${defender.name} escapes with NATURAL 20!`, "critical");
    }
    
    // Safeguard against undefined message
    if (result.message) {
      addLog(result.message, "info");
    }
    if (result.weakSpot) {
      addLog(`Ã°Å¸â€”Â¡Ã¯Â¸Â ${attacker.name} slips inside the armor with ${result.weaponName || "a dagger"}.`, "critical");
    } else if (result.armorBlockedWeakSpot) {
      addLog(`Ã°Å¸â€ºÂ¡Ã¯Â¸Â ${defender.name}'s armor blocks the close-quarters attack.`, "info");
    }
    
    // Log size modifier information if present
    if (result.autoGrapple) {
      const sizeMod = getCombinedGrappleModifiers(attacker, defender);
      addLog(`Ã°Å¸â€™Âª ${sizeMod.description}`, "info");
    }
    
    // Apply damage if any
    // For takedown, damage is always applied if result.damage exists (takedown doesn't use hit property)
    // For ground attacks, result.hit indicates if the attack connected
    if (result.damage && (actionType === 'takedown' || result.hit)) {
      const damageStaleReason = getStaleGrappleReason();
      if (damageStaleReason) {
        abortStaleGrapple(damageStaleReason);
        return;
      }
      const updated = [...getLiveFighters()];
      const damageTargetId = defender?.id ?? defenderId;
      const defenderIndex = updated.findIndex(f => f.id === damageTargetId);
      if (defenderIndex !== -1) {
        const defenderCopy = { ...updated[defenderIndex] };
        const damageTargetLabel = labelActor(defenderCopy, attacker, updated);
        const attackerLabel = labelActor(attacker, defenderCopy, updated);
        
        // Use applyDamageWithArmor to handle armor logic
        const updatedDefender = applyDamageWithArmor(result, attacker, defenderCopy);
        
        if (DEBUG_GRAPPLE) {
          console.log(
            `[GRAPPLE DEBUG] Post-damage: ` +
              `${damageTargetLabel} HP=${updatedDefender.currentHP ?? updatedDefender.hp} ` +
              `armorDurability=${updatedDefender.currentarmorDurability ?? updatedDefender.armorDurability} ` +
              (updatedDefender.equistaminadArmor
                ? `ArmorarmorDurability=${updatedDefender.equistaminadArmor.currentarmorDurability ?? updatedDefender.equistaminadArmor.armorDurability}`
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
            `Ã°Å¸â€™Â¥ ${damageTargetLabel} takes ${result.damage} damage from ${attackerLabel} (armor bypassed - weak point struck)! (HP: ${finalHP}/${maxHP})`,
            result.critical ? "critical" : "warning"
          );
          
          // Log broken armor if any (from calculateArmorDamage)
          if (updatedDefender.equistaminad) {
            const brokenArmor = Object.values(updatedDefender.equistaminad)
              .filter(armor => armor && armor.broken && armor.currentarmorDurability <= 0)
              .map(armor => armor.name);
            if (brokenArmor.length > 0) {
              brokenArmor.forEach(name => {
                addLog(`Ã°Å¸â€™Â¢ ${damageTargetLabel}'s ${name} is destroyed!`, "warning");
              });
            }
          }
        } else {
          // Normal hit - armor may have absorbed some/all damage
          const damageTaken = (getFighterHP(defenderCopy) - finalHP);
          if (damageTaken > 0) {
            addLog(
              `Ã°Å¸â€™Â¥ ${damageTargetLabel} takes ${damageTaken} damage from ${attackerLabel}! (HP: ${finalHP}/${maxHP})`,
              "warning"
            );
          } else {
            addLog(
              `Ã°Å¸â€ºÂ¡Ã¯Â¸Â ${damageTargetLabel}'s armor absorbs the blow from ${attackerLabel}! (Armor armorDurability damaged: ${result.damage})`,
              "info"
            );
          }
        }
        
        // Check for death blow
        if (result.deathBlow) {
          applyHPToFighter(updatedDefender, -999);
          updatedDefender.isDead = true;
          addLog(`Ã°Å¸â€™â‚¬ ${damageTargetLabel} is slain by death blow!`, "error");
        }
        
        // Update fighter state
        updated[defenderIndex] = updatedDefender;
        nextDefender = nextDefender
          ? { ...nextDefender, ...updatedDefender }
          : updatedDefender;
        setFighters(updated);
      }
    } else if (!result.hit && result.message && actionType !== 'takedown') {
      // Miss - log the message
      addLog(result.message, "info");
    }
    
    // Merge the outcome and spend its action atomically. Grapple result objects
    // are based on the pre-action actor and must not restore remainingActions.
    const spendStaleReason = getStaleGrappleReason();
    if (spendStaleReason) {
      abortStaleGrapple(spendStaleReason);
      return;
    }
    const updated = [...getLiveFighters()];
    const attackerIndex = updated.findIndex(f => f.id === attacker.id);
    if (attackerIndex !== -1) {
      const outcome = nextAttacker || attacker;
      const transition = applyGrappleFollowUpOutcome(updated[attackerIndex], outcome);
      if (!transition.ok) {
        abortStaleGrapple("no actions");
        return;
      }
      updated[attackerIndex] = transition.actor;
      if (outcome?.hex) {
        updated[attackerIndex].hex = outcome.hex;
        updated[attackerIndex].position = outcome.position || outcome.hex;
      }
      addLog(
        `${updated[attackerIndex].name} has ${transition.remainingAfter}/${updated[attackerIndex].actionsPerRound || updated[attackerIndex].actionsPerMelee || "?"} attacks remaining.`,
        "info"
      );
    }
    const damageTargetId = defender?.id ?? defenderId;
      const defenderIndex = updated.findIndex(f => f.id === damageTargetId);
    if (defenderIndex !== -1 && nextDefender) {
      updated[defenderIndex] = { ...updated[defenderIndex], ...nextDefender };
      if (nextDefender.hex) {
        updated[defenderIndex].hex = nextDefender.hex;
        updated[defenderIndex].position = nextDefender.position || nextDefender.hex;
      }
    }
    setFighters(updated);
    
    // Update positions if grapple pulled fighters together - both fighters should be in same hex
    if (nextAttacker && nextAttacker.hex) {
      const sharedHex = nextAttacker.hex;
      setPositions(prev => {
        const updated = { ...prev };
        // Move attacker to shared hex
        updated[nextAttacker.id] = sharedHex;
        // Move defender to same shared hex (both fighters grapple in same hex)
        if (nextDefender && nextDefender.id) {
          updated[nextDefender.id] = sharedHex;
        } else if (defenderId) {
          updated[defenderId] = sharedHex;
        }
        return updated;
      });
    }
    if (shouldRevealForMovement) {
      if (result.attacker && nextAttacker !== result.attacker) {
        addLog(`Ã°Å¸â€˜ÂÃ¯Â¸Â ${result.attacker.name} is revealed by the grapple movement!`, "info");
      }
      if (result.defender && nextDefender !== result.defender) {
        addLog(`Ã°Å¸â€˜ÂÃ¯Â¸Â ${result.defender.name} is revealed by the grapple movement!`, "info");
      }
    }
  } else {
    // Safeguard against undefined reason/message
    const failureMessage = result.reason || result.message || `Grapple action failed`;
    addLog(failureMessage, "info");
    
    // Still deduct attack if it was attempted
    if (actionType !== 'breakFree') {
      const failSpendStaleReason = getStaleGrappleReason();
      if (failSpendStaleReason) {
        abortStaleGrapple(failSpendStaleReason);
        return;
      }
      const updated = [...getLiveFighters()];
      const attackerIndex = updated.findIndex(f => f.id === attacker.id);
      if (attackerIndex !== -1) {
        updated[attackerIndex].remainingActions = Math.max(0, updated[attackerIndex].remainingActions - 1);
        addLog(
          `${updated[attackerIndex].name} has ${updated[attackerIndex].remainingActions}/${updated[attackerIndex].actionsPerRound || updated[attackerIndex].actionsPerMelee || "?"} attacks remaining.`,
          "info"
        );
        setFighters(updated);
      }
    }
    onStaleGrappleAbort?.(grappleActionId);
  }
}

