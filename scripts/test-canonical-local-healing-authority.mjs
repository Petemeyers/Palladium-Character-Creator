import assert from "node:assert/strict";
import fs from "node:fs";

import { healerAbility, medicalTreatment } from "../src/utils/healingSystem.js";
import { applyCanonicalCombatEffect } from "../src/utils/combat/applyCanonicalCombatEffect.js";
import {
  applyHPToFighter,
  clampHP,
  getFighterHP,
} from "../src/utils/combat/canonicalHpAuthority.js";
import { applyCanonicalLocalHealing } from "../src/utils/combat/canonicalLocalHealing.js";

const fighter = (id, hp, maxHP = 30, extra = {}) => ({
  id,
  name: extra.name || id,
  currentHP: hp,
  currentHp: hp,
  hp,
  HP: hp,
  maxHP,
  maxHp: maxHP,
  status: "active",
  remainingActions: 2,
  ...extra,
});

const normal = applyCanonicalLocalHealing({
  fighter: fighter("ally", 10),
  amount: 7,
  source: "First Aid",
});
assert.equal(normal.accepted, true);
assert.equal(normal.previousHP, 10);
assert.equal(normal.appliedAmount, 7);
assert.equal(normal.nextHP, 17);
assert.equal(normal.mutationCount, 1);
assert.deepEqual(
  [normal.fighter.currentHP, normal.fighter.currentHp, normal.fighter.hp, normal.fighter.HP],
  [17, 17, 17, 17],
  "all active aliases must agree",
);

const clamped = applyCanonicalLocalHealing({
  fighter: fighter("near-max", 28),
  amount: 8,
  source: "Healing Touch",
});
assert.equal(clamped.nextHP, 30);
assert.equal(clamped.appliedAmount, 2);

let mutationCalls = 0;
const once = applyCanonicalLocalHealing({
  fighter: fighter("once", 10),
  amount: 5,
  authorities: {
    getFighterHP,
    clampHP,
    applyHPToFighter(target, nextHP, options) {
      mutationCalls += 1;
      return applyHPToFighter(target, nextHP, options);
    },
  },
});
assert.equal(once.nextHP, 15);
assert.equal(mutationCalls, 1, "one accepted local action performs one HP mutation");

const roster = [fighter("healer", 20), fighter("ally-a", 8), fighter("ally-b", 9)];
const stableTargetId = "ally-b";
const updatedRoster = roster.map((candidate) => (
  candidate.id === stableTargetId
    ? applyCanonicalLocalHealing({ fighter: candidate, amount: 4, source: "First Aid" }).fighter
    : candidate
));
assert.equal(getFighterHP(updatedRoster.find((candidate) => candidate.id === "ally-a")), 8);
assert.equal(getFighterHP(updatedRoster.find((candidate) => candidate.id === "ally-b")), 13);
assert.equal(
  applyCanonicalLocalHealing({ fighter: { name: "replacement" }, amount: 4 }).reason,
  "stable-target-id-required",
);

const firstAidTarget = fighter("first-aid-target", 10);
const firstAid = medicalTreatment(fighter("medic", 20), firstAidTarget, 100);
assert.equal(firstAid.success, true);
assert.ok(firstAid.healed >= 3 && firstAid.healed <= 8);
assert.equal(getFighterHP(firstAidTarget), 10, "First Aid policy must not write HP before canonical admission");
const firstAidApplied = applyCanonicalLocalHealing({
  fighter: firstAidTarget,
  amount: firstAid.healed,
  source: "First Aid",
});
assert.equal(firstAidApplied.nextHP, 10 + firstAid.healed);

const touchTarget = fighter("touch-target", 29, 30);
const touchApplied = applyCanonicalLocalHealing({
  fighter: touchTarget,
  amount: 8,
  source: "Healing Touch",
});
assert.equal(touchApplied.nextHP, 30);
assert.equal(touchApplied.appliedAmount, 1);

const healerTarget = fighter("healer-target", 11);
const focusedHealer = fighter("focused-healer", 20, 30, {
  profession: "Healer",
  currentfocus: 20,
  maxfocus: 20,
});
const focusedTouch = healerAbility(focusedHealer, healerTarget, "Healing Touch");
assert.equal(focusedTouch.focusCost, 8);
assert.equal(getFighterHP(healerTarget), 11, "focus Healing Touch policy remains mutation-free");

const engineTarget = fighter("engine-target", 10);
const engineHealer = fighter("engine-healer", 20);
const engine = applyCanonicalCombatEffect({
  event: {
    type: "HEAL",
    kind: "healing",
    amount: 7,
    sourceId: engineHealer.id,
    targetId: engineTarget.id,
    meta: { combatSession: "phase-10" },
  },
  fighters: [engineHealer, engineTarget],
  liveContext: {
    combatActive: true,
    combatSession: "phase-10",
    fighters: [engineHealer, engineTarget],
    resolvedKeys: new Set(),
  },
});
assert.equal(engine.accepted, true);
assert.equal(engine.nextHP, normal.nextHP, "engine HEAL and local healing converge numerically");
assert.deepEqual(
  [engine.target.currentHP, engine.target.currentHp, engine.target.hp, engine.target.HP],
  [17, 17, 17, 17],
);

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const healingSystem = fs.readFileSync(new URL("../src/utils/healingSystem.js", import.meta.url), "utf8");
const clericalSource = fs.readFileSync(new URL("../src/utils/clericalAbilities.js", import.meta.url), "utf8");
const abilitySource = fs.readFileSync(new URL("../src/utils/abilitySystem.js", import.meta.url), "utf8");
assert.match(combatPage, /applyCanonicalLocalHealing\(\{/);
assert.match(combatPage, /authorities:\s*\{\s*getFighterHP,\s*clampHP,\s*applyHPToFighter,/);
assert.doesNotMatch(healingSystem, /target\.(?:currentHP|currentHp|hp|HP)\s*=/);
assert.doesNotMatch(clericalSource, /target\.(?:currentHP|currentHp|hp|HP)\s*=/);
assert.match(clericalSource, /String\(casterId\) === String\(targetId\)/);
assert.doesNotMatch(abilitySource, /fighter\.(?:currentHP|currentHp|hp|HP)\s*=/);
assert.doesNotMatch(combatPage, /currentHP:\s*skillResult\.currentHp/);

console.log("canonical local healing authority consolidation tests passed");
