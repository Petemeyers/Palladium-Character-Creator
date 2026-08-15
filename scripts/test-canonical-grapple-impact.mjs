import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  applyCanonicalGrappleImpact,
  resolveCanonicalGrapplePhysicalProtection,
} from "../src/utils/combat/canonicalGrappleImpact.js";

const source = { id: "attacker", name: "Knight", controlMode: "manual" };
const armoredTarget = {
  id: "target",
  name: "Armored Defender",
  currentHP: 20,
  hp: 20,
  maxHP: 20,
  currentarmorDurability: 40,
  armorDurability: 40,
  armorProfile: { armorClass: "plate", rigidCoverage: true },
};
const dagger = {
  id: "dagger",
  weaponId: "dagger",
  name: "Dagger",
  damage: "1d4",
  damageType: "piercing",
  attackMode: "dagger-gap-attack",
};

function createAuthorities(overrides = {}) {
  const calls = { hp: 0, armor: 0, contact: 0, layered: 0 };
  return {
    calls,
    authorities: {
      getFighterHP: (fighter) => Number(fighter.currentHP ?? fighter.hp ?? 0),
      clampHP: (value) => Math.max(-100, Math.min(20, Number(value))),
      applyHPToFighter: (fighter, value) => {
        calls.hp += 1;
        fighter.currentHP = value;
        fighter.hp = value;
        return fighter;
      },
      applyArmorImpactToFighter: (fighter, impact) => {
        calls.armor += 1;
        return { ...fighter, armorAssemblyState: { outcome: impact.outcome } };
      },
      resolveArmorContact: (...args) => {
        calls.contact += 1;
        return overrides.resolveArmorContact?.(...args) || {
          contactType: "solid-plate",
          coverageType: "solid-plate",
          damageAllowed: false,
          bodilyDamageMultiplier: 0,
          damagePrevented: true,
        };
      },
      resolveLayeredArmorImpact: (...args) => {
        calls.layered += 1;
        return overrides.resolveLayeredArmorImpact?.(...args) || {
          accepted: true,
          outcome: "armor-deflected-impact",
          body: { injuryAuthorized: false, damageMultiplier: 0, minimumDamage: 0 },
        };
      },
    },
  };
}

const blocked = createAuthorities({
  resolveLayeredArmorImpact: ({ attack }) => {
    assert.equal(attack.name, "Dagger", "clinch weapon identity reaches layered armor");
    assert.equal(attack.attackMode, "dagger-gap-attack");
    return {
      accepted: true,
      outcome: "armor-deflected-impact",
      body: { injuryAuthorized: false, damageMultiplier: 0, minimumDamage: 0 },
    };
  },
});
const blockedKeys = new Set();
const blockedImpact = applyCanonicalGrappleImpact({
  fighters: [source, armoredTarget],
  attacker: source,
  defender: armoredTarget,
  result: { damage: 7, hit: true, attackRoll: 14 },
  actionType: "clinchStrike",
  weapon: dagger,
  attackMode: dagger.attackMode,
  hitLocation: "torso",
  executionKey: "grapple-impact-blocked",
  resolvedKeys: blockedKeys,
  originControlMode: "manual",
  authorities: blocked.authorities,
});
assert.equal(blockedImpact.accepted, true);
assert.equal(blockedImpact.previousHP, 20);
assert.equal(blockedImpact.nextHP, 20, "plate-protected grapple strike deals no HP damage");
assert.equal(blocked.calls.contact, 1, "canonical contact is consulted once");
assert.equal(blocked.calls.layered, 1, "layered armor is consulted once");
assert.equal(blocked.calls.armor, 1, "canonical armor assembly mutation occurs once");
assert.equal(blocked.calls.hp, 1, "one resolved grapple impact reaches HP authority once");
assert.equal(blockedImpact.target.currentarmorDurability, 40, "aggregate durability remains a compatibility mirror");

const gap = createAuthorities({
  resolveArmorContact: () => {
    throw new Error("supplied gap contact must not be rerolled");
  },
  resolveLayeredArmorImpact: () => {
    throw new Error("a successful armor gap must not be reapplied to covered armor");
  },
});
const suppliedGap = {
  contactType: "armor-gap",
  coverageType: "gap",
  gapReached: true,
  damageAllowed: true,
  bodilyDamageMultiplier: 1,
};
const gapImpact = applyCanonicalGrappleImpact({
  fighters: [source, armoredTarget],
  attacker: source,
  defender: armoredTarget,
  result: { damage: 6, hit: true, attackRoll: 20, weakSpot: true },
  actionType: "groundedArmorGapStrike",
  weapon: dagger,
  attackMode: dagger.attackMode,
  hitLocation: "neck",
  armorContact: suppliedGap,
  executionKey: "grapple-impact-gap",
  resolvedKeys: new Set(),
  originControlMode: "ai",
  authorities: gap.authorities,
});
assert.equal(gapImpact.accepted, true);
assert.equal(gapImpact.nextHP, 14);
assert.equal(gapImpact.protection.gapPreserved, true);
assert.equal(gapImpact.protection.hitLocation.location, "neck");
assert.equal(gap.calls.contact, 0, "supplied contact is not rerolled");
assert.equal(gap.calls.layered, 0, "gap success is not discarded by a second armor pass");
assert.equal(gap.calls.hp, 1);

