import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCanonicalAttackRollEvent } from "../src/utils/combat/canonicalAttackRollEvent.js";
import { buildStaleDamageApplicationDiagnostic } from "../src/utils/combat/canonicalAttackOwnershipDiagnostic.js";
import { resolveCanonicalRangedContext } from "../src/utils/combat/liveWildlifeConcealmentRanged.js";
import { applyFatiguePenalties } from "../src/utils/fatigueSystem.js";
import {
  assignBattleLocalIdentities,
  disambiguateDuplicateCombatActorNames,
  getCombatDisplayName,
} from "../src/utils/combatActorIdentity.js";
import { resolveCanonicalSurpriseAttack } from "../src/utils/combat/canonicalSurpriseAttack.js";
import { getPlayerAiActionCompletion } from "../src/utils/playerAiTurnResult.js";
import { buildInitiativePresentation } from "../src/utils/combat/initiativeIdentity.js";

let passed = 0;
const test = async (name, run) => {
  await run();
  passed += 1;
  console.log(`PASS ${name}`);
};

await test("takeover completion remains pending until admitted action settles", async () => {
  let settle;
  const completion = new Promise((resolve) => { settle = resolve; });
  const selected = { action: "attack", admitted: true, completion };
  let takeoverCompleted = false;
  const waiting = getPlayerAiActionCompletion(selected).then(() => { takeoverCompleted = true; });
  await Promise.resolve();
  assert.equal(takeoverCompleted, false);
  settle({ status: "completed", hpMutations: 1 });
  await waiting;
  assert.equal(takeoverCompleted, true);
});

await test("source wires delayed attack settlement into player AI ownership", () => {
  const ai = fs.readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
  const page = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
  assert.match(ai, /createPlayerAiActionResult\("attack", \{ admitted: true, completion \}\)/);
  assert.match(ai, /const attackResult = await attack/);
  assert.match(ai, /status: "completed", result: attackResult/);
  assert.match(page, /const actionCompletion = getPlayerAiActionCompletion/);
  assert.match(page, /await Promise\.race\(\[\s*Promise\.resolve\(actionCompletion\)/);
  assert.match(page, /const refreshedDamageFighters = liveDamageFighters\.map/);
  assert.match(page, /updated\.push\(\.\.\.refreshedDamageFighters\)/);
  assert.doesNotMatch(page, /updated\.push\(\.\.\.liveDamageFighters\.map/);
  assert.doesNotMatch(page, /fatiguePenalty = fatigued(?:Attacker|Shooter)\.bonuses\?\.attack/);
});

await test("fatigue metadata contains the actual negative delta", () => {
  const fresh = { bonuses: { attack: 6 } };
  assert.equal((applyFatiguePenalties(fresh).bonuses.attack - fresh.bonuses.attack), 0);
  const tired = { bonuses: { attack: 6 }, fatigueState: { status: "fatigued", combatPenalty: -2 } };
  assert.equal(applyFatiguePenalties(tired).bonuses.attack - tired.bonuses.attack, -2);
});

await test("ranged component totals are canonical for all roll outcomes", () => {
  const ranged = resolveCanonicalRangedContext({
    actor: { id: "archer", rangedTrainingProfile: { weaponFamily: "longbow", specializationBonus: 2, proficiencyBonus: 0 } },
    target: { id: "target" }, attack: { name: "Longbow", type: "ranged", range: 150, weaponFamily: "longbow" },
    distanceFt: 80, baseAttackBonus: 4, fatigueModifier: -1,
  });
  assert.equal(ranged.auditValid, true);
  assert.equal(ranged.components.fatigue, -1);
  for (const outcome of ["critical-hit", "hit", "miss", "critical-miss"]) {
    const event = buildCanonicalAttackRollEvent({
      naturalRoll: outcome === "critical-hit" ? 20 : outcome === "critical-miss" ? 1 : 10,
      modifier: ranged.total, total: 10 + ranged.total, defense: 12, outcome,
      modifierComponents: { ...ranged.components, fatigueModifierApplied: ranged.components.fatigue, fatigue: undefined },
    });
    assert.equal(event.modifierArithmeticValid, true, outcome);
  }
});

await test("stale damage diagnostic distinguishes current and stale ownership", () => {
  const execution = { id: "attack-1", generation: 4, combatSession: "combat-1", initiativeTurnId: "turn-1" };
  const current = buildStaleDamageApplicationDiagnostic({
    attackerId: "a", targetId: "b", executionKey: "attack-1", execution,
    activeActorId: "a", activeInitiativeTurnId: "turn-1", activeExecutionKey: "attack-1",
    activeGeneration: 4, activeCombatSession: "combat-1", combatActive: true, target: { id: "b" },
  });
  assert.deepEqual(Object.values(current).filter((value) => value === false), []);
  const stale = buildStaleDamageApplicationDiagnostic({ ...current, execution, activeGeneration: 5, target: { id: "b" }, rejectionReason: null });
  assert.equal(stale.generationMatches, false);
  assert.equal(stale.rejectionReason, "generation-mismatch");
});

await test("twenty duplicate templates receive immutable non-recursive labels", () => {
  const actors = assignBattleLocalIdentities(Array.from({ length: 20 }, (_, index) => ({
    id: `longbowman-${index + 1}`, name: "Longbowman", team: index < 10 ? "party" : "enemy",
  })));
  assert.equal(new Set(actors.map(getCombatDisplayName)).size, 20);
  const line = `${getCombatDisplayName(actors[10])} attacks ${getCombatDisplayName(actors[0])}.`;
  const normalized = disambiguateDuplicateCombatActorNames(line, { roster: actors, activeActor: actors[10] });
  assert.equal(normalized, line);
  assert.doesNotMatch(normalized, /Enemy Enemy|Party Party|\b\d{2} \d{2}\b/);
  const initiative = buildInitiativePresentation(
    actors.map((actor, index) => ({ ...actor, initiativeEligible: true, initiativeRoll: 20 - index, initiativeTotal: 20 - index, initiativeBreakdown: { total: 0 } })),
    actors,
  );
  assert.deepEqual(initiative.results.map((entry) => entry.displayName), actors.map(getCombatDisplayName));
});

await test("surprise grants attack plus one multiplier and never flat damage", () => {
  const surprise = resolveCanonicalSurpriseAttack({ actor: { profession: "Longbowman" }, eligible: true });
  assert.equal(surprise.allowed, true);
  assert.equal(surprise.attackBonus, 2);
  assert.equal(surprise.damageMultiplier, 2);
  assert.equal(surprise.flatDamageBonus, 0);
  assert.equal(resolveCanonicalSurpriseAttack({ eligible: true, alreadyUsed: true }).allowed, false);
  assert.equal(resolveCanonicalSurpriseAttack({ eligible: false }).allowed, false);
  assert.equal(resolveCanonicalSurpriseAttack({ actor: { profession: "Ranger" }, eligible: true }).attackBonus, 4);
  const visibilitySource = fs.readFileSync(new URL("../src/utils/aiVisibilityFilter.js", import.meta.url), "utf8");
  assert.match(visibilitySource, /attackBonus: bonus\.attackBonus/);
  assert.doesNotMatch(visibilitySource, /bonus\.attack\b/);
});

console.log(`${passed}/${passed} browser-log regression tests passed`);
