import { getInventoryAmmoCount } from "../combatAmmoManager.js";
import { prioritizeEnemyCombatTargets } from "../ai/routedTargetPriority.js";
import { assignBattleLocalIdentities, auditBattleRosterIdentity } from "../combatActorIdentity.js";
import { createCanonicalAmmunitionRegistry, spendAmmunitionOnce } from "./canonicalAmmunition.js";
import { commitCanonicalMovement, createCanonicalMovementRegistry } from "./canonicalMovementStamina.js";

export function runCombatCorrectnessBrowserScenario() {
  const fighters = assignBattleLocalIdentities(Array.from({ length: 20 }, (_, index) => ({
    id: `longbowman-${index + 1}`,
    name: "Longbowman",
    team: index < 10 ? "party" : "enemy",
    currentHP: 12,
    combatStamina: { maxStamina: 20, currentStamina: 20, authority: "combat-stamina" },
    inventory: [{ name: "Arrows", quantity: 20 }],
  })));
  const identityAudit = auditBattleRosterIdentity(fighters);
  const routedTarget = { ...fighters[10], moraleState: { status: "routed" } };
  const ordinaryTargets = prioritizeEnemyCombatTargets({
    attacker: fighters[0],
    candidates: [routedTarget, fighters[11]],
  });
  const ammunitionRegistry = createCanonicalAmmunitionRegistry();
  const firstShot = spendAmmunitionOnce({
    registry: ammunitionRegistry,
    actor: fighters[0],
    ammoType: "arrows",
    executionKey: "browser-shot-1",
    projectileReleased: true,
    source: "browser-correctness-scenario",
  });
  const secondShot = spendAmmunitionOnce({
    registry: ammunitionRegistry,
    actor: firstShot.actor,
    ammoType: "arrows",
    executionKey: "browser-shot-2",
    projectileReleased: true,
    source: "browser-correctness-scenario",
  });
  let movementPosition = { x: 0, y: 0 };
  const movement = commitCanonicalMovement({
    registry: createCanonicalMovementRegistry(),
    actor: fighters[1],
    from: movementPosition,
    to: { x: 3, y: 0 },
    distanceFt: 30,
    movementMode: "run-to-range",
    executionKey: "browser-move-1",
    source: "browser-correctness-scenario",
    spendStamina: ({ actor, amount }) => ({
      accepted: true,
      spent: amount,
      previousStamina: 20,
      nextStamina: 20 - amount,
      updated: { ...actor, combatStamina: { ...actor.combatStamina, currentStamina: 20 - amount } },
    }),
    commit: ({ to }) => { movementPosition = { ...to }; return { accepted: true }; },
  });
  return Object.freeze({
    actorCount: fighters.length,
    identityAudit,
    ordinaryTargetIds: ordinaryTargets.map((fighter) => fighter.id),
    routedTargetExcluded: !ordinaryTargets.some((fighter) => fighter.id === routedTarget.id),
    ammunitionCounts: [firstShot.record.nextCount, secondShot.record.nextCount],
    finalAmmunition: getInventoryAmmoCount(secondShot.actor, "arrows"),
    projectileReleaseCount: [...ammunitionRegistry.values()].filter((record) => record.projectileReleased).length,
    movementAccepted: movement.accepted,
    movementStaminaSpent: movement.record.spent,
    movementPosition,
  });
}

export default runCombatCorrectnessBrowserScenario;
