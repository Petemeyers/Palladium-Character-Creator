import assert from "node:assert/strict";
import {
  createTacticalPostParryRuntime,
  openTacticalPostParryWindow,
  progressTacticalPostParryWindows,
  submitTacticalPostParryResponse,
} from "../src/utils/combat/tacticalPostParryWindow.js";

export const fighters = (overrides = {}) => [
  { id: "defender", name: "Swordsman", team: "party", currentHP: 20, controlMode: "manual", weaponSlots: { rightHand: { id: "sword-a", name: "Long Sword" }, leftHand: { id: "shield-a", name: "Shield" } }, ...overrides.defender },
  { id: "attacker", name: "Knight", team: "enemy", currentHP: 20, controlMode: "ai", weaponSlots: { rightHand: { id: "sword-b", name: "Long Sword" } }, ...overrides.attacker },
];

export const defense = (quality = "parry_dominant", overrides = {}) => ({
  generationId: 1,
  combatSession: 1,
  reactionWindowId: "reaction-window",
  reactionResponseId: `reaction-response:${quality}`,
  responderId: "defender",
  sourceDefenderId: "defender",
  sourceAttackerId: "attacker",
  sourceActionIntentId: "action-intent",
  sourceExecutionKey: "source-attack",
  sourceWeaponId: "sword-b",
  parryingWeaponId: "sword-a",
  defenseType: "weapon",
  parryAttempted: true,
  parrySucceeded: true,
  parryQuality: quality,
  ...overrides,
});

export const offer = (quality = "parry_dominant", overrides = {}) => ({
  opportunityId: `offer:${quality}`,
  reactionId: `offer:${quality}`,
  opportunityType: quality === "parry_dominant" ? "dominant_opening" : "riposte",
  sourceExchangeId: "exchange",
  sourceAttackExecutionKey: "source-attack",
  reactorId: "defender",
  targetId: "attacker",
  reactionDepth: 1,
  parryingWeaponId: "sword-a",
  attackingWeaponId: "sword-b",
  attack: { id: "sword-a", name: "Long Sword" },
  legalResponses: quality === "parry_dominant"
    ? ["riposte", "maintain_bind", "weapon_displacement", "grapple_entry", "controlled_disengage", "shield_pressure", "decline"]
    : ["riposte", "decline"],
  ...overrides,
});

export function openScenario({ quality = "parry_dominant", controlMode = "manual", actorOverrides, defenseOverrides, offerOverrides, runtimeOptions, events = [] } = {}) {
  const runtime = createTacticalPostParryRuntime({ generationId: 1, combatSession: 1, ...runtimeOptions });
  const roster = fighters(actorOverrides);
  const opened = openTacticalPostParryWindow({
    runtime,
    defenseResult: defense(quality, defenseOverrides),
    canonicalOffer: offer(quality, offerOverrides),
    pulseIndex: 6,
    fighters: roster,
    controlMode,
    onEvent: (event) => events.push(event),
  });
  return { runtime, roster, opened, events };
}

export async function selectAndResolve(scenario, responseType, { pulse = 7, validateResponse, executeCanonicalResponse } = {}) {
  const window = scenario.opened.window;
  const selected = submitTacticalPostParryResponse({
    runtime: scenario.runtime,
    tacticalPostParryWindowId: window.tacticalPostParryWindowId,
    responderId: "defender",
    responseType,
    pulseIndex: pulse,
    generationId: 1,
    combatSession: 1,
    sourceExecutionKey: "source-attack",
    sourceReactionResponseId: window.sourceReactionResponseId,
    selectedActorId: "defender",
    onEvent: (event) => scenario.events.push(event),
  });
  const executions = [];
  const progressed = await progressTacticalPostParryWindows({
    runtime: scenario.runtime,
    pulseIndex: pulse,
    fighters: scenario.roster,
    validateResponse,
    executeCanonicalResponse: executeCanonicalResponse || ((admission) => {
      executions.push(admission);
      return { accepted: true, responseType: admission.responseType };
    }),
    onEvent: (event) => scenario.events.push(event),
  });
  return { selected, progressed, executions };
}

export function assertOne(events, type) {
  assert.equal(events.filter((event) => event.eventType === type).length, 1, `${type} exactly once`);
}
