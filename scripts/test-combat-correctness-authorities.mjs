import assert from "node:assert/strict";
import {
  canExplicitlyPursueRoutedTarget,
  isCombatCapable,
  isOrdinaryAttackTarget,
  isVictoryNeutralized,
} from "../src/utils/combat/combatParticipation.js";
import { prioritizeEnemyCombatTargets } from "../src/utils/ai/routedTargetPriority.js";
import {
  createCanonicalAmmunitionRegistry,
  spendAmmunitionOnce,
} from "../src/utils/combat/canonicalAmmunition.js";
import {
  calculateCanonicalMovementStaminaCost,
  commitCanonicalMovement,
  createCanonicalMovementRegistry,
} from "../src/utils/combat/canonicalMovementStamina.js";
import {
  resolveCanonicalDamageMetadata,
  validateCanonicalHpMutationMetadata,
} from "../src/utils/combat/canonicalDamageMetadata.js";
import { buildCanonicalAttackRollEvent } from "../src/utils/combat/canonicalAttackRollEvent.js";
import {
  assignBattleLocalIdentities,
  auditBattleRosterIdentity,
  formatCombatActorLabel,
} from "../src/utils/combatActorIdentity.js";

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };

const active = { id: "active", currentHP: 10, status: "active" };
const routed = { id: "routed", currentHP: 10, moraleState: { status: "routed" } };
check(!isOrdinaryAttackTarget(routed), "routed positive-HP actor is not an ordinary target");
check(isVictoryNeutralized(routed) && !isCombatCapable(routed), "routed actor is victory-neutralized");
check(prioritizeEnemyCombatTargets({ attacker: active, candidates: [routed] }).length === 0, "enemy target priority excludes routed actors");
check(!canExplicitlyPursueRoutedTarget({ ...active, alignment: "Neutral Good" }, routed, { explicitPursuit: true }), "merciful actor does not automatically pursue");
check(canExplicitlyPursueRoutedTarget({ ...active, alignment: "Chaotic Evil" }, routed, { order: "no-escape" }), "explicit binding pursuit can admit routed target");
check(isCombatCapable({ ...active, moraleState: { status: "shaken" } }), "shaken actor remains capable");
for (const actor of [
  { ...active, status: "surrendered" },
  { ...active, captured: true },
  { ...active, hasFled: true },
  { ...active, dead: true },
]) check(!isOrdinaryAttackTarget(actor), "neutralized actor excluded from ordinary targeting");
check(!isOrdinaryAttackTarget({ ...active, unconscious: true }), "incapacitated target protected by default");
check(isOrdinaryAttackTarget({ ...active, unconscious: true }, { mayFinishIncapacitated: true }), "existing finishing policy remains explicit");

const ammoRegistry = createCanonicalAmmunitionRegistry();
let archer = { id: "archer", inventory: [{ name: "Arrows", quantity: 20 }] };
const shot1 = spendAmmunitionOnce({ registry: ammoRegistry, actor: archer, ammoType: "arrows", executionKey: "shot-1", projectileReleased: true });
archer = shot1.actor;
const shot2 = spendAmmunitionOnce({ registry: ammoRegistry, actor: archer, ammoType: "arrows", executionKey: "shot-2", projectileReleased: true });
archer = shot2.actor;
check(shot1.record.nextCount === 19 && shot2.record.nextCount === 18, "two shots synchronously expose 19 then 18 arrows");
const duplicate = spendAmmunitionOnce({ registry: ammoRegistry, actor: archer, ammoType: "arrows", executionKey: "shot-2", projectileReleased: true });
check(duplicate.duplicate && duplicate.spent === 0 && !duplicate.projectileAuthorized, "duplicate callback neither spends nor releases");
const dryMisfire = spendAmmunitionOnce({ registry: ammoRegistry, actor: archer, ammoType: "arrows", executionKey: "misfire-dry", projectileReleased: false });
check(dryMisfire.spent === 0 && dryMisfire.record.nextCount === 18, "unreleased misfire spends no ammunition");
const releasedMisfire = spendAmmunitionOnce({ registry: ammoRegistry, actor: archer, ammoType: "arrows", executionKey: "misfire-flight", projectileReleased: true });
check(releasedMisfire.spent === 1 && releasedMisfire.record.nextCount === 17, "released misfire spends ammunition");
check(shot1.events.some((event) => event.eventType === "projectile-released"), "release has canonical ammunition result");

