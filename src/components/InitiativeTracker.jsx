import React, { useState, useEffect } from "react";
import {
  Box,
  Heading,
  Button,
  Table,
  Tbody,
  Tr,
  Td,
  Th,
  Input,
  Select,
  HStack,
  Text,
  Badge,
  Alert,
  AlertIcon,
  VStack,
  Collapse,
  useDisclosure,
} from "@chakra-ui/react";
import { useParty } from "../context/PartyContext";
import { rollDice, rollLoot, savingThrow, attackRoll, moraleCheck } from "./util";
import getSocket from "../utils/socket";
import axiosInstance from "../utils/axios";
import { getEncumbranceInfo, getEncumbrancePenalty, getArmorPenalty } from "../utils/encumbrance";
import { parseEffect } from "../data/consumables";
import CombatActionsPanel from "./CombatActionsPanel";
import { aiManager, AI_PERSONALITIES } from "../utils/enemyAI";
import { enhancedAIManager } from "../utils/openaiAdapter";
import MissileWeaponTracker from "./MissileWeaponTracker";
import WeaponSlots from "./WeaponSlots";
import MovementPanel from "./MovementPanel";
import { initializeAmmo, useAmmo, setAmmo, replenishAllAmmo, canFireMissileWeapon, getAmmoInfo } from "../utils/combatAmmoManager";
import { getMissileWeapon, getRangeInfo } from "../data/missileWeapons";
import { initializeWeaponSlots, equipWeapon, toggleTwoHandedGrip, getWeaponDamage, isTwoHandedWeapon } from "../utils/weaponSlotManager";
import { initializePositions, updatePosition, getAutoTargetDistance, getAllDistances, getDistanceBetween } from "../utils/positionManager";
import TacticalMap from "./TacticalMap";
import { getEngagementRange, MOVEMENT_RATES, GRID_CONFIG } from "../data/movementRules";

const socket = getSocket(); // Use centralized socket manager

