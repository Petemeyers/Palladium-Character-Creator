export const COMBAT_PHASE = {
  IDLE: "idle",
  AWAITING_COMMAND: "awaiting-command",
  CHOOSING_TARGET: "choosing-target",
  RESOLVING: "resolving",
};

export const COMBAT_ACTION = {
  MOVE: "move",
  ATTACK: "attack",
  CAST: "cast",
  DEFEND: "defend",
  READY: "ready",
  USE_SKILL: "use-skill",
};

export const TARGET_MODE = {
  ANY: "any",
  TILE: "tile",
  CHARACTER: "character",
  SELF: "self",
};

export function createEmptyCombatState() {
  return {
    phase: COMBAT_PHASE.IDLE,
    activeCombatantId: null,
    selectedObject: null,
    pendingAction: null,
    selectedSpell: null,
    targetMode: TARGET_MODE.ANY,
    grid: {},
    positions: {},
    combatantsById: {},
    initiativeOrder: [],
    round: 1,
    log: [],
  };
}

export function cloneCombatState(state) {
  return {
    ...state,
    selectedObject: state.selectedObject ? { ...state.selectedObject } : null,
    grid: { ...state.grid },
    positions: Object.fromEntries(
      Object.entries(state.positions || {}).map(([id, pos]) => [id, { ...pos }])
    ),
    combatantsById: Object.fromEntries(
      Object.entries(state.combatantsById || {}).map(([id, fighter]) => [
        id,
        { ...fighter },
      ])
    ),
    initiativeOrder: [...(state.initiativeOrder || [])],
    log: [...(state.log || [])],
  };
}

export function withLog(state, entry) {
  const nextLog = [...(state.log || []), { ...entry, ts: entry.ts ?? Date.now() }];
  return { ...state, log: nextLog };
}

export function withPhase(state, phase) {
  if (!Object.values(COMBAT_PHASE).includes(phase)) {
    throw new Error(`Unknown combat phase: ${phase}`);
  }
  return { ...state, phase };
}

export function clearPendingAction() {
  return {
    pendingAction: null,
    selectedSpell: null,
    targetMode: TARGET_MODE.ANY,
  };
}
