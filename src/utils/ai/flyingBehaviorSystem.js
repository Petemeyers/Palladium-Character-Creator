/**
 * Generic Flying Behavior System
 *
 * Provides:
 * - isFlyingCreature: helper to decide if a creature should be treated as a flier
 * - runFlyingTurn: optional per-turn behavior for flying creatures
 *
 * IMPORTANT:
 * This module is intentionally pure JS (no JSX), so Vite's import analysis
 * can parse it without needing a JSX transform.
 */

import { isFlying } from "../abilitySystem";
import {
  spendFlyingStamina,
  shouldLandToRest,
  recoverStamina,
} from "../combatFatigueSystem";
import {
  isScavenger,
  findNearbyCorpse,
  scavengeCorpse,
} from "../scavengingSystem";
import { findFoodItem, consumeItem } from "../consumptionSystem";

/**
 * Determine if a creature should be treated as a flying creature for AI purposes.
 * @param {Object} creature
 * @param {Function} canFlyFn - function that checks if a creature can fly (from abilitySystem)
 * @returns {boolean}
 */
export function isFlyingCreature(creature, canFlyFn) {
  if (!creature) return false;

  // Use the canonical canFly check if provided
  if (typeof canFlyFn === "function" && canFlyFn(creature)) {
    return true;
  }

  // Fallback on tags / metadata, just in case
  const tags = Array.isArray(creature.tags)
    ? creature.tags.map((t) => String(t).toLowerCase())
    : [];

  if (tags.includes("flying") || tags.includes("flyer") || tags.includes("bird")) {
    return true;
  }

  return false;
}

/**
 * Run generic flying behavior for a creature.
 *
 * This should ONLY return true if it actually spends an action
 * (landing, resting, scavenging, etc.). If it returns false, the main
 * enemy AI continues as normal.
 *
 * @param {Object} flier - the flying creature
 * @param {Object} ctx - context from runEnemyTurnAI
 * @returns {boolean} true if this function handled the turn
 */
