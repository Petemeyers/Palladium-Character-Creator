import { buildPublicInitiativePreviewRows } from "./publicInitiativePreview.js";
import { getPublicCombatHpInfo } from "./publicCombatHp.js";

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const rollD20 = () => Math.floor(Math.random() * 20) + 1;

export function buildPublicTurnOrderRows(combatants = [], options = {}) {
  const list = Array.isArray(combatants) ? combatants : [];
  const previews = buildPublicInitiativePreviewRows(list);
  const roller = typeof options.rollD20 === "function" ? options.rollD20 : rollD20;

  return previews
    .map((preview, index) => {
      const initiativeBonus = toNumber(preview.initiativeBonus);
      const missingFields = [...(preview.missingFields || [])];
      if (initiativeBonus === null && !missingFields.includes("initiativeBonus")) {
        missingFields.push("initiativeBonus");
      }

      const ready = missingFields.length === 0 && (preview.side === "player" || preview.side === "enemy");
      const initiativeRoll = ready ? toNumber(roller(list[index], preview, index)) : null;
      const totalInitiative = initiativeRoll === null || initiativeBonus === null
        ? null
        : initiativeRoll + initiativeBonus;

      return {
        id: preview.id,
        name: preview.name,
        side: preview.side,
        initiativeBonus,
        initiativeRoll,
        totalInitiative,
        source: preview.source,
        sourceLabel: preview.sourceLabel,
        ready,
        missingFields,
        originalIndex: index,
      };
    })
    .sort((left, right) => {
      const leftTotal = toNumber(left.totalInitiative);
      const rightTotal = toNumber(right.totalInitiative);
      if (leftTotal !== null && rightTotal !== null && rightTotal !== leftTotal) {
        return rightTotal - leftTotal;
      }
      if (leftTotal !== null && rightTotal === null) return -1;
      if (leftTotal === null && rightTotal !== null) return 1;
      return left.originalIndex - right.originalIndex;
    });
}

export function canStartPublicTurnOrder(combatants = []) {
  const rows = buildPublicInitiativePreviewRows(Array.isArray(combatants) ? combatants : []);
  const readySides = new Set(
    rows
      .filter((row) => row.status === "ready" && (row.side === "player" || row.side === "enemy"))
      .map((row) => row.side)
  );

  return readySides.has("player") && readySides.has("enemy");
}

export function isPublicTurnCombatantActive(row = {}, combatants = []) {
  const combatant = (Array.isArray(combatants) ? combatants : []).find((candidate, index) =>
    String(candidate?.id || candidate?._id || candidate?.name || index) === String(row.id)
  );
  const hpInfo = getPublicCombatHpInfo(combatant || {});
  return !hpInfo.ok || hpInfo.hp > 0;
}

export function advancePublicTurnOrder({
  turnOrder = [],
  currentIndex = 0,
  round = 1,
  combatants = [],
  skipZeroHp = true,
} = {}) {
  const rows = Array.isArray(turnOrder) ? turnOrder : [];
  if (rows.length === 0) {
    return { currentIndex: 0, round, current: null, wrapped: false };
  }

  for (let offset = 1; offset <= rows.length; offset += 1) {
    const nextIndex = (currentIndex + offset) % rows.length;
    const wrapped = currentIndex + offset >= rows.length;
    const candidate = rows[nextIndex];
    if (!skipZeroHp || isPublicTurnCombatantActive(candidate, combatants)) {
      return {
        currentIndex: nextIndex,
        round: wrapped ? round + 1 : round,
        current: candidate,
        wrapped,
      };
    }
  }

  return {
    currentIndex,
    round,
    current: rows[currentIndex] || null,
    wrapped: false,
  };
}

export default {
  advancePublicTurnOrder,
  buildPublicTurnOrderRows,
  canStartPublicTurnOrder,
  isPublicTurnCombatantActive,
};
