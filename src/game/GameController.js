import { CombatEngine } from "../utils/combatEngine";
import {
  createEmptyCombatState,
  COMBAT_PHASE,
  COMBAT_ACTION,
  TARGET_MODE,
  clearPendingAction,
} from "./combatState";
import { canReachTile, canPerformRangedAttack } from "./rules/combatRules";

export class GameController {
  constructor({ onStateChange, onLog } = {}) {
    this.state = createEmptyCombatState();
    this.onStateChange =
      typeof onStateChange === "function" ? onStateChange : () => {};
    this.onLog = typeof onLog === "function" ? onLog : console.log;

    this._isProcessingAI = false;

    this.engine = new CombatEngine({
      logCallback: (msg, type) => this.log(msg, type),
      onCombatantUpdate: (fighter) => this.handleCombatantUpdate(fighter),
      onMeleeRoundComplete: () => this.handleMeleeComplete(),
    });
  }

  // ---------------------------
  // Logging & state helpers
  // ---------------------------
  log(msg, type = "info") {
    this.onLog({ msg, type, ts: Date.now() });
  }

  _emitState(partial = {}) {
    this.state = { ...this.state, ...partial };
    this.onStateChange(this.state);
  }

  _positionsAxialToEngine(positions = {}) {
    const converted = {};
    Object.entries(positions).forEach(([id, pos]) => {
      if (pos) {
        converted[id] = { x: pos.q, y: pos.r };
      }
    });
    return converted;
  }

  _getCombatantById(id) {
    if (!id) return null;
    if (typeof this.engine.getCombatantById === "function") {
      return this.engine.getCombatantById(id);
    }
    return (this.engine.combatants || []).find(
      (c) => c.id === id || c.name === id
    );
  }

  _nextActiveFromEngine(currentId = null) {
    if (typeof this.engine.getNextActiveCombatant === "function") {
      return this.engine.getNextActiveCombatant(currentId);
    }

    const fighters = this.engine.combatants || [];
    if (!fighters.length) return null;

    const length = fighters.length;
    let start = 0;
    if (currentId) {
      const idx = fighters.findIndex((f) => f.id === currentId);
      if (idx >= 0) start = (idx + 1) % length;
    }

    for (let offset = 0; offset < length; offset += 1) {
      const fighter = fighters[(start + offset) % length];
      const canAct = this.engine.canFighterAct
        ? this.engine.canFighterAct(fighter)
        : true;
      if (canAct && (fighter.remainingAttacks ?? 0) > 0) {
        return fighter;
      }
    }

    return null;
  }

  _startNextMeleeRound() {
    if (typeof this.engine.startNextMeleeRound === "function") {
      this.engine.startNextMeleeRound();
      return;
    }

    this.engine.meleeRound = (this.engine.meleeRound || 0) + 1;
    (this.engine.combatants || []).forEach((fighter) => {
      if (this.engine.canFighterAct && !this.engine.canFighterAct(fighter)) {
        fighter.remainingAttacks = 0;
      } else {
        fighter.remainingAttacks =
          fighter.attacksPerMelee ??
          fighter.actions ??
          fighter.remainingAttacks ??
          2;
      }
    });
    this.log(`⏰ Melee Round ${this.engine.meleeRound} begins`, "combat");
  }

  _isAIControlled(fighter) {
    return !!fighter?.isAIControlled;
  }

  _hexDistance(a, b) {
    if (!a || !b) return Infinity;
    const dq = (a.q ?? 0) - (b.q ?? 0);
    const dr = (a.r ?? 0) - (b.r ?? 0);
    const ds = -(a.q ?? 0) - (a.r ?? 0) - (-(b.q ?? 0) - (b.r ?? 0));
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
  }

  _hasTileAt(q, r) {
    const grid = this.state.grid || {};
    return Object.values(grid).some(
      (cell) => cell && cell.q === q && cell.r === r
    );
  }

  _isTileOccupied(q, r, ignoreId = null) {
    const positions = this.state.positions || {};
    return Object.entries(positions).some(([id, pos]) => {
      if (ignoreId && id === ignoreId) return false;
      return pos?.q === q && pos?.r === r;
    });
  }

  _stepToward(from, to, ignoreId) {
    if (!from || !to) return null;
    const directions = [
      { dq: +1, dr: 0 },
      { dq: +1, dr: -1 },
      { dq: 0, dr: -1 },
      { dq: -1, dr: 0 },
      { dq: -1, dr: +1 },
      { dq: 0, dr: +1 },
    ];

    let best = null;
    let bestDist = this._hexDistance(from, to);

    directions.forEach((dir) => {
      const candidate = { q: from.q + dir.dq, r: from.r + dir.dr };
      if (!this._hasTileAt(candidate.q, candidate.r)) return;
      if (this._isTileOccupied(candidate.q, candidate.r, ignoreId)) return;
      const dist = this._hexDistance(candidate, to);
      if (dist < bestDist) {
        bestDist = dist;
        best = candidate;
      }
    });

    return best;
  }

