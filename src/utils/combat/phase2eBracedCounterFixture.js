/**
 * Milestone 8D Phase 2E: deterministic live braced-counter fixture helpers.
 * Test/debug only. Does not change production Charge, brace, or HP rules.
 */

import { resolveBracedCounterDefenderWeapon } from "./bracedCounterWeaponLookup.js";

export { resolveBracedCounterDefenderWeapon };

export const PHASE2E_BRACED_COUNTER_FIXTURE = Object.freeze({
  charger: Object.freeze({
    role: "charger",
    name: "Charger",
    actorId: "knight",
    side: "player",
    team: "party",
    armyId: "party",
    fighterTypeOverride: "player",
    controlMode: "manual",
    weapon: "Long Sword",
    position: Object.freeze({ x: 20, y: 23 }),
    survivalHp: 80,
  }),
  bracer: Object.freeze({
    role: "bracer",
    name: "Bracer",
    actorId: "spearman",
    side: "enemy",
    team: "enemy",
    armyId: "enemy",
    fighterTypeOverride: null,
    controlMode: "manual",
    weapon: "Spear",
    position: Object.freeze({ x: 20, y: 20 }),
    survivalHp: 80,
  }),
  chargeDestination: Object.freeze({ x: 20, y: 21 }),
  qualifyingNaturalAttackRoll: 19,
  windowApiName: "__mcsPhase2ECombatFixture",
});

export function pointKey(point = {}) {
  return `${Number(point?.x)},${Number(point?.y)}`;
}

export function pointsEqual(left = {}, right = {}) {
  return Number(left?.x) === Number(right?.x) && Number(left?.y) === Number(right?.y);
}

