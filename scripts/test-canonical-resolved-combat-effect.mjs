import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { applyCanonicalCombatEffect, resolvePhysicalProtectionForCanonicalEffect } from "../src/utils/combat/applyCanonicalCombatEffect.js";
import {
  PROTECTION_POLICIES,
  isCanonicalResolvedEffectEvent,
  normalizeCanonicalResolvedEffect,
} from "../src/utils/combat/canonicalResolvedCombatEffect.js";

const makeFighter = (id, hp, extras = {}) => ({
  id,
  name: id,
  currentHP: hp,
  hp,
  HP: hp,
  maxHP: 80,
  maxHp: 80,
  status: "active",
  controlMode: extras.controlMode || "manual",
  ...extras,
});

const liveFor = (event, fighters, extras = {}) => ({
  combatActive: true,
  combatOver: false,
  combatSession: "session-1",
  turnToken: "token-1",
  fighters,
  pendingTechnique: event.kind === "technique" ? { castId: event.meta.castId, turnToken: "token-1", combatSession: "session-1" } : null,
  pendingTactical: event.kind === "tactical" ? { id: event.meta.tacticalUseId, turnToken: "token-1", combatSession: "session-1" } : null,
  resolvedKeys: extras.resolvedKeys || new Set(),
});

const hpAuthority = () => {
  const calls = [];
  return {
    calls,
    authorities: {
      getFighterHP: (fighter) => Number(fighter.currentHP ?? fighter.hp ?? fighter.HP),
      clampHP: (value, fighter) => Math.max(-100, Math.min(Number(fighter.maxHP ?? 80), value)),
      applyHPToFighter(fighter, newHP) {
        calls.push({ id: fighter.id, newHP });
        fighter.currentHP = newHP;
        fighter.hp = newHP;
        fighter.HP = newHP;
      },
    },
  };
};

const physicalEvent = (overrides = {}) => ({
  type: "DAMAGE",
  kind: "technique",
  attackType: "melee",
  delivery: "physical-contact",
  protectionPolicy: "physical-armor",
  damageType: "piercing",
  amount: 12,
  sourceId: "striker",
  targetId: "target",
  controlMode: "manual",
  meta: { castId: "cast-1", turnToken: "token-1", combatSession: "session-1", controlMode: "manual" },
  ...overrides,
});

const bypassEvent = (overrides = {}) => ({
  type: "DAMAGE",
  kind: "tactical",
  attackType: "mental",
  delivery: "mental",
  protectionPolicy: "bypass-physical",
  damageType: "tactical",
  amount: 12,
  sourceId: "minder",
  targetId: "target",
  controlMode: "ai",
  meta: { tacticalUseId: "tac-1", turnToken: "token-1", combatSession: "session-1", controlMode: "ai" },
  ...overrides,
});

assert.equal(isCanonicalResolvedEffectEvent(physicalEvent()), true);
assert.equal(normalizeCanonicalResolvedEffect(physicalEvent()).protectionPolicy, PROTECTION_POLICIES.PHYSICAL_ARMOR);
assert.equal(normalizeCanonicalResolvedEffect(bypassEvent()).protectionPolicy, PROTECTION_POLICIES.BYPASS_PHYSICAL);

const armored = makeFighter("target", 40, { name: "Armored" });
const striker = makeFighter("striker", 40);
const hp = hpAuthority();
let armorCalls = 0;
const physical = applyCanonicalCombatEffect({
  event: physicalEvent(),
  fighters: [striker, armored],
  liveContext: liveFor(physicalEvent(), [striker, armored]),
  authorities: {
    ...hp.authorities,
    resolvePhysicalProtection: ({ amount }) => {
      armorCalls += 1;
      return { armorConsulted: true, amount: 4, hitLocation: { location: "Torso" }, injuryAuthorized: true };
    },
  },
});
assert.equal(physical.accepted, true, physical.reason);
assert.equal(armorCalls, 1, "physical technique must consult protection/armor authority");
assert.equal(physical.appliedAmount, 4);
assert.equal(physical.target.currentHP, 36);
assert.equal(physical.target.hp, 36);
assert.equal(physical.target.HP, 36);
assert.equal(hp.calls.length, 1);

const plateKnight = makeFighter("target", 40, {
  name: "Plate Knight",
  equistaminadArmor: { name: "Plate Mail", type: "heavy", guardRating: 18 },
  guardRating: 16,
});
const plateStriker = makeFighter("striker", 40);
const livePlateProtection = resolvePhysicalProtectionForCanonicalEffect({
  source: plateStriker,
  target: plateKnight,
  effect: normalizeCanonicalResolvedEffect(physicalEvent()),
  amount: 12,
  rollHitLocationFn: () => ({ location: "torso" }),
});
assert.equal(livePlateProtection.armorConsulted, true);
assert.ok(livePlateProtection.contact, "physical policy must call armor contact authority");

const plate = makeFighter("target", 40);
const minder = makeFighter("minder", 40);
const bypassHp = hpAuthority();
let bypassArmorCalls = 0;
const bypass = applyCanonicalCombatEffect({
  event: bypassEvent(),
  fighters: [minder, plate],
  liveContext: liveFor(bypassEvent(), [minder, plate]),
  authorities: {
    ...bypassHp.authorities,
    resolvePhysicalProtection: () => {
      bypassArmorCalls += 1;
      return { armorConsulted: true, amount: 0 };
    },
  },
});
assert.equal(bypass.accepted, true, bypass.reason);
assert.equal(bypassArmorCalls, 0, "explicit bypass must not invoke mundane armor protection");
assert.equal(bypass.appliedAmount, 12);
assert.equal(bypass.target.currentHP, 28);
assert.equal(bypassHp.calls.length, 1);

