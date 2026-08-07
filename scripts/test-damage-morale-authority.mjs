import assert from "node:assert/strict";
import {
  evaluateDamageMoraleTrigger,
  guardDamageMoraleOutcome,
} from "../src/utils/combat/damageMoraleAuthority.js";

const shakenFighter = {
  id: "enemy",
  maxHP: 38,
  currentHP: 29,
  moraleState: { status: "SHAKEN", failedChecks: 1 },
  bleeding: { active: false, stabilized: false },
};

const chipTrigger = evaluateDamageMoraleTrigger({
  defender: shakenFighter,
  hpBefore: 31,
  hpAfter: 29,
  damageDealt: 2,
  alliesDownRatio: 0,
});
assert.equal(chipTrigger.shouldCheck, false, "2 damage at 29/38 must not create another morale check");
assert.equal(chipTrigger.canEscalateToRouted, false);

const skipped = guardDamageMoraleOutcome({
  fighterBefore: shakenFighter,
  outcome: { success: false, result: "failure", moraleState: { status: "ROUTED" } },
  trigger: chipTrigger,
});
assert.equal(skipped.appliedStatus, "SHAKEN");
assert.equal(skipped.suppressed, true);

const significantTrigger = evaluateDamageMoraleTrigger({
  defender: { ...shakenFighter, currentHP: 31, moraleState: { status: "STEADY" } },
  hpBefore: 38,
  hpAfter: 31,
  damageDealt: 7,
});
assert.equal(significantTrigger.shouldCheck, true, "7/38 damage should be eligible for a morale check");
assert.equal(significantTrigger.canEscalateToRouted, false, "a single moderate hit above half HP should not directly route");

const clamped = guardDamageMoraleOutcome({
  fighterBefore: { ...shakenFighter, moraleState: { status: "STEADY" } },
  outcome: { success: false, result: "failure", moraleState: { status: "ROUTED" } },
  trigger: significantTrigger,
});
assert.equal(clamped.appliedStatus, "SHAKEN", "non-route-eligible failed check should stop at SHAKEN");

const lowHpTrigger = evaluateDamageMoraleTrigger({
  defender: shakenFighter,
  hpBefore: 20,
  hpAfter: 17,
  damageDealt: 3,
});
assert.equal(lowHpTrigger.shouldCheck, true);
assert.equal(lowHpTrigger.canEscalateToRouted, true, "fighters at or below half HP may route on a failed meaningful check");

const routed = guardDamageMoraleOutcome({
  fighterBefore: shakenFighter,
  outcome: { success: false, result: "failure", moraleState: { status: "ROUTED" } },
  trigger: lowHpTrigger,
});
assert.equal(routed.appliedStatus, "ROUTED");
assert.equal(routed.suppressed, false);

console.log("damage morale authority tests passed");