export function runFlyingTurn(flier, ctx) {
  if (!flier || !ctx) return false;

  const {
    fighters,
    positions,
    canFlyFn,
    setFighters,
    setPositions,
    calculateDistanceFn,
    addLog,
    // performDiveAttack, // currently unused here, but left in ctx for future expansion
  } = ctx;

  const canFly =
    typeof canFlyFn === "function" ? canFlyFn(flier) : false;
  const airborne = isFlying(flier);

  // If this creature isn't a flier and isn't in the air, do nothing.
  if (!canFly && !airborne) return false;

  const hasActions = (flier.remainingAttacks ?? 0) > 0;

  // 1) Landing / resting logic – let fatigue system decide when to land
  if (airborne && shouldLandToRest(flier) && hasActions) {
    // Land in place (keep same x,y, set altitude to 0)
    setFighters((prev) =>
      prev.map((f) =>
        f.id === flier.id
          ? { ...f, altitude: 0, altitudeFeet: 0 }
          : f
      )
    );

    // Recover stamina for a full-rest style action
    recoverStamina(flier, "FULL_REST", 1);

    // Spend one action for landing/resting
    setFighters((prev) =>
      prev.map((f) =>
        f.id === flier.id
          ? {
              ...f,
              remainingAttacks: Math.max(0, (f.remainingAttacks ?? 1) - 1),
            }
          : f
      )
    );

    if (typeof addLog === "function") {
      addLog(
        `🕊️ ${flier.name} lands to rest and recover stamina.`,
        "info"
      );
    }
    return true;
  }

  // 2) Grounded but exhausted – just rest to recover (no movement)
  if (!airborne && shouldLandToRest(flier) && hasActions) {
    recoverStamina(flier, "FULL_REST", 1);

    setFighters((prev) =>
      prev.map((f) =>
        f.id === flier.id
          ? {
              ...f,
              remainingAttacks: Math.max(0, (f.remainingAttacks ?? 1) - 1),
            }
          : f
      )
    );

    if (typeof addLog === "function") {
      addLog(
        `🕊️ ${flier.name} rests and recovers stamina.`,
        "info"
      );
    }
    return true;
  }

  // 3) Simple airborne scavenging behavior for flying scavengers
  if (
    airborne &&
    isScavenger(flier) &&
    hasActions &&
    Array.isArray(fighters) &&
    positions &&
    typeof calculateDistanceFn === "function"
  ) {
    const corpse = findNearbyCorpse(flier, fighters, positions, 8); // ~8 hex radius

    if (corpse && positions[flier.id] && positions[corpse.id]) {
      const myPos = positions[flier.id];
      const corpsePos = positions[corpse.id];
      const dist = calculateDistanceFn(myPos, corpsePos);

      // If adjacent, eat; otherwise glide one hex toward it
      if (dist <= 5.5) {
        scavengeCorpse(flier, corpse, addLog);

        setFighters((prev) =>
          prev.map((f) =>
            f.id === flier.id
              ? {
                  ...f,
                  remainingAttacks: Math.max(
                    0,
                    (f.remainingAttacks ?? 1) - 1
                  ),
                }
              : f
          )
        );

        return true;
      } else {
        const dx = corpsePos.x - myPos.x;
        const dy = corpsePos.y - myPos.y;
        const length = Math.sqrt(dx * dx + dy * dy) || 1;

        const newPos = {
          x: Math.round(myPos.x + dx / length), // move ~1 hex
          y: Math.round(myPos.y + dy / length),
        };

        setPositions((prev) => ({
          ...prev,
          [flier.id]: newPos,
        }));

        // Light stamina drain for circling/gliding
        spendFlyingStamina(flier, "FLY_HOVER", 1);

        setFighters((prev) =>
          prev.map((f) =>
            f.id === flier.id
              ? {
                  ...f,
                  remainingAttacks: Math.max(
                    0,
                    (f.remainingAttacks ?? 1) - 1
                  ),
                }
              : f
          )
        );

        if (typeof addLog === "function") {
          addLog(
            `🕊️ ${flier.name} glides toward a corpse to scavenge.`,
            "info"
          );
        }
        return true;
      }
    }
  }

  // 4) Simple grounded eating behavior – only when not flying
  if (!airborne && hasActions) {
    const foodItem = findFoodItem(flier);
    if (foodItem) {
      consumeItem(flier, foodItem, { log: addLog });

      setFighters((prev) =>
        prev.map((f) =>
          f.id === flier.id
            ? {
                ...f,
                remainingAttacks: Math.max(
                  0,
                  (f.remainingAttacks ?? 1) - 1
                ),
              }
            : f
        )
      );

      return true;
    }
  }

  // 5) Airborne circling/harassment behavior - when flying and no other action needed
  if (airborne && hasActions && Array.isArray(fighters) && positions && typeof calculateDistanceFn === "function") {
    // Find nearest target to circle around
    const targets = fighters.filter(
      (f) => f.id !== flier.id && f.type === "player" && (f.currentHP ?? 0) > 0
    );

    if (targets.length > 0 && positions[flier.id]) {
      // Find closest target
      let closestTarget = null;
      let closestDist = Infinity;
      for (const target of targets) {
        if (!positions[target.id]) continue;
        const dist = calculateDistanceFn(positions[flier.id], positions[target.id]);
        if (dist < closestDist) {
          closestDist = dist;
          closestTarget = target;
        }
      }

      if (closestTarget && positions[closestTarget.id]) {
        const myPos = positions[flier.id];
        const targetPos = positions[closestTarget.id];
        
        // Calculate a circling position - move perpendicular to the line between us and target
        const dx = targetPos.x - myPos.x;
        const dy = targetPos.y - myPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        
        // If too close, move away; if too far, move closer; otherwise circle
        let newPos;
        if (dist < 10) {
          // Too close - move away
          newPos = {
            x: Math.round(myPos.x - (dx / dist) * 2),
            y: Math.round(myPos.y - (dy / dist) * 2),
          };
        } else if (dist > 30) {
          // Too far - move closer
          newPos = {
            x: Math.round(myPos.x + (dx / dist) * 2),
            y: Math.round(myPos.y + (dy / dist) * 2),
          };
        } else {
          // Circle - move perpendicular (rotate 90 degrees)
          newPos = {
            x: Math.round(myPos.x - (dy / dist) * 2),
            y: Math.round(myPos.y + (dx / dist) * 2),
          };
        }

        // Check if new position is off-board (fled/routed)
        const GRID_WIDTH = 40; // Default from GRID_CONFIG
        const GRID_HEIGHT = 30; // Default from GRID_CONFIG
        const isOffBoard = 
          newPos.x < 0 || 
          newPos.y < 0 || 
          newPos.x >= GRID_WIDTH || 
          newPos.y >= GRID_HEIGHT;

        if (isOffBoard) {
          // Character has moved off-board - check if they should leave
          const isBird = (flier.species || flier.name || "").toLowerCase().includes("hawk") ||
                        (flier.species || flier.name || "").toLowerCase().includes("bird") ||
                        (flier.species || flier.name || "").toLowerCase().includes("owl") ||
                        (flier.species || flier.name || "").toLowerCase().includes("eagle");
          
          // For flying hunters (hawks, etc.), only leave if no prey exists on the map
          if (isBird && ctx && ctx.fighters) {
            // Check if there are any prey animals on the map
            const allFighters = ctx.fighters || [];
            const hasPrey = allFighters.some((f) => {
              if (!f || f.id === flier.id) return false;
              const name = (f.name || "").toLowerCase();
              const size = (f.sizeCategory || f.size || "").toLowerCase();
              const isSmallBody = ["tiny", "small"].includes(size);
              const preyKeywords = ["mouse", "rat", "rabbit", "squirrel", "songbird"];
              const isNamedPrey = preyKeywords.some((k) => name.includes(k));
              return isSmallBody || isNamedPrey;
            });

            // If prey exists, don't leave - prevent moving off-board
            if (hasPrey) {
              // Keep them on the board by clamping position
              const clampedPos = {
                x: Math.max(0, Math.min(newPos.x, GRID_WIDTH - 1)),
                y: Math.max(0, Math.min(newPos.y, GRID_HEIGHT - 1)),
              };
              setPositions((prev) => ({
                ...prev,
                [flier.id]: clampedPos,
              }));
              return true;
            }
          }
          
          if (typeof addLog === "function") {
            if (isBird) {
              addLog(`🦅 ${flier.name} flies away from the battle.`, "info");
            } else {
              addLog(`🏃 ${flier.name} has fled the battlefield!`, "warning");
            }
          }

          // Remove from fighters array
          setFighters((prev) => prev.filter((f) => f.id !== flier.id));
          
          // Remove from positions
          setPositions((prev) => {
            const updated = { ...prev };
            delete updated[flier.id];
            return updated;
          });

          return true;
        }

        setPositions((prev) => ({
          ...prev,
          [flier.id]: newPos,
        }));

        // Light stamina drain for circling
        spendFlyingStamina(flier, "FLY_HOVER", 1);

        setFighters((prev) =>
          prev.map((f) =>
            f.id === flier.id
              ? {
                  ...f,
                  remainingAttacks: Math.max(0, (f.remainingAttacks ?? 1) - 1),
                }
              : f
          )
        );

        if (typeof addLog === "function") {
          addLog(
            `🦅 ${flier.name} circles overhead, maintaining altitude.`,
            "info"
          );
        }

        return true;
      }
    }
  }

  // If we get here, we didn't consume an action; main AI should proceed.
  return false;
}