const failed = createAuthorities({
  resolveArmorContact: () => {
    throw new Error("armor resolver unavailable");
  },
});
const failedImpact = applyCanonicalGrappleImpact({
  fighters: [source, armoredTarget],
  attacker: source,
  defender: armoredTarget,
  result: { damage: 9, hit: true, attackRoll: 15 },
  actionType: "takedown",
  hitLocation: "torso",
  executionKey: "grapple-impact-error",
  resolvedKeys: new Set(),
  authorities: failed.authorities,
});
assert.equal(failedImpact.accepted, false);
assert.equal(failedImpact.reason, "grapple-armor-processing-failed");
assert.equal(failed.calls.hp, 0, "armor failure cannot fall back to direct HP damage");
assert.equal(failedImpact.fighters[1].currentHP, 20);
assert.ok(failedImpact.logs.some((event) => event.eventType === "grapple-armor-processing-failed-safe"));

const once = createAuthorities();
const onceKeys = new Set();
const onceInput = {
  fighters: [source, armoredTarget],
  attacker: source,
  defender: armoredTarget,
  result: { damage: 4, hit: true, attackRoll: 20 },
  actionType: "clinchStrike",
  weapon: dagger,
  hitLocation: "face",
  armorContact: {
    contactType: "unarmored",
    coverageType: "unarmored",
    damageAllowed: true,
    bodilyDamageMultiplier: 1,
  },
  executionKey: "grapple-impact-once",
  resolvedKeys: onceKeys,
  authorities: once.authorities,
};
const first = applyCanonicalGrappleImpact(onceInput);
const duplicate = applyCanonicalGrappleImpact({ ...onceInput, fighters: first.fighters, defender: first.target });
assert.equal(first.nextHP, 16);
assert.equal(duplicate.accepted, false);
assert.equal(duplicate.reason, "duplicate-effect-mutation");
assert.equal(once.calls.hp, 1, "execution identity permits exactly one HP mutation");

const manual = resolveCanonicalGrapplePhysicalProtection({
  source,
  target: armoredTarget,
  amount: 5,
  actionType: "clinchStrike",
  weapon: dagger,
  hitLocation: "torso",
  armorContact: suppliedGap,
});
const ai = resolveCanonicalGrapplePhysicalProtection({
  source: { ...source, controlMode: "ai" },
  target: armoredTarget,
  amount: 5,
  actionType: "clinchStrike",
  weapon: dagger,
  hitLocation: "torso",
  armorContact: suppliedGap,
});
assert.deepEqual(
  { amount: manual.amount, gap: manual.gapPreserved, location: manual.hitLocation.location },
  { amount: ai.amount, gap: ai.gapPreserved, location: ai.hitLocation.location },
  "manual and AI impacts share one protection policy",
);

const grappleActionsSource = readFileSync(
  fileURLToPath(new URL("../src/utils/combatActionHandlers/grappleActions.js", import.meta.url)),
  "utf8",
);
const grapplingSystemSource = readFileSync(
  fileURLToPath(new URL("../src/utils/grapplingSystem.js", import.meta.url)),
  "utf8",
);
assert.doesNotMatch(grappleActionsSource, /applyDamageWithArmor\s*\(/);
assert.doesNotMatch(grappleActionsSource, /defenderCopy\.(?:currentHP|hp|HP)\s*=/);
const legacyShim = grapplingSystemSource.slice(
  grapplingSystemSource.indexOf("export function applyDamageWithArmor"),
  grapplingSystemSource.indexOf("function hexDistance"),
);
assert.match(legacyShim, /deprecated; grapple impact was not applied outside canonical authority/);
assert.doesNotMatch(legacyShim, /\.(?:currentHP|hp|HP|currentarmorDurability|armorDurability)\s*=/);
assert.match(grappleActionsSource, /const damageStaleReason = getStaleGrappleReason\("grapple-damage-roll"\)/);
assert.ok(
  grappleActionsSource.indexOf('getStaleGrappleReason("grapple-damage-roll")') <
    grappleActionsSource.indexOf("applyCanonicalGrappleImpact({"),
  "stale ownership is checked before canonical HP mutation",
);

console.log("canonical grapple impact consolidation tests passed");
