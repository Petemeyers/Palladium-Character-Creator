import {
  clearInvalidExchangeStates,
  resolveCanonicalDefenseExchange,
} from "./defenseOutcome.js";

const makeFighter = (id, name) => ({
  id,
  name,
  hp: 30,
  remainingActions: 2,
  stamina: 14,
  isConscious: true,
});

export function createPhase2SwordDuelScenario() {
  const attacker = makeFighter("knight-a", "Knight A");
  const defender = makeFighter("knight-b", "Knight B");
  const registry = new Map();
  const initialInitiative = ["knight-a", "knight-b"];
  const initialEconomy = {
    attackerActions: attacker.remainingActions,
    defenderActions: defender.remainingActions,
    attackerStamina: attacker.stamina,
    defenderStamina: defender.stamina,
  };
  const resolve = (defenseTotal, sequence) => resolveCanonicalDefenseExchange({
    registry,
    admission: {
      combatActive: true,
      expectedGenerationId: "browser-phase2",
      currentGenerationId: "browser-phase2",
      expectedRound: 1,
      currentRound: 1,
      expectedExecutionKey: `sword-duel:${sequence}`,
      currentExecutionKey: `sword-duel:${sequence}`,
      attacker,
      defender,
    },
    attackTotal: 15,
    defenseTotal,
    attackNaturalRoll: 10,
    defenseNaturalRoll: Math.min(20, defenseTotal - 4),
    canonicalSuccess: defenseTotal >= 15,
    attackType: "melee",
    defenseType: "weapon",
    actionSequence: sequence,
    attackerName: attacker.name,
    defenderName: defender.name,
  });
  const neutral = resolve(18, 1);
  const advantage = resolve(20, 2);
  const dominant = resolve(25, 3);
  const stale = resolveCanonicalDefenseExchange({
    registry,
    admission: {
      combatActive: true,
      expectedGenerationId: "browser-phase2",
      currentGenerationId: "browser-phase2",
      expectedRound: 1,
      currentRound: 2,
      expectedExecutionKey: "sword-duel:stale",
      currentExecutionKey: "sword-duel:stale",
      attacker,
      defender,
    },
    attackTotal: 15,
    defenseTotal: 25,
    canonicalSuccess: true,
    actionSequence: 4,
  });
  const beforeRoundClear = registry.size;
  clearInvalidExchangeStates(registry, {
    generationId: "browser-phase2",
    round: 2,
    combatActive: true,
    fighters: [attacker, defender],
  });
  return Object.freeze({
    routeKind: "browser-importable",
    initialInitiative,
    finalInitiative: [...initialInitiative],
    initialEconomy,
    finalEconomy: {
      attackerActions: attacker.remainingActions,
      defenderActions: defender.remainingActions,
      attackerStamina: attacker.stamina,
      defenderStamina: defender.stamina,
    },
    outcomes: [neutral.result.outcome, advantage.result.outcome, dominant.result.outcome],
    openingLevels: [neutral.result.openingLevel, advantage.result.openingLevel, dominant.result.openingLevel],
    messages: [neutral.playerMessage, advantage.playerMessage, dominant.playerMessage],
    staleAccepted: stale.accepted,
    beforeRoundClear,
    afterRoundClear: registry.size,
    immediateAttacksCreated: 0,
  });
}