/**
 * Move a flying creature through the air to a target hex.
 * This is a helper function used by CombatPage.jsx for player-controlled flight.
 * @param {Object} flier - The flying creature
 * @param {Object} targetHex - Target hex coordinates
 * @param {Object} context - Context with gameState, log, moveCreatureOnMap
 * @param {Object} options - Optional movement options
 * @returns {boolean} true if movement was successful
 */
export function moveFlyingCreature(flier, targetHex, context, options = {}) {
  const { gameState, log, moveCreatureOnMap } = context;
  if (!flier || !targetHex || !moveCreatureOnMap) return false;

  const positions = gameState?.positions || context.positions || {};
  const from = positions[flier.id];
  if (!from) return false;

  flier.isFlying = true;
  if (flier.altitudeFeet == null) {
    // Default altitude: 100ft for hawks/birds, 20ft for others
  const defaultAltitude = (flier.name?.toLowerCase().includes("hawk") || 
                           flier.species?.toLowerCase().includes("hawk") ||
                           flier.tags?.some(t => t.toLowerCase().includes("bird"))) ? 100 : 20;
  flier.altitudeFeet = options.altitudeFeet ?? defaultAltitude;
  }

  const movementType = options.movementType || "FLY";
  moveCreatureOnMap(flier, targetHex, {
    movementType,
    mode: "FLY",
    altitudeFeet: flier.altitudeFeet,
  });

  const distFt = options.distanceFt ?? 0;
  if (typeof log === "function") {
    log(
      `🪽 ${flier.name} moves ${Math.round(distFt)}ft through the air (${movementType}) to (${targetHex.x || targetHex.q}, ${targetHex.y || targetHex.r}).`
    );
  }
  return true;
}

