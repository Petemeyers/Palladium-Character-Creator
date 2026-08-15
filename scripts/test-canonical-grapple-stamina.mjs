import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  initializeCombatStamina,
  recoverCombatStamina,
  spendCombatStamina,
} from "../src/utils/combatStamina.js";
import { resolveAttackOverexertionPolicy } from "../src/utils/combat/combatActionRouting.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const grappleActionsPath = path.resolve(
  here,
  "../src/utils/combatActionHandlers/grappleActions.js",
);
const combatPagePath = path.resolve(here, "../src/pages/CombatPage.jsx");
const grappleSource = fs.readFileSync(grappleActionsPath, "utf8");
const combatPageSource = fs.readFileSync(combatPagePath, "utf8");

const splitAuthorityFighter = {
  id: "minotaur",
  name: "Minotaur",
  maxStamina: 32,
  currentStamina: 31,
  currentstamina: 31,
  staminaCurrent: 31,
  staminaAuthority: "combat-stamina",
  combatStamina: {
    maxStamina: 32,
    current: 31,
    currentStamina: 31,
    authority: "combat-stamina",
  },
  fatigueState: {
    maxStamina: 32,
    currentStamina: 29,
    authority: "combat-stamina",
    status: "ready",
  },
};

const initialized = initializeCombatStamina(splitAuthorityFighter);
assert.equal(
  initialized.combatStamina.currentStamina,
  31,
  "combatStamina must remain authoritative over a stale legacy fatigue value",
);
assert.equal(
  initialized.fatigueState.currentStamina,
  31,
  "initialization must mirror the authoritative value to compatibility fatigue state",
);

const spend = spendCombatStamina({
  fighter: splitAuthorityFighter,
  amount: 1,
  reason: "grapple",
});
assert.equal(spend.accepted, true);
assert.equal(spend.spent, 1);
assert.equal(spend.nextStamina, 30);
assert.equal(spend.updated.combatStamina.currentStamina, 30);
assert.equal(spend.updated.currentStamina, 30);
assert.equal(spend.updated.currentstamina, 30);
assert.equal(spend.updated.staminaCurrent, 30);
assert.equal(spend.updated.fatigueState.currentStamina, 30);

const zeroSpend = spendCombatStamina({
  fighter: {
    ...spend.updated,
    currentStamina: 0,
    currentstamina: 0,
    staminaCurrent: 0,
    combatStamina: {
      ...spend.updated.combatStamina,
      current: 0,
      currentStamina: 0,
    },
    fatigueState: {
      ...spend.updated.fatigueState,
      currentStamina: 0,
    },
  },
  amount: 1,
  reason: "grapple",
});
assert.equal(zeroSpend.accepted, false);
assert.equal(zeroSpend.reason, "insufficient-stamina");

const recovery = recoverCombatStamina({
  fighter: spend.updated,
  amount: 1,
  reason: "grapple-hold-and-rest",
});
assert.equal(recovery.accepted, true);
assert.equal(recovery.nextStamina, 31);
assert.equal(recovery.updated.combatStamina.currentStamina, 31);
assert.equal(recovery.updated.fatigueState.currentStamina, 31);

assert.equal(
  resolveAttackOverexertionPolicy({
    currentStamina: 0,
    attackCost: 1,
    alreadyOverexerted: false,
  }).reason,
  "body-demands-recovery",
  "zero stamina without a survival override must require recovery",
);
assert.equal(
  resolveAttackOverexertionPolicy({
    currentStamina: 1,
    attackCost: 2,
    alreadyOverexerted: false,
  }).allowOverexertion,
  true,
);
assert.equal(
  resolveAttackOverexertionPolicy({
    currentStamina: 1,
    attackCost: 2,
    alreadyOverexerted: true,
  }).reason,
  "overexertion-limit-reached",
);

const preClaimSpendIndex = grappleSource.indexOf(
  "if (!noRollAction && canonicalGrappleStaminaCost > 0)",
);
const canonicalClaimIndex = grappleSource.indexOf(
  'source: "grapple-resolution-boundary"',
);
assert.ok(preClaimSpendIndex > 0, "grapple stamina must have a pre-roll gate");
assert.ok(
  preClaimSpendIndex < canonicalClaimIndex,
  "canonical grapple stamina must be admitted before roll ownership is claimed",
);
assert.ok(
  grappleSource.includes('eventType: "grapple-stamina-spend-resolved"'),
  "grapple spend audit event must exist",
);
assert.ok(
  grappleSource.includes('eventType: "grapple-stamina-authority-audit"'),
  "post-action stamina authority audit must exist",
);
assert.ok(
  grappleSource.includes("legacyDrainRemoved: true"),
  "audit event must report that the legacy grapple drain has been removed",
);
assert.ok(
  grappleSource.includes("snapshotRestorationRemoved: true"),
  "audit event must report that stamina snapshot restoration has been removed",
);
const grapplingSystemPath = path.resolve(here, "../src/utils/grapplingSystem.js");
const grapplingSystemSource = fs.readFileSync(grapplingSystemPath, "utf8");
assert.ok(
  !grapplingSystemSource.includes("drainStamina"),
  "low-level grapplingSystem must not contain any legacy stamina drain",
);
assert.ok(
  grappleSource.includes(
    "staminaSpent: Number(canonicalStaminaSpend?.spent ?? canonicalStaminaSpend?.appliedSpend ?? 0)",
  ),
  "completion must report the actual canonical spend rather than a hard-coded value",
);
assert.ok(
  !grappleSource.includes("applyGroundedGrappleHoldAndRest"),
  "hold-and-rest must not use the legacy fatigue-only recovery helper",
);
assert.ok(
  combatPageSource.includes(
    "spendCanonicalGrappleStamina: spendAdmittedGrappleStamina",
  ),
  "CombatPage must provide the canonical grapple spend callback",
);
assert.ok(
  combatPageSource.includes(
    "recoverCanonicalGrappleStamina: recoverAdmittedGrappleStamina",
  ),
  "CombatPage must provide canonical grapple recovery",
);
assert.ok(
  combatPageSource.includes(
    "alreadyOverexerted: overexertionAttackRoundRegistryRef.current.has(overexertionRoundKey)",
  ),
  "grapples and attacks must share the same one-overexertion-per-round registry",
);
assert.ok(
  combatPageSource.includes('"grapple-stamina-already-charged"'),
  "duplicate grapple stamina charges must be idempotently suppressed",
);

console.log("canonical grapple stamina regression checks passed");
