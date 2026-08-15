import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spendCombatStamina } from "../src/utils/combatStamina.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const grapplingSystemSource = fs.readFileSync(
  path.resolve(here, "../src/utils/grapplingSystem.js"),
  "utf8",
);

// Load the low-level grapple engine in isolation (its import graph is not
// resolvable under plain node ESM), with pure stubs for spatial/size helpers.
const strippedSource = grapplingSystemSource.replace(/^import[\s\S]*?;\s*$/gm, "");
const prelude = `
const getCombinedGrappleModifiers = () => ({ autoGrapple: false, psModifier: 0, psDiff: 0, attackBonus: 0, defenderBlockPenalty: 0 });
const getSizeCategory = () => "medium";
const assessGrappleSizeOutcome = () => ({ outcome: "normal" });
const canLiftAndThrow = () => ({ canThrow: true });
const getLeveragePenalty = () => 0;
const canCarryTarget = () => true;
const linkCombinedBodies = () => null;
const COMBINED_ROLES = {};
const COMBINED_MODES = {};
const canFly = () => false;
const isFlying = () => false;
const getAltitude = () => 0;
const normalizeCanonicalD20Roll = (roll, { modifier = 0 } = {}) => ({
  ok: Number.isInteger(roll) && roll >= 1 && roll <= 20,
  total: roll + (Number(modifier) || 0),
  naturalRoll: roll,
  rejectionReason: null,
});
const restoreRetainedWeaponAfterGrapple = () => ({ restored: false });
`;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(`${prelude}${strippedSource}`).toString("base64")}`;
const { attemptGrapple, breakFree, GRAPPLE_STATES } = await import(moduleUrl);
const grappleActionsSource = fs.readFileSync(
  path.resolve(here, "../src/utils/combatActionHandlers/grappleActions.js"),
  "utf8",
);
const combatPageSource = fs.readFileSync(
  path.resolve(here, "../src/pages/CombatPage.jsx"),
  "utf8",
);

// ---------------------------------------------------------------------------
// 1. No low-level mutation: canonical grapple mechanics must not touch stamina
// ---------------------------------------------------------------------------

function makeCanonicalRoller(rollKind, values) {
  const admission = {
    generationId: "phase6-generation",
    initiativeTurnId: "phase6-turn",
    actionToken: "phase6-action-token",
    actionSequence: 1,
    actorId: "phase6-attacker",
    opponentId: "phase6-defender",
    executionKey: "phase6-execution-key",
  };
  let index = 0;
  const roll = () => values[Math.min(index++, values.length - 1)];
  Object.defineProperties(roll, {
    canonicalAdmission: { value: admission, enumerable: false },
    canonicalActionToken: { value: admission.actionToken, enumerable: false },
    canonicalExecutionKey: { value: admission.executionKey, enumerable: false },
    canonicalRollKind: { value: rollKind, enumerable: false },
  });
  return roll;
}

function makeFighter(id, name, overrides = {}) {
  return {
    id,
    name,
    attributes: { PP: 12, PS: 14 },
    statusEffects: [],
    fatigueState: {
      currentStamina: 8,
      maxStamina: 10,
      status: "ready",
      penalties: { attack: 0, block: 0, evade: 0, ps: 0, speed: 1.0 },
    },
    ...overrides,
  };
}

function assertStaminaUntouched(fighter, label) {
  assert.equal(
    fighter.fatigueState.currentStamina,
    8,
    `${label}: low-level grapple code must not change fatigueState.currentStamina`,
  );
  assert.deepEqual(
    fighter.statusEffects,
    [],
    `${label}: low-level grapple code must not push status effects such as EXHAUSTED`,
  );
}

{
  const attacker = makeFighter("phase6-attacker", "Phase6 Attacker");
  const defender = makeFighter("phase6-defender", "Phase6 Defender");
  const result = attemptGrapple(
    attacker,
    defender,
    makeCanonicalRoller("opposed-grapple-initiation", [1, 20]),
    { q: 0, r: 0 },
    { q: 1, r: 0 },
  );
  assert.equal(result.success, false, "roll of 1 vs 20 must fail the grapple");
  assertStaminaUntouched(attacker, "failed attemptGrapple attacker");
  assertStaminaUntouched(defender, "failed attemptGrapple defender");
}

{
  const attacker = makeFighter("phase6-attacker", "Phase6 Attacker");
  const defender = makeFighter("phase6-defender", "Phase6 Defender");
  const result = attemptGrapple(
    attacker,
    defender,
    makeCanonicalRoller("opposed-grapple-initiation", [20, 1]),
    { q: 0, r: 0 },
    { q: 1, r: 0 },
  );
  const resolvedAttacker = result.attacker || attacker;
  const resolvedDefender = result.defender || defender;
  assertStaminaUntouched(resolvedAttacker, "winning attemptGrapple attacker");
  assertStaminaUntouched(resolvedDefender, "winning attemptGrapple defender");
}

{
  const opponent = makeFighter("phase6-defender", "Phase6 Holder", {
    grappleState: {
      state: GRAPPLE_STATES.CLINCH,
      positionState: "standing",
      opponent: "phase6-attacker",
      isAttacker: true,
    },
  });
  const character = makeFighter("phase6-attacker", "Phase6 Escapee", {
    grappleState: {
      state: GRAPPLE_STATES.GRAPPLED,
      positionState: "standing",
      opponent: "phase6-defender",
      isAttacker: false,
    },
  });
  const result = breakFree(
    character,
    opponent,
    makeCanonicalRoller("break-free-opposed-roll", [20, 1]),
  );
  assert.notEqual(
    result.reason,
    "grapple-dice-boundary-without-canonical-claim-blocked",
    "canonical roller must be accepted by breakFree",
  );
  assertStaminaUntouched(character, "breakFree character");
  assertStaminaUntouched(opponent, "breakFree opponent");
}

// ---------------------------------------------------------------------------
// 2. Source contracts: single owner, no legacy drain, no snapshot compensation
// ---------------------------------------------------------------------------

assert.ok(
  !grapplingSystemSource.includes("drainStamina"),
  "grapplingSystem must not contain any legacy stamina drain",
);
assert.ok(
  !grapplingSystemSource.includes("combatFatigueSystem"),
  "grapplingSystem must not import the legacy fatigue mutation module",
);

assert.ok(
  grappleActionsSource.includes("if (canonicalStaminaCharged) return canonicalStaminaSpend;"),
  "canonical grapple spend must be guarded for exactly-once semantics",
);
assert.ok(
  !/StaminaBefore/.test(grappleActionsSource),
  "grapple handler must not keep pre-action stamina snapshots for restoration",
);
assert.ok(
  grappleActionsSource.includes("snapshotRestorationRemoved: true"),
  "stamina authority audit must report snapshot restoration removal",
);

// Stale actions must be rejected before canonical stamina commitment.
const staleGateIndex = grappleActionsSource.indexOf(
  'const preActionStaleReason = getStaleGrappleReason("grapple-action-entry")',
);
const firstSpendCallIndex = grappleActionsSource.indexOf("ensureCanonicalGrappleStamina();");
assert.ok(staleGateIndex > 0, "pre-action stale gate must exist");
assert.ok(
  staleGateIndex < firstSpendCallIndex,
  "stale grapple actions must be rejected before any canonical stamina spend",
);

// Commitment rule: stamina spends on attempt (before the dice claim), and a
// failed contest keeps the spend (no refund path outside hold-and-rest).
const preClaimSpendIndex = grappleActionsSource.indexOf(
  "if (!noRollAction && canonicalGrappleStaminaCost > 0)",
);
const resolutionClaimIndex = grappleActionsSource.indexOf(
  'source: "grapple-resolution-boundary"',
);
assert.ok(
  preClaimSpendIndex > 0 && preClaimSpendIndex < resolutionClaimIndex,
  "canonical grapple stamina must be committed before the roll claim",
);
const recoveryCallIndex = grappleActionsSource.indexOf("recoverCanonicalGrappleStamina({");
const holdAndRestIndex = grappleActionsSource.indexOf("case 'holdAndRest'");
const followingCaseIndex = grappleActionsSource.indexOf("case 'demandSurrender'");
assert.ok(
  recoveryCallIndex > holdAndRestIndex && recoveryCallIndex < followingCaseIndex,
  "stamina recovery must only exist inside the hold-and-rest action",
);
assert.equal(
  grappleActionsSource.indexOf("recoverCanonicalGrappleStamina({", recoveryCallIndex + 1),
  -1,
  "no other grapple path may recover (refund) stamina",
);

// Control parity: one frozen cost table, and the spend path must not choose a
// different stamina algorithm based on control mode.
assert.ok(
  grappleActionsSource.includes("const CANONICAL_GRAPPLE_STAMINA_COSTS = Object.freeze({"),
  "grapple stamina costs must come from the single frozen canonical table",
);
const ensureStart = grappleActionsSource.indexOf("const ensureCanonicalGrappleStamina = () => {");
const ensureEnd = grappleActionsSource.indexOf("const labelActor", ensureStart);
assert.ok(ensureStart > 0 && ensureEnd > ensureStart, "canonical spend helper must exist");
const ensureBody = grappleActionsSource.slice(ensureStart, ensureEnd);
assert.ok(
  !/controlMode|automatedControl/.test(ensureBody),
  "the canonical grapple spend algorithm must not branch on control mode",
);
assert.ok(
  ensureBody.includes("amount: canonicalGrappleStaminaCost"),
  "the spend amount must come from the canonical cost table",
);

// CombatPage context spend: single canonical algorithm plus duplicate guard.
assert.ok(
  combatPageSource.includes("spendCanonicalGrappleStamina: spendAdmittedGrappleStamina"),
  "CombatPage must provide the canonical grapple spend callback",
);
const contextSpendStart = combatPageSource.indexOf("const spendAdmittedGrappleStamina = ({");
const contextSpendEnd = combatPageSource.indexOf("recoverAdmittedGrappleStamina", contextSpendStart);
assert.ok(contextSpendStart > 0 && contextSpendEnd > contextSpendStart);
const contextSpendBody = combatPageSource.slice(contextSpendStart, contextSpendEnd);
assert.ok(
  /amount:\s*requestedSpend/.test(contextSpendBody),
  "the context spend must debit the requested canonical amount for every control mode",
);
assert.ok(
  contextSpendBody.includes('"grapple-stamina-already-charged"'),
  "duplicate grapple stamina charges must be idempotently suppressed",
);

// ---------------------------------------------------------------------------
// 3. Low-stamina behavior through the canonical authority
// ---------------------------------------------------------------------------

function staminaFighter(currentStamina, extra = {}) {
  return {
    id: "phase6-stamina",
    name: "Phase6 Stamina",
    maxStamina: 10,
    currentStamina,
    combatStamina: {
      maxStamina: 10,
      current: currentStamina,
      currentStamina,
      authority: "combat-stamina",
    },
    ...extra,
  };
}

const exactSpend = spendCombatStamina({
  fighter: staminaFighter(1),
  amount: 1,
  reason: "grapple",
});
assert.equal(exactSpend.accepted, true, "exact stamina must admit the grapple");
assert.equal(exactSpend.spent, 1);
assert.equal(exactSpend.nextStamina, 0);

const oneBelowSpend = spendCombatStamina({
  fighter: staminaFighter(1),
  amount: 2,
  reason: "grapple",
});
assert.equal(oneBelowSpend.accepted, false, "one point short must be rejected");
assert.equal(oneBelowSpend.reason, "insufficient-stamina");
assert.equal(oneBelowSpend.spent, 0, "a rejected spend must not debit stamina");

const zeroSpend = spendCombatStamina({
  fighter: staminaFighter(0),
  amount: 1,
  reason: "grapple",
});
assert.equal(zeroSpend.accepted, false, "zero stamina must be rejected");
assert.equal(zeroSpend.reason, "insufficient-stamina");

// ---------------------------------------------------------------------------
// 4. Alias synchronization after a canonical spend
// ---------------------------------------------------------------------------

const aliasSpend = spendCombatStamina({
  fighter: staminaFighter(9, { stamina: 9, currentstamina: 9, staminaCurrent: 9 }),
  amount: 1,
  reason: "grapple",
});
assert.equal(aliasSpend.accepted, true);
const updated = aliasSpend.updated;
assert.equal(updated.combatStamina.currentStamina, 8);
assert.equal(updated.currentStamina, 8, "currentStamina alias must match canonical value");
assert.equal(updated.currentstamina, 8, "currentstamina alias must match canonical value");
assert.equal(updated.staminaCurrent, 8, "staminaCurrent alias must match canonical value");
assert.equal(updated.stamina, 8, "legacy stamina alias must match canonical value");
assert.equal(
  updated.fatigueState.currentStamina,
  8,
  "compatibility fatigue state must mirror canonical stamina",
);

assert.ok(
  !combatPageSource.includes("applyGrappleStaminaRebate"),
  "CombatPage must not restore fatigueState via a legacy grapple stamina rebate",
);
assert.ok(
  !combatPageSource.includes("staminaRebateById"),
  "CombatPage must not compute a per-actor grapple stamina rebate",
);
assert.ok(
  !combatPageSource.includes("endurance reduces grapple fatigue"),
  "CombatPage must not log a legacy endurance rebate for grapple fatigue",
);

console.log("canonical grapple stamina ownership checks passed");
