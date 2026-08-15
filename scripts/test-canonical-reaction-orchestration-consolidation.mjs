import assert from "node:assert/strict";
import fs from "node:fs";
import {
  MAX_IMMEDIATE_REACTION_DEPTH,
  REACTION_STATUSES,
  buildCanonicalReactionLifecycleRecord,
  registerCanonicalReaction,
  transitionCanonicalReaction,
  validateCanonicalReactionOwnership,
} from "../src/utils/combat/reactionResolution.js";
import {
  DOMINANT_CONTROL_TYPES,
  DOMINANT_RESPONSE_TYPES,
  claimDominantControlModifier,
  createDominantControlState,
  getLegalDominantResponses,
} from "../src/utils/combat/dominantOpeningResolution.js";
import {
  createTacticalReactionRuntime,
  lockTacticalReactionWindow,
  openTacticalReactionWindow,
  submitTacticalReactionResponse,
} from "../src/utils/combat/tacticalReactionWindow.js";
import {
  createTacticalPostParryRuntime,
} from "../src/utils/combat/tacticalPostParryWindow.js";
import { createTacticalPulseRuntime } from "../src/utils/combat/tacticalPulseResolver.js";

const registry = new Map();
const base = buildCanonicalReactionLifecycleRecord({
  opportunityId: "source:1:riposte",
  triggerType: "advantageous-parry",
  sourceExecutionId: "source:1",
  generationId: 4,
  combatSession: 4,
  actorId: "defender",
  targetId: "attacker",
  depth: 1,
  legalResponses: ["riposte", "decline"],
  mode: "initiative-actions",
});
assert.equal(registerCanonicalReaction(registry, base).accepted, true);
assert.equal(registerCanonicalReaction(registry, base).reason, "duplicate_reaction_opportunity");
assert.equal(transitionCanonicalReaction(registry, base.reactionId, REACTION_STATUSES.ADMITTED, { selectedResponse: "riposte" }).accepted, true);
assert.equal(transitionCanonicalReaction(registry, base.reactionId, REACTION_STATUSES.CONSUMED).accepted, true);
assert.equal(transitionCanonicalReaction(registry, base.reactionId, REACTION_STATUSES.RESOLVING).accepted, true);
assert.equal(transitionCanonicalReaction(registry, base.reactionId, REACTION_STATUSES.RESOLVED).accepted, true);
assert.equal(transitionCanonicalReaction(registry, base.reactionId, REACTION_STATUSES.RESOLVED).accepted, false, "one opening cannot resolve twice");

const decline = buildCanonicalReactionLifecycleRecord({
  opportunityId: "source:2:dominant",
  triggerType: "dominant-parry",
  sourceExecutionId: "source:2",
  generationId: 4,
  actorId: "defender",
  targetId: "attacker",
  legalResponses: ["bind", "decline"],
});
registerCanonicalReaction(registry, decline);
transitionCanonicalReaction(registry, decline.reactionId, REACTION_STATUSES.ADMITTED, { selectedResponse: "decline" });
transitionCanonicalReaction(registry, decline.reactionId, REACTION_STATUSES.CONSUMED);
transitionCanonicalReaction(registry, decline.reactionId, REACTION_STATUSES.RESOLVING);
assert.equal(transitionCanonicalReaction(registry, decline.reactionId, REACTION_STATUSES.DECLINED, { terminalReason: "manual-decline" }).accepted, true);
assert.equal(registry.get(decline.reactionId).terminalReason, "manual-decline");

const expired = buildCanonicalReactionLifecycleRecord({
  opportunityId: "source:3:reaction",
  triggerType: "attack-defense",
  sourceExecutionId: "source:3",
  generationId: 4,
  actorId: "defender",
  targetId: "attacker",
  legalResponses: ["parry", "decline"],
});
registerCanonicalReaction(registry, expired);
assert.equal(transitionCanonicalReaction(registry, expired.reactionId, REACTION_STATUSES.EXPIRED, { terminalReason: "turn-advanced" }).accepted, true);
assert.equal(transitionCanonicalReaction(registry, expired.reactionId, REACTION_STATUSES.ADMITTED).accepted, false, "expired opportunity cannot execute later");

assert.equal(MAX_IMMEDIATE_REACTION_DEPTH, 1);
assert.equal(validateCanonicalReactionOwnership({
  opportunity: { ...base, reactionId: "too-deep" },
  registryRecord: { ...base, reactionId: "too-deep", depth: 2, reactionDepth: 2, status: REACTION_STATUSES.OFFERED },
  generationId: 4,
  sourceExecutionId: "source:1",
  actorId: "defender",
  targetId: "attacker",
}).reason, "reaction_depth_cap");

