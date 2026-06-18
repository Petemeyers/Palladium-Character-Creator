// src/engine/resolveMove.cjs
// Keep this PURE. No DOM, no React, no window.

const { resolveAttack } = require("./resolveAttack.cjs");
const { aStar } = require("./pathfinding.cjs");
const { getModePolicy, pathTerrainCost } = require("./movementModes.cjs");
const { getAltitude, isFlying, isHexOccupiedByOther, isNoFlyHex, setAltitudeEvent } = require("./flightEngine.cjs");
const { flightMoveCost } = require("./utils/moveCostFlight.cjs");
const { hexDistanceAxial } = require("./utils/hexDistance.cjs");

/**
 * Resolve MOVE command inside engine worker
 * @param {Object} payload
 * @param {string} payload.eid - entity / fighter id
 * @param {{x:number,y:number}} payload.to
 * @param {string} payload.mode - Movement mode (MOVE, RUN, WITHDRAW, CHARGE)
 * @param {string} payload.targetId - Optional target ID for CHARGE
 * @param {Object} payload.state - current engine state snapshot
 * @param {Object} payload.meta - optional flags (baseStepMs, etc)
 * @param {Object} payload.engine - engine instance (gridState, timeScale)
 */
module.exports = async function resolveMove(payload) {
  const { eid, to, mode, targetId, state, meta, engine, ruleset } = payload;

  const events = [];

  // Helper function for errors
  function fail(message) {
    return { ok: false, error: { message } };
  }

  /**
   * Clamp a number between min and max
   */
  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  /**
   * Get fighter speed (with fallbacks)
   */
  function getSpeed(fighter) {
    return (
      fighter.Spd ||
      fighter.spd ||
      fighter.attributes?.Spd ||
      fighter.attributes?.spd ||
      10
    );
  }

  const fighter = state.fighters.find(f => f.id === eid);
  if (!fighter) return fail("Fighter not found");

  const oldPos = state.positions[eid];
  if (!oldPos) return fail("No starting position");

  // ---- FLIGHT ALTITUDE HANDLING ----
  const fromAlt = getAltitude(state, eid);
  
  // Decide altitude target
  const toAlt = Number.isFinite(payload.toAltitude)
    ? payload.toAltitude
    : Number.isFinite(payload.deltaAltitude)
      ? (fromAlt + payload.deltaAltitude)
      : fromAlt;

  // Clamp altitude
  const maxAlt = ruleset?.maxAltitude ? ruleset.maxAltitude(fighter) : (fighter?.maxAltitude ?? 6);
  const clampedToAlt = Math.max(0, Math.min(maxAlt, toAlt));

  // Flight mode if altitude > 0 OR target altitude > 0
  const flyingNow = fromAlt > 0;
  const flyingAfter = clampedToAlt > 0;
  const flightMode = flyingNow || flyingAfter;

  // ---- LOCK CHECKS: Block if already acting or moving ----
  // Note: engine is already destructured from payload on line 23
  
  if (engine?.hasLock?.(eid, "acting")) {
    return fail("LOCKED_ACTING");
  }
  if (engine.hasLock?.(eid, "moving")) {
    return fail("LOCKED_MOVING");
  }

  // ---- Action availability ----
  if (fighter.remainingActions <= 0) {
    return fail("No actions remaining");
  }

  // ---- GRID LEGALITY (ENGINE AUTHORITY) ----
  const gridState = engine?.gridState;
  const timeScale = engine?.timeScale ?? 1.0;
  
  if (!gridState) {
    return fail("Grid state not available");
  }

  // Check if destination is blocked (mover-aware)
  // For flying units, only check if landing (altitude going to 0)
  if (flightMode && clampedToAlt === 0) {
    // Landing: check if destination is blocked
    if (gridState.isBlocked(to.x, to.y, fighter)) {
      return fail("Cannot land in impassable hex");
    }
  } else if (!flightMode) {
    // Ground movement: check if destination is blocked
    if (gridState.isBlocked(to.x, to.y, fighter)) {
      return fail("Destination hex is blocked for this mover");
    }
  }

  // ---- FLIGHT VALIDATION ----
  // Validate end hex occupancy (flying units can pass over but not end on occupied hex)
  if (isHexOccupiedByOther(state, to, eid)) {
    return fail("Destination occupied");
  }

  // Landing validation: cannot land in impassable or occupied hex
  if (fromAlt > 0 && clampedToAlt === 0) {
    if (gridState.isBlocked(to.x, to.y, fighter)) {
      return fail("Cannot land in impassable hex");
    }
    if (isHexOccupiedByOther(state, to, eid)) {
      return fail("Cannot land in occupied hex");
    }
  }

  // Check destination for no-fly zones (early validation)
  if (flightMode && isNoFlyHex(state, to)) {
    return fail("Destination is a no-fly zone");
  }

  // ---- MOVEMENT MODE POLICY ----
  const policy = getModePolicy(mode, fighter);

  // ---- PATdreadRatingINDING (ENGINE AUTHORITY) ----
  // Use A* to find path, respecting blocked tiles, occupancy, and terrain costs
  // Max cost = mode policy budget (RUN/CHARGE get 2x, others get 1x)
  const maxCost = policy.budget;

  // Check if goal is occupied and whether we can enter it
  const goalOccupantId = gridState.getOccupant(to.x, to.y);
  let canEnterGoal = true;
  let goalOccupant = null;
  
  if (goalOccupantId && goalOccupantId !== eid) {
    goalOccupant = state.fighters.find(f => f.id === goalOccupantId);
    if (goalOccupant) {
      const fighterSide = fighter.side || fighter.type || (fighter.isEnemy ? "enemy" : "player");
      const occupantSide = goalOccupant.side || goalOccupant.type || (goalOccupant.isEnemy ? "enemy" : "player");
      // Allow entering if enemy (close-to-melee), block if ally
      canEnterGoal = fighterSide !== occupantSide;
    } else {
      canEnterGoal = false; // Invalid occupant
    }
  }

  const path = aStar({
    start: oldPos,
    goal: to,
    gridState,
    moverId: eid,
    mover: fighter, // Ã¢Å“â€¦ pass full mover for capability-aware pathfinding
    maxCost,
    terrainCost: (pos) => gridState.terrainMoveCost(pos.x, pos.y, fighter),
    canEnterOccupied: (pos, occupantId) => {
      // Flying units can pass over occupied hexes (but not end on them)
      if (flightMode && (pos.x !== to.x || pos.y !== to.y)) {
        return true; // Allow passing over
      }
      // Only allow entering occupied hex if it's the goal and it's an enemy (ground movement)
      const isGoal = pos.x === to.x && pos.y === to.y;
      return isGoal && canEnterGoal;
    },
  });

  if (!path || path.length < 2) {
    return fail(`No valid path to (${to.x}, ${to.y})`);
  }

  // ---- NO-FLY ZONE VALIDATION (check full path) ----
  if (flightMode) {
    for (const h of path) {
      if (isNoFlyHex(state, h)) {
        return fail("Path crosses no-fly zone");
      }
    }
  }

  // ---- MOVEMENT COST CALCULATION ----
  let pathCost;
  let actionCost;

  if (flightMode) {
    // Flight movement cost
    const steps = Math.max(0, path.length - 1);
    pathCost = flightMoveCost({
      steps,
      fromAlt,
      toAlt: clampedToAlt,
      ascendCostPer: 1,
      descendCostPer: 0,
      takeoffBaseCost: 1,
      landingBaseCost: 1,
    });
    // Action cost based on mode policy (flight uses same action cost rules)
    actionCost = policy.actionCostFromPathCost(pathCost);
  } else {
    // Ground movement cost (existing logic)
    pathCost = pathTerrainCost(path, gridState, fighter);
    actionCost = policy.actionCostFromPathCost(pathCost);
  }

  if (actionCost > fighter.remainingActions) {
    return fail(`Move too costly: need ${actionCost}, have ${fighter.remainingActions}`);
  }

  // Check if destination is occupied by enemy (for close-to-melee)
  const lastPos = path[path.length - 1];
  let closeToMelee = false;
  let targetEnemy = null;

  if (goalOccupant && canEnterGoal) {
    // We already validated this is an enemy, now check weapon range
    const weaponRange =
      fighter.equistaminadWeapons?.[0]?.range ??
      fighter.weapons?.[0]?.range ??
      5;

    if (weaponRange <= 5) {
      closeToMelee = true;
      targetEnemy = goalOccupant;
    } else {
      return fail("Weapon too long to close into melee");
    }
  }

  // ---- APPLY MOVE (AUTHORITATIVE STATE UPDATES) ----
  // Update grid state occupancy immediately (truth)
  gridState.moveOccupant(oldPos.x, oldPos.y, lastPos.x, lastPos.y, eid);

  // Emit authoritative state updates immediately
  events.push({
    type: "AP_SPENT",
    eid,
    amount: actionCost,
    remaining: fighter.remainingActions - actionCost,
  });

  // Emit movement cost event (for UI tracking)
  events.push({
    type: "MOVE_SPENT",
    eid,
    amount: pathCost,
  });

  // Emit altitude change if needed
  if (clampedToAlt !== fromAlt) {
    events.push(setAltitudeEvent(eid, clampedToAlt));
    if (clampedToAlt === 0) {
      events.push({
        type: "LOG",
        level: "info",
        message: `Ã°Å¸â€ºÂ¬ ${fighter.name} lands.`,
      });
    } else if (fromAlt === 0) {
      events.push({
        type: "LOG",
        level: "info",
        message: `Ã¢Å“Ë†Ã¯Â¸Â ${fighter.name} takes off to altitude ${clampedToAlt}.`,
      });
    } else {
      events.push({
        type: "LOG",
        level: "info",
        message: `Ã¢Å“Ë†Ã¯Â¸Â ${fighter.name} changes altitude: ${fromAlt} Ã¢â€ â€™ ${clampedToAlt}.`,
      });
    }
  }

  if (closeToMelee) {
    events.push({
      type: "TEMP_HEX_SHARED",
      attacker: eid,
      defender: targetEnemy.id,
      originalPos: { ...oldPos },
      targetHex: { x: lastPos.x, y: lastPos.y },
    });

    events.push({
      type: "LOG",
      message: `Ã¢Å¡â€Ã¯Â¸Â ${fighter.name} closes into melee with ${targetEnemy.name} (temporarily occupying same hex)`,
      level: "info",
    });
  }

  // Debug: log path cost
  events.push({
    type: "LOG",
    level: "info",
    message: `Ã°Å¸Â§Â­ Path cost = ${pathCost}, action cost = ${actionCost} (mode: ${policy.mode})`,
  });

  // ---- SCHEDULED ANIMATION EVENTS (SPEED + TERRAIN BASED) ----
  // Schedule step-by-step movement animation with variable timing
  const baseStepMs = meta?.baseStepMs ?? 120; // Base time for normal open tile at speed 10
  const speed = getSpeed(fighter);

  // timeScale comes from worker (setTimeScale); treat 0 as "instant" or "paused" later
  const ts = Math.max(timeScale ?? 1, 0.0001);

  // Build scheduled step events with variable per-step time
  const scheduled = [];
  let t = 0;

  // Emit one step at a time (skip path[0] = start)
  for (let i = 1; i < path.length; i++) {
    const step = path[i];

    const tileCost = gridState.terrainMoveCost(step.x, step.y, fighter);

    // Convert game properties Ã¢â€ â€™ animation time
    // Higher speed Ã¢â€ â€™ faster animation (lower time)
    const speedFactor = clamp(10 / speed, 0.5, 2.0); // speed 20 Ã¢â€ â€™ 0.5x time, speed 5 Ã¢â€ â€™ 2x time
    // Higher terrain cost Ã¢â€ â€™ slower animation (higher time)
    const terrainFactor = clamp(tileCost, 0.75, 3.5); // road/open ~1, forest 2, swamp 3, etc.

    const stepMs = (baseStepMs * speedFactor * terrainFactor) / ts;

    scheduled.push({
      t: Math.round(t),
      e: {
        type: "HEX_MOVED_STEP",
        eid,
        stepIndex: i,
        to: { x: step.x, y: step.y },
        // Optional debug info (uncomment if needed):
        // debug: { tileCost, speed, stepMs: Math.round(stepMs) },
      },
    });

    t += stepMs;
  }

  // End-of-move marker (useful to clear "moving" UI state)
  scheduled.push({
    t: Math.round(t),
    e: { type: "MOVE_ANIM_DONE", eid },
  });

  // Clear movement lock after animation completes
  scheduled.push({
    t: Math.round(t) + 2,
    e: { 
      type: "ENGINE_CLEAR_LOCK", 
      lock: { type: "entity", id: eid, lock: "moving" } 
    },
  });

  // IMPORTANT: end turn AFTER animation and lock clear (so visuals match turn pacing)
  scheduled.push({
    t: Math.round(t) + 3,
    e: { type: "TURN_ENDED", eid },
  });

  // ---- MODE-SPECIFIC BEHAVIOR ----
  
  // WITHDRAW: grants defensive stance
  if (policy.grantsDefensiveStance) {
    events.push({
      type: "DEFENSIVE_STANCE",
      eid,
      until: "NEXT_TURN", // UI / rules can interpret later
    });
    events.push({
      type: "LOG",
      level: "info",
      message: `Ã°Å¸â€ºÂ¡Ã¯Â¸Â ${fighter.name} withdraws and takes a defensive stance.`,
    });
  }

  // CHARGE: schedule an attack after movement animation
  if (policy.isCharge) {
    const target = pickChargeTarget({ state, eid, targetId, endPos: path[path.length - 1] });

    if (!target) {
      return fail("Charge requires a valid target");
    }

    // Require ending in melee range (same hex close or adjacent)
    const end = path[path.length - 1];
    const targetPos = state.positions[target.id];
    const okMelee = isMeleeRange(end, targetPos);
    if (!okMelee) {
      return fail("Charge must end in melee range of target");
    }

    // Schedule attack event slightly after MOVE_ANIM_DONE
    scheduled.push({
      t: Math.round(t) + 10,
      e: {
        type: "ATTACK_REQUESTED",
        attacker: eid,
        target: target.id,
        bonus: policy.chargeBonus,
        meta: { isCharge: true },
      },
    });

    events.push({
      type: "LOG",
      level: "info",
      message: `Ã°Å¸Ââ€¡ ${fighter.name} charges ${target.name}!`,
    });
  }

  // Emit the schedule as one event
  // Set moving lock BEFORE emitting scheduled events (prevents race conditions)
  engine.addLock?.(eid, "moving");
  
  // Emit explicit lock event for UI
  events.push({
    type: "ENGINE_SET_LOCK",
    lock: { type: "entity", id: eid, lock: "moving" },
  });
  
  // Generate unique schedule ID
  const scheduleId = `sched:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  
  events.push({
    type: "SCHEDULED_EVENTS",
    id: scheduleId,
    kind: "move",
    owner: { type: "entity", id: eid },
    locks: [{ type: "entity", id: eid, lock: "moving" }],
    items: scheduled,
  });

  // ---- ATTACK OF OPPORTUNITY (mode-aware + flight-aware) ----
  // Only trigger AoO if policy allows it (WITHDRAW blocks AoO)
  if (closeToMelee && policy.allowAoO && canAttackOfOpportunity(targetEnemy)) {
    // Flight AoO rules:
    // - Ground units vs flying targets: only if altitude <= 1
    // - Flyers leaving melee: only if altitude <= 1
    // - Flyers vs flyers: if altitude difference <= 1
    const targetAlt = getAltitude(state, targetEnemy.id);
    const moverAlt = clampedToAlt;
    const canAoO = checkAoOAltitude(targetEnemy, moverAlt, targetAlt);

    if (canAoO) {
      events.push({
        type: "ATTACK_OF_OPPORTUNITY",
        attackerId: targetEnemy.id,
        targetId: eid,
        reason: "LEAVING_MELEE",
      });

      events.push({
        type: "LOG",
        message: `Ã¢Å¡Â Ã¯Â¸Â ${targetEnemy.name} gets an attack of opportunity against ${fighter.name}!`,
        level: "warning",
      });

      // Build attack profile for AoO (simplified - uses basic attack)
      // In a full implementation, you'd get this from attackProfilesById or compute it
      const aooAttack = {
        toHitBonus: 0, // Base attack, no bonuses for AoO
        targetGuardRating: fighter.guardRating || fighter.guardRating || 10, // Target's guardRating
        damageFormula: targetEnemy.weapons?.[0]?.damage || "1d4", // Default damage
        remainingActions: targetEnemy.remainingActions, // Don't consume AoO attacker's actions
        critOn: 20,
        critMult: 2,
      };

      const aooState = {
        hpById: {
          [eid]: fighter.currentHP || fighter.hp || 0,
        },
      };

      const aooResult = resolveAttack({
        attackerId: targetEnemy.id,
        targetId: eid,
        attack: aooAttack,
        state: aooState,
      });

      if (aooResult?.events) {
        // Mark all AoO events with source
        aooResult.events.forEach(ev => {
          events.push({ ...ev, source: "AoO" });
        });
      }

      // Apply delta if present (HP changes, etc.)
      if (aooResult?.delta?.hpById) {
        events.push({
          type: "HP_CHANGED",
          targetId: eid,
          prevHP: fighter.currentHP || fighter.hp || 0,
          nextHP: aooResult.delta.hpById[eid],
        });
      }
    }
  }

  // Helper: check if AoO is allowed based on altitude
  function checkAoOAltitude(attacker, moverAlt, attackerAlt) {
    // Ground attacker vs flying mover: only if mover altitude <= 1
    if (attackerAlt === 0 && moverAlt > 1) return false;
    if (attackerAlt === 0 && moverAlt <= 1) return true;

    // Flying attacker vs ground mover: always allowed
    if (attackerAlt > 0 && moverAlt === 0) return true;

    // Flyer vs flyer: only if altitude difference <= 1
    if (attackerAlt > 0 && moverAlt > 0) {
      return Math.abs(attackerAlt - moverAlt) <= 1;
    }

    return true; // Default: allow AoO
  }

  events.push({
    type: "LOG",
    message: `Ã°Å¸Å¡Â¶ ${fighter.name} moves from (${oldPos.x},${oldPos.y}) to (${lastPos.x},${lastPos.y}) using ${actionCost} action(s)`,
    level: "info",
  });

  // TURN_ENDED is now scheduled after animation completes (see SCHEDULED_EVENTS above)

  return { ok: true, events };

  // -------- helpers --------
  function canAttackOfOpportunity(enemy) {
    return (
      enemy &&
      (enemy.currentHP ?? enemy.hp ?? 0) > 0 &&
      !enemy.isDown &&
      (enemy.remainingActions ?? 0) > 0
    );
  }

  /**
   * Pick charge target (from targetId or nearest enemy)
   */
  function pickChargeTarget({ state, eid, targetId, endPos }) {
    if (targetId) {
      const target = state.fighters.find(f => f.id === targetId);
      if (target && (target.currentHP ?? target.hp ?? 0) > 0 && !target.isDown) {
        return target;
      }
    }
    
    // Fallback: nearest living enemy
    const me = state.fighters.find(f => f.id === eid);
    if (!me) return null;
    
    const enemies = state.fighters.filter(f => {
      const mySide = me.side || me.type || (me.isEnemy ? "enemy" : "player");
      const theirSide = f.side || f.type || (f.isEnemy ? "enemy" : "player");
      return mySide !== theirSide && (f.currentHP ?? f.hp ?? 0) > 0 && !f.isDown;
    });
    
    if (!enemies.length) return null;

    let best = null;
    let bestD = Infinity;
    for (const e of enemies) {
      const p = state.positions[e.id];
      if (!p) continue;
      // Cheap distance metric (can swap to hex distance later)
      const d = Math.abs(p.x - endPos.x) + Math.abs(p.y - endPos.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  /**
   * Check if two positions are in melee range
   */
  function isMeleeRange(a, b) {
    if (!a || !b) return false;
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    // Axial adjacency approximation: allow same hex or distance 1
    return (dx === 0 && dy === 0) || (dx <= 1 && dy <= 1);
  }
};