/**
 * Perform a dive attack for a flying creature.
 * This is a helper function used by CombatPage.jsx for player-controlled dive attacks.
 * @param {Object} flier - The flying creature
 * @param {Object} target - The target to attack
 * @param {Object} context - Context with gameState, log, moveCreatureOnMap, performMeleeAttack
 * @returns {boolean} true if dive attack was initiated
 */
export function performDiveAttack(flier, target, context) {
  const { gameState, log, moveCreatureOnMap, performMeleeAttack } = context;
  if (!flier || !target || !performMeleeAttack) return false;

  const positions = gameState?.positions || context.positions || {};
  const from = positions[flier.id];
  const to = positions[target.id];
  if (!from || !to) return false;

  flier.isFlying = true;
  const targetAltitude = target.altitudeFeet ?? 0;
  const attackAltitude = targetAltitude + 5;
  // Default altitude: 100ft for hawks/birds, 20ft for others
  const defaultAltitude = (flier.name?.toLowerCase().includes("hawk") || 
                           flier.species?.toLowerCase().includes("hawk") ||
                           flier.tags?.some(t => t.toLowerCase().includes("bird"))) ? 100 : 20;
  const previousAltitude = flier.altitudeFeet ?? defaultAltitude;
  const newAltitude = Math.min(previousAltitude, attackAltitude);
  flier.altitudeFeet = newAltitude;

  if (context.setFighters) {
    context.setFighters((prev) =>
      prev.map((f) =>
        f.id === flier.id
          ? { ...f, altitude: newAltitude, altitudeFeet: newAltitude, isFlying: true }
          : f
      )
    );
  }

  if (typeof log === "function") {
    log(
      `🦅 ${flier.name} dives from ${previousAltitude || 0}ft to ${newAltitude}ft to attack ${target.name}.`
    );
  }

  // Calculate distance if we have a distance function
  const calculateDistanceFn = context.calculateDistanceFn || context.calculateDistance;
  const distFt = calculateDistanceFn ? calculateDistanceFn(from, to) : 0;
  const isAdjacentOrSame = distFt <= 5.5 || (from.x === to.x && from.y === to.y);

  if (!isAdjacentOrSame && moveCreatureOnMap) {
    moveFlyingCreature(flier, to, { gameState, log, moveCreatureOnMap, positions }, {
      movementType: "FLY_SPRINT",
      altitudeFeet: newAltitude,
      distanceFt: distFt,
    });
  }

  performMeleeAttack(flier, target, {
    attackType: "Strike",
    source: "DIVE_ATTACK",
    attackBonus: flier.diveBonusToStrike ?? 2,
  });
  return true;
}
