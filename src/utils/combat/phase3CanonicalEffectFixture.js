/**
 * Milestone 8D Phase 3: DEV/test-only canonical effect fixture.
 * Does not populate global catalogs or change production technique/tactical content.
 */

export const PHASE3_CANONICAL_EFFECT_FIXTURE = Object.freeze({
  windowApiName: "__mcsPhase3CanonicalEffectFixture",
  physical: Object.freeze({
    label: "Fixture Spear Thrust",
    kind: "technique",
    attackType: "melee",
    delivery: "physical-contact",
    protectionPolicy: "physical-armor",
    damageType: "piercing",
    amount: 12,
  }),
  bypass: Object.freeze({
    label: "Fixture Mental Strike",
    kind: "tactical",
    attackType: "mental",
    delivery: "mental",
    protectionPolicy: "bypass-physical",
    damageType: "tactical",
    amount: 12,
  }),
  heal: Object.freeze({
    label: "Fixture Restore",
    kind: "healing",
    attackType: "healing",
    delivery: "healing",
    protectionPolicy: "not-applicable",
    amount: 8,
  }),
});

export default PHASE3_CANONICAL_EFFECT_FIXTURE;