const tacticalRegistry = new Map();
const reactionRuntime = createTacticalReactionRuntime({
  generationId: 4,
  combatSession: 4,
  reactionRegistry: tacticalRegistry,
});
const postParryRuntime = createTacticalPostParryRuntime({
  generationId: 4,
  combatSession: 4,
  reactionRegistry: tacticalRegistry,
});
assert.equal(reactionRuntime.reactionRegistry, postParryRuntime.reactionRegistry, "Tactical Pulse windows share one canonical lifecycle registry");
const externalPulseRegistry = new Map();
const pulseRuntime = createTacticalPulseRuntime({
  generationId: 4,
  combatSession: 4,
  reactionRegistry: externalPulseRegistry,
});
assert.equal(
  pulseRuntime.actionRuntime.reactionRegistry,
  externalPulseRegistry,
  "Tactical Pulse accepts the page-level canonical reaction registry",
);
const fighters = [
  { id: "attacker", currentHP: 20, team: "party", controlMode: "manual", attacks: [{ name: "Sword", type: "melee" }] },
  { id: "defender", currentHP: 20, team: "enemy", controlMode: "manual", attacks: [{ name: "Sword", type: "melee", canParry: true }] },
];
const intent = {
  generationId: 4,
  combatSession: 4,
  actionIntentId: "intent:1",
  actorId: "attacker",
  targetActorId: "defender",
  actionType: "melee",
  weaponFamily: "sword",
  weaponId: "sword",
};
const opened = openTacticalReactionWindow({
  runtime: reactionRuntime,
  intent,
  executionKey: "execution:1",
  pulseIndex: 1,
  fighters,
  getControlMode: () => "manual",
});
assert.equal(opened.accepted, true);
assert.equal(tacticalRegistry.get(opened.window.reactionWindowId).status, REACTION_STATUSES.OFFERED);
const submitted = submitTacticalReactionResponse({
  runtime: reactionRuntime,
  reactionWindowId: opened.window.reactionWindowId,
  responderId: "defender",
  responseType: "parry",
  pulseIndex: 1,
});
assert.equal(submitted.accepted, true);
assert.equal(tacticalRegistry.get(opened.window.reactionWindowId).status, REACTION_STATUSES.ADMITTED);
assert.equal(lockTacticalReactionWindow({
  runtime: reactionRuntime,
  reactionWindowId: opened.window.reactionWindowId,
  pulseIndex: 2,
}).accepted, true);
assert.equal(tacticalRegistry.get(opened.window.reactionWindowId).status, REACTION_STATUSES.CONSUMED);

const exchange = {
  exchangeId: "exchange:dominant",
  generationId: 4,
  round: 1,
  attackExecutionKey: "attack:1",
  tempoOwnerId: "defender",
  openingAgainstId: "attacker",
  parryOutcome: "parry_dominant",
  consumed: false,
};
const dominantContext = {
  exchange,
  reactor: fighters[1],
  target: fighters[0],
  defenseType: "weapon",
  defenseOutcome: "parry_dominant",
  generationId: 4,
  round: 1,
  sourceAttackExecutionKey: "attack:1",
  parryingWeapon: fighters[1].attacks[0],
  attackingWeapon: fighters[0].attacks[0],
  riposteEligible: true,
  grappleLegal: true,
  currentStamina: 10,
  legalDisengagementDestinations: [{ x: 0, y: 0 }],
  engaged: true,
};
const manualLegal = getLegalDominantResponses(dominantContext);
const aiLegal = getLegalDominantResponses(dominantContext);
assert.deepEqual(manualLegal, aiLegal, "manual and AI receive the same canonical dominant-response set");
assert.ok(manualLegal.includes(DOMINANT_RESPONSE_TYPES.RIPOSTE));
assert.ok(manualLegal.includes(DOMINANT_RESPONSE_TYPES.MAINTAIN_BIND));
assert.ok(manualLegal.includes(DOMINANT_RESPONSE_TYPES.DECLINE));

const controlOpportunity = {
  sourceExchangeId: "exchange:dominant",
  generationId: 4,
  round: 1,
};
const control = createDominantControlState({
  type: DOMINANT_CONTROL_TYPES.BIND,
  opportunity: controlOpportunity,
  controllerId: "defender",
  controlledActorId: "attacker",
  controllerWeaponId: "defender-sword",
  controlledWeaponId: "attacker-sword",
});
const controlRegistry = new Map([[control.controlId, control]]);
assert.equal(claimDominantControlModifier({
  registry: controlRegistry,
  actorId: "attacker",
  againstActorId: "defender",
  weaponId: "attacker-sword",
  kind: "attack",
}).applied, true);
assert.equal(claimDominantControlModifier({
  registry: controlRegistry,
  actorId: "attacker",
  againstActorId: "defender",
  weaponId: "attacker-sword",
  kind: "attack",
}).applied, false, "one-use control cannot be consumed twice");

const combatPageSource = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPageSource, /dominantResponseRegistryRef = reactionOpportunityRegistryRef/, "dominant and riposte offers share one CombatPage registry");
assert.match(combatPageSource, /reactionRegistry: reactionOpportunityRegistryRef\.current/, "Tactical Pulse uses the same page-level canonical registry");
assert.match(combatPageSource, /scheduleCanonicalOpportunityAttackRef\.current\?\.\(/, "movement AoO routes through the canonical opportunity scheduler");
assert.doesNotMatch(combatPageSource, /attackRef\.current\(attackerForAoO/, "legacy direct AoO attack callback is removed");
assert.match(combatPageSource, /reactionAdmission: resolving\.reaction/, "AoO reaches attack through canonical reaction admission");
assert.match(combatPageSource, /triggerType: "stop-thrust"[\s\S]*reactionType: "weapon-measure-control"/, "stop-thrust uses the canonical opportunity lifecycle");
assert.match(combatPageSource, /executeCanonicalGrappleAction\(\{[\s\S]*reactionAdmission:/, "dominant grapple entry retains canonical grapple dispatch");

console.log("canonical reaction orchestration consolidation tests passed");