const InitiativeTracker = () => {
  const { activeParty } = useParty();
  const [order, setOrder] = useState([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);
  const [enemies, setEnemies] = useState([]);
  const [newEnemyName, setNewEnemyName] = useState("");
  const [hp, setHp] = useState({}); // store HP per id
  const [status, setStatus] = useState({}); // store condition per id
  const [showCombatChoices, setShowCombatChoices] = useState(false);
  const { isOpen: isCombatChoicesOpen, onToggle: toggleCombatChoices, onOpen: openCombatChoices, onClose: closeCombatChoices } = useDisclosure({ defaultIsOpen: false });
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiDifficulty, setAiDifficulty] = useState("normal");
  const [aiPersonalities, setAiPersonalities] = useState({});
  const [useLLM, setUseLLM] = useState(false);
  const [openaiKey, setOpenaiKey] = useState("");
  const [ammoCount, setAmmoCount] = useState({}); // Missile weapon ammunition tracking
  const [targetDistance, setTargetDistance] = useState(null); // Distance to target in feet
  const [weaponSlots, setWeaponSlots] = useState({}); // Weapon slots for each character
  const [positions, setPositions] = useState({}); // Combatant positions on tactical map
  const [showTacticalMap, setShowTacticalMap] = useState(false); // Toggle tactical map display
  const [sprintingEnemies, setSprintingEnemies] = useState(new Set()); // Enemies that are sprinting
  const [movementMode, setMovementMode] = useState(false); // Whether movement mode is active

  // Auto-open combat choices when it's a player character's turn
  useEffect(() => {
    if (order.length > 0) {
      const currentChar = order[turnIndex];
      if (currentChar && !currentChar.isEnemy) {
        setShowCombatChoices(true);
        if (!isCombatChoicesOpen) {
          openCombatChoices();
        }
        
        // Auto-calculate distance to closest enemy
        if (Object.keys(positions).length > 0) {
          const allChars = [...activeParty.members, ...enemies];
          const autoDistance = getAutoTargetDistance(positions, currentChar.char._id, allChars);
          if (autoDistance) {
            setTargetDistance(autoDistance);
          }
        }
      } else {
        setShowCombatChoices(false);
        if (isCombatChoicesOpen) {
          closeCombatChoices();
        }
        
        // Clear sprinting status when enemy's turn starts
        if (currentChar && currentChar.isEnemy) {
          setSprintingEnemies(prev => {
            const newSet = new Set(prev);
            newSet.delete(currentChar.char._id);
            return newSet;
          });
        }
        
        // Handle AI decision making for enemy turns
        if (currentChar && currentChar.isEnemy && aiEnabled) {
          handleEnemyAITurn(currentChar);
        }
      }
      
      // Turn off movement mode when turn changes
      setMovementMode(false);
    }
  }, [turnIndex, order, isCombatChoicesOpen, openCombatChoices, closeCombatChoices, aiEnabled, positions]);


  // Handle AI decision making for enemy turns
  const handleEnemyAITurn = async (enemy) => {
    try {
      // Get available targets (player characters)
      const targets = order
        .filter(entry => !entry.isEnemy && entry.char.currentHP > 0)
        .map(entry => entry.char);
      
      if (targets.length === 0) {
        logCombatEvent(`${enemy.name} has no targets and defends`);
        setTimeout(nextTurn, 1000); // Auto-advance after 1 second
        return;
      }

      // Check if enemy needs to move closer to attack
      let needsToMoveCloser = false;
      let closestTarget = null;
      let closestDistance = Infinity;

      if (positions && positions[enemy._id]) {
        // Find closest target and check if in range
        targets.forEach(target => {
          if (positions[target._id]) {
            const distance = getDistanceBetween(positions, enemy._id, target._id);
            if (distance < closestDistance) {
              closestDistance = distance;
              closestTarget = target;
            }
          }
        });

        // Check if enemy has melee weapons and is out of range
        const weapon = enemy.equippedWeapon || enemy.weapon || "Unarmed";
        const isMeleeWeapon = !weapon.toLowerCase().includes('bow') && 
                             !weapon.toLowerCase().includes('crossbow') &&
                             !weapon.toLowerCase().includes('sling') &&
                             !weapon.toLowerCase().includes('gun') &&
                             !weapon.toLowerCase().includes('thrown');

        if (isMeleeWeapon && closestDistance > 5) {
          needsToMoveCloser = true;
          logCombatEvent(`📍 ${enemy.name} is ${Math.round(closestDistance)}ft from ${closestTarget.name} (melee range: ≤5ft)`);
        }
      }

      // If enemy needs to move closer, do that first
      if (needsToMoveCloser && closestTarget && positions[enemy._id] && positions[closestTarget._id]) {
        const currentPos = positions[enemy._id];
        const targetPos = positions[closestTarget._id];
        const speed = enemy.Spd || enemy.spd || enemy.attributes?.Spd || enemy.attributes?.spd || 10;
        const movement = MOVEMENT_RATES.calculateMovement(speed);
        
        // Calculate direction to target
        const dx = targetPos.x - currentPos.x;
        const dy = targetPos.y - currentPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Move towards target
        // FIX: Use fullSpeed (official Palladium) instead of deprecated running
        const moveDistance = Math.min((movement.fullSpeed || movement.running || speed * 60) / GRID_CONFIG.CELL_SIZE, distance - 1); // Stop 1 cell away (5ft)
        const ratio = moveDistance / distance;
        
        const newX = Math.round(currentPos.x + dx * ratio);
        const newY = Math.round(currentPos.y + dy * ratio);
        
        // Update position
        handlePositionChange(enemy._id, { x: newX, y: newY });
        
        const newDistance = getDistanceBetween(
          { ...positions, [enemy._id]: { x: newX, y: newY } },
          enemy._id,
          closestTarget._id
        );
        
        logCombatEvent(`🏃 ${enemy.name} moves closer to ${closestTarget.name} (${Math.round(closestDistance)}ft → ${Math.round(newDistance)}ft)`);
        
        socket.emit("partyMessage", {
          partyId: activeParty._id,
          user: "System",
          text: `🏃 ${enemy.name} moves from (${currentPos.x},${currentPos.y}) to (${newX},${newY}) - closing distance to ${closestTarget.name}`,
          type: "system",
        });

        // Mark enemy as sprinting so they flash until their next turn
        setSprintingEnemies(prev => {
          const newSet = new Set(prev);
          newSet.add(enemy._id);
          return newSet;
        });

        // If now in range, continue with attack, otherwise end turn
        if (newDistance <= 5) {
          logCombatEvent(`✅ ${enemy.name} is now in melee range!`);
          // Continue to attack below
        } else {
          logCombatEvent(`⏭️ ${enemy.name} used movement action, ending turn`);
          setTimeout(nextTurn, 2000);
          return;
        }
      }

      // Get AI personality for this enemy
      const personality = aiPersonalities[enemy._id] || AI_PERSONALITIES.TACTICAL;
      
      // Create combat state for AI decision
      const combatState = {
        round: roundNumber,
        turn: turnIndex,
        enemies: order.filter(e => e.isEnemy).map(e => e.char),
        players: order.filter(e => !e.isEnemy).map(e => e.char),
        difficulty: aiDifficulty
      };

      // Get AI decision (using enhanced manager)
      const decision = await enhancedAIManager.makeDecision(
        enemy._id, 
        enemy, 
        targets, 
        combatState, 
        personality, 
        aiDifficulty
      );

      if (!decision) {
        logCombatEvent(`❌ AI failed to make decision for ${enemy.name}`);
        setTimeout(nextTurn, 1000);
        return;
      }

      // Log the AI decision
      logCombatEvent(`🤖 ${enemy.name} (${personality.name}) chooses: ${decision.action.name} - ${decision.reasoning}`);

      // Execute the action using enhanced manager
      const result = enhancedAIManager.executeAction(enemy._id, decision, enemy, combatState);
      
      if (result.success) {
        // Mark enemy as sprinting/flashing if they chose a sprint action
        if (result.action === "sprint" || result.action === "sprint_retreat") {
          setSprintingEnemies(prev => {
            const newSet = new Set(prev);
            newSet.add(enemy._id);
            return newSet;
          });
          logCombatEvent(`💫 ${enemy.name} icon will flash until their next turn`);
        }
        
        // Validate attack range before applying damage
        if (result.action === "strike" && result.target && result.damage) {
          const targetId = result.target._id;
          
          // Check if this is a melee attack and validate range
          const weapon = result.weapon || enemy.equippedWeapon || "Unarmed";
          const isMeleeWeapon = !weapon.toLowerCase().includes('bow') && 
                               !weapon.toLowerCase().includes('crossbow') &&
                               !weapon.toLowerCase().includes('sling') &&
                               !weapon.toLowerCase().includes('gun') &&
                               !weapon.toLowerCase().includes('thrown');
          
          // Get distance to target if positions are available
          let attackAllowed = true;
          if (isMeleeWeapon && positions && positions[enemy._id] && positions[targetId]) {
            const distance = getDistanceBetween(positions, enemy._id, targetId);
            const engagementRange = getEngagementRange(distance);
            
            if (!engagementRange.canMeleeAttack) {
              attackAllowed = false;
              logCombatEvent(`❌ ${enemy.name} cannot reach ${result.target.name} for melee attack! (Distance: ${Math.round(distance)}ft, needs ≤5ft)`);
              logCombatEvent(`💡 ${enemy.name} must move closer first`);
              
              // Log to party chat
              socket.emit("partyMessage", {
                partyId: activeParty._id,
                user: "System",
                text: `❌ ${enemy.name} attempted melee attack from ${Math.round(distance)}ft away but is out of range (max 5ft for melee)`,
                type: "system",
              });
            } else {
              logCombatEvent(`✅ ${enemy.name} is in melee range of ${result.target.name} (${Math.round(distance)}ft)`);
            }
          }
          
          if (attackAllowed) {
            logCombatEvent(result.message);
            
            const currentHp = hp[targetId] || result.target.currentHP || result.target.HP || 20;
            const newHp = Math.max(0, currentHp - result.damage);
            
            setHp(prev => ({ ...prev, [targetId]: newHp }));
            
            if (newHp <= 0) {
              logCombatEvent(`💀 ${result.target.name} has been defeated!`);
              setStatus(prev => ({ ...prev, [targetId]: "KO" }));
            }
          }
        } else {
          logCombatEvent(result.message);
        }
        
        // Handle other action results
        if (result.action === "maneuver" && result.maneuver) {
          logCombatEvent(`⚔️ ${enemy.name} attempts to ${result.maneuver} ${result.target.name}`);
          // You could add maneuver resolution logic here
        }
      }

      // Auto-advance to next turn after AI action
      setTimeout(nextTurn, 2000); // 2 second delay to see the action
      
    } catch (error) {
      console.error("AI decision error:", error);
      logCombatEvent(`❌ AI error for ${enemy.name}, skipping turn`);
      setTimeout(nextTurn, 1000);
    }
  };

  // Loot handling
  const handleLoot = async (table = "common") => {
    const loot = rollLoot(table);

    try {
      await axiosInstance.post(`/loot/${activeParty._id}/add`, { loot });
    } catch (err) {
      console.error("Failed to save loot:", err);
    }

    socket.emit("partyMessage", {
      partyId: activeParty._id,
      user: "System",
      text: `🎁 Loot Found: ${loot.name} ${loot.quantity ? `x${loot.quantity}` : ""} (added to Party Inventory)`,
      type: "system",
    });
  };

  // Listen for enemies from random encounters
  useEffect(() => {
    socket.on("addEnemies", ({ partyId, enemies }) => {
      if (activeParty?._id === partyId) {
        setEnemies((prev) => [
          ...prev,
          ...enemies.map((e, idx) => ({
            name: e.name,
            hp: e.hp,
            weapon: e.weapon,
            _id: `enemy-${Date.now()}-${idx}`,
          })),
        ]);
      }
    });
    return () => socket.off("addEnemies");
  }, [activeParty]);

  if (!activeParty) {
    return (
      <Box className="container" p={4}>
        <Heading size="md" mb={4}>Combat Tracker</Heading>
        <Text>Load a party first to access combat tools.</Text>
      </Box>
    );
  }

  // Helper function to log combat events
  const logCombatEvent = async (text) => {
    if (!activeParty?._id) return;
    try {
      await axiosInstance.post(`/combat-log/${activeParty._id}`, { event: text });
    } catch (err) {
      console.error("Failed to log combat event:", err);
    }
  };

  // Add enemy to list
  const addEnemy = () => {
    if (!newEnemyName.trim()) return;
    const id = `enemy-${Date.now()}`;
    const enemy = { name: newEnemyName.trim(), _id: id };
    setEnemies((prev) => [...prev, enemy]);
    setHp((prev) => ({ ...prev, [id]: 20 })); // default HP 20
    setNewEnemyName("");
    
    // Log enemy addition
    logCombatEvent(`🆕 Added enemy: ${enemy.name} (HP: 20)`);
  };

  // Roll initiative for party + enemies
  const rollInitiative = () => {
    const rolls = [
      ...activeParty.members.map((char) => {
        const baseRoll = rollDice(20, 1);
        const dexModifier = char.attributes?.PP ? Math.floor((char.attributes.PP - 10) / 2) : 0;
        
        // Calculate encumbrance penalty
        const encumbranceInfo = getEncumbranceInfo(char);
        const encumbrancePenalty = encumbranceInfo.penalty.initiative;
        
        // Post encumbrance penalty notice to PartyChat
        if (encumbrancePenalty < 0 && activeParty?._id) {
          socket.emit("partyMessage", {
            partyId: activeParty._id,
            user: "System",
            text: `⚠️ ${char.name} suffers encumbrance penalty: ${encumbrancePenalty} to initiative, ${encumbranceInfo.penalty.skill} to skills (Carrying ${encumbranceInfo.currentWeight}/${encumbranceInfo.maxWeight})`,
            type: "system",
          });
        }
        
        const totalInitiative = baseRoll + dexModifier + encumbrancePenalty;
        return { 
          char, 
          initiative: totalInitiative,
          dexModifier,
          encumbrancePenalty,
          rawRoll: baseRoll,
          isEnemy: false
        };
      }),
      ...enemies.map((char) => {
        const roll = rollDice(20, 1);
        const totalInitiative = roll; // Enemies don't get modifiers for now
        return { 
          char, 
          initiative: totalInitiative,
          dexModifier: 0,
          encumbrancePenalty: 0,
          rawRoll: roll,
          isEnemy: true
        };
      }),
    ];

    const sorted = rolls.sort((a, b) => b.initiative - a.initiative);
    setOrder(sorted);
    setTurnIndex(0);
    setRoundNumber(1);

    // Initialize ammunition for all combatants
    const allCharacters = [...activeParty.members, ...enemies];
    const initialAmmo = initializeAmmo(allCharacters);
    setAmmoCount(initialAmmo);

    // Initialize weapon slots for all combatants (start unequipped)
    const initialSlots = {};
    allCharacters.forEach(char => {
      initialSlots[char._id] = initializeWeaponSlots(char);
      // Characters start unequipped - they can equip weapons during combat
    });
    setWeaponSlots(initialSlots);

    // Initialize positions for tactical combat
    const initialPositions = initializePositions(activeParty.members, enemies);
    setPositions(initialPositions);
    
    // Clear sprinting status and movement mode when new combat starts
    setSprintingEnemies(new Set());
    setMovementMode(false);

    // Combat choices will be handled by useEffect

    if (activeParty._id) {
      const initiativeText = sorted
        .map((r) => {
          const modifiers = [];
          if (r.dexModifier !== 0) modifiers.push(`DEX+${r.dexModifier}`);
          if (r.encumbrancePenalty !== 0) modifiers.push(`ENC${r.encumbrancePenalty}`);
          const modText = modifiers.length > 0 ? ` (${r.rawRoll}+${modifiers.join('+')})` : '';
          return `${r.char.name}${r.isEnemy ? " (Enemy)" : ""} (${r.initiative}${modText})`;
        })
        .join(", ");
      
      const logText = `🎲 **Round 1 - Initiative Rolled!** Order: ${initiativeText}`;
      
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "System",
        text: logText,
        type: "system",
      });
      
      logCombatEvent(logText);
      logCombatEvent("🏹 Missile weapon ammunition initialized");
    }
  };

  // Advance to next turn
  const nextTurn = () => {
    const newIndex = (turnIndex + 1) % order.length;
    setTurnIndex(newIndex);
    
    // If we've completed a full round, increment round number
    if (newIndex === 0) {
      const newRound = roundNumber + 1;
      setRoundNumber(newRound);
      
      if (activeParty._id) {
        const logText = `🔄 Round ${newRound} begins!`;
        
        socket.emit("partyMessage", {
          partyId: activeParty._id,
          user: "System",
          text: logText,
          type: "system",
        });
        
        logCombatEvent(logText);
      }
    }
  };

  // Attack roll with O.C.C. bonuses, criticals, and fumbles
  const handleAttack = (char) => {
    // Get weapon from weapon slots (prioritize right hand)
    const charSlots = weaponSlots[char._id] || initializeWeaponSlots(char);
    const weapon = charSlots.rightHand || { damage: "1d4", name: "Unarmed" };
    const usingTwoHanded = charSlots.usingTwoHanded;
    
    // Check if using missile weapon and has ammunition
    const missileWeapon = getMissileWeapon(weapon.name);
    if (missileWeapon) {
      const canFire = canFireMissileWeapon(char, ammoCount);
      if (!canFire.canFire) {
        const logText = `❌ ${char.name} cannot fire ${missileWeapon.name}: ${canFire.reason}`;
        socket.emit("partyMessage", {
          partyId: activeParty._id,
          user: "System",
          text: logText,
          type: "system",
        });
        logCombatEvent(logText);
        return;
      }
      
      // Consume ammunition
      const newAmmoCount = useAmmo(ammoCount, char._id, missileWeapon.ammunition, 1);
      setAmmoCount(newAmmoCount);
      
      const remaining = newAmmoCount[char._id]?.[missileWeapon.ammunition] || 0;
      logCombatEvent(`🏹 ${char.name} fires ${missileWeapon.name} (${remaining} ${missileWeapon.ammunition} remaining)`);
    }
    
    // Use new attackRoll system for criticals/fumbles
    const attackResult = attackRoll(char, null, weapon);
    
    let bonus = 0;
    let bonusText = "";

    // Apply O.C.C. attack bonuses
    char.abilities?.forEach((ability) => {
      if (ability.type === "combat" && ability.bonusType === "attack") {
        // Check weapon-specific bonuses
        if (ability.weapon) {
          const equippedWeapon = char.inventory?.find(item => 
            item.name === char.equippedWeapon && item.type === "Weapon"
          );
          if (equippedWeapon && equippedWeapon.name.toLowerCase().includes(ability.weapon.toLowerCase())) {
            bonus += ability.value;
            bonusText += ` +${ability.value} (${ability.name})`;
          }
        } else {
          // General attack bonuses
          bonus += ability.value;
          bonusText += ` +${ability.value} (${ability.name})`;
        }
      }
    });

    // Apply range modifier for missile weapons
    let rangeModifier = 0;
    let rangeText = "";
    if (missileWeapon && targetDistance) {
      const rangeInfo = getRangeInfo(targetDistance, missileWeapon);
      if (rangeInfo.modifier !== null) {
        rangeModifier = rangeInfo.modifier;
        rangeText = ` ${rangeInfo.description}`;
        bonus += rangeModifier;
      } else {
        const logText = `❌ ${char.name} cannot hit target: ${rangeInfo.description}`;
        socket.emit("partyMessage", {
          partyId: activeParty._id,
          user: "System",
          text: logText,
          type: "system",
        });
        logCombatEvent(logText);
        return;
      }
    }

    const total = attackResult.roll + bonus;
    const hitThreshold = 12; // Example: 12+ to hit
    const hit = total >= hitThreshold;
    
    let emoji = missileWeapon ? "🏹" : "⚔️";
    let resultText = "HIT!";
    
    if (attackResult.result === "critical") {
      emoji = "💥";
      resultText = attackResult.message;
    } else if (attackResult.result === "fumble") {
      emoji = "💀";
      resultText = attackResult.message;
    } else if (!hit) {
      emoji = "💨";
      resultText = "MISS!";
    }
    
    const weaponDisplayName = weapon.name || "unarmed";
    const twoHandedIndicator = usingTwoHanded ? ' (2H)' : (isTwoHandedWeapon(weapon) ? ' (Two-Handed)' : '');
    const logText = `${emoji} ${char.name} attacks with ${weaponDisplayName}${twoHandedIndicator}${rangeText}! Roll = ${attackResult.roll}${bonusText} → Total ${total} - ${resultText} (Needs ${hitThreshold}+)`;
    
    if (activeParty._id) {
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "System",
        text: logText,
        type: "system",
      });
      
      logCombatEvent(logText);
    }

    // Trigger morale check for enemies if critical hit
    if (attackResult.result === "critical") {
      // Find a random enemy to check morale
      const enemies = order.filter(entry => entry.isEnemy);
      if (enemies.length > 0) {
        const randomEnemy = enemies[Math.floor(Math.random() * enemies.length)];
        const moraleResult = moraleCheck(randomEnemy.char);
        
        socket.emit("partyMessage", {
          partyId: activeParty._id,
          user: "System",
          text: `🎲 ${randomEnemy.char.name} morale check → ${moraleResult.roll} vs ${moraleResult.target} (${moraleResult.message})`,
          type: "system",
        });

        // If morale fails, remove enemy from combat
        if (!moraleResult.success) {
          setOrder(prevOrder => prevOrder.filter(entry => entry.char._id !== randomEnemy.char._id));
        }
      }
    }
  };

  // Defense roll with armor bonus and penalties
  const handleDefense = (char, type = "Parry") => {
    const baseRoll = rollDice(20, 1);
    
    // Get armor defense bonus
    const armor = char.inventory?.find(item => item.name === char.equippedArmor && item.type === "armor");
    const armorBonus = armor?.defense || 0;
    
    // Get armor penalties
    const armorPenalty = getArmorPenalty(char);
    const encumbranceInfo = getEncumbranceInfo(char);
    
    // Apply penalties to defense roll
    const totalPenalty = armorPenalty.skillPenalty + encumbranceInfo.penalty.skill;
    const totalRoll = baseRoll + armorBonus + totalPenalty;
    const successThreshold = 10; // Example: 10+ for successful defense
    const success = totalRoll >= successThreshold;
    const emoji = success ? "🛡️" : "💥";
    const resultText = success ? "SUCCESS!" : "FAILED!";
    
    const penaltyText = totalPenalty !== 0 ? ` + penalties (${totalPenalty})` : "";
    const logText = `${emoji} ${char.name} attempts to ${type}! Roll = ${baseRoll} + armor (${armorBonus})${penaltyText} = ${totalRoll} - ${resultText} (Needs ${successThreshold}+)`;
    
    if (activeParty._id) {
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "System",
        text: logText,
        type: "system",
      });
      
      logCombatEvent(logText);
    }
  };

  // Magic spell casting with saving throws
  const handleMagic = (caster, spell, target = null) => {
    if (caster.PPE < spell.cost) {
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "System",
        text: `❌ ${caster.name} does not have enough PPE to cast ${spell.name}`,
        type: "system",
      });
      return;
    }

    caster.PPE -= spell.cost;

    // Saving throw for target if applicable
    if (target) {
      const save = savingThrow(target, "magic");
      if (save.success) {
        socket.emit("partyMessage", {
          partyId: activeParty._id,
          user: "System",
          text: `✨ ${caster.name} casts ${spell.name} on ${target.name}, but ${target.name} RESISTS! (Roll ${save.roll} vs ${save.target})`,
          type: "system",
        });
        return;
      }
    }

    let msg = `✨ ${caster.name} casts ${spell.name}`;
    if (spell.damage) {
      const [num, sides] = spell.damage.split("d").map(Number);
      let total = 0;
      for (let i = 0; i < num; i++) total += rollDice(sides, 1);

      // Reduce target HP if present
      if (target) {
        setHp((prev) => {
          const newHp = Math.max((prev[target._id] ?? 20) - total, 0);
          return { ...prev, [target._id]: newHp };
        });
      }

      msg += ` → ${total} damage (${spell.damage})`;
    } else if (spell.effect) {
      msg += ` → ${spell.effect}`;
    }

    socket.emit("partyMessage", {
      partyId: activeParty._id,
      user: "System",
      text: msg,
      type: "system",
    });
  };

  // Psionic power use with saving throws
  const handlePsionic = (user, power, target = null) => {
    if (user.ISP < power.cost) {
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "System",
        text: `❌ ${user.name} does not have enough ISP to use ${power.name}`,
        type: "system",
      });
      return;
    }

    user.ISP -= power.cost;

    // Saving throw for target if applicable
    if (target) {
      const save = savingThrow(target, "psionics");
      if (save.success) {
        socket.emit("partyMessage", {
          partyId: activeParty._id,
          user: "System",
          text: `🧠 ${user.name} uses ${power.name} on ${target.name}, but ${target.name} RESISTS! (Roll ${save.roll} vs ${save.target})`,
          type: "system",
        });
        return;
      }
    }

    let msg = `🧠 ${user.name} uses ${power.name}`;
    if (power.damage) {
      const [num, sides] = power.damage.split("d").map(Number);
      let total = 0;
      for (let i = 0; i < num; i++) total += rollDice(sides, 1);

      // Reduce target HP if present
      if (target) {
        setHp((prev) => {
          const newHp = Math.max((prev[target._id] ?? 20) - total, 0);
          return { ...prev, [target._id]: newHp };
        });
      }

      msg += ` → ${total} damage (${power.damage})`;
    } else if (power.effect) {
      msg += ` → ${power.effect}`;
    }

    socket.emit("partyMessage", {
      partyId: activeParty._id,
      user: "System",
      text: msg,
      type: "system",
    });
  };

  // Damage roll with O.C.C. bonuses and spell damage
  const handleDamage = (char, dice = null) => {
    let weaponName = "fists";
    let damageDice = "1d4"; // default unarmed damage
    let isSpellDamage = false;
    let spellUsed = null;
    
    // Get weapon from weapon slots
    const charSlots = weaponSlots[char._id] || initializeWeaponSlots(char);
    const weapon = charSlots.rightHand;
    const usingTwoHanded = charSlots.usingTwoHanded;
    
    if (weapon) {
      weaponName = weapon.name;
      // Use getWeaponDamage to get proper damage with two-handed bonus
      damageDice = getWeaponDamage(weapon, usingTwoHanded);
    } else if (dice) {
      // Use manual dice if provided (for enemies or override)
      damageDice = dice;
    }

    // Check for spell damage from O.C.C. abilities
    char.abilities?.forEach((ability, idx) => {
      if (ability.type === "magic" && ability.damage) {
        // Check if spell has uses remaining
        if (ability.usesRemaining !== null && ability.usesRemaining <= 0) {
          return; // Skip this spell, no uses left
        }
        
        damageDice = ability.damage;
        weaponName = ability.name;
        isSpellDamage = true;
        spellUsed = idx;
      }
    });

    const [num, sides] = damageDice.split("d").map(Number);
    let total = 0;
    const rolls = [];
    for (let i = 0; i < num; i++) {
      const roll = rollDice(sides, 1);
      total += roll;
      rolls.push(roll);
    }

    // Apply O.C.C. damage bonuses
    let bonus = 0;
    let bonusText = "";
    char.abilities?.forEach((ability) => {
      if (ability.type === "combat" && ability.bonusType === "damage") {
        // For now, apply all damage bonuses (could add condition checking later)
        bonus += ability.value;
        bonusText += ` +${ability.value} (${ability.name})`;
      }
    });

    total += bonus;

    // Decrement spell use if cast
    if (spellUsed !== null && char.abilities[spellUsed]) {
      const ability = char.abilities[spellUsed];
      if (ability.usesRemaining !== null) {
        ability.usesRemaining = Math.max(0, ability.usesRemaining - 1);
        bonusText += ` (${ability.usesRemaining}/${ability.uses} uses left)`;
      }
    }

    // Reduce HP
    setHp((prev) => {
      const current = prev[char._id] ?? 20;
      const newHp = Math.max(current - total, 0);
      return { ...prev, [char._id]: newHp };
    });

    const damageSource = isSpellDamage ? `via ${weaponName}` : `with ${weaponName}`;
    const twoHandedText = usingTwoHanded && weapon ? ' (Two-Handed)' : '';
    const logText = `💥 ${char.name} deals ${total} damage ${damageSource}${twoHandedText}${bonusText} (${damageDice} = ${rolls.join("+")}${bonus > 0 ? ` + ${bonus}` : ""}). HP now ${Math.max((hp[char._id] ?? 20) - total, 0)}`;
    
    if (activeParty._id) {
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "System",
        text: logText,
        type: "system",
      });
      
      logCombatEvent(logText);
    }
  };

  // Handle consumable usage
  const handleConsumable = (char, consumable) => {
    if (!consumable || !consumable.effect) return;

    const effect = parseEffect(consumable.effect);
    let message = "";

    if (effect.type === "healing") {
      // Parse healing dice (e.g., "2d4+2")
      const diceStr = effect.dice;
      const parts = diceStr.split("+");
      const dice = parts[0];
      const bonus = parts[1] ? parseInt(parts[1]) : 0;
      
      const [num, sides] = dice.split("d").map(Number);
      let heal = bonus;
      const rolls = [];
      
      for (let i = 0; i < num; i++) {
        const roll = rollDice(sides, 1);
        heal += roll;
        rolls.push(roll);
      }

      setHp((prev) => {
        const current = prev[char._id] ?? 20;
        const newHp = Math.min(current + heal, 100); // Cap at 100 HP
        return { ...prev, [char._id]: newHp };
      });

      message = `🧪 ${char.name} uses ${consumable.name} → heals ${heal} HP (${diceStr} = ${rolls.join("+")}${bonus > 0 ? `+${bonus}` : ""})`;
    } else if (effect.type === "buff") {
      message = `💪 ${char.name} uses ${consumable.name} → ${effect.buff}`;
    } else if (effect.type === "damage") {
      message = `💥 ${char.name} uses ${consumable.name} → ${effect.damage} damage`;
    } else {
      message = `✨ ${char.name} uses ${consumable.name} → ${consumable.effect}`;
    }

    if (activeParty._id) {
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "System",
        text: message,
        type: "system",
      });
      
      logCombatEvent(message);
    }
  };

  // Handle HP changes
  const handleHpChange = (id, newVal) => {
    const newHp = parseInt(newVal) || 0;
    setHp((prev) => ({ ...prev, [id]: newHp }));
    
    // Find character name for logging
    const allCombatants = [...activeParty.members, ...enemies];
    const combatant = allCombatants.find(c => c._id === id);
    if (combatant && activeParty._id) {
      logCombatEvent(`❤️ ${combatant.name} HP set to ${newHp}`);
    }
  };

  // Handle status changes
  const handleStatusChange = (id, newStatus) => {
    setStatus((prev) => ({ ...prev, [id]: newStatus }));
    
    // Find character name for logging
    const allCombatants = [...activeParty.members, ...enemies];
    const combatant = allCombatants.find(c => c._id === id);
    if (combatant && activeParty._id) {
      logCombatEvent(`📋 ${combatant.name} status changed to: ${newStatus}`);
    }
  };

  // Handle ammunition changes
  const handleAmmoChange = (characterId, ammoType, newCount) => {
    const newAmmoCount = setAmmo(ammoCount, characterId, ammoType, newCount);
    setAmmoCount(newAmmoCount);
    
    // Find character name for logging
    const allCombatants = [...activeParty.members, ...enemies];
    const combatant = allCombatants.find(c => c._id === characterId);
    if (combatant && activeParty._id) {
      logCombatEvent(`🏹 ${combatant.name} ${ammoType}: ${newCount}`);
    }
  };

  // Handle weapon equipment
  const handleEquipWeapon = (characterId, weaponName, slot) => {
    const character = [...activeParty.members, ...enemies].find(c => c._id === characterId);
    if (!character) return;

    const weapon = character.inventory?.find(item => item.name === weaponName);
    const currentSlots = weaponSlots[characterId] || initializeWeaponSlots(character);
    
    let newSlots;
    if (weapon) {
      newSlots = equipWeapon(currentSlots, weapon, slot);
    } else {
      // Empty slot
      newSlots = { ...currentSlots, [slot]: null };
    }

    setWeaponSlots(prev => ({ ...prev, [characterId]: newSlots }));
    
    if (activeParty._id) {
      logCombatEvent(`⚔️ ${character.name} equipped ${weaponName || 'nothing'} in ${slot === 'rightHand' ? 'right hand' : 'left hand'}`);
    }
  };

  // Toggle two-handed grip
  const handleToggleTwoHanded = (characterId) => {
    const currentSlots = weaponSlots[characterId];
    if (!currentSlots) return;

    const newSlots = toggleTwoHandedGrip(currentSlots);
    setWeaponSlots(prev => ({ ...prev, [characterId]: newSlots }));

    const character = [...activeParty.members, ...enemies].find(c => c._id === characterId);
    if (character && activeParty._id) {
      const action = newSlots.usingTwoHanded ? 'now using two-handed grip' : 'released two-handed grip';
      logCombatEvent(`⚔️ ${character.name} ${action}`);
    }
  };

  // Handle position change
  const handlePositionChange = (characterId, newPosition) => {
    const newPositions = updatePosition(positions, characterId, newPosition);
    setPositions(newPositions);
    
    const character = [...activeParty.members, ...enemies].find(c => c._id === characterId);
    if (character && activeParty._id) {
      logCombatEvent(`🏃 ${character.name} moved to (${newPosition.x}, ${newPosition.y})`);
    }
  };

  // Handle move execution from tactical map
  const handleMoveExecution = (targetHex) => {
    if (currentCharacter && targetHex) {
      handlePositionChange(currentCharacter._id, targetHex);
      
      // Broadcast to party chat
      if (activeParty._id) {
        socket.emit("partyMessage", {
          partyId: activeParty._id,
          user: "System",
          text: `🏃 ${currentCharacter.name} moved to (${targetHex.x}, ${targetHex.y})`,
          type: "system",
        });
      }
      
      // Turn off movement mode after successful move
      setMovementMode(false);
    }
  };

  // End combat and replenish ammunition
  const endCombat = () => {
    setOrder([]);
    setRoundNumber(1);
    setTurnIndex(0);
    
    // Replenish all ammunition
    const allCharacters = [...activeParty.members, ...enemies];
    const replenishedAmmo = replenishAllAmmo(allCharacters);
    setAmmoCount(replenishedAmmo);
    
    // Clear positions, sprinting status, and movement mode
    setPositions({});
    setTargetDistance(null);
    setSprintingEnemies(new Set());
    setMovementMode(false);
    
    logCombatEvent("🏁 Combat ended - All ammunition replenished");
    
    if (activeParty._id) {
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "System",
        text: "🏁 Combat ended - All ammunition replenished",
        type: "system",
      });
    }
  };

  const currentCharacter = order[turnIndex]?.char;

  return (
    <Box className="container" p={4}>
      <Heading mb={4}>Combat Tracker</Heading>
      
      {activeParty && (
        <Alert status="info" mb={4}>
          <AlertIcon />
          Active Party: <strong>{activeParty.name}</strong> - {activeParty.members.length} members
        </Alert>
      )}

      <VStack spacing={4} align="stretch">
        {/* Add Enemy Section */}
        <Box>
          <Heading size="sm" mb={2}>Add Enemy</Heading>
          <HStack>
            <Input
              placeholder="Enemy name (e.g., Orc, Goblin, Bandit)"
              value={newEnemyName}
              onChange={(e) => setNewEnemyName(e.target.value)}
              width="250px"
              onKeyPress={(e) => e.key === 'Enter' && addEnemy()}
            />
            <Button onClick={addEnemy} colorScheme="red" size="sm">
              Add Enemy
            </Button>
          </HStack>
        </Box>

        {/* Initiative Controls */}
        <Box>
          <HStack spacing={4} mb={4}>
            <Button 
              colorScheme="blue" 
              onClick={rollInitiative}
              isDisabled={activeParty.members.length === 0 && enemies.length === 0}
            >
              🎲 Roll Initiative
            </Button>
            {order.length > 0 && (
              <Button onClick={nextTurn} colorScheme="green">
                Next Turn →
              </Button>
            )}
            {order.length > 0 && (
              <Button 
                onClick={endCombat} 
                colorScheme="red" 
                variant="outline"
              >
                End Combat
              </Button>
            )}
          </HStack>
        </Box>

        {/* AI Controls */}
        <Box>
          <Heading size="sm" mb={2}>🤖 AI Enemy Control</Heading>
          <VStack spacing={3} align="stretch" mb={4}>
            <HStack spacing={4}>
              <Button
                colorScheme={aiEnabled ? "green" : "gray"}
                variant={aiEnabled ? "solid" : "outline"}
                onClick={() => setAiEnabled(!aiEnabled)}
                size="sm"
              >
                {aiEnabled ? "✅ AI Enabled" : "❌ AI Disabled"}
              </Button>
              <Select
                value={aiDifficulty}
                onChange={(e) => setAiDifficulty(e.target.value)}
                width="120px"
                size="sm"
                isDisabled={!aiEnabled}
              >
                <option value="easy">Easy</option>
                <option value="normal">Normal</option>
                <option value="hard">Hard</option>
                <option value="nightmare">Nightmare</option>
              </Select>
              <Text fontSize="sm" color="gray.600">
                Difficulty: {aiDifficulty}
              </Text>
            </HStack>
            
            {/* LLM Controls */}
            <HStack spacing={4}>
              <Button
                colorScheme={useLLM ? "blue" : "gray"}
                variant={useLLM ? "solid" : "outline"}
                onClick={() => {
                  if (useLLM) {
                    setUseLLM(false);
                    enhancedAIManager.disableLLM();
                  } else if (openaiKey) {
                    setUseLLM(true);
                    enhancedAIManager.initializeOpenAI(openaiKey);
                  }
                }}
                size="sm"
                isDisabled={!openaiKey}
              >
                {useLLM ? "🧠 LLM Enabled" : "🤖 Deterministic AI"}
              </Button>
              <Input
                placeholder="OpenAI API Key (optional)"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                width="200px"
                size="sm"
                type="password"
              />
              <Text fontSize="xs" color="gray.500">
                {useLLM ? "Using OpenAI for decisions" : "Using deterministic AI"}
              </Text>
            </HStack>
          </VStack>
        </Box>

        {/* Tactical Map Toggle */}
        {order.length > 0 && (
          <Box>
            <HStack spacing={4} mb={2} wrap="wrap">
              <Button
                size="sm"
                colorScheme={showTacticalMap ? "green" : "gray"}
                variant={showTacticalMap ? "solid" : "outline"}
                onClick={() => setShowTacticalMap(!showTacticalMap)}
              >
                {showTacticalMap ? "✅ Hide Tactical Map" : "🗺️ Show Tactical Map"}
              </Button>
              
              {/* Movement Mode Button - only show for current character's turn */}
              {showTacticalMap && currentCharacter && !order[turnIndex]?.isEnemy && (
                <Button
                  size="sm"
                  colorScheme={movementMode ? "blue" : "cyan"}
                  variant={movementMode ? "solid" : "outline"}
                  onClick={() => setMovementMode(!movementMode)}
                >
                  {movementMode ? "✓ Movement Mode Active" : "🏃 Choose Movement"}
                </Button>
              )}
              
              <Text fontSize="sm" color="gray.600">
                View and manage character positions on the battlefield
              </Text>
            </HStack>
          </Box>
        )}

        {/* Tactical Map Display */}
        {order.length > 0 && showTacticalMap && (
          <TacticalMap
            combatants={[...activeParty.members.map(m => ({...m, isEnemy: false})), ...enemies.map(e => ({...e, isEnemy: true}))]}
            positions={positions}
            onPositionChange={handlePositionChange}
            currentTurn={currentCharacter?._id}
            highlightMovement={true}
            flashingCombatants={sprintingEnemies}
            movementMode={movementMode}
            onMoveSelect={handleMoveExecution}
          />
        )}

        {/* Range Input for Missile Weapons */}
        {order.length > 0 && (
          <Box>
            <Heading size="sm" mb={2}>🎯 Target Distance</Heading>
            <HStack spacing={4}>
              <Input
                type="number"
                placeholder="Distance in feet"
                value={targetDistance || ""}
                onChange={(e) => setTargetDistance(e.target.value ? parseInt(e.target.value) : null)}
                width="150px"
                size="sm"
              />
              <Text fontSize="sm" color="gray.600">
                {Object.keys(positions).length > 0 
                  ? "Auto-calculated to closest enemy (or set manually)" 
                  : "Set distance to target for missile weapon range modifiers"}
              </Text>
              {targetDistance && (
                <>
                  <Badge colorScheme="blue">
                    {targetDistance} ft
                  </Badge>
                  <Button
                    size="xs"
                    colorScheme="gray"
                    variant="ghost"
                    onClick={() => setTargetDistance(null)}
                  >
                    Clear
                  </Button>
                </>
              )}
            </HStack>
          </Box>
        )}

        {/* Current Round/Turn Display */}
        {order.length > 0 && (
          <Alert status="success">
            <AlertIcon />
            <Box>
              <Text fontWeight="bold">
                Round {roundNumber} - Turn {(turnIndex % order.length) + 1} of {order.length}
              </Text>
              <Text fontSize="lg">
                Current Turn: <strong>{currentCharacter?.name}</strong>
                {order[turnIndex]?.isEnemy ? " (Enemy)" : " (Player Character)"}
              </Text>
              {currentCharacter && !order[turnIndex]?.isEnemy && (
                <Text fontSize="sm" color="blue.600" fontWeight="bold">
                  🎯 Combat choices available below
                </Text>
              )}
              {/* Show Combat Choices Button for Player Characters */}
              {currentCharacter && !order[turnIndex]?.isEnemy && (
                <HStack spacing={2} mt={2}>
                  <Button
                    size="sm"
                    colorScheme="blue"
                    variant="outline"
                    onClick={toggleCombatChoices}
                  >
                    {isCombatChoicesOpen ? "Hide" : "Show"} Combat Choices
                  </Button>
                </HStack>
              )}
            </Box>
          </Alert>
        )}

        {/* Combat Choices Panel */}
        {order.length > 0 && currentCharacter && !order[turnIndex]?.isEnemy && showCombatChoices && (
          <Collapse in={isCombatChoicesOpen} animateOpacity>
            <Box 
              mt={4} 
              p={4} 
              borderWidth="2px" 
              borderColor="blue.200"
              borderRadius="md" 
              bg="blue.50" 
              _dark={{ bg: "blue.900", borderColor: "blue.600" }}
              boxShadow="sm"
            >
              <Heading size="sm" mb={3} color="blue.600" _dark={{ color: "blue.300" }}>
                🎯 Combat Options for {currentCharacter.name}
              </Heading>
              <CombatActionsPanel 
                character={currentCharacter}
                onActionSelect={(action, character) => {
                  console.log("Selected action:", action.name, "for character:", character.name);
                  // Here you could add logic to handle the selected action
                  // For example, trigger the appropriate combat action
                }}
              />
            </Box>
          </Collapse>
        )}

        {/* Weapon Slots, Movement, and Missile Tracker for Current Character */}
        {order.length > 0 && currentCharacter && !order[turnIndex]?.isEnemy && (
          <VStack spacing={3}>
            <WeaponSlots
              character={currentCharacter}
              weaponSlots={weaponSlots[currentCharacter._id] || initializeWeaponSlots(currentCharacter)}
              onEquipWeapon={(weaponName, slot) => handleEquipWeapon(currentCharacter._id, weaponName, slot)}
              onToggleTwoHanded={() => handleToggleTwoHanded(currentCharacter._id)}
              compact={false}
            />
            
            {Object.keys(positions).length > 0 && (
              <MovementPanel
                character={currentCharacter}
                positions={positions}
                allCombatants={[...activeParty.members.map(m => ({...m, isEnemy: false})), ...enemies.map(e => ({...e, isEnemy: true}))]}
                onMove={handlePositionChange}
              />
            )}
            
            <MissileWeaponTracker
              character={currentCharacter}
              ammoCount={ammoCount}
              onAmmoChange={handleAmmoChange}
              targetDistance={targetDistance}
              isCompact={false}
            />
          </VStack>
        )}

        {/* Initiative Order Table */}
        {order.length > 0 && (
          <Box>
            <Heading size="md" mb={3}>Initiative Order</Heading>
            <Table size="sm">
              <thead>
                <Tr>
                  <Th>Order</Th>
                  <Th>Character</Th>
                  <Th>Initiative</Th>
                  <Th>Weapon</Th>
                  {Object.keys(positions).length > 0 && <Th>Distance</Th>}
                  <Th>HP</Th>
                  <Th>Status</Th>
                  <Th>AI Personality</Th>
                  <Th>Actions</Th>
                </Tr>
              </thead>
              <Tbody>
                {order.map((entry, idx) => (
                  <Tr
                    key={`${entry.char._id}-${idx}`}
                    style={{
                      background: idx === turnIndex ? "#e6fffa" : "inherit",
                      border: idx === turnIndex ? "2px solid #38b2ac" : "1px solid #e2e8f0",
                    }}
                  >
                    <Td>
                      <Badge 
                        colorScheme={idx === turnIndex ? "teal" : "gray"}
                        size="lg"
                      >
                        {idx + 1}
                      </Badge>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="bold">
                          {entry.char.name} {entry.isEnemy && <Badge colorScheme="red" size="sm">Enemy</Badge>}
                        </Text>
                        <Text fontSize="sm" color="gray.600">
                          {entry.char.species} {entry.char.class}
                        </Text>
                        {/* PPE and ISP display */}
                        {!entry.isEnemy && (
                          <HStack spacing={2} fontSize="xs">
                            {entry.char.PPE !== undefined && (
                              <Text color="purple.600">PPE: {entry.char.PPE}</Text>
                            )}
                            {entry.char.ISP !== undefined && (
                              <Text color="blue.600">ISP: {entry.char.ISP}</Text>
                            )}
                          </HStack>
                        )}
                      </VStack>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="bold">{entry.initiative}</Text>
                        {entry.dexModifier !== 0 && (
                          <Text fontSize="xs" color="gray.500">
                            ({entry.rawRoll}+{entry.dexModifier})
                          </Text>
                        )}
                      </VStack>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={1}>
                        {entry.isEnemy ? (
                          <Text fontSize="sm" color="gray.600">Manual</Text>
                        ) : (
                          <>
                            {/* Compact weapon slots display */}
                            <WeaponSlots
                              character={entry.char}
                              weaponSlots={weaponSlots[entry.char._id] || initializeWeaponSlots(entry.char)}
                              compact={true}
                            />
                            
                            {/* Compact ammo display */}
                            <MissileWeaponTracker
                              character={entry.char}
                              ammoCount={ammoCount}
                              onAmmoChange={handleAmmoChange}
                              isCompact={true}
                            />
                          </>
                        )}
                      </VStack>
                    </Td>
                    
                    {/* Distance to closest enemy */}
                    {Object.keys(positions).length > 0 && (
                      <Td>
                        {(() => {
                          const allChars = [...activeParty.members.map(m => ({...m, isEnemy: false})), ...enemies.map(e => ({...e, isEnemy: true}))];
                          const distances = getAllDistances(positions, entry.char._id, allChars);
                          const closest = distances.find(d => d.character.isEnemy !== entry.isEnemy);
                          
                          if (!closest) {
                            return <Text fontSize="xs" color="gray.500">—</Text>;
                          }
                          
                          return (
                            <VStack align="start" spacing={0}>
                              <Badge 
                                colorScheme={
                                  closest.range.canMeleeAttack ? 'red' :
                                  closest.range.canCharge ? 'orange' : 'blue'
                                }
                                fontSize="xs"
                              >
                                {closest.distance} ft
                              </Badge>
                              <Text fontSize="xs" color="gray.500">
                                to {closest.character.name.substring(0, 8)}
                              </Text>
                            </VStack>
                          );
                        })()}
                      </Td>
                    )}
                    
                    <Td>
                      <Input
                        type="number"
                        width="80px"
                        size="sm"
                        value={hp[entry.char._id] ?? 20}
                        onChange={(e) => handleHpChange(entry.char._id, e.target.value)}
                      />
                    </Td>
                    <Td>
                      <Select
                        width="120px"
                        size="sm"
                        value={status[entry.char._id] || "OK"}
                        onChange={(e) => handleStatusChange(entry.char._id, e.target.value)}
                      >
                        <option value="OK">OK</option>
                        <option value="Wounded">Wounded</option>
                        <option value="KO">KO</option>
                        <option value="Dead">Dead</option>
                      </Select>
                    </Td>
                    <Td>
                      {entry.isEnemy ? (
                        <Select
                          size="xs"
                          width="100px"
                          value={aiPersonalities[entry.char._id]?.name || "Tactical"}
                          onChange={(e) => {
                            const personality = Object.values(AI_PERSONALITIES).find(p => p.name === e.target.value);
                            if (personality) {
                              setAiPersonalities(prev => ({
                                ...prev,
                                [entry.char._id]: personality
                              }));
                              aiManager.setPersonality(entry.char._id, personality);
                            }
                          }}
                        >
                          {Object.values(AI_PERSONALITIES).map(personality => (
                            <option key={personality.name} value={personality.name}>
                              {personality.name}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Text fontSize="xs" color="gray.500">Player</Text>
                      )}
                    </Td>
                    <Td>
                      <HStack spacing={1} wrap="wrap">
                        <Button
                          size="xs"
                          colorScheme="red"
                          onClick={() => handleAttack(entry.char)}
                        >
                          ⚔️ Attack
                        </Button>
                        <Button
                          size="xs"
                          colorScheme="blue"
                          onClick={() => handleDefense(entry.char, "Parry")}
                        >
                          🛡️ Parry
                        </Button>
                        
                        {/* Magic Spells */}
                        {entry.char.magic?.length > 0 && (
                          <Select
                            size="xs"
                            placeholder="Cast Spell"
                            width="120px"
                            onChange={(e) => {
                              const spell = entry.char.magic.find((s) => s.name === e.target.value);
                              if (spell) {
                                // For now, target the first enemy or character
                                const target = order.find((o) => o.char._id !== entry.char._id)?.char;
                                handleMagic(entry.char, spell, target);
                              }
                            }}
                          >
                            {entry.char.magic.map((s, idx) => (
                              <option key={idx} value={s.name}>
                                {s.name} ({s.cost} PPE)
                              </option>
                            ))}
                          </Select>
                        )}
                        
                        {/* Psionic Powers */}
                        {entry.char.psionics?.length > 0 && (
                          <Select
                            size="xs"
                            placeholder="Use Psionic"
                            width="120px"
                            onChange={(e) => {
                              const power = entry.char.psionics.find((p) => p.name === e.target.value);
                              if (power) {
                                // For now, target the first enemy or character
                                const target = order.find((o) => o.char._id !== entry.char._id)?.char;
                                handlePsionic(entry.char, power, target);
                              }
                            }}
                          >
                            {entry.char.psionics.map((p, idx) => (
                              <option key={idx} value={p.name}>
                                {p.name} ({p.cost} ISP)
                              </option>
                            ))}
                          </Select>
                        )}
                        <Button
                          size="xs"
                          colorScheme="teal"
                          onClick={() => handleDefense(entry.char, "Dodge")}
                        >
                          💨 Dodge
                        </Button>
                        <Button
                          size="xs"
                          colorScheme="orange"
                          onClick={() => handleDamage(entry.char)}
                          title={entry.isEnemy ? "Manual damage" : "Use equipped weapon"}
                        >
                          💥 {entry.isEnemy ? "Damage" : "Weapon"}
                        </Button>
                        {entry.isEnemy && (
                          <>
                            <Button
                              size="xs"
                              colorScheme="purple"
                              onClick={() => handleDamage(entry.char, "2d6")}
                            >
                              💥 2d6
                            </Button>
                            <Button
                              size="xs"
                              colorScheme="yellow"
                              onClick={() => handleDamage(entry.char, "1d8")}
                            >
                              💥 1d8
                            </Button>
                          </>
                        )}
                      </HStack>
                      
                      {/* Consumables for party members */}
                      {!entry.isEnemy && entry.char.inventory && (
                        <Select
                          placeholder="Use Consumable"
                          size="xs"
                          width="150px"
                          mt={1}
                          onChange={(e) => {
                            const consumable = entry.char.inventory.find(item => 
                              item.name === e.target.value && item.type === "consumable"
                            );
                            if (consumable) {
                              handleConsumable(entry.char, consumable);
                            }
                          }}
                        >
                          {entry.char.inventory
                            .filter(item => item.type === "consumable")
                            .map((consumable, idx) => (
                              <option key={idx} value={consumable.name}>
                                {consumable.name} ({consumable.effect})
                              </option>
                            ))}
                        </Select>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}

        {/* Loot Generation */}
        <Box>
          <Heading size="sm" mb={2}>Loot Generation</Heading>
          <HStack spacing={2} mb={2}>
            <Button size="sm" colorScheme="green" onClick={() => handleLoot("common")}>
              Roll Common Loot
            </Button>
            <Button size="sm" colorScheme="purple" onClick={() => handleLoot("rare")}>
              Roll Rare Loot
            </Button>
            <Button size="sm" colorScheme="red" onClick={() => handleLoot("boss")}>
              Roll Boss Loot
            </Button>
          </HStack>
          <Text fontSize="xs" color="gray.600">
            Loot is automatically added to Party Inventory. Check the Party Inventory tab to distribute.
          </Text>
        </Box>

        {/* Combat Reference */}
        <Box>
          <Heading size="sm" mb={2}>Combat Quick Reference</Heading>
          <VStack align="stretch" spacing={1}>
            <Text fontSize="sm">
              <strong>Attack Roll:</strong> d20, 12+ to hit (basic)
            </Text>
            <Text fontSize="sm">
              <strong>Defense:</strong> Parry (with weapon/shield) or Dodge (-1 action)
            </Text>
            <Text fontSize="sm">
              <strong>Initiative:</strong> d20 + DEX modifier
            </Text>
            <Text fontSize="sm">
              <strong>Damage:</strong> Weapon dice + STR modifier
            </Text>
            <Text fontSize="sm">
              <strong>Status:</strong> OK → Wounded → KO → Dead
            </Text>
          </VStack>
        </Box>
      </VStack>
    </Box>
  );
};

export default InitiativeTracker;