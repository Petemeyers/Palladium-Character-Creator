import assert from "node:assert/strict";
import fs from "node:fs";
import { createPhase3RiposteScenario } from "../src/utils/combat/phase3RiposteScenarios.js";

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const panel = fs.readFileSync(new URL("../src/components/RiposteOpportunityPanel.jsx", import.meta.url), "utf8");
let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
};

test("player advantageous parry creates opportunity", () => {
  const scenario = createPhase3RiposteScenario();
  assert.equal(scenario.eligibility.eligible, true);
  assert.equal(scenario.opportunity.openingLevel, 1);
});
test("player accepting creates exactly one riposte", () => {
  const scenario = createPhase3RiposteScenario({ decision: "accept" });
  assert.equal(scenario.immediateAttackCount, 1);
  assert.equal(scenario.defenderActionsAfterRiposte, scenario.defenderActionsBeforeRiposte);
});
test("player declining creates no attack and resumes source once", () => {
  const scenario = createPhase3RiposteScenario({ decision: "decline" });
  assert.equal(scenario.immediateAttackCount, 0);
  assert.equal(scenario.sourceFinalizerCount, 1);
});
test("AI advantageous opening automatically resolves one reaction", () => {
  assert.equal(createPhase3RiposteScenario({ openingLevel: 1 }).immediateAttackCount, 1);
});
test("AI dominant opening automatically resolves one depth-one reaction", () => {
  const scenario = createPhase3RiposteScenario({ openingLevel: 2 });
  assert.equal(scenario.opportunity.openingLevel, 2);
  assert.equal(scenario.maximumReactionDepth, 1);
});
test("shield defense routes follow-up through selected weapon", () => {
  assert.match(combatPage, /selectLegalRiposteAttack\(\{/);
  assert.match(combatPage, /attackDataOverride: legalAttack/);
});
test("riposte target may successfully defend", () => {
  const event = createPhase3RiposteScenario({ targetDefends: true }).events.find((entry) => entry.eventType === "reaction_attack_resolved");
  assert.equal(event.defended, true);
  assert.equal(event.enteredImpact, false);
});
test("failed riposte defense enters impact and armor contact", () => {
  const event = createPhase3RiposteScenario({ targetDefends: false }).events.find((entry) => entry.eventType === "reaction_attack_resolved");
  assert.equal(event.enteredImpact, true);
  assert.equal(event.armorContact, true);
  assert.match(combatPage, /resolveArmorContact\(/);
});
test("reaction ending combat does not resume ordinary turn", () => {
  const scenario = createPhase3RiposteScenario({ reactionEndsCombat: true });
  assert.equal(scenario.combatEnded, true);
  assert.equal(scenario.ordinaryTurnResumed, false);
});
test("larger battle resumes correct next fighter", () => {
  const scenario = createPhase3RiposteScenario({ largerBattle: true });
  assert.equal(scenario.nextFighterId, "knight-c");
  assert.deepEqual(scenario.initiativeAfter, scenario.initiativeBefore);
});
test("page awaits riposte before calculating final hit path", () => {
  const awaitIndex = combatPage.indexOf("await resolveImmediateRiposte()");
  const didHitIndex = combatPage.indexOf("let didHit =", awaitIndex);
  assert.ok(awaitIndex > 0 && didHitIndex > awaitIndex);
});
test("sequential and tactical ripostes each use the canonical consumption helper", () => {
  assert.equal((combatPage.match(/consumeRiposteOpening\(\{/g) || []).length, 2);
  assert.match(combatPage, /tactical-post-parry-riposte/);
});
test("reaction-depth cap suppresses counter-riposte", () => {
  assert.match(combatPage, /isImmediateRiposte \|\|[\s\S]{0,100}sourceExchange\.reactionDepth >= 1/);
  assert.equal(createPhase3RiposteScenario().counterRiposteCount, 0);
});
test("insufficient stamina declines without attack", () => {
  const scenario = createPhase3RiposteScenario({ stamina: 3, staminaCost: 4 });
  assert.equal(scenario.eligibility.reason, "insufficient_stamina");
  assert.equal(scenario.immediateAttackCount, 0);
});
test("manual controls are compact and target-locked", () => {
  assert.match(panel, />\s*Riposte\s*</);
  assert.match(panel, />\s*Decline\s*</);
  assert.doesNotMatch(panel, /Select|targetId|executionKey/);
  assert.match(combatPage, /<RiposteOpportunityPanel/);
});
test("reaction attack suppresses action spend but not stamina pipeline", () => {
  assert.match(combatPage, /suppressActionSpend: true/);
  assert.match(combatPage, /calculateAttackStaminaCost\(\{/);
  assert.match(combatPage, /source: "attack-roll-pre-stamina"/);
});
test("recovery penalty is linked only to immediate riposte defense", () => {
  assert.match(combatPage, /if \(isImmediateRiposte\)[\s\S]{0,120}recoveryPenalty/);
  assert.match(combatPage, /eventType: "riposte-recovery-penalty-applied"/);
});
test("reaction execution key retains parent and source exchange identity", () => {
  assert.match(combatPage, /parentAttackExecutionKey: reactionAdmission\?\.sourceAttackExecutionKey/);
  assert.match(combatPage, /sourceExchangeId: reactionAdmission\?\.sourceExchangeId/);
});
test("parent snapshot refresh prevents stale HP restoration", () => {
  assert.match(combatPage, /for \(const snapshotFighter of updated\)/);
  assert.match(combatPage, /Object\.assign\(snapshotFighter, authoritative\)/);
});
test("source and reaction each finalize once in deterministic scenario", () => {
  const scenario = createPhase3RiposteScenario();
  assert.equal(scenario.sourceFinalizerCount, 1);
  assert.equal(scenario.reactionFinalizerCount, 1);
});

console.log(`Phase 3 riposte integration tests: ${passed}/${passed} passed`);