const wounded = makeFighter("target", 20);
const healer = makeFighter("healer", 40);
const healHp = hpAuthority();
const heal = applyCanonicalCombatEffect({
  event: {
    type: "HEAL",
    kind: "healing",
    attackType: "healing",
    amount: 15,
    sourceId: "healer",
    targetId: "target",
    meta: { combatSession: "session-1" },
  },
  fighters: [healer, wounded],
  liveContext: { combatActive: true, combatSession: "session-1", fighters: [healer, wounded], resolvedKeys: new Set() },
  authorities: healHp.authorities,
});
assert.equal(heal.accepted, true, heal.reason);
assert.equal(heal.target.currentHP, 35);
assert.equal(heal.target.hp, 35);
assert.equal(heal.target.HP, 35);

const overheal = applyCanonicalCombatEffect({
  event: {
    type: "HEAL",
    kind: "healing",
    amount: 50,
    sourceId: "healer",
    targetId: "target",
    meta: { combatSession: "session-1" },
  },
  fighters: [healer, makeFighter("target", 70)],
  liveContext: { combatActive: true, combatSession: "session-1", fighters: [healer, makeFighter("target", 70)], resolvedKeys: new Set() },
  authorities: hpAuthority().authorities,
});
assert.equal(overheal.target.currentHP, 80, "healing must clamp to max HP");

const staleKeys = new Set();
const first = applyCanonicalCombatEffect({
  event: physicalEvent(),
  fighters: [striker, makeFighter("target", 40)],
  liveContext: liveFor(physicalEvent(), [striker, makeFighter("target", 40)], { resolvedKeys: staleKeys }),
  authorities: {
    ...hpAuthority().authorities,
    resolvePhysicalProtection: ({ amount }) => ({ armorConsulted: true, amount, hitLocation: { location: "Torso" } }),
  },
});
assert.equal(first.accepted, true);
const duplicate = applyCanonicalCombatEffect({
  event: physicalEvent(),
  fighters: first.fighters,
  liveContext: liveFor(physicalEvent(), first.fighters, { resolvedKeys: staleKeys }),
  authorities: {
    ...hpAuthority().authorities,
    resolvePhysicalProtection: ({ amount }) => ({ armorConsulted: true, amount, hitLocation: { location: "Torso" } }),
  },
});
assert.equal(duplicate.accepted, false);
assert.equal(duplicate.reason, "duplicate-effect-mutation");

const stale = applyCanonicalCombatEffect({
  event: physicalEvent(),
  fighters: [striker, makeFighter("target", 40)],
  liveContext: {
    combatActive: true,
    combatSession: "session-1",
    turnToken: "token-2",
    fighters: [striker, makeFighter("target", 40)],
    pendingTechnique: { castId: "other-cast", turnToken: "token-2", combatSession: "session-1" },
    resolvedKeys: new Set(),
  },
  authorities: hpAuthority().authorities,
});
assert.equal(stale.accepted, false);
assert.equal(stale.reason, "technique-cast-invalidated");

const replaced = applyCanonicalCombatEffect({
  event: physicalEvent({ targetId: "gone" }),
  fighters: [striker, makeFighter("target", 40)],
  liveContext: liveFor(physicalEvent(), [striker, makeFighter("target", 40)]),
  authorities: hpAuthority().authorities,
});
assert.equal(replaced.accepted, false);
assert.equal(replaced.reason, "target-replaced-or-missing");

const manual = applyCanonicalCombatEffect({
  event: bypassEvent({ controlMode: "manual", meta: { ...bypassEvent().meta, controlMode: "manual" } }),
  fighters: [minder, makeFighter("target", 40)],
  liveContext: liveFor(bypassEvent(), [minder, makeFighter("target", 40)]),
  authorities: hpAuthority().authorities,
});
const autoplay = applyCanonicalCombatEffect({
  event: bypassEvent({ controlMode: "autoplay", meta: { ...bypassEvent().meta, controlMode: "autoplay" } }),
  fighters: [minder, makeFighter("target", 40)],
  liveContext: liveFor(bypassEvent(), [minder, makeFighter("target", 40)]),
  authorities: hpAuthority().authorities,
});
assert.equal(manual.appliedAmount, autoplay.appliedAmount);
assert.equal(manual.nextHP, autoplay.nextHP);

const combatPage = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const canonicalStart = combatPage.indexOf("if (e.type === \"HEAL\" || (e.type === \"DAMAGE\" && (isCanonicalResolvedEffectEvent(e)");
const canonicalEnd = combatPage.indexOf("// Handle attack resolution events", canonicalStart);
assert.ok(canonicalStart >= 0 && canonicalEnd > canonicalStart);
const canonicalBlock = combatPage.slice(canonicalStart, canonicalEnd);
assert.match(canonicalBlock, /applyCanonicalCombatEffect\(/);
assert.doesNotMatch(canonicalBlock, /currentHP\s*-\s*amount/);
assert.doesNotMatch(canonicalBlock, /hp\s*-\s*amount/);
assert.match(combatPage, /canonicalEffectAuthoritiesRef\.current = \{[\s\S]*applyHPToFighter/);
assert.match(combatPage, /canonicalEffectAuthoritiesRef\.current = \{[\s\S]*resolveArmorContact/);
assert.match(combatPage, /canonicalEffectAuthoritiesRef\.current = \{[\s\S]*rollHitLocation: rollImpactLocation/);
assert.match(
  combatPage.slice(canonicalEnd),
  /if \(isCanonicalResolvedEffectEvent\(e\)\) \{\s*return;/,
);

console.log("canonical resolved-effect adapter: physical armor, explicit bypass, heal, stale, once, parity");