  _maybeRunAITurn() {
    const activeId = this.state.activeCombatantId;
    if (!activeId || this._isProcessingAI) return;

    const fighter = this._getCombatantById(activeId);
    if (!this._isAIControlled(fighter)) return;

    this._isProcessingAI = true;
    try {
      this._runSimpleAITurn(fighter);
    } finally {
      this._isProcessingAI = false;
    }
  }

  _runSimpleAITurn(fighter) {
    const attackerId = fighter.id;
    const { combatantsById = {}, positions = {} } = this.state;

    const enemies = Object.values(combatantsById).filter((opponent) => {
      if (!opponent || opponent.id === attackerId) return false;
      if (typeof fighter.isEnemy === "function") {
        return fighter.isEnemy(opponent);
      }
      if (fighter.alignmentGroup && opponent.alignmentGroup) {
        return fighter.alignmentGroup !== opponent.alignmentGroup;
      }
      return fighter.alignment !== opponent.alignment;
    });

    if (!enemies.length) {
      this.log(`🤖 ${fighter.name} has no valid targets`, "ai");
      this._consumeAction(attackerId);
      return;
    }

    const attackerPos = positions[attackerId];
    if (!attackerPos) {
      this._consumeAction(attackerId);
      return;
    }

    let bestTarget = null;
    let bestDist = Infinity;

    enemies.forEach((enemy) => {
      const enemyPos = positions[enemy.id];
      if (!enemyPos) return;
      if (!canPerformRangedAttack(this.state, attackerId, enemy.id)) return;
      const dist = this._hexDistance(attackerPos, enemyPos);
      if (dist < bestDist) {
        bestDist = dist;
        bestTarget = enemy;
      }
    });

    if (bestTarget) {
      this.log(`🤖 ${fighter.name} attacks ${bestTarget.name}`, "ai");
      this.handleAction(COMBAT_ACTION.ATTACK, { actorId: attackerId });
      this.handleSelect({ type: "character", id: bestTarget.id });
      return;
    }

    let closestEnemy = null;
    let closestDist = Infinity;
    enemies.forEach((enemy) => {
      const enemyPos = positions[enemy.id];
      if (!enemyPos) return;
      const dist = this._hexDistance(attackerPos, enemyPos);
      if (dist < closestDist) {
        closestDist = dist;
        closestEnemy = enemy;
      }
    });

    if (!closestEnemy) {
      this.log(`🤖 ${fighter.name} cannot locate enemies`, "ai");
      this._consumeAction(attackerId);
      return;
    }

    const targetPos = positions[closestEnemy.id];
    const step = this._stepToward(attackerPos, targetPos, attackerId);
    if (!step || !canReachTile(this.state, attackerId, step)) {
      this.log(`🤖 ${fighter.name} cannot advance`, "ai");
      this._consumeAction(attackerId);
      return;
    }

    this.log(`🤖 ${fighter.name} moves toward ${closestEnemy.name}`, "ai");
    this.handleAction(COMBAT_ACTION.MOVE, { actorId: attackerId });
    this.handleSelect({ type: "tile", q: step.q, r: step.r });
  }

  // ---------------------------
  // Public API
  // ---------------------------
  startEncounter({
    fighters = [],
    grid = {},
    positions = {},
    terrain = null,
  } = {}) {
    const combatantsById = {};
    fighters.forEach((fighter) => {
      combatantsById[fighter.id] = fighter;
    });

    this.engine.initializeCombat(fighters, {
      terrain,
      positions: this._positionsAxialToEngine(positions),
    });

    const initiativeOrder = (this.engine.combatants || []).map((c) => c.id);
    const firstActive =
      this._nextActiveFromEngine(null) || this.engine.combatants?.[0] || null;

    const baseState = createEmptyCombatState();
    this._emitState({
      ...baseState,
      phase: firstActive ? COMBAT_PHASE.AWAITING_COMMAND : COMBAT_PHASE.IDLE,
      activeCombatantId: firstActive ? firstActive.id : null,
      grid,
      positions,
      combatantsById,
      initiativeOrder,
      round: 1,
    });

    this._maybeRunAITurn();
  }

  handleSelect(info = {}) {
    const { pendingAction } = this.state;

    if (pendingAction === COMBAT_ACTION.MOVE && info.type === "tile") {
      this._executeMoveToTile(info);
      return;
    }

    if (pendingAction === COMBAT_ACTION.ATTACK && info.type === "character") {
      this._executeAttack(info);
      return;
    }

    if (pendingAction === COMBAT_ACTION.CAST) {
      this._executeSpellTarget(info);
      return;
    }

    this._emitState({ selectedObject: info });
  }

