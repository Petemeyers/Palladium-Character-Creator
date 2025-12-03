/**
 * Player Turn AI Module
 * 
 * Handles AI decision-making for player characters during combat.
 * This is a pure function module - no React hooks or state management.
 * All state updates are done via callbacks passed in the context.
 */

/**
 * Run player turn AI
 * @param {Object} player - The player fighter object
 * @param {Object} context - Context object containing all necessary dependencies
 */
export function runPlayerTurnAI(player, context) {
  const {
    fighters,
    positions,
    combatTerrain,
    arenaEnvironment,
    meleeRound,
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
    findFlankingPositions,
    calculateFlankingBonus,
    validateWeaponRange,
    isHexOccupied,
    handlePositionChange,
    getEquippedWeapons,
    // Visibility / fog
    fogEnabled,
    visibleCells,
    canAISeeTarget,
    visibilityLogRef,
    // Magic / psionics
    getFighterSpells,
    getFighterPsionicPowers,
    getFighterPPE,
    getFighterISP,
    // Attack & combat
    attack,
    setPositions,
    setFighters,
    getActionDelay,
    arenaSpeed,
    positionsRef,
    movementAttemptsRef,
    playerAIRecentlyUsedPsionicsRef,
    processingPlayerAIRef,
    // Spell/power utilities
    isOffensiveSpell,
    isHealingSpell,
    getSpellCost,
    getSpellHealingFormula,
    getPsionicCost,
    getPsionicTargetCategory,
    parseRangeToFeet,
    getSpellRangeInFeet,
    spellCanAffectTarget,
    executeSpell,
    executePsionicPower,
    // Weapon utilities
    getWeaponRange,
    getWeaponType,
    getWeaponLength,
    autoEquipWeapons,
    // Constants
    MIN_COMBAT_HP,
    getFighterHP,
    getFighterMaxHP,
    GRID_CONFIG,
    MOVEMENT_RATES,
    MOVEMENT_ACTIONS,
    getHexNeighbors,
    isValidPosition,
    findBeePath,
    getTargetsInLine,
  } = context;

  // ✅ CRITICAL: Check if player can act (conscious, not dying/dead/unconscious)
  if (!canFighterAct(player)) {
    const hpStatus = getHPStatus(player.currentHP);
    addLog(`⏭️ ${player.name} cannot act (${hpStatus.description}), skipping turn`, "info");
    processingPlayerAIRef.current = false;
    scheduleEndTurn();
    return;
  }
  
  // Check if combat is still active
  if (!combatActive) {
    addLog(`⚠️ Combat ended, ${player.name} skips turn`, "info");
    processingPlayerAIRef.current = false;
    return;
  }
  
  // Check if player has actions remaining
  if (player.remainingAttacks <= 0) {
    addLog(`⏭️ ${player.name} has no actions remaining - passing to next fighter in initiative order`, "info");
    processingPlayerAIRef.current = false;
    scheduleEndTurn();
    return;
  }
  
  // ✅ FIX: Filter enemies by visibility AND exclude unconscious/dying/dead targets
  // Only target conscious enemies (HP > 0) - unconscious/dying enemies are already defeated
  const allEnemies = fighters.filter(f => 
    f.type === "enemy" && 
    canFighterAct(f) && 
    f.currentHP > 0 &&  // Only conscious enemies
    f.currentHP > -21    // Not dead
  );
  const enemyTargets = allEnemies.filter(target => {
    return canAISeeTarget(player, target, positions, combatTerrain, {
      useFogOfWar: fogEnabled,
      fogOfWarVisibleCells: visibleCells
    });
  });
  
  if (enemyTargets.length === 0) {
    // Check if there are enemies but they're just not visible
    if (allEnemies.length > 0) {
      // Only log visibility issues once per melee round per player to avoid spam
      // Use meleeRound instead of turnCounter since turnCounter changes every action
      const visibilityLogKey = `${player.id}_round_${meleeRound}`;
      if (!visibilityLogRef.current.has(visibilityLogKey)) {
        addLog(`👁️ ${player.name} cannot see any enemies (hidden/obscured).`, "info");
        visibilityLogRef.current.add(visibilityLogKey);
        // Clean up old entries (keep only last 10 rounds worth)
        if (visibilityLogRef.current.size > 100) {
          const entries = Array.from(visibilityLogRef.current);
          visibilityLogRef.current = new Set(entries.slice(-50));
        }
      }
    } else {
      addLog(`${player.name} has no targets and defends.`, "info");
    }
    processingPlayerAIRef.current = false;
    scheduleEndTurn();
    return;
  }

  const occLower = (player.occ || player.class || "").toLowerCase();
  const fighterSpells = getFighterSpells(player);
  const fighterPsionics = getFighterPsionicPowers(player);
  const ppeAvailable = getFighterPPE(player);
  const ispAvailable = getFighterISP(player);

  const offensiveSpells = fighterSpells.filter(
    (spell) => isOffensiveSpell(spell) && getSpellCost(spell) <= ppeAvailable
  );
  const healingSpells = fighterSpells.filter(
    (spell) =>
      isHealingSpell(spell) &&
      getSpellCost(spell) <= ppeAvailable &&
      getSpellHealingFormula(spell)
  );

  const offensivePsionics = fighterPsionics.filter((power) => {
    const cost = getPsionicCost(power);
    if (cost > ispAvailable) return false;
    return getPsionicTargetCategory(power) === "enemy";
  });

  const healingPsionics = fighterPsionics.filter((power) => {
    const cost = getPsionicCost(power);
    if (cost > ispAvailable) return false;
    
    // Exclude detection/utility powers that don't actually heal
    const powerName = (power.name || "").toLowerCase();
    if (powerName.includes("see aura") || powerName.includes("detect") || 
        powerName.includes("sense") || powerName.includes("telepathy") ||
        powerName.includes("empathy") || powerName.includes("presence sense")) {
      return false;
    }
    
    const type = (power.attackType || "").toLowerCase();
    if (type === "healing") return true;
    const category = (power.category || "").toLowerCase();
    if (category.includes("healing")) return true;
    if ((power.effect || "").toLowerCase().includes("heal")) return true;
    
    // Only include powers that explicitly mention HP healing
    const description = (power.description || "").toLowerCase();
    if (description.includes("restore hp") || description.includes("heal hp") || 
        description.includes("regain hit points")) return true;
    
    return false;
  });

  const healingCandidates = fighters
    .filter((f) => f.type === "player" && f.currentHP > MIN_COMBAT_HP)
    .filter((f) => getFighterHP(f) < getFighterMaxHP(f));

  const prioritizedHealingTargets = [...healingCandidates].sort(
    (a, b) => getFighterHP(a) - getFighterHP(b)
  );

  const healingTargets = prioritizedHealingTargets.filter((candidate) => {
    const hp = getFighterHP(candidate);
    const max = getFighterMaxHP(candidate) || 1;
    if (hp <= 0) return true;
    return hp / max <= 0.6;
  });

  const attemptHealing = (targetsToHeal) => {
    // Track which powers we've already tried this turn to prevent loops
    const triedPowers = new Set();
    
    for (const candidate of targetsToHeal) {
      const isSelfTarget = candidate.id === player.id;
      const spell = healingSpells.find((spellOption) =>
        spellCanAffectTarget(spellOption, player, candidate)
      );

      if (spell) {
        addLog(
          `💚 ${player.name} uses ${spell.name} to aid ${candidate.name}.`,
          "info"
        );
        if (executeSpell(player, candidate, spell)) {
          processingPlayerAIRef.current = false;
          return true;
        }
      }

      const psionic = healingPsionics.find((power) => {
        // Skip if we've already tried this power
        if (triedPowers.has(power.name)) return false;
        
        const category = getPsionicTargetCategory(power);
        if (isSelfTarget) {
          return category === "self" || category === "ally";
        }
        if (category !== "ally") return false;
        if (!positions[player.id] || !positions[candidate.id]) return true;
        const rangeFeet = parseRangeToFeet(power.range);
        if (rangeFeet === Infinity) return true;
        const distanceFeet = calculateDistance(
          positions[player.id],
          positions[candidate.id]
        );
        return distanceFeet <= rangeFeet;
      });

      if (psionic) {
        triedPowers.add(psionic.name); // Mark as tried
        addLog(
          `💚 ${player.name} channels ${psionic.name} to help ${candidate.name}.`,
          "info"
        );
        if (executePsionicPower(player, candidate, psionic)) {
          processingPlayerAIRef.current = false;
          return true;
        }
      }
    }
    return false;
  };

  if (
    healingTargets.length > 0 &&
    (healingSpells.length > 0 || healingPsionics.length > 0)
  ) {
    if (attemptHealing(healingTargets)) {
      return;
    }
  }

  // AI Strategy for players: Similar to enemy AI but with player-specific logic
  let target = null;
  let reasoning = "";

  // Get equipped weapons for automatic weapon selection
  const equippedWeapons = getEquippedWeapons(player);
  
  // Debug: Show what we found
  addLog(`🔍 ${player.name} weapon check: ${equippedWeapons.length} equipped weapons found`, "info");
  if (equippedWeapons.length > 0) {
    addLog(`🔍 ${player.name} equipped weapons: ${equippedWeapons.map(w => w.name).join(', ')}`, "info");
  }
  
  // Calculate distances to all targets and check if they're reachable
  const targetsWithDistance = enemyTargets.map(t => {
    const dist = positions[player.id] && positions[t.id] 
      ? calculateDistance(positions[player.id], positions[t.id])
      : Infinity;
    
    const isBlocked = isTargetBlocked(player.id, t.id, positions);
    
    return {
      target: t,
      distance: dist,
      hpPercent: t.currentHP / t.maxHP,
      isWounded: t.currentHP < t.maxHP,
      isBlocked: isBlocked,
      priority: calculateTargetPriority(t, dist, isBlocked)
    };
  }).sort((a, b) => a.priority - b.priority);
  
  const targetsInRange = targetsWithDistance.filter(t => t.distance <= 100);
  
  if (targetsInRange.length === 0) {
    target = targetsWithDistance[0]?.target || enemyTargets[0];
    reasoning = `targeting the closest reachable foe`;
  } else {
    const reachableTargets = targetsInRange.filter(t => !t.isBlocked);
    const blockedTargets = targetsInRange.filter(t => t.isBlocked);
    
    if (reachableTargets.length > 0) {
      const bestReachable = reachableTargets[0];
      target = bestReachable.target;
      reasoning = `attacking closest reachable target (${Math.round(bestReachable.distance)}ft away)`;
    } else if (blockedTargets.length > 0) {
      const bestBlocked = blockedTargets[0];
      target = bestBlocked.target;
      reasoning = `target blocked by ${getBlockingCombatant(player.id, target.id, positions)?.name || 'another combatant'}, considering area attack`;
    } else {
      target = targetsInRange[0].target;
      const dist = Math.round(targetsInRange[0].distance);
      reasoning = `attacking closest target (${dist}ft away)`;
    }
  }

  let currentDistance = Infinity;
  if (target && positions[player.id] && positions[target.id]) {
    currentDistance = calculateDistance(positions[player.id], positions[target.id]);
  }

  const selectOffensiveSpell = (spellsList) => {
    if (!target) return null;
    const viable = spellsList.filter((spell) =>
      spellCanAffectTarget(spell, player, target)
    );
    if (viable.length === 0) return null;
    const inRange = viable.filter((spell) => {
      const rangeFeet = getSpellRangeInFeet(spell);
      return (
        rangeFeet === Infinity ||
        currentDistance === Infinity ||
        currentDistance <= rangeFeet
      );
    });
    const pool = inRange.length > 0 ? inRange : viable;
    pool.sort(
      (a, b) => getSpellRangeInFeet(a) - getSpellRangeInFeet(b)
    );
    return pool[0];
  };

  // Track recently used psionics per fighter to prevent spamming
  const recentlyUsed = playerAIRecentlyUsedPsionicsRef.current.get(player.id) || [];
  const lastUsedPsionic = recentlyUsed[recentlyUsed.length - 1];
  
  const selectOffensivePsionic = (powersList) => {
    if (!target) return null;
    const viable = powersList.filter((power) => {
      if (getPsionicTargetCategory(power) !== "enemy") return false;
      const rangeFeet = parseRangeToFeet(power.range);
      if (rangeFeet === Infinity || currentDistance === Infinity) return true;
      return currentDistance <= rangeFeet;
    });
    if (viable.length === 0) return null;
    
    // Filter out recently used psionics (prevent spamming the same power)
    // Only exclude if we've used it in the last 3 actions
    const available = viable.filter((power) => {
      if (!lastUsedPsionic) return true;
      // Allow using the same psionic if we have 3+ different options
      if (viable.length >= 3 && recentlyUsed.length >= 2) {
        // If we've used the same power twice in a row, try a different one
        const lastTwo = recentlyUsed.slice(-2);
        if (lastTwo.length === 2 && lastTwo[0] === lastTwo[1] && lastTwo[0] === power.name) {
          return false; // Don't use the same power 3 times in a row
        }
      }
      return true;
    });
    
    // If we filtered everything out, use the original list (better than nothing)
    const powersToChooseFrom = available.length > 0 ? available : viable;
    
    // Sort by range, then by cost (prefer cheaper if same range)
    powersToChooseFrom.sort((a, b) => {
      const rangeA = parseRangeToFeet(a.range);
      const rangeB = parseRangeToFeet(b.range);
      if (rangeA !== rangeB) return rangeA - rangeB;
      const costA = getPsionicCost(a);
      const costB = getPsionicCost(b);
      return costA - costB;
    });
    
    return powersToChooseFrom[0];
  };

  const bestOffensiveSpell = selectOffensiveSpell(offensiveSpells);
  const bestOffensivePsionic = selectOffensivePsionic(offensivePsionics);

  const magicKeywords = [
    "wizard",
    "mage",
    "warlock",
    "witch",
    "sorcerer",
    "summoner",
    "diabolist",
    "cleric",
    "priest",
    "druid",
    "shaman",
  ];
  const isMagicFocused = magicKeywords.some((keyword) =>
    occLower.includes(keyword)
  );
  const isMindMage = occLower.includes("mind mage") || occLower.includes("mindmage");

  // Debug logging for mind mages
  if (isMindMage) {
    addLog(`🧠 ${player.name} is a Mind Mage - checking psionic powers...`, "info");
    addLog(`🧠 Available psionic powers: ${fighterPsionics.length}, Offensive: ${offensivePsionics.length}, ISP: ${ispAvailable}`, "info");
    if (bestOffensivePsionic) {
      addLog(`🧠 Best offensive psionic: ${bestOffensivePsionic.name} (cost: ${getPsionicCost(bestOffensivePsionic)} ISP)`, "info");
    } else {
      addLog(`🧠 No viable offensive psionic found (target: ${target?.name}, distance: ${Math.round(currentDistance)}ft)`, "info");
    }
  }

  const attemptOffensiveSpell = (spell) => {
    addLog(
      `🔮 ${player.name} unleashes ${spell.name} at ${target.name}!`,
      "info"
    );
    if (executeSpell(player, target, spell)) {
      processingPlayerAIRef.current = false;
      return true;
    }
    return false;
  };

  const attemptOffensivePsionic = (power) => {
    addLog(
      `🧠 ${player.name} focuses ${power.name} on ${target.name}!`,
      "info"
    );
    if (executePsionicPower(player, target, power)) {
      // Track this psionic as recently used to prevent spamming
      const recentlyUsed = playerAIRecentlyUsedPsionicsRef.current.get(player.id) || [];
      recentlyUsed.push(power.name);
      // Keep only last 3 used psionics per fighter
      if (recentlyUsed.length > 3) {
        recentlyUsed.shift();
      }
      playerAIRecentlyUsedPsionicsRef.current.set(player.id, recentlyUsed);
      
      processingPlayerAIRef.current = false;
      return true;
    }
    return false;
  };

  // For mind mages, prioritize psionics over weapons and spells
  // For others, use psionics if no spell available or at long range
  const shouldUsePsionics =
    !!bestOffensivePsionic &&
    (isMindMage ||
      (!bestOffensiveSpell && currentDistance > 5.5) ||
      currentDistance > 20);

  if (isMindMage) {
    addLog(`🧠 Mind Mage psionic decision: shouldUsePsionics=${shouldUsePsionics}, bestOffensivePsionic=${bestOffensivePsionic?.name || 'none'}`, "info");
  }

  if (shouldUsePsionics && bestOffensivePsionic) {
    const psionicResult = attemptOffensivePsionic(bestOffensivePsionic);
    if (isMindMage) {
      addLog(`🧠 Psionic execution result: ${psionicResult ? 'SUCCESS' : 'FAILED'}`, psionicResult ? "info" : "error");
    }
    if (psionicResult) {
      return;
    }
  }

  // Only use spells if not a mind mage (mind mages should prefer psionics)
  const shouldUseSpell =
    !!bestOffensiveSpell &&
    !isMindMage &&
    (isMagicFocused ||
      currentDistance > 20 ||
      !bestOffensivePsionic);

  if (shouldUseSpell && bestOffensiveSpell) {
    if (attemptOffensiveSpell(bestOffensiveSpell)) {
      return;
    }
  }

  // Smart weapon selection based on distance and available weapons
  addLog(`🔍 ${player.name} checking weapons...`, "info");
  let selectedAttack = null;
  let attackName = "Unarmed Strike";
  let selectedWeapon = null;
  
  // If no weapons found, try to equip a basic weapon from inventory
  if (equippedWeapons.length === 0) {
    addLog(`⚠️ ${player.name} has no equipped weapons - checking inventory...`, "warning");
    
    // Check if player has weapons in inventory/wardrobe
    const inventory = player.wardrobe || player.inventory || [];
    addLog(`🔍 ${player.name}'s inventory has ${inventory.length} items`, "info");
    
    const availableWeapons = inventory.filter(item => 
      item.type === 'weapon' || 
      item.category === 'one-handed' || 
      item.category === 'two-handed' ||
      item.name?.toLowerCase().includes('sword') ||
      item.name?.toLowerCase().includes('bow') ||
      item.name?.toLowerCase().includes('dagger')
    );
    
    addLog(`🔍 Found ${availableWeapons.length} weapons in inventory`, "info");
    
    if (availableWeapons.length > 0) {
      // Use autoEquipWeapons to properly equip weapons from inventory
      const updatedPlayer = autoEquipWeapons(player);
      
      // Update player's equipped weapons
      if (updatedPlayer.equippedWeapons && updatedPlayer.equippedWeapons.length > 0) {
        equippedWeapons.push(...updatedPlayer.equippedWeapons.filter(w => w.name !== "Unarmed"));
        
        // Update the player object in fighters array
        setFighters(prev => prev.map(f => 
          f.id === player.id 
            ? { ...f, equippedWeapons: updatedPlayer.equippedWeapons, equipped: updatedPlayer.equipped, equippedWeapon: updatedPlayer.equippedWeapon }
            : f
        ));
        
        const equippedWeaponNames = updatedPlayer.equippedWeapons.filter(w => w.name !== "Unarmed").map(w => w.name).join(', ');
        addLog(`⚔️ ${player.name} auto-equipped: ${equippedWeaponNames || 'No weapons'}`, "info");
      } else {
        addLog(`❌ ${player.name} has no weapons in inventory - using unarmed`, "warning");
      }
    } else {
      addLog(`❌ ${player.name} has no weapons in inventory - using unarmed`, "warning");
    }
  }
  
  // Calculate current distance to target for weapon selection
  if (target && positions[player.id] && positions[target.id]) {
    currentDistance = calculateDistance(positions[player.id], positions[target.id]);
    addLog(`📍 ${player.name} is ${Math.round(currentDistance)}ft from ${target.name}`, "info");
  }
  
  if (equippedWeapons.length > 0) {
    // Smart weapon selection based on distance to target
    // Categorize weapons by range and type
    const meleeWeapons = equippedWeapons.filter(w => {
      const range = getWeaponRange(w);
      return range <= 5.5; // Melee range
    });
    
    const rangedWeapons = equippedWeapons.filter(w => {
      const range = getWeaponRange(w);
      return range > 5.5; // Ranged weapons
    });
    
    // Use getWeaponType and getWeaponLength for detailed weapon info
    const weaponTypeInfo = equippedWeapons.map(w => {
      const type = getWeaponType(w);
      const length = getWeaponLength(w);
      return `${w.name} (${type}, ${length}ft)`;
    }).join(', ');
    
    addLog(`🔍 ${player.name} has ${meleeWeapons.length} melee and ${rangedWeapons.length} ranged weapons`, "info");
    if (equippedWeapons.length > 0) {
      addLog(`🔍 Weapon details: ${weaponTypeInfo}`, "info");
    }
    
    // Choose weapon based on distance - prioritize ranged when far away
    if (currentDistance > 5.5 && rangedWeapons.length > 0) {
      // Far range - prefer ranged weapons
      selectedWeapon = rangedWeapons[Math.floor(Math.random() * rangedWeapons.length)];
      addLog(`🏹 ${player.name} selects ${selectedWeapon.name} for ranged combat (${Math.round(currentDistance)}ft away)`, "info");
    } else if (currentDistance <= 5.5 && meleeWeapons.length > 0) {
      // Close range - prefer melee weapons
      selectedWeapon = meleeWeapons[Math.floor(Math.random() * meleeWeapons.length)];
      addLog(`🗡️ ${player.name} selects ${selectedWeapon.name} for melee combat`, "info");
    } else if (equippedWeapons.length > 0) {
      // Fallback to any equipped weapon
      selectedWeapon = equippedWeapons[Math.floor(Math.random() * equippedWeapons.length)];
      addLog(`⚔️ ${player.name} selects ${selectedWeapon.name} (fallback)`, "info");
    }
    
    if (selectedWeapon) {
      selectedAttack = {
        name: selectedWeapon.name,
        damage: selectedWeapon.damage || "1d3",
        count: 1,
        range: getWeaponRange(selectedWeapon)
      };
      attackName = selectedAttack.name;
      addLog(`✅ ${player.name} will attack with ${attackName}`, "info");
    }
  }
  
  // Fallback to unarmed if no weapon selected
  if (!selectedAttack) {
    selectedAttack = {
      name: "Unarmed Strike",
      damage: "1d3",
      count: 1,
      range: 5.5
    };
  }

  // Check if player needs to move closer to attack
  let needsToMoveCloser = false;
  
  if (target && positions[player.id] && positions[target.id]) {
    try {
      currentDistance = calculateDistance(positions[player.id], positions[target.id]);
      // Use proper weapon range validation
      const rangeValidation = validateWeaponRange(player, target, selectedAttack, currentDistance);
      needsToMoveCloser = !rangeValidation.canAttack;
    } catch (error) {
      console.error('Error in range validation:', error);
      needsToMoveCloser = true; // Default to needing to move closer
    }
  }
  
  // Handle movement if needed
  if (needsToMoveCloser && target && positions[player.id] && positions[target.id]) {
    try {
      const currentPos = positions[player.id];
      const targetPos = positions[target.id];
      const speed = player.Spd || player.spd || player.attributes?.Spd || player.attributes?.spd || 10;
      
      // Initialize or reset movement attempts tracker for this fighter/turn
      const attemptKey = `${player.id}-${turnCounter}`;
      if (!movementAttemptsRef.current[attemptKey]) {
        movementAttemptsRef.current[attemptKey] = { count: 0, lastDistance: currentDistance, lastPosition: {...currentPos} };
      }
      const movementTracker = movementAttemptsRef.current[attemptKey];
      if (movementTracker.lastDistance == null) {
        movementTracker.lastDistance = currentDistance;
      }
      if (!movementTracker.lastPosition) {
        movementTracker.lastPosition = { ...currentPos };
      }
      
      // Prevent infinite loops: max 3 movement attempts per turn
      if (movementTracker.count >= 3) {
        addLog(`🚫 ${player.name} has tried to move 3 times and cannot reach target - ending turn`, "error");
        processingPlayerAIRef.current = false;
        scheduleEndTurn();
        return;
      }
      
      // ✅ FIX: Check if distance actually improved from last attempt
      // Also check if combat ended or target is no longer valid
      if (!combatActive) {
        addLog(`⚠️ Combat ended, ${player.name} stops moving`, "info");
        processingPlayerAIRef.current = false;
        return;
      }
      
      // Check if target is still valid (conscious and alive)
      if (target && (target.currentHP <= 0 || target.currentHP <= -21)) {
        addLog(`⚠️ ${player.name}'s target is no longer valid, ending turn`, "info");
        processingPlayerAIRef.current = false;
        scheduleEndTurn();
        return;
      }
      
      if (movementTracker.count > 0 && currentDistance >= movementTracker.lastDistance) {
        addLog(`⚠️ ${player.name} movement not improving distance (${Math.round(currentDistance)}ft >= ${Math.round(movementTracker.lastDistance)}ft) - ending turn`, "warning");
        processingPlayerAIRef.current = false;
        scheduleEndTurn();
        return;
      }
      
      movementTracker.count++;
      movementTracker.lastDistance = currentDistance;
      
      // Check for flanking opportunities
      const flankingPositions = findFlankingPositions(targetPos, positions, player.id);
      const currentFlankingBonus = calculateFlankingBonus(currentPos, targetPos, positions, player.id);
      
      // If we can flank, prioritize flanking positions
      if (flankingPositions.length > 0 && currentFlankingBonus === 0) {
        addLog(`🎯 ${player.name} considers flanking ${target.name}`, "info");
        
        // Find the best flanking position (closest to current position)
        const bestFlankPos = flankingPositions.reduce((best, current) => {
          const bestDist = calculateDistance(currentPos, best);
          const currentDist = calculateDistance(currentPos, current);
          return currentDist < bestDist ? current : best;
        });
        
        // Check if we can reach the flanking position
        const flankDistance = calculateDistance(currentPos, bestFlankPos);
        const maxMoveDistance = speed * 5; // 5 feet per hex
        
        if (flankDistance <= maxMoveDistance) {
          addLog(`🎯 ${player.name} attempts to flank ${target.name}`, "info");
          
          // Move to flanking position
          setPositions(prev => {
            const updated = {
            ...prev,
            [player.id]: bestFlankPos
            };
            positionsRef.current = updated;
            return updated;
          });
          
          // Deduct movement action cost
          const movementCost = Math.ceil(flankDistance / (speed * 5));
          setFighters(prev => prev.map(f => 
            f.id === player.id 
              ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - movementCost) }
              : f
          ));
          
          addLog(`🎯 ${player.name} moves to flanking position (${bestFlankPos.x}, ${bestFlankPos.y})`, "info");
          
          // Continue with attack after movement - use updated positions from state
          setTimeout(() => {
            // Re-read positions from state to ensure we have the latest
            setPositions(currentPositions => {
              positionsRef.current = currentPositions;
              const actualFlankPos = currentPositions[player.id] || bestFlankPos;
              const actualTargetPos = currentPositions[target.id] || targetPos;
              const newDistance = calculateDistance(actualFlankPos, actualTargetPos);
              
              // Check range after position update
              setTimeout(() => {
                const rangeValidation = validateWeaponRange(player, target, selectedAttack, newDistance);
                
                if (rangeValidation.canAttack) {
                  const flankingBonus = calculateFlankingBonus(actualFlankPos, actualTargetPos, currentPositions, player.id);
                  if (flankingBonus > 0) {
                    addLog(`🎯 ${player.name} gains flanking bonus (+${flankingBonus} to hit)!`, "info");
                  }
                  
                  // Execute attack with flanking bonus
                  const updatedPlayer = { ...player, selectedAttack: selectedAttack };
                  const bonuses = flankingBonus > 0 ? { flankingBonus } : {};
                  attack(updatedPlayer, target.id, {
                    ...bonuses,
                    attackerPosOverride: actualFlankPos,
                    defenderPosOverride: actualTargetPos,
                    distanceOverride: newDistance
                  });
                  
                  processingPlayerAIRef.current = false;
                  scheduleEndTurn();
                } else {
                  addLog(`❌ ${player.name} cannot reach ${target.name} from flanking position (${rangeValidation.reason})`, "error");
                  // Check if we should continue trying to move closer - use closure variables
                  setTimeout(() => {
                    const updatedPlayerState = fighters.find(f => f.id === player.id);
                    const attemptKey = `${player.id}-${turnCounter}`;
                    const currentTracker = movementAttemptsRef.current[attemptKey];
                    
                    if (updatedPlayerState && updatedPlayerState.remainingAttacks > 0 && 
                        currentTracker && currentTracker.count < 3 && newDistance < currentDistance) {
                      // Distance improved, continue trying to move closer
                      addLog(`🏃 ${player.name} continues moving towards ${target.name} (${Math.round(newDistance)}ft, attempt ${currentTracker.count + 1}/3)...`, "info");
                      // Update movement tracker
                      currentTracker.lastDistance = newDistance;
                      currentTracker.lastPosition = actualFlankPos;
                      currentTracker.count++;
                      // Continue movement logic by triggering another movement attempt
                      if (combatActive && !processingPlayerAIRef.current) {
                        processingPlayerAIRef.current = true;
                        setTimeout(() => {
                          // Recursive call - but we need to pass the context
                          // For now, we'll just schedule end turn and let the next turn handle it
                          processingPlayerAIRef.current = false;
                          scheduleEndTurn();
                        }, 500);
                      } else {
                        processingPlayerAIRef.current = false;
                        scheduleEndTurn();
                      }
                    } else {
                      // Can't continue - end turn
                      addLog(`⏭️ ${player.name} cannot continue moving (attempts: ${currentTracker?.count || 0}/3, distance: ${Math.round(newDistance)}ft) - ending turn`, "info");
                      processingPlayerAIRef.current = false;
                      scheduleEndTurn();
                    }
                  }, 500);
                }
              }, 100);
              
              return currentPositions; // Return unchanged since we already updated it
            });
          }, 1000);
          return;
        }
      }
      
      // Use proper weapon range validation
      const rangeValidation = validateWeaponRange(player, target, selectedAttack, currentDistance);
      const weaponRange = rangeValidation.maxRange || 5.5;
      
      // Calculate how much we need to move to get into range
      const distanceNeeded = currentDistance - weaponRange;
      
      // Calculate movement per action using MOVEMENT_RATES
      const movementRates = MOVEMENT_RATES.calculateMovement(speed);
      const movementPerAction = movementRates.walking / (player.attacksPerMelee || 1);
      const moveDistance = Math.min(distanceNeeded, movementPerAction);
      let hexesToMove = Math.max(1, Math.ceil(moveDistance / GRID_CONFIG.CELL_SIZE));
      const hexDistanceToTarget = Math.ceil(currentDistance / GRID_CONFIG.CELL_SIZE);
      hexesToMove = Math.min(hexesToMove, Math.max(1, hexDistanceToTarget - 1));
    
      if (hexesToMove > 0) {
        const computeBeeDetour = (startHex, goalHex, stepsAllowed = 1, maxRings = 3) => {
          if (!startHex || !goalHex) return null;
          const visited = new Set([`${goalHex.x},${goalHex.y}`]);
          const queue = [{ pos: goalHex, ring: 0 }];
          const candidateHexes = [];

          while (queue.length > 0) {
            const { pos, ring } = queue.shift();
            if (ring >= maxRings) continue;
            const neighbors = getHexNeighbors(pos.x, pos.y) || [];
            neighbors.forEach((neighbor) => {
              const key = `${neighbor.x},${neighbor.y}`;
              if (visited.has(key)) return;
              visited.add(key);
              if (!isValidPosition(neighbor.x, neighbor.y)) return;
              const nextRing = ring + 1;
              queue.push({ pos: neighbor, ring: nextRing });
              candidateHexes.push({ ...neighbor, ring: nextRing });
            });
          }

          if (candidateHexes.length === 0) return null;

          const openCandidates = candidateHexes.filter((hex) => {
            if (hex.x === goalHex.x && hex.y === goalHex.y) return false;
            if (hex.x === startHex.x && hex.y === startHex.y) return false;
            return !isHexOccupied(hex.x, hex.y, player.id);
          });

          if (openCandidates.length === 0) return null;

          openCandidates.sort((a, b) => {
            if (a.ring !== b.ring) return a.ring - b.ring;
            const distA = calculateDistance(startHex, a);
            const distB = calculateDistance(startHex, b);
            return distA - distB;
          });

          for (const candidate of openCandidates) {
            const path = findBeePath(
              { q: startHex.x, r: startHex.y },
              { q: candidate.x, r: candidate.y },
              (hex) => {
                if (!hex) return true;
                if (
                  !Number.isFinite(hex.q) ||
                  !Number.isFinite(hex.r) ||
                  hex.q < 0 ||
                  hex.q >= GRID_CONFIG.GRID_WIDTH ||
                  hex.r < 0 ||
                  hex.r >= GRID_CONFIG.GRID_HEIGHT
                ) {
                  return true;
                }
                if (hex.q === candidate.x && hex.r === candidate.y) {
                  return false;
                }
                return Boolean(isHexOccupied(hex.q, hex.r, player.id));
              }
            );

            if (path && path.length > 1) {
              const stepsToTake = Math.min(Math.max(1, stepsAllowed), path.length - 1);
              const destination = path[stepsToTake];
              if (!destination) continue;
              if (destination.q === startHex.x && destination.r === startHex.y) continue;

              return {
                destination: { x: destination.q, y: destination.r },
                path,
                goal: candidate,
                stepsTaken: stepsToTake,
                goalRing: candidate.ring,
              };
            }
          }

          return null;
        };

        const candidateMoves = [];
        const candidateKeys = new Set();
        const pushCandidateMove = (pos, label, type, meta = {}) => {
          if (!pos) return;
          if (!isValidPosition(pos.x, pos.y)) return;
          const key = `${pos.x},${pos.y}`;
          if (candidateKeys.has(key)) return;
          if (isHexOccupied(pos.x, pos.y, player.id)) return;
          candidateKeys.add(key);
          const distanceAfterMove = calculateDistance(pos, targetPos);
          candidateMoves.push({
            pos,
            label,
            type,
            meta,
            distance: distanceAfterMove,
          });
        };

        const dx = targetPos.x - currentPos.x;
        const dy = targetPos.y - currentPos.y;
        const linearDistance = Math.sqrt(dx * dx + dy * dy);
        
        if (linearDistance > 0) {
          const moveRatio = hexesToMove / linearDistance;
          let directX = Math.round(currentPos.x + dx * moveRatio);
          let directY = Math.round(currentPos.y + dy * moveRatio);
        
          if (directX === currentPos.x && directY === currentPos.y) {
            const dirX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
            const dirY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
            if (dirX !== 0 || dirY !== 0) {
              directX = currentPos.x + dirX;
              directY = currentPos.y + dirY;
            }
          }
          
          if (!isHexOccupied(directX, directY, player.id)) {
            pushCandidateMove(
              { x: directX, y: directY },
              `🤖 ${player.name} moves to position (${directX}, ${directY})`,
              "direct",
              { via: "direct" }
            );
          } else {
            for (let offset = 1; offset <= 2; offset += 1) {
              const testPositions = [
                { x: directX - offset, y: directY },
                { x: directX + offset, y: directY },
                { x: directX, y: directY - offset },
                { x: directX, y: directY + offset },
              ];
              
              testPositions.forEach((testPos) => {
                if (!isValidPosition(testPos.x, testPos.y)) return;
                if (isHexOccupied(testPos.x, testPos.y, player.id)) return;
                pushCandidateMove(
                  testPos,
                  `🤖 ${player.name} sidesteps to (${testPos.x}, ${testPos.y})`,
                  "sidestep",
                  { via: "sidestep" }
                );
              });
            }
          }
        }

        const beeDetour = computeBeeDetour(currentPos, targetPos, hexesToMove, 3);
        if (beeDetour) {
          pushCandidateMove(
            beeDetour.destination,
            `🐝 ${player.name} reroutes via BeeLine to (${beeDetour.destination.x}, ${beeDetour.destination.y})`,
            "bee",
            beeDetour
          );
        }

        if (candidateMoves.length === 0) {
          addLog(`🚫 ${player.name} cannot find path to target - no open hexes`, "warning");
          processingPlayerAIRef.current = false;
          scheduleEndTurn();
          return;
        }

        candidateMoves.sort((a, b) => a.distance - b.distance);
        const previousDistance = movementTracker.lastDistance ?? currentDistance;
        let chosenMove = candidateMoves[0];

        if (chosenMove.distance >= previousDistance) {
          const improvedMove = candidateMoves.find((move) => move.distance < previousDistance);
          if (improvedMove) {
            chosenMove = improvedMove;
          }
        }

        if (
          !chosenMove ||
          (chosenMove.pos.x === currentPos.x && chosenMove.pos.y === currentPos.y)
        ) {
          addLog(`🚫 ${player.name} cannot advance toward ${target.name} - blocked`, "info");
          processingPlayerAIRef.current = false;
          scheduleEndTurn();
          return;
        }

        setPositions((prev) => {
          const updated = {
            ...prev,
            [player.id]: { x: chosenMove.pos.x, y: chosenMove.pos.y },
          };
          positionsRef.current = updated;
          return updated;
        });

        if (chosenMove.type === "bee") {
          const stepsTaken = chosenMove.meta?.stepsTaken ?? 1;
          const goalRing = chosenMove.meta?.goalRing ?? 1;
          addLog(
            `🐝 ${player.name} follows BeeLine path (${stepsTaken} hex${stepsTaken > 1 ? "es" : ""}, ring ${goalRing})`,
            "info"
          );
        } else {
          addLog(chosenMove.label, "info");
        }

        const newDistance = chosenMove.distance;
        const rangeValidation = validateWeaponRange(player, target, selectedAttack, newDistance);
        const improved = newDistance + 0.01 < previousDistance;

        movementTracker.lastDistance = Math.min(previousDistance, newDistance);
        movementTracker.lastPosition = { ...chosenMove.pos };

        setFighters((prev) =>
          prev.map((f) => {
            if (f.id === player.id) {
              return { ...f, remainingAttacks: Math.max(0, (f.remainingAttacks || 0) - 1) };
            }
            return f;
          })
        );
                
        if (!rangeValidation.canAttack) {
          if (!combatActive) {
            addLog(`⚠️ Combat ended, ${player.name} stops moving`, "info");
            processingPlayerAIRef.current = false;
            return;
          }

          const updatedTargetState = fighters.find((f) => f.id === target.id);
          if (!updatedTargetState || updatedTargetState.currentHP <= 0 || updatedTargetState.currentHP <= -21) {
            addLog(`⚠️ ${player.name}'s target is no longer valid, ending turn`, "info");
            processingPlayerAIRef.current = false;
            scheduleEndTurn();
            return;
          }

          addLog(
            `❌ ${player.name} still cannot reach ${target.name} for attack! (${rangeValidation.reason})`,
            "error"
          );

          if (movementTracker.count >= 3 || (!improved && chosenMove.type !== "bee")) {
            addLog(
              `🚫 ${player.name} cannot reach target after ${movementTracker.count} attempt(s) - ending turn`,
              "warning"
            );
            processingPlayerAIRef.current = false;
            scheduleEndTurn();
            return;
          }

          if (player.remainingAttacks > 0 && movementTracker.count < 3 && combatActive) {
            addLog(
              `🏃 ${player.name} is still ${Math.round(newDistance)}ft away, attempting another move...`,
              "info"
            );
            setTimeout(() => {
              setPositions((currentPositions) => {
                positionsRef.current = currentPositions;
                const updatedPlayerState = fighters.find((f) => f.id === player.id);
                if (
                  updatedPlayerState &&
                  updatedPlayerState.remainingAttacks > 0 &&
                  combatActive &&
                  !processingPlayerAIRef.current
                ) {
                  const latestTarget = fighters.find((f) => f.id === target.id);
                  if (!latestTarget || latestTarget.currentHP <= 0 || latestTarget.currentHP <= -21) {
                    addLog(`⚠️ ${player.name}'s target is no longer valid, ending turn`, "info");
                    processingPlayerAIRef.current = false;
                    scheduleEndTurn();
                    return currentPositions;
                  }

                  const latestDistance = calculateDistance(
                    currentPositions[player.id] || chosenMove.pos,
                    targetPos
                  );
                  const latestRangeValidation = validateWeaponRange(
                    player,
                    target,
                    selectedAttack,
                    latestDistance
                  );
                    
                  if (!latestRangeValidation.canAttack && latestDistance < (movementTracker.lastDistance ?? Infinity)) {
                    processingPlayerAIRef.current = true;
                    setTimeout(() => {
                      // Note: We can't recursively call runPlayerTurnAI here because we don't have access to the full context
                      // Instead, we'll just schedule end turn and let the next turn handle it
                      processingPlayerAIRef.current = false;
                      scheduleEndTurn();
                    }, 500);
                  } else {
                    processingPlayerAIRef.current = false;
                    scheduleEndTurn();
                  }
                } else {
                  processingPlayerAIRef.current = false;
                  scheduleEndTurn();
                }
                return currentPositions;
              });
            }, 800);
            return;
          } else {
            addLog(
              `⏭️ ${player.name} cannot reach target (${movementTracker.count} attempts, ${Math.round(
                newDistance
              )}ft remaining) - ending turn`,
              "info"
            );
            processingPlayerAIRef.current = false;
            scheduleEndTurn();
            return;
          }
        } else {
          addLog(`✅ ${player.name} is now in range (${rangeValidation.reason})`, "info");
        }
      }
    } catch (error) {
      console.error('Error in movement logic:', error);
      addLog(`❌ ${player.name} movement failed: ${error.message}`, "error");
      processingPlayerAIRef.current = false;
      scheduleEndTurn();
      return;
    }
  }

  // Execute attack
  addLog(`🤖 ${player.name} ${reasoning} and attacks ${target.name} with ${attackName}!`, "info");
  
  // Create updatedPlayer with selectedAttack
  const updatedPlayer = { ...player, selectedAttack: selectedAttack };
  
  // Execute attack after ensuring position state is updated
  const executeAttack = (flankingBonus = 0) => {
    // Check for area attacks (like charge attacks)
    const isAreaAttack = selectedAttack.name.toLowerCase().includes('charge') || 
                        selectedAttack.name.toLowerCase().includes('gore') ||
                        selectedAttack.name.toLowerCase().includes('ram') ||
                        selectedAttack.name.toLowerCase().includes('rush');
    
    if (isAreaAttack && isTargetBlocked(player.id, target.id, positions)) {
      const targetsInLine = getTargetsInLine(player.id, target.id, positions);
      
      if (targetsInLine.length > 0) {
        addLog(`⚡ ${player.name} uses ${attackName} - area attack hitting ${targetsInLine.length} target(s)!`, "info");
        
        // Execute area attack on all targets in line (one action, multiple targets)
        setTimeout(() => {
          targetsInLine.forEach((lineTarget, index) => {
            setTimeout(() => {
              attack(updatedPlayer, lineTarget.id, { flankingBonus });
            }, index * 500); // Stagger attacks slightly for visual effect
          });
          
          processingPlayerAIRef.current = false;
          scheduleEndTurn();
        }, 1500);
        return;
      }
    }
    
    // Execute attack - only ONE attack per turn
    setTimeout(() => {
      // Get current fighter state to check remaining attacks before executing
      const currentFighterState = fighters.find(f => f.id === player.id);
      
      // Check if fighter has attacks remaining before executing
      if (currentFighterState && currentFighterState.remainingAttacks <= 0) {
        addLog(`⚠️ ${player.name} is out of attacks this turn!`, "warning");
        processingPlayerAIRef.current = false;
        setTimeout(() => endTurn(), 500);
        return;
      }
      
      const currentPositions = positionsRef.current || positions;
      const attackerPos = currentPositions?.[player.id] || null;
      const defenderPos = currentPositions?.[target.id] || null;
      const latestDistance =
        attackerPos && defenderPos
          ? calculateDistance(attackerPos, defenderPos)
          : undefined;
      
      attack(updatedPlayer, target.id, {
        flankingBonus,
        attackerPosOverride: attackerPos,
        defenderPosOverride: defenderPos,
        distanceOverride: latestDistance
      });
        
      // Only one attack per tick. Clear processing flag and advance turn.
      const actionDelay = getActionDelay(arenaSpeed);
      setTimeout(() => {
        processingPlayerAIRef.current = false;
        if (combatActive) {
          endTurn();
        }
      }, actionDelay);
    }, 1500);
  };

  // Use a longer delay to ensure position state is fully updated, then execute attack
  setTimeout(() => {
    executeAttack(0); // No flanking bonus by default
  }, 1000);
}

