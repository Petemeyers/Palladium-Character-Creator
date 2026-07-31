import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyExertionProfileToFighter,
  getExertionProfile,
  getStaminaDebtFloor,
  resolveExertionActionPolicy,
  resolveSurvivalOverride,
} from "../src/utils/combat/exertionState.js";
import {
  calculateEffectiveRoutedMovement,
  recoverCombatStamina,
  spendCombatStamina,
} from "../src/utils/combatStamina.js";
import { resolveAttackOverexertionPolicy } from "../src/utils/combat/combatActionRouting.js";

let assertions = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  assertions += 1;
};
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  assertions += 1;
};

const baseFighter = {
  id: "runner",
  name: "Runner",
  maxStamina: 20,
  currentStamina: 1,
  combatStamina: { maxStamina: 20, currentStamina: 1, authority: "combat-stamina" },
  fatigueState: { maxStamina: 20, currentStamina: 1, authority: "combat-stamina", status: "ready", penalties: {} },
  currentHP: 12,
  maxHP: 20,
};

const crossing = spendCombatStamina({
  fighter: baseFighter,
  amount: 2,
  reason: "sprint",
  allowOverexertion: true,
});
check(crossing.accepted, "Crossing below zero must be accepted when overexertion is authorized.");
equal(crossing.nextStamina, -1, "Stamina must become negative instead of clamping to zero.");
equal(crossing.updated.combatStamina.currentStamina, -1, "Canonical stamina must retain the debt.");
equal(crossing.updated.fatigueState.currentStamina, -1, "Compatibility fatigue must match canonical debt.");
check(crossing.updated.statusEffects.includes("EXHAUSTED"), "Crossing zero must add EXHAUSTED.");

const noThreatOverride = resolveSurvivalOverride({ fighter: crossing.updated, actionType: "attack" });
check(!noThreatOverride.active, "An exhausted AI fighter without danger should feel the recovery urge.");
const noThreatPolicy = resolveExertionActionPolicy({
  currentStamina: -1,
  maxStamina: 20,
  cost: 2,
  survivalOverride: noThreatOverride,
});
check(!noThreatPolicy.canAttempt, "Negative-stamina action without an override must be blocked.");
equal(noThreatPolicy.reason, "body-demands-recovery", "Blocked debt action should identify the body's stop signal.");

const hunter = { id: "hunter", currentHP: 10, maxHP: 10 };
const dangerOverride = resolveSurvivalOverride({
  fighter: crossing.updated,
  opponent: hunter,
  distanceFeet: 10,
  immediateThreat: true,
  actionType: "panic-run",
});
check(dangerOverride.active, "A nearby lethal threat must activate survival override.");
equal(dangerOverride.reason, "immediate-lethal-threat", "The override should record its physiological cause.");

const dangerPolicy = resolveAttackOverexertionPolicy({
  currentStamina: -1,
  maxStamina: 20,
  attackCost: 2,
  survivalOverride: dangerOverride,
});
check(dangerPolicy.canAttempt, "Survival override must allow continued exertion below zero.");
check(dangerPolicy.allowOverexertion, "Debt action must explicitly authorize overexertion.");
equal(dangerPolicy.projectedStamina, -3, "Debt must deepen by the full action cost.");

const deeper = spendCombatStamina({
  fighter: crossing.updated,
  amount: 2,
  reason: "panic-run",
  allowOverexertion: dangerPolicy.allowOverexertion,
});
equal(deeper.nextStamina, -3, "Authorized survival effort must deepen the debt.");
check(deeper.updated.exertionState.operatingOnDebt, "The fighter must be marked as operating on debt.");

const recovered = recoverCombatStamina({ fighter: deeper.updated, amount: 2, reason: "catch-breath" });
equal(recovered.nextStamina, -1, "Brief recovery must repay debt before creating positive stamina.");

const recoveredAboveZero = recoverCombatStamina({ fighter: deeper.updated, amount: 5, reason: "extended-catch-breath" });
equal(recoveredAboveZero.nextStamina, 2, "Recovery must repay debt before restoring positive reserve.");
check(!recoveredAboveZero.updated.statusEffects.includes("EXHAUSTED"), "Recovering above zero must clear the exertion EXHAUSTED marker.");
check(!recoveredAboveZero.updated.exertionState.exhaustedStatusApplied, "Recovered fighters must clear exertion marker ownership.");

const collapseRiskFighter = applyExertionProfileToFighter(baseFighter, -8, 20);
equal(collapseRiskFighter.fatigueState.status, "collapse_risk", "Forty-percent debt must enter the turn-start collapse-check state.");

const severeProfile = getExertionProfile(-12, 20);
equal(severeProfile.band, "critical-exhaustion", "Sixty-percent debt must be critical exhaustion.");
check(severeProfile.penalties.attack <= -4, "Critical exhaustion must impair attacks.");
check(severeProfile.penalties.speed <= 0.5, "Critical exhaustion must sharply reduce speed.");
check(severeProfile.collapseCheckRequired, "Critical exhaustion must require collapse checks.");

const routedFighter = applyExertionProfileToFighter({
  ...baseFighter,
  moraleState: { status: "ROUTED" },
}, -4, 20);
const panicMove = calculateEffectiveRoutedMovement({
  fighter: routedFighter,
  baseDistanceFeet: 30,
  movementType: "panic",
  staminaProfile: { band: "exhausted" },
  armorProfile: { band: "none" },
});
check(panicMove.distanceFeet > 0, "A routed fighter under survival override must be able to keep fleeing below zero.");
check(panicMove.distanceFeet < 30, "Negative-stamina flight must be slower than fresh flight.");
check(panicMove.survivalOverrideActive, "Panic movement must report the active survival override.");

const floor = getStaminaDebtFloor(20);
equal(floor, -20, "The physiological floor must equal negative maximum stamina.");
const floorSpend = spendCombatStamina({
  fighter: applyExertionProfileToFighter(baseFighter, -19, 20),
  amount: 2,
  reason: "desperate-action",
  allowOverexertion: true,
});
check(!floorSpend.accepted, "An action that would exceed the hard floor must be rejected.");
equal(floorSpend.reason, "exertion-floor-reached", "Hard-floor rejection must be explicit.");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const combatPage = fs.readFileSync(path.join(projectRoot, "src/pages/CombatPage.jsx"), "utf8");
check(!combatPage.includes("minimum=0"), "CombatPage must no longer enforce a zero minimum.");
check(combatPage.includes("survival-override-activated"), "CombatPage must emit survival override events.");

const grappleActions = fs.readFileSync(path.join(projectRoot, "src/utils/combatActionHandlers/grappleActions.js"), "utf8");
check(grappleActions.includes("const debtFloor = -resolvedMaxStamina"), "Grapple compatibility synchronization must retain negative stamina.");

console.log(`Negative stamina survival-override tests passed: ${assertions} assertions.`);