export function applyExplicitDeploymentPositions(deploymentState = {}, placements = []) {
  const next = {
    ...deploymentState,
    selectionBySide: {
      player: [...(deploymentState.selectionBySide?.player || [])],
      enemy: [...(deploymentState.selectionBySide?.enemy || [])],
      npc: [...(deploymentState.selectionBySide?.npc || [])],
    },
    selectedFighterBySide: {
      player: deploymentState.selectedFighterBySide?.player ?? null,
      enemy: deploymentState.selectedFighterBySide?.enemy ?? null,
      npc: deploymentState.selectedFighterBySide?.npc ?? null,
    },
    positionsBySide: {
      player: { ...(deploymentState.positionsBySide?.player || {}) },
      enemy: { ...(deploymentState.positionsBySide?.enemy || {}) },
      npc: { ...(deploymentState.positionsBySide?.npc || {}) },
    },
    manualPositionsBySide: {
      player: { ...(deploymentState.manualPositionsBySide?.player || {}) },
      enemy: { ...(deploymentState.manualPositionsBySide?.enemy || {}) },
      npc: { ...(deploymentState.manualPositionsBySide?.npc || {}) },
    },
  };

  for (const placement of placements) {
    const fighterId = String(placement?.fighterId || "");
    const side = placement?.side === "enemy" || placement?.side === "npc" ? placement.side : "player";
    const point = {
      x: Number(placement?.x),
      y: Number(placement?.y),
    };
    if (!fighterId || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    next.positionsBySide[side][fighterId] = point;
    next.manualPositionsBySide[side][fighterId] = point;
    next.selectionBySide[side] = [fighterId];
    next.selectedFighterBySide[side] = fighterId;
    if (side === "player" || side === "enemy") next.currentSide = side;
  }

  return next;
}

export function flattenDeploymentPositions(deploymentState = {}) {
  return {
    ...(deploymentState.positionsBySide?.player || {}),
    ...(deploymentState.positionsBySide?.enemy || {}),
    ...(deploymentState.positionsBySide?.npc || {}),
  };
}

export function expectedBracedCounterDamage(finalDamage) {
  return Math.floor(Number(finalDamage) / 3);
}

export function clampExpectedHp(value, fighter = {}, minHp = -30) {
  const maxHp = Number(fighter.maxHP ?? fighter.maxHp ?? fighter.HP ?? fighter.hp ?? value);
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  const ceiling = Number.isFinite(maxHp) ? maxHp : numeric;
  return Math.max(minHp, Math.min(numeric, ceiling));
}

export function summarizeFighter(fighter = {}, positions = {}) {
  const id = String(fighter?.id || fighter?._id || "");
  const position = positions[id] || fighter?.position || fighter?.hex || null;
  const hp = Number(fighter?.currentHP ?? fighter?.hp ?? fighter?.HP);
  return {
    id,
    originalCombatId: fighter?.originalCombatId || null,
    name: fighter?.name || "",
    team: fighter?.team || fighter?.battleSide || fighter?.side || "",
    type: fighter?.type || "",
    side: fighter?.side || fighter?.type || "",
    controlMode: fighter?.controlMode || "",
    status: fighter?.status || "",
    remainingActions: Number(fighter?.remainingActions ?? fighter?.actionsRemaining ?? 0),
    maxActions: Number(fighter?.maxActions ?? fighter?.actionsPerRound ?? 0),
    currentStamina: Number(
      fighter?.currentStamina
      ?? fighter?.combatStamina?.currentStamina
      ?? fighter?.fatigueState?.currentStamina
      ?? 0,
    ),
    combatStamina: Number(
      fighter?.combatStamina?.currentStamina
      ?? fighter?.combatStamina?.current
      ?? 0,
    ),
    staminaAlias: Number.isFinite(Number(fighter?.stamina)) ? Number(fighter.stamina) : null,
    maxStamina: Number(
      fighter?.maxStamina
      ?? fighter?.combatStamina?.maxStamina
      ?? fighter?.fatigueState?.maxStamina
      ?? 0,
    ),
    hp,
    currentHP: fighter?.currentHP,
    hpAlias: fighter?.hp,
    HPAlias: fighter?.HP,
    maxHP: fighter?.maxHP ?? fighter?.maxHp,
    position: position ? { x: Number(position.x), y: Number(position.y) } : null,
    combatPosture: fighter?.combatPosture || null,
    weapons: Array.isArray(fighter?.equistaminadWeapons)
      ? fighter.equistaminadWeapons.map((weapon) => weapon?.name).filter(Boolean)
      : [fighter?.equistaminadWeapons?.primary?.name, fighter?.equistaminadWeapons?.secondary?.name].filter(Boolean),
  };
}

export function assertFixtureLiveState({
  charger,
  bracer,
  positions = {},
  catalogByRole = {},
} = {}) {
  const errors = [];
  const chargerId = String(charger?.id || "");
  const bracerId = String(bracer?.id || "");
  if (!chargerId || !bracerId) errors.push("both fixture actors must exist");
  if (chargerId && bracerId && chargerId === bracerId) errors.push("fixture actor IDs must be unique");
  if (!pointsEqual(charger?.position || positions[chargerId], PHASE2E_BRACED_COUNTER_FIXTURE.charger.position)) {
    errors.push("charger must occupy (20,23)");
  }
  if (!pointsEqual(bracer?.position || positions[bracerId], PHASE2E_BRACED_COUNTER_FIXTURE.bracer.position)) {
    errors.push("bracer must occupy (20,20)");
  }
  const chargerSide = String(charger?.team || charger?.type || "").toLowerCase();
  const bracerSide = String(bracer?.team || bracer?.type || "").toLowerCase();
  const chargerHostile = chargerSide === "party" || chargerSide === "player";
  const bracerHostile = bracerSide === "enemy";
  if (!chargerHostile || !bracerHostile) errors.push("fixture actors must be hostile to each other");
  if (String(charger?.status || "active").toLowerCase() !== "active") errors.push("charger must be active");
  if (String(bracer?.status || "active").toLowerCase() !== "active") errors.push("bracer must be active");
  if (catalogByRole.charge && catalogByRole.charge.enabled === false) {
    errors.push(`Charge must be available to the charger: ${catalogByRole.charge.disabledReason || "disabled"}`);
  }
  if (catalogByRole.block && catalogByRole.block.enabled === false) {
    errors.push(`Block must be available to the bracer: ${catalogByRole.block.disabledReason || "disabled"}`);
  }
  return {
    ok: errors.length === 0,
    errors,
  };
}

export default {
  PHASE2E_BRACED_COUNTER_FIXTURE,
  applyExplicitDeploymentPositions,
  assertFixtureLiveState,
  expectedBracedCounterDamage,
  flattenDeploymentPositions,
  resolveBracedCounterDefenderWeapon,
  summarizeFighter,
};
