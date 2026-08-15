import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const resolveTechniqueImpact = require("../src/engine/resolveTechniqueImpact.cjs");
const resolveTacticalImpact = require("../src/engine/resolveTacticalImpact.cjs");

const fighters = [
  { id: "caster", name: "Caster", currentHP: 40, hp: 40, level: 1 },
  { id: "target", name: "Target", currentHP: 40, hp: 40, level: 1 },
];
const state = { fighters, positions: { caster: { x: 1, y: 1 }, target: { x: 2, y: 1 } }, turnCounter: 1 };

const technique = resolveTechniqueImpact({
  caster: "caster",
  target: "target",
  technique: {
    name: "Spear Bind",
    damage: "1d1",
    attackType: "melee",
    damageType: "piercing",
    protectionPolicy: "physical-armor",
    delivery: "physical-contact",
  },
  state,
  meta: { castId: "cast-engine", turnToken: "tok", combatSession: "s1", controlMode: "manual" },
});
const techniqueDamage = technique.events.find((event) => event.type === "DAMAGE");
assert.ok(techniqueDamage);
assert.equal(techniqueDamage.protectionPolicy, "physical-armor");
assert.equal(techniqueDamage.canonicalEffect.family, "physical-contact");
assert.equal(techniqueDamage.kind, "technique");

const mental = resolveTacticalImpact({
  user: "caster",
  target: "target",
  power: {
    name: "Fixture Mental Strike",
    attackType: "mental",
    damage: "1d1",
    damageType: "tactical",
    protectionPolicy: "bypass-physical",
    delivery: "mental",
  },
  state,
  meta: { tacticalUseId: "tac-engine", turnToken: "tok", combatSession: "s1", controlMode: "ai" },
});
const mentalDamage = mental.events.find((event) => event.type === "DAMAGE");
assert.ok(mentalDamage);
assert.equal(mentalDamage.protectionPolicy, "bypass-physical");
assert.equal(mentalDamage.canonicalEffect.family, "mental");

const heal = resolveTacticalImpact({
  user: "caster",
  target: "target",
  power: { name: "Restore", attackType: "healing", damage: "1d1" },
  state,
  meta: { tacticalUseId: "tac-heal", turnToken: "tok", combatSession: "s1", controlMode: "autoplay" },
});
const healEvent = heal.events.find((event) => event.type === "HEAL");
assert.ok(healEvent);
assert.equal(healEvent.protectionPolicy, "not-applicable");
assert.equal(healEvent.canonicalEffect.family, "healing");

const page = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(page, /controlMode: liveUser\?\.controlMode/);
assert.match(page, /controlMode: liveCasterForTechniqueAction\?\.controlMode/);
assert.match(page, /PHASE3_CANONICAL_EFFECT_FIXTURE\.windowApiName/);
assert.doesNotMatch(
  page.slice(page.indexOf("if (e.type === \"HEAL\""), page.indexOf("// Handle attack resolution events")),
  /currentHP:\s*newHP,\s*hp:\s*newHP/,
);

console.log("technique/tactical engine events carry explicit canonical effect policy");
