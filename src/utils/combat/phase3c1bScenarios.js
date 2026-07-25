import { CANONICAL_COMBAT_ACTORS, CANONICAL_RANGED_AND_REACH_WEAPON_FIXTURES as weapons } from "../../data/canonicalCombatActors.js";

export function createPhase3C1BProjectileScenario() {
  return {
    scenarioId: "phase3c1b-projectile-battle",
    deterministic: true,
    party: [
      structuredClone(CANONICAL_COMBAT_ACTORS.longbowman),
      structuredClone(CANONICAL_COMBAT_ACTORS.guard),
      { ...structuredClone(CANONICAL_COMBAT_ACTORS.bandit), loadoutKey: "hunting-bow-skirmisher" },
    ],
    opponents: [
      structuredClone(CANONICAL_COMBAT_ACTORS.archer),
      structuredClone(CANONICAL_COMBAT_ACTORS["man-at-arms"]),
      structuredClone(CANONICAL_COMBAT_ACTORS["veteran-knight"]),
    ],
    assertions: ["stable-identities", "ammunition-depletes", "armor-stop", "gap-contact-conditional", "sidearm-carried", "one-combat-over"],
  };
}
export function createPhase3C1BExtendedReachScenario() {
  return {
    scenarioId: "phase3c1b-extended-reach",
    deterministic: true,
    publicActorBodiesCreated: false,
    fixtures: [
      { actor: { ...structuredClone(CANONICAL_COMBAT_ACTORS.spearman), id: "pike-fixture", weaponProfiles: [weapons.pike], inventory: [weapons.pike] }, weapon: weapons.pike },
      { actor: { ...structuredClone(CANONICAL_COMBAT_ACTORS.spearman), id: "halberd-fixture", weaponProfiles: [weapons.halberd], inventory: [weapons.halberd] }, weapon: weapons.halberd },
    ],
    assertions: ["extended-melee", "no-ammunition", "no-projectile-animation", "obstruction", "grapple-drop", "no-synthetic-sidearm", "exact-once-token"],
  };
}