  handleAction(action, payload = {}) {
    const activeId = this.state.activeCombatantId;
    if (!activeId) return;

    if (payload.actorId && payload.actorId !== activeId) {
      this.log("❌ Not your turn", "warn");
      return;
    }

    switch (action) {
      case COMBAT_ACTION.MOVE:
        this._emitState({
          pendingAction: COMBAT_ACTION.MOVE,
          selectedObject: null,
        });
        break;
      case COMBAT_ACTION.ATTACK:
        this._emitState({
          pendingAction: COMBAT_ACTION.ATTACK,
          selectedObject: null,
        });
        break;
      case COMBAT_ACTION.CAST:
        this._emitState({
          pendingAction: COMBAT_ACTION.CAST,
          selectedSpell: payload.spell || null,
          selectedObject: null,
        });
        break;
      case COMBAT_ACTION.DEFEND:
      case COMBAT_ACTION.READY:
      case COMBAT_ACTION.USE_SKILL:
      default:
        break;
    }
  }

  // ---------------------------
  // Concrete action handlers
  // ---------------------------
  _executeMoveToTile(tileInfo) {
    const activeId = this.state.activeCombatantId;
    if (!activeId) return;

    const destination = { q: tileInfo.q, r: tileInfo.r };

    if (!canReachTile(this.state, activeId, destination)) {
      this.log("🚫 Cannot reach that tile this action", "warn");
      return;
    }

    if (typeof this.engine.moveById === "function") {
      const ok = this.engine.moveById(activeId, destination);
      if (!ok) return;
    } else {
      const fighter = this._getCombatantById(activeId);
      if (!fighter) return;
      const oldPos = fighter.position || {
        x: fighter.q ?? 0,
        y: fighter.r ?? 0,
      };
      const target = { x: destination.q, y: destination.r };
      if (typeof this.engine.performMove === "function") {
        this.engine.performMove(fighter, target, oldPos);
      }
      fighter.position = target;
    }

    const positions = {
      ...this.state.positions,
      [activeId]: destination,
    };

    this._emitState({
      positions,
      pendingAction: null,
      selectedObject: tileInfo,
      targetMode: TARGET_MODE.ANY,
    });

    this._consumeAction(activeId);
  }

  _executeAttack(targetInfo) {
    const attackerId = this.state.activeCombatantId;
    const targetId = targetInfo.id;
    if (!attackerId || !targetId) return;

    if (!canPerformRangedAttack(this.state, attackerId, targetId)) {
      this.log("🚫 Target out of range or line of sight", "warn");
      return;
    }

    if (typeof this.engine.attackById === "function") {
      this.engine.attackById(attackerId, targetId);
    } else if (typeof this.engine.performStrike === "function") {
      const attacker = this._getCombatantById(attackerId);
      const target = this._getCombatantById(targetId);
      if (!attacker || !target) return;
      this.engine.performStrike(attacker, target, null, {});
    }

    this._emitState({
      pendingAction: null,
      selectedObject: targetInfo,
      targetMode: TARGET_MODE.ANY,
    });

    this._consumeAction(attackerId);
  }

  _executeSpellTarget(targetInfo) {
    const casterId = this.state.activeCombatantId;
    const spell = this.state.selectedSpell;
    if (!casterId || !spell) return;

    if (targetInfo?.id && spell.requiresLoS) {
      if (!canPerformRangedAttack(this.state, casterId, targetInfo.id)) {
        this.log("🚫 Spell target out of range or line of sight", "warn");
        return;
      }
    }

    if (typeof this.engine.castSpellById === "function") {
      this.engine.castSpellById(casterId, spell, targetInfo);
    } else if (typeof this.engine.performSpell === "function") {
      const caster = this._getCombatantById(casterId);
      const target = targetInfo?.id
        ? this._getCombatantById(targetInfo.id)
        : null;
      this.engine.performSpell(caster, target, spell);
    }

    this._emitState({
      pendingAction: null,
      selectedSpell: null,
      selectedObject: targetInfo,
      targetMode: TARGET_MODE.ANY,
    });

    this._consumeAction(casterId);
  }

  // ---------------------------
  // Turn sequencing
  // ---------------------------
  _consumeAction(actorId) {
    const fighter = this._getCombatantById(actorId);
    if (!fighter) return;

    const remaining = Math.max(0, (fighter.remainingAttacks ?? 1) - 1);
    fighter.remainingAttacks = remaining;

    if (typeof this.engine.onCombatantUpdate === "function") {
      this.engine.onCombatantUpdate(fighter);
    }

    if (remaining > 0) {
      this._emitState({});
      return;
    }

    let next = this._nextActiveFromEngine(actorId);
    if (!next) {
      this._startNextMeleeRound();
      next = this._nextActiveFromEngine(null);
    }

    const newPhase = next ? COMBAT_PHASE.AWAITING_COMMAND : COMBAT_PHASE.IDLE;
    this._emitState({
      activeCombatantId: next ? next.id : null,
      phase: newPhase,
      ...clearPendingAction(),
    });

    this._maybeRunAITurn();
  }

  // ---------------------------
  // Engine callbacks
  // ---------------------------
  handleCombatantUpdate(fighter) {
    if (!fighter) return;
    const combatantsById = {
      ...this.state.combatantsById,
      [fighter.id]: fighter,
    };
    this._emitState({ combatantsById });
  }

  handleMeleeComplete() {
    this.log(
      `🔁 Melee round ${this.engine.meleeRound || "?"} complete`,
      "combat"
    );
  }
}
