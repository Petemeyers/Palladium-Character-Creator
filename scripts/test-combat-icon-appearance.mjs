import assert from "node:assert/strict";
import {
  commitSurrenderResolution,
  commitSurrenderResponse,
  createCanonicalSurrenderOffer,
  createSurrenderDecisionToken,
  createSurrenderLifecycleRegistry,
} from "../src/utils/combat/surrenderLifecycle.js";
import { getCombatIconAppearance } from "../src/utils/presentation/getCombatIconAppearance.js";
import { runCombatIconAppearanceScenarios } from "../src/utils/presentation/combatIconAppearanceScenarios.js";

const generationId = "icon-test-generation";
const party = { id: "party-1", name: "Knight", team: "party", alignment: "neutral-evil", currentHP: 20, maxHP: 20 };
const enemy = { id: "enemy-1", name: "Goblin Warrior", team: "enemy", alignment: "lawful-good", currentHP: 8, maxHP: 8 };
const appearance = (fighter, options = {}) => getCombatIconAppearance({ fighter, generationId, ...options });
const hasRing = (value, key, style = null) => value.rings.some((ring) => ring.key === key && (!style || ring.style === style));

// 1-6: allegiance is authoritative, alignment-independent, and renderer-compatible.
assert.equal(appearance({ ...party, team: undefined, isEnemy: undefined }).allegiance.key, "neutral", "alignment cannot infer allegiance");
assert.equal(appearance(party).allegiance.key, "party");
assert.equal(appearance(party).baseColor, "#2563eb", "Neutral Evil party actor remains blue");
assert.equal(appearance(enemy).allegiance.key, "enemy");
assert.equal(appearance(enemy).baseColor, "#dc2626", "Lawful Good enemy actor remains red");
assert.equal(appearance({ ...party, color: "#123456" }).baseColor, "#123456", "fighter.color is an explicit override");

// 7-10: stable-ID interaction layers coexist and remain distinct.
const active = appearance(party, { activeFighterId: party.id });
assert.ok(hasRing(active, "active", "glow"));
assert.equal(active.activeColor, "#ffd400");
const selected = appearance(party, { selectedFighterId: party.id });
assert.ok(hasRing(selected, "selected", "dashed"));
assert.ok(selected.scale > 1);
const targeted = appearance(enemy, { targetFighterId: enemy.id });
assert.ok(hasRing(targeted, "target", "reticle"));
assert.notEqual(targeted.targetColor, selected.selectionColor);
const duplicateNames = [{ ...party, id: "knight-a" }, { ...party, id: "knight-b" }];
assert.deepEqual(duplicateNames.map((fighter) => appearance(fighter, { activeFighterId: "knight-b" }).active), [false, true]);

// 11-18: canonical conditions are additive, ordered, marked, and accessible.
const routed = appearance({ ...enemy, moraleState: { status: "ROUTED" } });
assert.equal(routed.priorityReason, "routed");
assert.ok(hasRing(routed, "routed"));
const surrendered = appearance({ ...enemy, isSurrendered: true, combatState: "surrendered" });
assert.equal(surrendered.allegiance.baseColor, "#dc2626");
assert.equal(surrendered.status.key, "surrendered");
assert.ok(hasRing(surrendered, "surrendered", "solid"));
const captured = appearance({ ...enemy, isCaptured: true, combatState: "captured", prisonerState: { status: "prisoner" } }, { activeFighterId: enemy.id });
assert.equal(captured.status.key, "captured");
assert.ok(hasRing(captured, "captured"));
assert.equal(captured.active, false);
const grappled = appearance({ ...party, grappleState: { state: "grapple_standing", opponent: enemy.id } }, { activeFighterId: party.id });
assert.ok(hasRing(grappled, "grappled"));
assert.ok(hasRing(grappled, "active"), "grapple and active rings coexist");
const prone = appearance({ ...party, isProne: true });
assert.equal(prone.status.key, "prone");
assert.equal(prone.status.marker, "▼");
const unconscious = appearance({ ...enemy, isUnconscious: true }, { activeFighterId: enemy.id });
assert.equal(unconscious.status.key, "unconscious");
assert.ok(unconscious.opacity < 1);
assert.equal(unconscious.active, false);
const dead = appearance({ ...enemy, dead: true }, { activeFighterId: enemy.id, selectedFighterId: enemy.id });
assert.equal(dead.status.key, "dead");
assert.equal(dead.baseColor, "#111827");
assert.equal(dead.active, false);
assert.equal(dead.selected, false);

