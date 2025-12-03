/**
 * Enemy Turn AI Module
 * 
 * Handles AI decision-making for enemy characters during combat.
 * This is a pure function module - no React hooks or state management.
 * All state updates are done via callbacks passed in the context.
 */

import CryptoSecureDice from "../cryptoDice";
import { getRandomCombatSpell } from "../../data/combatSpells";
import { decayAwareness, updateAwareness, getAwareness, AWARENESS_STATES } from "../aiVisibilityFilter";
import { hasSpecialSenses } from "../stealthSystem";
import { calculatePerceptionCheck } from "../terrainSystem";
import { getWeaponRange } from "../distanceCombatSystem";

/**
 * Run enemy turn AI
 * @param {Object} enemy - The enemy fighter object
 * @param {Object} context - Context object containing all necessary dependencies
 */
export function runEnemyTurnAI(enemy, context) {
  const {
    fighters,
    positions,
    combatTerrain,
    arenaEnvironment,
    meleeRound,
    turnIndex,
    turnCounter,
    combatActive,
    // Core helpers
    canFighterAct,
    getHPStatus,
    addLog,
    scheduleEndTurn,
    endTurn,
    // Distance & movement
    calculateDistance,
    isTargetBlocked,
    getBlockingCombatant,
    calculateTargetPriority,
    calculateEnemyMovementAI,
    analyzeMovementAndAttack,
    findFlankingPositions,
    calculateFlankingBonus,
    validateWeaponRange,
    handlePositionChange,
    isHexOccupied,
    findRetreatDestination,
    // Healing / support
    getAvailableSkills,
    isEvilAlignment,
    healerAbility,
    clericalHealingTouch,
    medicalTreatment,
    // AI engine
    createAIActionSelector,
    GRID_CONFIG,
    calculateMovementPerAction,
    MOVEMENT_RATES,
    MOVEMENT_ACTIONS,
    // Fog of war
    fogEnabled,
    visibleCells,
    canAISeeTarget,
    // State setters
    setPositions,
    setFighters,
    setDefensiveStance,
    setTemporaryHexSharing,
    setCombatActive,
    // Refs
    positionsRef,
    processingEnemyTurnRef,
    attackRef,
    combatEndCheckRef,
    // Other
    getTargetsInLine,
  } = context;

  // ✅ CRITICAL: Check if enemy can act (conscious, not dying/dead/unconscious)
  if (!canFighterAct(enemy)) {
    const hpStatus = getHPStatus(enemy.currentHP);
    addLog(`⏭️ ${enemy.name} cannot act (${hpStatus.description}), skipping turn`, "info");
    processingEnemyTurnRef.current = false;
    scheduleEndTurn();
    return;
  }
  
  // Check if combat is still active
  if (!combatActive) {
    addLog(`⚠️ Combat ended, ${enemy.name} skips turn`, "info");
    processingEnemyTurnRef.current = false;
    return;
  }
  
  // Check if enemy has actions remaining
  if (enemy.remainingAttacks <= 0) {
    addLog(`⏭️ ${enemy.name} has no actions remaining - passing to next fighter in initiative order`, "info");
    processingEnemyTurnRef.current = false;
    scheduleEndTurn();
    return;
  }
  
  // ✅ FIX: Filter players by visibility AND exclude unconscious/dying/dead targets
  // Only target conscious players (HP > 0) - unconscious/dying players are already defeated
  const allPlayers = fighters.filter(f => 
    f.type === "player" && 
    canFighterAct(f) && 
    f.currentHP > 0 &&  // Only conscious players
    f.currentHP > -21    // Not dead
  );
  
  // Decay awareness for each player target
  allPlayers.forEach(target => {
    decayAwareness(enemy, target);
  });
  
  // Filter visible targets and get awareness states
  const visiblePlayers = [];
  allPlayers.forEach(target => {
    const isVisible = canAISeeTarget(enemy, target, positions, combatTerrain, {
      useFogOfWar: fogEnabled,
      fogOfWarVisibleCells: visibleCells
    });
    
    if (isVisible) {
      visiblePlayers.push(target);
      // Update awareness to Alert when enemy can see target
      updateAwareness(enemy, target, AWARENESS_STATES.ALERT);
    } else {
      // Use calculatePerceptionCheck to determine if enemy can detect hidden target
      const perceptionCheck = calculatePerceptionCheck(
        enemy,
        target,
        {
          terrain: combatTerrain?.terrain,
          lighting: combatTerrain?.lighting || "BRIGHT_DAYLIGHT",
          distance: positions[enemy.id] && positions[target.id] 
            ? calculateDistance(positions[enemy.id], positions[target.id])
            : 0
        }
      );
      
      // Check if enemy can still target Searching players (lost track but actively looking)
      const awareness = getAwareness(enemy, target);
      if (awareness === AWARENESS_STATES.SEARCHING || hasSpecialSenses(enemy) || perceptionCheck.success) {
        visiblePlayers.push(target);
        // Keep awareness at Searching if enemy is actively looking
        if (awareness !== AWARENESS_STATES.SEARCHING) {
          updateAwareness(enemy, target, AWARENESS_STATES.SEARCHING);
        }
      } else {
        // Target is hidden - update awareness to Unaware if not already
        if (awareness !== AWARENESS_STATES.UNAWARE) {
          updateAwareness(enemy, target, AWARENESS_STATES.UNAWARE);
        }
      }
    }
  });
  
  // AI Skill Usage: Check if enemy should use healing/support skills before attacking
  const availableSkills = getAvailableSkills(enemy);
  const healingSkills = availableSkills.filter(skill => 
    skill.type === "healer_ability" || 
    skill.type === "clerical_ability" || 
    skill.type === "medical_skill"
  );
  
  // Check for allies that need healing (only for non-evil alignments)
  const enemyAlignment = enemy.alignment || enemy.attributes?.alignment || "";
  const isEvil = isEvilAlignment(enemyAlignment);
  
  if (healingSkills.length > 0 && !isEvil) {
    // Find injured allies (same type as enemy)
    const allies = fighters.filter(f => 
      f.type === enemy.type && 
      f.id !== enemy.id && 
      f.currentHP > -21 &&
      (f.currentHP < f.maxHP * 0.5 || f.currentHP <= 0) // Injured or dying
    );
    
    if (allies.length > 0) {
      // Prioritize dying allies (HP <= 0)
      const dyingAllies = allies.filter(a => a.currentHP <= 0);
      const targetAlly = dyingAllies.length > 0 ? dyingAllies[0] : allies[0];
      
      // Check if enemy is adjacent to target (for touch skills)
      const enemyPos = positions[enemy.id];
      const allyPos = positions[targetAlly.id];
      const isAdjacent = enemyPos && allyPos && calculateDistance(enemyPos, allyPos) <= 5.5;
      
      if (isAdjacent) {
        // Select appropriate healing skill
        let selectedHealingSkill = null;
        
        // Prioritize Lust for Life for dying allies
        if (targetAlly.currentHP <= 0) {
          selectedHealingSkill = healingSkills.find(s => s.name === "Lust for Life");
        }
        
        // Fallback to Healing Touch or First Aid
        if (!selectedHealingSkill) {
          selectedHealingSkill = healingSkills.find(s => 
            s.name.includes("Healing Touch") || s.name === "First Aid"
          );
        }
        
        if (selectedHealingSkill) {
          // Check if enemy has enough resources
          let canUse = true;
          if (selectedHealingSkill.costType === "ISP") {
            const currentISP = enemy.currentISP || enemy.currentIsp || enemy.ISP || 0;
            canUse = currentISP >= selectedHealingSkill.cost;
          }
          
          if (canUse) {
            addLog(`🤖 ${enemy.name} uses ${selectedHealingSkill.name} on ${targetAlly.name}!`, "info");
            
            // Execute the healing skill
            let skillResult = null;
            
            if (selectedHealingSkill.type === "healer_ability") {
              const powerName = selectedHealingSkill.name.replace(" (Healer)", "");
              skillResult = healerAbility(enemy, targetAlly, powerName);
              
              if (!skillResult.error) {
                // Update enemy ISP
                setFighters(prev => prev.map(f => 
                  f.id === enemy.id 
                    ? { ...f, currentISP: skillResult.ispRemaining, ISP: skillResult.ispRemaining }
                    : f
                ));
                
                // Update ally HP
                if (skillResult.healed !== undefined) {
                  setFighters(prev => prev.map(f => 
                    f.id === targetAlly.id 
                      ? { ...f, currentHP: skillResult.currentHp }
                      : f
                  ));
                }
                
                addLog(skillResult.message, skillResult.success === false ? "error" : "success");
              }
            } else if (selectedHealingSkill.type === "clerical_ability") {
              skillResult = clericalHealingTouch(enemy, targetAlly);
              
              if (!skillResult.error) {
                setFighters(prev => prev.map(f => 
                  f.id === targetAlly.id 
                    ? { ...f, currentHP: skillResult.currentHp }
                    : f
                ));
                addLog(skillResult.message, "success");
              }
            } else if (selectedHealingSkill.type === "medical_skill") {
              const skillPercent = selectedHealingSkill.skillPercent || 50;
              skillResult = medicalTreatment(enemy, targetAlly, skillPercent);
              
              if (skillResult.healed > 0) {
                setFighters(prev => prev.map(f => 
                  f.id === targetAlly.id 
                    ? { ...f, currentHP: skillResult.currentHp }
                    : f
                ));
              }
              addLog(skillResult.message, skillResult.success ? "success" : "error");
            }
            
            // Deduct action and end turn
            setFighters(prev => prev.map(f => 
              f.id === enemy.id 
                ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - selectedHealingSkill.cost) }
                : f
            ));
            
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return;
          }
        }
      }
    }
  }
  
  const playerTargets = visiblePlayers;
  if (playerTargets.length === 0) {
    // Check if there are players but they're just not visible
    if (allPlayers.length > 0) {
      addLog(`👁️ ${enemy.name} cannot see any players (hidden/obscured).`, "info");
    } else {
      addLog(`${enemy.name} has no targets and defends.`, "info");
    }
    processingEnemyTurnRef.current = false;
    scheduleEndTurn();
    return;
  }

  const normalizeLabel = (value) => {
    if (!value) return null;
    if (typeof value === "string") return value.toLowerCase();
    if (typeof value === "object") {
      const nested =
        value.key ??
        value.id ??
        value.slug ??
        value.type ??
        value.terrain ??
        value.name;
      if (typeof nested === "string") {
        return nested.toLowerCase();
      }
    }
    return null;
  };

  const engineTerrain =
    normalizeLabel(combatTerrain?.terrainData?.terrain) ??
    normalizeLabel(combatTerrain?.terrainData) ??
    normalizeLabel(combatTerrain?.terrain) ??
    normalizeLabel(arenaEnvironment?.terrainData?.terrain) ??
    normalizeLabel(arenaEnvironment?.terrainData) ??
    normalizeLabel(arenaEnvironment?.terrain) ??
    "plains";

  const engineLighting =
    normalizeLabel(combatTerrain?.lightingData?.lighting) ??
    normalizeLabel(combatTerrain?.lightingData) ??
    normalizeLabel(combatTerrain?.lighting) ??
    normalizeLabel(arenaEnvironment?.lightingData?.lighting) ??
    normalizeLabel(arenaEnvironment?.lightingData) ??
    normalizeLabel(arenaEnvironment?.lighting) ??
    "daylight";

  const engineContext = {
    combatants: fighters,
    environment: {
      terrain: engineTerrain,
      lighting: engineLighting,
    },
    positions: positionsRef.current || positions,
    logCallback: (message, type = "ai") => {
      addLog(message, type);
    },
  };

  let actionPlan = null;
  try {
    const selector = createAIActionSelector(engineContext);
    actionPlan = selector(enemy, playerTargets, fighters);
  } catch (error) {
    console.error("[AI] Failed to evaluate layered combat action", error);
    addLog(`⚠️ ${enemy.name} hesitates (AI error: ${error.message})`, "error");
  }

  if (actionPlan && !actionPlan.target && playerTargets.length > 0) {
    actionPlan.target = playerTargets[0];
  }

  if (actionPlan) {
    const aiType = (actionPlan.type || "").toLowerCase();
    if (aiType === "hold") {
      addLog(
        `[AI] ${enemy.name} holds position (${actionPlan.aiAction || "Hold"})`,
        "ai"
      );
      setFighters((prev) =>
        prev.map((f) =>
          f.id === enemy.id
            ? {
                ...f,
                remainingAttacks: Math.max(
                  0,
                  (f.remainingAttacks ?? enemy.remainingAttacks ?? 1) - 1
                ),
              }
            : f
        )
      );
      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }

    if (aiType === "defend" || aiType === "dodge") {
      const stance =
        actionPlan.stance === "retreat"
          ? "Retreat"
          : actionPlan.defend === "parry"
          ? "Parry"
          : "Dodge";

      if (stance === "Retreat") {
        const currentPositions = positionsRef.current || positions;
        const currentPos = currentPositions?.[enemy.id];
        const threatPositions = playerTargets
          .map((target) => currentPositions?.[target.id])
          .filter(Boolean);

        const speed =
          enemy.Spd ||
          enemy.spd ||
          enemy.attributes?.Spd ||
          enemy.attributes?.spd ||
          10;
        const attacksPerMelee =
          enemy.attacksPerMelee ||
          enemy.remainingAttacks ||
          1;
        const movementStats = calculateMovementPerAction(
          speed,
          Math.max(1, attacksPerMelee)
        );
        const fullFeetPerAction =
          movementStats.fullMovementPerAction ||
          movementStats.feetPerAction ||
          (speed * 18) / Math.max(1, attacksPerMelee);
        const retreatSteps = Math.max(
          1,
          Math.min(
            Math.floor(fullFeetPerAction / GRID_CONFIG.CELL_SIZE),
            5
          )
        );

        let retreatDestination = null;
        if (currentPos && threatPositions.length > 0) {
          retreatDestination = findRetreatDestination({
            currentPos,
            threatPositions,
            maxSteps: retreatSteps,
            enemyId: enemy.id,
            isHexOccupied,
          });
        }

        if (retreatDestination) {
          const retreatInfo = {
            action: "RETREAT",
            actionCost: 0,
            description: `Withdraw ${Math.round(
              retreatDestination.distanceFeet
            )}ft`,
          };
          handlePositionChange(
            enemy.id,
            retreatDestination.position,
            retreatInfo
          );
          addLog(
            `[AI] ${enemy.name} withdraws ${Math.round(
              retreatDestination.distanceFeet
            )}ft to (${retreatDestination.position.x}, ${
              retreatDestination.position.y
            }).`,
            "ai"
          );
        } else if (!currentPos) {
          addLog(
            `[AI] ${enemy.name} tries to withdraw but has no recorded position.`,
            "ai"
          );
        } else if (threatPositions.length === 0) {
          addLog(
            `[AI] ${enemy.name} looks for an escape path but no enemies are visible.`,
            "ai"
          );
        } else {
          addLog(
            `[AI] ${enemy.name} tries to withdraw but finds no safe space!`,
            "ai"
          );
        }

        setDefensiveStance((prev) => ({ ...prev, [enemy.id]: "Retreat" }));

        const currentEnemyState = fighters.find(
          (f) => f.id === enemy.id
        );
        const remainingBefore =
          currentEnemyState?.remainingAttacks ??
          enemy.remainingAttacks ??
          1;
        const remainingAfter = Math.max(0, remainingBefore - 1);

        setFighters((prev) =>
          prev.map((f) =>
            f.id === enemy.id
              ? {
                  ...f,
                  remainingAttacks: Math.max(
                    0,
                    (f.remainingAttacks ?? remainingBefore) - 1
                  ),
                }
              : f
          )
        );
        addLog(
          `⏭️ ${enemy.name} has ${remainingAfter} action(s) remaining this melee`,
          "info"
        );

        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      } else {
        addLog(
          `[AI] ${enemy.name} prepares to ${stance.toLowerCase()} (+defense).`,
          "ai"
        );
        if (stance === "Parry" || stance === "Dodge") {
          setDefensiveStance((prev) => ({ ...prev, [enemy.id]: stance }));
        }
      }

      setFighters((prev) =>
        prev.map((f) =>
          f.id === enemy.id
            ? {
                ...f,
                remainingAttacks: Math.max(
                  0,
                  (f.remainingAttacks ?? enemy.remainingAttacks ?? 1) - 1
                ),
              }
            : f
        )
      );
      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }
  }

  // Enhanced enemy AI with strategic reasoning (fallback/augment for strikes and specials)
  let target = actionPlan?.target || null;
  let reasoning = actionPlan?.aiAction
    ? `layered AI preference: ${actionPlan.aiAction}`
    : "";

  if (!target) {
    // Strategy 1: Target the weakest player (lowest HP percentage)
    const weakestTarget = playerTargets.reduce((weakest, current) => {
      const currentHPPct = current.currentHP / current.maxHP;
      const weakestHPPct = weakest.currentHP / weakest.maxHP;
      return currentHPPct < weakestHPPct ? current : weakest;
    });

    // Strategy 2: Target players with lowest AR (easiest to hit)
    const easyTarget = playerTargets.reduce((easiest, current) => {
      const currentAR = current.AR || current.ar || 10;
      const easiestAR = easiest.AR || easiest.ar || 10;
      return currentAR < easiestAR ? current : easiest;
    });

    // Strategy 3: Target players who are currently taking their turn (aggressive)
    const currentPlayerTarget = playerTargets.find(f => f.id === fighters[turnIndex]?.id);

    // Enhanced AI LOGIC: Smart target selection with pathfinding consideration
    
    // Calculate distances to all targets and check if they're reachable
    const targetsWithDistance = playerTargets.map(t => {
      const dist = positions[enemy.id] && positions[t.id] 
        ? calculateDistance(positions[enemy.id], positions[t.id])
        : Infinity;
      
      // Check if target is blocked by another combatant
      const isBlocked = isTargetBlocked(enemy.id, t.id, positions);
      
      return {
        target: t,
        distance: dist,
        hpPercent: t.currentHP / t.maxHP,
        isWounded: t.currentHP < t.maxHP,
        isBlocked: isBlocked,
        priority: calculateTargetPriority(t, dist, isBlocked)
      };
    }).sort((a, b) => a.priority - b.priority); // Sort by priority (lower = better)
    
    // Filter to only targets in reasonable range (within 100 ft to consider)
    const targetsInRange = targetsWithDistance.filter(t => t.distance <= 100);
    
    if (targetsInRange.length === 0) {
      // No one in range, use fallback strategies
      if (weakestTarget && weakestTarget.currentHP < weakestTarget.maxHP) {
        target = weakestTarget;
        reasoning = `targeting the weakest foe (${Math.round((weakestTarget.currentHP / weakestTarget.maxHP) * 100)}% HP)`;
      } else if (easyTarget && (easyTarget.AR || easyTarget.ar) < 10) {
        target = easyTarget;
        reasoning = `targeting easiest to hit (AR ${easyTarget.AR || easyTarget.ar})`;
      } else if (currentPlayerTarget) {
        target = currentPlayerTarget;
        reasoning = `targeting player currently taking turn (aggressive)`;
      } else {
        // Fallback to closest
        target = targetsWithDistance[0]?.target || playerTargets[0];
        reasoning = `targeting the closest reachable foe`;
      }
    } else {
      // Find best target considering reachability
      const reachableTargets = targetsInRange.filter(t => !t.isBlocked);
      const blockedTargets = targetsInRange.filter(t => t.isBlocked);
      
      if (reachableTargets.length > 0) {
        // Prefer reachable targets
        const bestReachable = reachableTargets[0];
        target = bestReachable.target;
        reasoning = `attacking closest reachable target (${Math.round(bestReachable.distance)}ft away)`;
      } else if (blockedTargets.length > 0) {
        // All targets blocked - try area attack or choose alternative
        const bestBlocked = blockedTargets[0];
        target = bestBlocked.target;
        reasoning = `target blocked by ${getBlockingCombatant(enemy.id, target.id, positions)?.name || 'another combatant'}, considering area attack`;
      } else {
        // Fallback
        target = targetsInRange[0].target;
        const dist = Math.round(targetsInRange[0].distance);
        reasoning = `attacking closest target (${dist}ft away)`;
      }
    }
  } else if (!reasoning) {
    reasoning = `following layered AI plan: ${actionPlan?.aiAction || "Strike"}`;
  }

  // Check if enemy needs to move closer to attack
  let needsToMoveCloser = false;
  let currentDistance = Infinity;

  // Select which attack to use (if creature has multiple attacks)
  const availableAttacks = enemy.attacks || [{ name: "Claw", damage: "1d6", count: 1 }];
  let selectedAttack = availableAttacks[0]; // Default to first attack
  let isChargingAttack = false; // Track if this will be a charge attack
  
  if (availableAttacks.length > 1) {
    // Check if creature has charge-type attacks (Horn Charge, Gore, Ram, etc.)
    const chargeAttacks = availableAttacks.filter(a => 
      a.name.toLowerCase().includes('charge') ||
      a.name.toLowerCase().includes('gore') ||
      a.name.toLowerCase().includes('ram') ||
      a.name.toLowerCase().includes('trample')
    );
    
    // Choose attack strategically from available
    if (chargeAttacks.length > 0) {
      // Has charge attack - choose randomly between charge and other attacks
      const allAttacks = [...chargeAttacks, ...availableAttacks.filter(a => !chargeAttacks.includes(a))];
      try {
        const attackRoll = CryptoSecureDice.parseAndRoll(`1d${allAttacks.length}`);
        selectedAttack = allAttacks[attackRoll.totalWithBonus - 1];
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[runEnemyTurnAI] Error rolling for attack selection:', error);
        }
        selectedAttack = allAttacks[0];
      }
    } else {
      // Choose attack strategically from available
      try {
        const attackRoll = CryptoSecureDice.parseAndRoll(`1d${availableAttacks.length}`);
        selectedAttack = availableAttacks[attackRoll.totalWithBonus - 1];
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[runEnemyTurnAI] Error rolling for available attack selection:', error);
        }
        selectedAttack = availableAttacks[0];
      }
    }
  }

  if (actionPlan?.aiAction && selectedAttack) {
    const aiActionName = actionPlan.aiAction.toLowerCase();
    const directMatch = availableAttacks.find(
      (attack) => (attack.name || "").toLowerCase() === aiActionName
    );
    if (directMatch) {
      selectedAttack = directMatch;
    } else if (aiActionName.includes("spell") && actionPlan.spell) {
      const spellAttack = {
        name: actionPlan.spell.name,
        damage: actionPlan.spell.damage || "by spell",
        type: "spell",
        spell: actionPlan.spell,
      };
      enemy.selectedAttack = spellAttack;
      selectedAttack = spellAttack;
    }
  }
  
  // If attack is Spellcasting, choose a specific spell
  let attackName = selectedAttack.name;
  if (selectedAttack.name === "Spellcasting" || selectedAttack.damage === "by spell") {
    const spell = getRandomCombatSpell(enemy.level || 3);
    attackName = `${spell.name} (${spell.damageType})`;
    // Update the attack damage to use the spell's damage
    selectedAttack = { ...selectedAttack, damage: spell.damage, name: attackName };
  }

  // Check weapon range for enemy attacks
  if (positions && positions[enemy.id] && positions[target.id]) {
    // Check if enemy just arrived from pending movement - use CURRENT position
    const enemyCurrentPos = positions[enemy.id];
    const targetCurrentPos = positions[target.id];
    
    // Recalculate distance with current positions using proper hex distance
    currentDistance = calculateDistance(enemyCurrentPos, targetCurrentPos);
    
    addLog(`📍 ${enemy.name} is at (${enemyCurrentPos.x}, ${enemyCurrentPos.y}), ${target.name} is at (${targetCurrentPos.x}, ${targetCurrentPos.y}), distance: ${Math.round(currentDistance)}ft`, "info");
    
    // Use proper weapon range validation
    const rangeValidation = validateWeaponRange(enemy, target, selectedAttack, currentDistance);
    
    if (!rangeValidation.canAttack) {
      needsToMoveCloser = true;
      addLog(`📍 ${enemy.name} is ${Math.round(currentDistance)}ft from ${target.name} (${rangeValidation.reason})`, "info");
    } else {
      addLog(`✅ ${enemy.name} is in range (${rangeValidation.reason})`, "info");
      if (rangeValidation.rangeInfo) {
        addLog(`📍 ${enemy.name} attacking at ${rangeValidation.rangeInfo}`, "info");
      }
    }
  }
  
  // Enhanced enemy AI using distance-based combat system
  if (needsToMoveCloser && target && positions[enemy.id] && positions[target.id]) {
    const currentPos = positions[enemy.id];
    const targetPos = positions[target.id];
    
    // Use analyzeMovementAndAttack to determine best movement strategy
    const equippedWeapon = enemy.equippedWeapons?.primary || enemy.equippedWeapons?.secondary || enemy.attacks?.[0] || null;
    if (equippedWeapon) {
      const movementAnalysis = analyzeMovementAndAttack(enemy, target, currentPos, targetPos, equippedWeapon);
      if (movementAnalysis.recommendations && movementAnalysis.recommendations.length > 0) {
        addLog(`🔍 ${enemy.name} analyzes movement: ${movementAnalysis.distance}ft away, ${movementAnalysis.inRange ? 'in range' : 'needs to move'}`, "info");
      }
    }
    
    // Use new AI system for movement decisions with flanking consideration
    const aiDecision = calculateEnemyMovementAI(enemy, target, currentPos, targetPos, availableAttacks);
    
    // Check for flanking opportunities
    const flankingPositions = findFlankingPositions(targetPos, positions, enemy.id);
    const currentFlankingBonus = calculateFlankingBonus(currentPos, targetPos, positions, enemy.id);
    
    // If we can flank, prioritize flanking positions
    if (flankingPositions.length > 0 && currentFlankingBonus === 0) {
      addLog(`🎯 ${enemy.name} considers flanking ${target.name}`, "info");
      
      // Find the best flanking position (closest to current position)
      const bestFlankPos = flankingPositions.reduce((best, current) => {
        const bestDist = calculateDistance(currentPos, best);
        const currentDist = calculateDistance(currentPos, current);
        return currentDist < bestDist ? current : best;
      });
      
      // Check if we can reach the flanking position
      const flankDistance = calculateDistance(currentPos, bestFlankPos);
      const speed = enemy.Spd || enemy.spd || enemy.attributes?.Spd || enemy.attributes?.spd || 10;
      const maxMoveDistance = speed * 5; // 5 feet per hex
      
      if (flankDistance <= maxMoveDistance) {
        addLog(`🎯 ${enemy.name} attempts to flank ${target.name}`, "info");
        
        // Move to flanking position
        setPositions(prev => {
          const updated = {
          ...prev,
          [enemy.id]: bestFlankPos
          };
          positionsRef.current = updated;
          return updated;
        });
        
        // Deduct movement action cost
        const movementCost = Math.ceil(flankDistance / (speed * 5));
        setFighters(prev => prev.map(f => 
          f.id === enemy.id 
            ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - movementCost) }
            : f
        ));
        
        addLog(`🎯 ${enemy.name} moves to flanking position (${bestFlankPos.x}, ${bestFlankPos.y})`, "info");
        
        // Continue with attack after movement
        setTimeout(() => {
          const newDistance = calculateDistance(bestFlankPos, targetPos);
          const rangeValidation = validateWeaponRange(enemy, target, selectedAttack, newDistance);
          
          if (rangeValidation.canAttack) {
            const flankingBonus = calculateFlankingBonus(bestFlankPos, targetPos, positions, enemy.id);
            if (flankingBonus > 0) {
              addLog(`🎯 ${enemy.name} gains flanking bonus (+${flankingBonus} to hit)!`, "info");
            }
            
            // Execute attack with flanking bonus
            const updatedEnemy = { ...enemy, selectedAttack: selectedAttack };
            const bonuses = flankingBonus > 0 ? { flankingBonus } : {};
            attack(updatedEnemy, target.id, bonuses);
            
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
          } else {
            addLog(`❌ ${enemy.name} cannot reach ${target.name} from flanking position`, "error");
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
          }
        }, 1000);
        return;
      }
    }
    
    // Get enemy speed for movement calculations
    const speed = enemy.Spd || enemy.spd || enemy.attributes?.Spd || enemy.attributes?.spd || 10;
    
    let movementType = 'MOVE';
    let movementDescription = 'moves';
    let hexesToMove = 1;
    let isChargingAttack = false;
    
    switch (aiDecision.decision) {
      case 'charge':
        movementType = 'CHARGE';
        movementDescription = 'charges';
        hexesToMove = Math.min(Math.round(currentDistance / GRID_CONFIG.CELL_SIZE) - 1, 3);
        isChargingAttack = true;
        addLog(`⚡ ${enemy.name} decides to charge! (${aiDecision.reason})`, "info");
        break;
        
      case 'move_and_attack':
        movementType = 'MOVE';
        movementDescription = 'moves closer';
        // Use Palladium movement calculation: Speed × 18 ÷ attacks per melee = feet per action
        const moveAndAttackFeetPerAction = (speed * 18) / (enemy.attacksPerMelee || 1);
        const moveAndAttackWalkingSpeed = Math.floor(moveAndAttackFeetPerAction * 0.5); // Walking speed
        hexesToMove = Math.floor(moveAndAttackWalkingSpeed / GRID_CONFIG.CELL_SIZE);
        addLog(`🏃 ${enemy.name} moves closer to attack (${aiDecision.reason})`, "info");
        break;
        
      case 'move_closer': {
        movementType = 'RUN';
        movementDescription = 'runs closer';
        // Use Palladium movement calculation: Speed × 18 ÷ attacks per melee = feet per action
        const moveCloserFeetPerAction = (speed * 18) / (enemy.attacksPerMelee || 1);
        hexesToMove = Math.floor(moveCloserFeetPerAction / GRID_CONFIG.CELL_SIZE);
        addLog(`🏃 ${enemy.name} runs closer (${aiDecision.reason})`, "info");
        break;
      }
        
      case 'use_ranged': {
        // Try to use ranged attack instead of moving
        const rangedAttack = availableAttacks.find(a => a.range && a.range > 0);
        if (rangedAttack) {
          addLog(`🏹 ${enemy.name} uses ranged attack instead of moving (${aiDecision.reason})`, "info");
          setTimeout(() => {
            const flankingBonus = calculateFlankingBonus(positions[enemy.id], positions[target.id], positions, enemy.id);
            const bonuses = flankingBonus > 0 ? { flankingBonus } : {};
            attack(enemy, target.id, bonuses);
          }, 1000);
          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }
        // Fall back to movement if no ranged attack
        movementType = MOVEMENT_ACTIONS.RUN.name;
        movementDescription = 'runs closer';
        // Use MOVEMENT_RATES for Palladium movement calculation
        const movementRates = MOVEMENT_RATES.calculateMovement(speed);
        const fallbackFeetPerAction = movementRates.running / (enemy.attacksPerMelee || 1);
        hexesToMove = Math.floor(fallbackFeetPerAction / GRID_CONFIG.CELL_SIZE);
        break;
      }
        
      default:
        movementType = MOVEMENT_ACTIONS.MOVE.name;
        movementDescription = 'moves';
        hexesToMove = 1;
    }
    
    // Legacy fallback for very far distances - use Palladium movement
    if (currentDistance > 20 * GRID_CONFIG.CELL_SIZE) {
      // Far away - RUN (move at full speed using Palladium formula)
      movementType = MOVEMENT_ACTIONS.RUN.name;
      movementDescription = 'runs';
      
      // Use MOVEMENT_RATES for official Palladium movement
      const movementRates = MOVEMENT_RATES.calculateMovement(speed);
      const maxMovementFeet = movementRates.running / (enemy.attacksPerMelee || 1); // Use feet per action
      hexesToMove = Math.floor(maxMovementFeet / GRID_CONFIG.CELL_SIZE);
      
      addLog(`🏃 ${enemy.name} is very far away, ${movementDescription} at full speed (${maxMovementFeet}ft/action)`, "info");
    }
    // else: close distance (1-3 hexes) - use default MOVE (1 hex)
    
    // If we decided to CHARGE, make sure we're using a charge-type attack!
    if (movementType === 'CHARGE' && isChargingAttack) {
      const chargeAttacks = availableAttacks.filter(a => 
        a.name.toLowerCase().includes('charge') ||
        a.name.toLowerCase().includes('gore') ||
        a.name.toLowerCase().includes('ram')
      );
      
      if (chargeAttacks.length > 0) {
        selectedAttack = chargeAttacks[0]; // Use Horn Charge, Gore, etc.
        addLog(`⚡ ${enemy.name} selects ${selectedAttack.name} for the charge!`, "combat");
      }
    }
    
    // Calculate new position
    const dx = targetPos.x - currentPos.x;
    const dy = targetPos.y - currentPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // FIX: Check for zero or very small distance to prevent NaN
    if (distance < 0.01) {
      // Already at target position, no movement needed
      addLog(`📍 ${enemy.name} is already at target position, skipping movement`, "info");
      // Continue to attack if in range
      const distanceFromCurrentPos = calculateDistance(currentPos, targetPos);
      const rangeValidation = validateWeaponRange(enemy, target, selectedAttack, distanceFromCurrentPos);
      
      if (rangeValidation.canAttack) {
        addLog(`⚔️ ${enemy.name} attacks from current position (${rangeValidation.reason})`, "info");
        // Continue to attack below (don't return)
      } else {
        addLog(`⚔️ ${enemy.name} cannot reach target (${rangeValidation.reason}) and ends turn`, "info");
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }
    }
    
    // Calculate distance in hexes for movement calculations
    const hexDistance = Math.round(currentDistance / GRID_CONFIG.CELL_SIZE);
    
    addLog(`🔍 ${enemy.name} movement debug: distance=${Math.round(currentDistance)}ft, hexDistance=${hexDistance}, hexesToMove=${hexesToMove}, movementType=${movementType}`, "info");
    
    // Determine actual hexes to move (don't overshoot, but ensure at least 1 hex if far away)
    // Fix: Ensure we always make progress toward the target
    let actualHexesToMove;
    
    if (currentDistance > 100) {
      // For very far distances, move more aggressively to prevent infinite loops
      actualHexesToMove = Math.min(hexesToMove * 3, Math.floor(hexDistance / 3));
      actualHexesToMove = Math.max(5, actualHexesToMove); // Minimum 5 hexes for far distances
      addLog(`🔍 ${enemy.name} far away (${Math.round(currentDistance)}ft), using aggressive movement: ${actualHexesToMove} hexes`, "info");
    } else {
      // Normal movement calculation
      actualHexesToMove = Math.max(1, Math.min(hexesToMove, hexDistance - 1)); // At least 1 hex, stop 1 hex away
    }
    const moveRatio = (actualHexesToMove * GRID_CONFIG.CELL_SIZE) / (distance * GRID_CONFIG.CELL_SIZE);
    
    // Log movement ratio for debugging (if significant movement)
    if (process.env.NODE_ENV === 'development' && moveRatio > 0.1) {
      console.debug(`[runEnemyTurnAI] Movement ratio: ${(moveRatio * 100).toFixed(1)}% of distance`);
    }
    
    let newX, newY, movementInfo;
    
    if (movementType === MOVEMENT_ACTIONS.MOVE.name || movementType === MOVEMENT_ACTIONS.CHARGE.name) {
      // MOVE: move calculated hexes immediately
      // CHARGE: move multiple hexes immediately and attack with bonuses
      const hexesThisTurn = actualHexesToMove; // Use the calculated movement distance
      
      // FIX: Prevent NaN by ensuring distance is valid
      if (distance < 0.01) {
        newX = currentPos.x;
        newY = currentPos.y;
      } else {
        newX = Math.round(currentPos.x + (dx / distance) * hexesThisTurn);
        newY = Math.round(currentPos.y + (dy / distance) * hexesThisTurn);
      }
      
      // Ensure valid numbers
      newX = isNaN(newX) ? currentPos.x : newX;
      newY = isNaN(newY) ? currentPos.y : newY;
      
      addLog(`🔍 ${enemy.name} calculated movement: from (${currentPos.x}, ${currentPos.y}) to (${newX}, ${newY}), hexesThisTurn=${hexesThisTurn}`, "info");
      
      // Check if destination is occupied
      const occupant = isHexOccupied(newX, newY, enemy.id);
      if (occupant) {
        addLog(`🚫 ${enemy.name} cannot move to (${newX}, ${newY}) - occupied by ${occupant.name}`, "info");
        
        // Recalculate distance from CURRENT position (not the blocked destination)
        const distanceFromCurrentPos = calculateDistance(currentPos, targetPos);
        
        // Check if within weapon range
        const rangeValidation = validateWeaponRange(enemy, target, selectedAttack, distanceFromCurrentPos);
        
        if (rangeValidation.canAttack) {
          addLog(`⚔️ ${enemy.name} is within range (${rangeValidation.reason}) and attacks`, "info");
          // Don't end turn, continue to attack below
        } else {
          addLog(`⚔️ ${enemy.name} cannot reach target (${rangeValidation.reason}) and ends turn`, "info");
          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }
      } else {
        // Not occupied, safe to move
        const currentMovementAction = movementType === MOVEMENT_ACTIONS.CHARGE.name ? MOVEMENT_ACTIONS.CHARGE : MOVEMENT_ACTIONS.MOVE;
        movementInfo = {
          action: movementType,
          actionCost: currentMovementAction.actionCost,
          description: movementType === MOVEMENT_ACTIONS.CHARGE.name 
            ? `Charge to position (${newX}, ${newY}) - ${MOVEMENT_ACTIONS.CHARGE.description}`
            : `Move to position (${newX}, ${newY}) - ${MOVEMENT_ACTIONS.MOVE.description}`
        };
        
        // Update position immediately for MOVE or CHARGE
        handlePositionChange(enemy.id, { x: newX, y: newY }, movementInfo);
        
        const distanceMoved = hexesThisTurn * GRID_CONFIG.CELL_SIZE;
        const actionVerb = movementType === MOVEMENT_ACTIONS.CHARGE.name ? 'charges' : 'moves';
        
        // Use MOVEMENT_RATES for 1994 Palladium format
        const movementRates = MOVEMENT_RATES.calculateMovement(speed);
        const runAction = MOVEMENT_ACTIONS.RUN;
        addLog(`🏃 ${enemy.name} uses ${runAction.actionCost} action(s) to ${runAction.name} (Speed ${speed} → ${movementRates.running}ft/melee)`, "info");
        addLog(`📍 ${enemy.name} ${actionVerb} ${Math.round(distanceMoved)}ft toward ${target.name} → new position (${newX},${newY})`, "info");
        
        // Deduct 1 action for movement
        setFighters(prev => prev.map(f => {
          if (f.id === enemy.id) {
            const updatedEnemy = { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) };
            addLog(`⏭️ ${enemy.name} has ${updatedEnemy.remainingAttacks} action(s) remaining this melee`, "info");
            return updatedEnemy;
          }
          return f;
        }));
        
        if (movementType === MOVEMENT_ACTIONS.CHARGE.name) {
          // CHARGE continues to attack on same turn (don't end turn yet!)
          const chargeAction = MOVEMENT_ACTIONS.CHARGE;
          addLog(`⚡ Now within melee range! Charge attack: ${chargeAction.description}`, "combat");
          // Continue to attack section below (don't return)
        } else {
          // After movement, check if we're now in range
          const newDistanceAfterMove = calculateDistance({ x: newX, y: newY }, targetPos);
          const rangeValidation = validateWeaponRange(enemy, target, selectedAttack, newDistanceAfterMove);
          
          const updatedEnemy = fighters.find(f => f.id === enemy.id);
          const hasActionsRemaining = updatedEnemy && updatedEnemy.remainingAttacks > 0;
          
          if (rangeValidation.canAttack && hasActionsRemaining) {
            // In range - perform a single attack, then end turn
            const updatedEnemyForAttack = { ...enemy, selectedAttack: selectedAttack };
            attack(updatedEnemyForAttack, target.id, {});
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return;
          } else {
            // Not in range or no actions - end turn
            const remainingDistance = Math.round(newDistanceAfterMove);
            if (remainingDistance > 5) {
              addLog(`📍 ${enemy.name} still ${remainingDistance}ft out of melee range - ending turn`, "info");
            } else if (!hasActionsRemaining) {
              addLog(`⏭️ ${enemy.name} has no actions remaining after movement - passing to next fighter`, "info");
            }
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return;
          }
        }
      }
    } else {
      // RUN/SPRINT: Move immediately (Palladium 1994 - no future movement)
      const moveDistance = actualHexesToMove;
      
      // FIX: Prevent NaN by checking distance is valid
      if (distance < 0.01) {
        // Already at target, don't move
        newX = currentPos.x;
        newY = currentPos.y;
      } else {
        newX = Math.round(currentPos.x + (dx / distance) * moveDistance);
        newY = Math.round(currentPos.y + (dy / distance) * moveDistance);
      }
      
      // Clamp to grid bounds and ensure valid numbers
      newX = Math.max(0, Math.min(GRID_CONFIG.GRID_WIDTH - 1, isNaN(newX) ? currentPos.x : newX));
      newY = Math.max(0, Math.min(GRID_CONFIG.GRID_HEIGHT - 1, isNaN(newY) ? currentPos.y : newY));
      
      // Check if destination is occupied
      const occupant = isHexOccupied(newX, newY, enemy.id);
      let targetX = newX;
      let targetY = newY;
      let closingIntoOpponent = false;
      let attackOfOpportunityAttacker = null;
      if (occupant) {
        const occupantIsAlly = occupant.type === enemy.type;
        
        if (occupantIsAlly) {
          addLog(`🏃 ${enemy.name} weaves past ${occupant.name} while running full tilt`, "info");
        } else {
          let attackRange = 5.5;
          if (typeof selectedAttack?.range === "number") {
            attackRange = selectedAttack.range;
          } else if (selectedAttack?.weapon) {
            const derivedRange = getWeaponRange(selectedAttack.weapon);
            if (typeof derivedRange === "number" && !Number.isNaN(derivedRange)) {
              attackRange = derivedRange;
            }
          }
          
          if (attackRange <= 5.5) {
            closingIntoOpponent = true;
            attackOfOpportunityAttacker = occupant;
            addLog(`⚔️ ${enemy.name} barrels through to engage ${occupant.name}!`, "info");
          } else {
            // Find nearest unoccupied hex toward target
            let foundAlternative = false;
            for (let offset = 1; offset <= 3 && !foundAlternative; offset++) {
              // Try hexes around the target at increasing distances
              const testPositions = [
                { x: newX - offset, y: newY },
                { x: newX + offset, y: newY },
                { x: newX, y: newY - offset },
                { x: newX, y: newY + offset },
                { x: newX - offset, y: newY - offset },
                { x: newX + offset, y: newY + offset },
              ];
              
              for (const testPos of testPositions) {
                if (
                  testPos.x >= 0 &&
                  testPos.x < GRID_CONFIG.GRID_WIDTH &&
                  testPos.y >= 0 &&
                  testPos.y < GRID_CONFIG.GRID_HEIGHT
                ) {
                  if (!isHexOccupied(testPos.x, testPos.y, enemy.id)) {
                    targetX = testPos.x;
                    targetY = testPos.y;
                    foundAlternative = true;
                    addLog(`📍 ${enemy.name} adjusts path to avoid ${occupant.name}, moving to (${targetX}, ${targetY})`, "info");
                    break;
                  }
                }
              }
            }
            
            if (!foundAlternative) {
              addLog(`🚫 ${enemy.name} cannot find path to target - all hexes occupied`, "info");
              addLog(`⏭️ ${enemy.name} ends turn (blocked)`, "info");
              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            }
          }
        }
      }
      
      if (closingIntoOpponent) {
        setTemporaryHexSharing((prev) => ({
          ...prev,
          [enemy.id]: {
            originalPos: { ...currentPos },
            targetHex: { x: targetX, y: targetY },
            targetCharId: attackOfOpportunityAttacker?.id,
            turnCreated: turnCounter,
          },
        }));
      }
      
      // Update position immediately (no pending movement)
      setPositions(prev => {
        const updated = {
          ...prev,
          [enemy.id]: { x: targetX, y: targetY }
        };
        positionsRef.current = updated;
        return updated;
      });
      
      if (closingIntoOpponent && attackOfOpportunityAttacker) {
        addLog(`⚠️ ${attackOfOpportunityAttacker.name} gets an attack of opportunity against ${enemy.name}!`, "warning");
        const attackerForAoO = attackOfOpportunityAttacker;
        const targetForAoO = enemy.id;
        
        setTimeout(() => {
          if (attackRef.current) {
            attackRef.current(attackerForAoO, targetForAoO, {});
          } else {
            addLog(`⚠️ Attack of opportunity delayed - attack system not ready`, "info");
            setTimeout(() => {
              if (attackRef.current) {
                attackRef.current(attackerForAoO, targetForAoO, {});
              }
            }, 1000);
          }
        }, 500);
      }
      
      const distanceMoved = calculateDistance(currentPos, { x: targetX, y: targetY });
      
      // 1994 Palladium format: RUN/SPRINT uses one action
      const feetPerMelee = speed * 18; // Official formula
      addLog(`🏃 ${enemy.name} uses one action to RUN (Speed ${speed} → ${feetPerMelee}ft/melee)`, "info");
      addLog(`📍 Moves ${Math.round(distanceMoved)}ft toward ${target.name} → new position (${targetX},${targetY})`, "info");
      
      // Deduct 1 action for movement
      setFighters(prev => prev.map(f => {
        if (f.id === enemy.id) {
          const updatedEnemy = { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) };
          addLog(`⏭️ ${enemy.name} has ${updatedEnemy.remainingAttacks} action(s) remaining this melee`, "info");
          return updatedEnemy;
        }
        return f;
      }));
      
      // After RUN/SPRINT movement, check if we're now in range and can attack
      setTimeout(() => {
        setPositions(currentPositions => {
          positionsRef.current = currentPositions;
          const latestEnemyPos = currentPositions[enemy.id] || { x: targetX, y: targetY };
          const latestTargetPos = currentPositions[target.id] || targetPos;
          const finalDistance = calculateDistance(latestEnemyPos, latestTargetPos);
          const rangeValidation = validateWeaponRange(enemy, target, selectedAttack, finalDistance);
          
          const updatedEnemy = fighters.find(f => f.id === enemy.id);
          const hasActionsRemaining = updatedEnemy && updatedEnemy.remainingAttacks > 0;
          
          // ✅ FIX: Check combat status and target validity before attacking
          if (!combatActive) {
            addLog(`⚠️ Combat ended, ${enemy.name} stops moving`, "info");
            processingEnemyTurnRef.current = false;
            return currentPositions;
          }
          
          // Check if target is still valid
          const updatedTarget = fighters.find(f => f.id === target.id);
          if (!updatedTarget || updatedTarget.currentHP <= 0 || updatedTarget.currentHP <= -21) {
            addLog(`⚠️ ${enemy.name}'s target is no longer valid, ending turn`, "info");
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return currentPositions;
          }
          
          if (rangeValidation.canAttack && hasActionsRemaining) {
            addLog(`⚔️ ${enemy.name} is now in range (${rangeValidation.reason})!`, "info");
            const updatedEnemyForAttack = { ...enemy, selectedAttack: selectedAttack };
            attack(updatedEnemyForAttack, target.id, {
              attackerPosOverride: latestEnemyPos,
              defenderPosOverride: latestTargetPos,
              distanceOverride: finalDistance
            });
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
          } else {
            if (finalDistance > 5) {
              addLog(`📍 ${enemy.name} still ${Math.round(finalDistance)}ft out of melee range - ending turn`, "info");
            } else if (!hasActionsRemaining) {
              addLog(`⏭️ ${enemy.name} has no actions remaining - passing to next fighter`, "info");
            }
            processingEnemyTurnRef.current = false;
            setTimeout(() => {
              endTurn();
            }, 1500);
          }
          
          return currentPositions;
        });
      }, 800);
      return;
    }
  }
  
  // ✅ FIX: Final validation: make sure target can still be attacked and combat is active
  if (!combatActive) {
    addLog(`⚠️ Combat ended, ${enemy.name} stops attacking`, "info");
    processingEnemyTurnRef.current = false;
    return;
  }
  
  if (!target || target.currentHP <= -21) {
    addLog(`⚠️ ${enemy.name}'s target is dead, ending turn`, "info");
    processingEnemyTurnRef.current = false;
    scheduleEndTurn();
    return;
  }
  
  // ✅ FIX: Don't allow attacking unconscious/dying targets if all players are already defeated
  // Exception: Evil alignments may finish off dying players (coup de grâce)
  if (target && target.currentHP <= 0 && target.currentHP > -21) {
    // Check if there are any conscious players remaining
    const consciousPlayers = fighters.filter(f => f.type === "player" && canFighterAct(f) && f.currentHP > 0);
    const enemyAlignment = enemy.alignment || enemy.attributes?.alignment || "";
    const isEvil = isEvilAlignment(enemyAlignment);
    
    if (consciousPlayers.length === 0) {
      // All players are defeated
      if (isEvil) {
        // Evil alignments may finish off dying players (coup de grâce)
        const hpStatus = getHPStatus(target.currentHP);
        addLog(`😈 ${enemy.name} (${enemyAlignment}) finishes off dying ${target.name} (${hpStatus.description})!`, "warning");
      } else {
        // Good/neutral alignments show mercy - don't attack unconscious players
        addLog(`⚠️ All players are defeated! ${enemy.name} shows mercy and stops attacking.`, "info");
        if (!combatEndCheckRef.current) {
          combatEndCheckRef.current = true;
          addLog("💀 All players are defeated! Enemies win!", "defeat");
          setCombatActive(false);
        }
        processingEnemyTurnRef.current = false;
        return;
      }
    } else {
      // Still conscious players remaining - allow attacking dying ones
      const hpStatus = getHPStatus(target.currentHP);
      if (isEvil) {
        addLog(`😈 ${enemy.name} (${enemyAlignment}) attacks dying ${target.name} (${hpStatus.description})!`, "warning");
      } else {
        addLog(`⚠️ ${enemy.name} targeting ${target.name} who is ${hpStatus.description}`, "warning");
      }
    }
  }
  
  // Check if this is an area attack (Horn Charge, etc.)
  const isAreaAttack = selectedAttack.name.toLowerCase().includes('charge') || 
                      selectedAttack.name.toLowerCase().includes('gore') ||
                      selectedAttack.name.toLowerCase().includes('ram');
  
  if (isAreaAttack && isTargetBlocked(enemy.id, target.id, positions)) {
    // Area attack - can hit multiple targets in line
    const targetsInLine = getTargetsInLine(enemy.id, target.id, positions);
    
    if (targetsInLine.length > 0) {
      addLog(`⚡ ${enemy.name} uses ${attackName} - area attack hitting ${targetsInLine.length} target(s)!`, "info");
      
      // Execute area attack on all targets in line (one action, multiple targets)
      const chargeBonus = isChargingAttack ? { strikeBonus: +2 } : {};
      
      // Attack all targets in line, but this is still ONE action
      targetsInLine.forEach((lineTarget) => {
        attack(enemy, lineTarget.id, {
          ...chargeBonus,
          flankingBonus: calculateFlankingBonus(
            positions[enemy.id],
            positions[lineTarget.id],
            positions,
            enemy.id
          ),
        });
      });
      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }
  }
  
  addLog(`🤖 ${enemy.name} ${reasoning} and attacks ${target.name} with ${attackName}!`, "info");
  
  // Create updated enemy with selected attack (don't update state yet to prevent re-render loop)
  const updatedEnemy = { ...enemy, selectedAttack: selectedAttack };
  
  // Get the number of attacks for this attack type
  const attackCount = selectedAttack.count || 1;
  
  // Determine if this is a charging attack (for bonuses)
  const chargeBonus = isChargingAttack ? { strikeBonus: +2 } : {};
  
  // Check for flanking bonus
  const currentFlankingBonus = calculateFlankingBonus(positions[enemy.id], positions[target.id], positions, enemy.id);
  const flankingBonus = currentFlankingBonus > 0 ? { flankingBonus: currentFlankingBonus } : {};
  
  // Combine all bonuses
  const allBonuses = { ...chargeBonus, ...flankingBonus };
  
  if (flankingBonus.flankingBonus > 0) {
    addLog(`🎯 ${enemy.name} gains +${flankingBonus.flankingBonus} flanking bonus!`, "info");
  }
  
  // Execute attack - handle attack count for multi-strike attacks
  // The count property is for attacks that hit multiple times in ONE action (like dual wield)
  setTimeout(() => {
    // If attackCount > 1, this represents a multi-strike attack (all in one action)
    // The attack function should handle this internally, but we log it for clarity
    if (attackCount > 1) {
      addLog(`⚔️ ${enemy.name} performs ${attackCount}-strike attack!`, "info");
    }
    attack(updatedEnemy, target.id, allBonuses);
    
    // End turn after attack
    processingEnemyTurnRef.current = false;
    setTimeout(() => {
      endTurn();
    }, 1500); // Reduced delay for faster turn progression
  }, 1500);
}