const mover = { id: "mover", combatStamina: { maxStamina: 20, currentStamina: 20, authority: "combat-stamina" } };
const walkCost = calculateCanonicalMovementStaminaCost({ actor: mover, distanceFt: 30, movementMode: "walk" });
const runCost = calculateCanonicalMovementStaminaCost({ actor: mover, distanceFt: 30, movementMode: "run" });
check(walkCost > 0 && runCost >= walkCost, "running costs at least as much stamina as walking");
const movementRegistry = createCanonicalMovementRegistry();
let committedPosition = null;
const movement = commitCanonicalMovement({
  registry: movementRegistry, actor: mover, from: { x: 0, y: 0 }, to: { x: 3, y: 0 },
  distanceFt: 30, movementMode: "flank", source: "player-ai-flank", executionKey: "move-1",
  spendStamina: ({ actor, amount }) => ({ accepted: true, spent: amount, previousStamina: 20, nextStamina: 20 - amount, updated: { ...actor, combatStamina: { ...actor.combatStamina, currentStamina: 20 - amount } } }),
  commit: ({ to }) => { committedPosition = to; return { accepted: true }; },
});
check(movement.accepted && movement.record.spent === walkCost && committedPosition.x === 3, "movement spends before one position commit");
check(movement.events.map((event) => event.eventType).join(",") === "movement-stamina-spend-requested,movement-stamina-spend-resolved,movement-committed", "movement ledger event order is canonical");
const repeatedMove = commitCanonicalMovement({ registry: movementRegistry, actor: mover, to: { x: 3, y: 0 }, executionKey: "move-1" });
check(repeatedMove.duplicate && !repeatedMove.accepted, "duplicate movement callback cannot spend twice");
let canceledSpend = 0;
const canceled = commitCanonicalMovement({
  registry: createCanonicalMovementRegistry(), actor: mover, from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, distanceFt: 10,
  executionKey: "move-cancel", spendStamina: ({ actor, amount }) => { canceledSpend = amount; return { accepted: true, spent: amount, updated: actor }; },
  commit: () => ({ accepted: false, reason: "canceled" }),
});
check(!canceled.accepted && canceled.record.accepted === false && canceledSpend > 0 && mover.combatStamina.currentStamina === 20, "canceled movement authorizes but commits neither position nor stamina");

const arrow = resolveCanonicalDamageMetadata({ attack: { name: "Longbow Arrow" }, impact: { location: "chest" }, projectile: true });
const cut = resolveCanonicalDamageMetadata({ attack: { name: "Long Sword", attackMode: "cut" }, impact: { location: "arm" } });
const thrust = resolveCanonicalDamageMetadata({ attack: { name: "Long Sword", attackMode: "thrust" }, impact: { location: "chest" } });
check(arrow.damageType === "piercing" && arrow.hitLocation === "chest", "arrow metadata is piercing with location");
check(cut.damageType === "slashing" && thrust.damageType === "piercing", "sword modes preserve distinct damage types");
check(!validateCanonicalHpMutationMetadata({ damage: 3, damageType: null, hitLocation: null }).valid, "bodily HP mutation rejects missing metadata");

const roll = buildCanonicalAttackRollEvent({ naturalRoll: 12, modifier: 4, total: 16, defense: 14, outcome: "hit", modifierComponents: { baseAttack: 3, fatigueModifierApplied: -1, reach: 2 } });
check(roll.eventType === "attack-roll" && roll.modifierArithmeticValid, "attack event schema and modifier arithmetic are canonical");

const duplicateRoster = assignBattleLocalIdentities(Array.from({ length: 20 }, (_, index) => ({ id: index < 2 ? "duplicate" : `longbowman-${index}`, name: "Longbowman", team: index % 2 ? "enemy" : "party" })));
const identityAudit = auditBattleRosterIdentity(duplicateRoster);
check(identityAudit.matches && identityAudit.actorCount === 20, "twenty template actors receive unique IDs and battle labels");
check(formatCombatActorLabel(duplicateRoster[0]) === duplicateRoster[0].battleLabel, "battle label remains stable after assignment");

console.log(`Combat correctness authorities: ${checks}/${checks} checks passed.`);