// 12, 19-22: surrender indicators are registry-owned, never modal-owned.
const refusalRegistry = createSurrenderLifecycleRegistry();
const refusalOffer = createCanonicalSurrenderOffer({ registry: refusalRegistry, surrenderingActor: enemy, receivingActor: party, reason: "test", generationId, round: 1, actionToken: "refusal-offer" });
const pending = appearance(refusalOffer.fighter, { surrenderRecord: refusalOffer.record });
assert.equal(pending.pendingSurrender, true);
assert.equal(pending.allegiance.key, "enemy");
assert.ok(hasRing(pending, "surrender-pending", "dashed"));
assert.equal(appearance(refusalOffer.fighter).pendingSurrender, false, "copied actor state cannot create pending marker");
const refused = commitSurrenderResponse({ registry: refusalRegistry, surrenderingActor: refusalOffer.fighter, token: createSurrenderDecisionToken({ record: refusalOffer.record, decisionOwnerId: party.id, phase: "response", actionToken: "refusal" }), response: "refuse" });
assert.equal(appearance(refused.fighter, { surrenderRecord: refusalOffer.record }).priorityReason, "allegiance-enemy");
const revokeRegistry = createSurrenderLifecycleRegistry();
const revokeOffer = createCanonicalSurrenderOffer({ registry: revokeRegistry, surrenderingActor: enemy, receivingActor: party, reason: "test", generationId, round: 1, actionToken: "revoke-offer" });
const accepted = commitSurrenderResponse({ registry: revokeRegistry, surrenderingActor: revokeOffer.fighter, token: createSurrenderDecisionToken({ record: revokeOffer.record, decisionOwnerId: party.id, phase: "response", actionToken: "accept" }), response: "accept" });
const revoked = commitSurrenderResolution({ registry: revokeRegistry, surrenderedActor: accepted.fighter, victor: party, token: createSurrenderDecisionToken({ record: revokeOffer.record, decisionOwnerId: party.id, phase: "victor-decision", actionToken: "revoke" }), decision: "revokeSurrenderAcceptance" });
assert.equal(appearance(revoked.fighter, { surrenderRecord: revokeOffer.record }).priorityReason, "allegiance-enemy");
assert.deepEqual(appearance(refused.fighter, { pendingManualSurrenderDecision: { phase: "response" } }), appearance(refused.fighter));
assert.equal(appearance(refusalOffer.fighter, { surrenderRecord: refusalOffer.record, generationId: "new-generation" }).pendingSurrender, false);
assert.equal(appearance(party, { activeFighterId: party.id, activeGenerationId: "old-generation" }).active, false);

// 25-26: helper purity, immutable output, and non-color communication.
const immutableActor = { ...party, grappleState: { state: "grapple_ground", opponent: enemy.id, positionState: "ground" } };
const before = structuredClone(immutableActor);
const frozenResult = appearance(immutableActor);
assert.deepEqual(immutableActor, before);
assert.equal(Object.isFrozen(frozenResult), true);
assert.equal(Object.isFrozen(frozenResult.rings), true);
for (const value of [routed, pending, surrendered, captured, grappled, prone, unconscious, dead]) {
  assert.ok(value.status.marker || value.status.label);
  assert.ok(value.accessibleLabel.includes(value.status.label));
}

const scenarios = runCombatIconAppearanceScenarios();
assert.ok(hasRing(scenarios.activeKnight, "active"));
assert.ok(hasRing(scenarios.selectedKnight, "selected"));
assert.ok(hasRing(scenarios.targetedGoblin, "target", "reticle"));
assert.ok(hasRing(scenarios.grappledKnight, "grappled"));
assert.equal(scenarios.proneGoblin.status.marker, "▼");
assert.equal(scenarios.pendingMinotaur.pendingSurrender, true);
assert.equal(scenarios.surrenderedMinotaur.status.key, "surrendered");
assert.equal(scenarios.capturedMinotaur.status.key, "captured");
assert.equal(scenarios.deadGoblin.status.key, "dead");

console.log("canonical combat icon appearance passed (26 requirements)");
