import assert from "node:assert/strict";
import fs from "node:fs";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import { normalizeReferenceCombatActor } from "../src/utils/combat/normalizeCombatActorSchema.js";
import {
  MOUNTED_ACTION_CONTRACTS,
  claimCanonicalMountedAction,
  completeCanonicalMountedAction,
  consumeCanonicalMountedContinuation,
  createCanonicalMountedContinuation,
  createCanonicalMountedTurn,
  executeCanonicalMountNaturalAttack,
  executeCanonicalMountedMovement,
  executeCanonicalMountedRiderAttack,
  getCanonicalMountedPresentation,
  rejectMountedRiderIndependentMovement,
  resolveCanonicalMountControl,
  resolveCanonicalMountedTarget,
  resolveMountedGrappleTarget,
  resolveMountedIncapacitation,
  resolveMountedOutcome,
  validateCanonicalMountedState,
} from "../src/utils/combat/canonicalMountedCombat.js";
import {
  createPhase3C3BMountedFixture,
  runPhase3C3BChargeAndBraceScenario,
  runPhase3C3BForcedDismountScenario,
  runPhase3C3BMountAndMoveScenario,
  runPhase3C3BMountedBrowserScenarios,
  runPhase3C3BTargetingScenario,
} from "../src/utils/combat/phase3c3bMountedGroundScenarios.js";

const makeActor = (key, id, team, position) => normalizeReferenceCombatActor({
  ...structuredClone(getCanonicalCombatActorDefinition(key)),
  id,
  team,
  side: team,
  battleSide: team,
  position,
  x: position.x,
  y: position.y,
}, { source: "phase3c3b-test" }).normalizedActor;
const spendCounter = () => {
  const state = { calls: 0, applied: 0 };
  state.spend = ({ actor, amount = 0 }) => {
    state.calls += 1;
    state.applied += amount;
    const previous = Number(actor.combatStamina?.current ?? actor.currentStamina);
    return { accepted: previous >= amount, actor: { ...actor, currentStamina: previous - amount, combatStamina: { ...actor.combatStamina, current: previous - amount } }, previous, requested: amount, applied: amount, next: previous - amount };
  };
  return state;
};

const moved = runPhase3C3BMountAndMoveScenario();
const charged = runPhase3C3BChargeAndBraceScenario();
const targeted = runPhase3C3BTargetingScenario();
const forced = runPhase3C3BForcedDismountScenario();
const browser = runPhase3C3BMountedBrowserScenarios();
const source = fs.readFileSync(new URL("../src/utils/combat/canonicalMountedCombat.js", import.meta.url), "utf8");
const carrierSource = fs.readFileSync(new URL("../src/utils/combat/canonicalCarrierLink.js", import.meta.url), "utf8");

const duplicateTurn = createCanonicalMountedTurn({
  registry: moved.registry,
  linkId: moved.mounted.link.linkId,
  rider: moved.rider,
  mount: moved.mount,
  generationId: moved.generationId,
  initiativeTurnId: moved.initiativeTurnId,
  authoritativeTurn: { generationId: moved.generationId, initiativeTurnId: moved.initiativeTurnId, actorId: moved.rider.id },
});
const staleFixture = createPhase3C3BMountedFixture("stale-turn");
const staleTurn = claimCanonicalMountedAction({
  registry: staleFixture.registry,
  mountedTurnId: staleFixture.turn.mountedTurn.mountedTurnId,
  actionKey: "mounted-walk",
  owner: "mount",
  generationId: "wrong-generation",
  initiativeTurnId: staleFixture.initiativeTurnId,
});

const runFixture = createPhase3C3BMountedFixture("run");
const runSpend = spendCounter();
const runClaim = claimCanonicalMountedAction({ registry: runFixture.registry, mountedTurnId: runFixture.turn.mountedTurn.mountedTurnId, actionKey: "mounted-run", owner: "mount", generationId: runFixture.generationId, initiativeTurnId: runFixture.initiativeTurnId });
const runMove = executeCanonicalMountedMovement({ registry: runFixture.registry, claim: runClaim.claim, rider: runFixture.knight, mount: runFixture.warhorse, destination: { x: 20, y: 2, altitudeFeet: 0 }, movementMode: "run", mountStaminaCost: 2, spendStamina: runSpend.spend });
const rejectedFixture = createPhase3C3BMountedFixture("rejected-move");
const rejectedSpend = spendCounter();
const rejectedClaim = claimCanonicalMountedAction({ registry: rejectedFixture.registry, mountedTurnId: rejectedFixture.turn.mountedTurn.mountedTurnId, actionKey: "mounted-walk", owner: "mount", generationId: rejectedFixture.generationId, initiativeTurnId: rejectedFixture.initiativeTurnId });
const rejectedMove = executeCanonicalMountedMovement({ registry: rejectedFixture.registry, claim: rejectedClaim.claim, rider: rejectedFixture.knight, mount: rejectedFixture.warhorse, destination: { x: 3, y: 2, altitudeFeet: 0 }, movementMode: "walk", terrain: { occupiedByHostile: true }, mountStaminaCost: 1, spendStamina: rejectedSpend.spend });
const terrainFixture = createPhase3C3BMountedFixture("terrain");
const terrainClaim = claimCanonicalMountedAction({ registry: terrainFixture.registry, mountedTurnId: terrainFixture.turn.mountedTurn.mountedTurnId, actionKey: "mounted-walk", owner: "mount", generationId: terrainFixture.generationId, initiativeTurnId: terrainFixture.initiativeTurnId });
const terrainMove = executeCanonicalMountedMovement({ registry: terrainFixture.registry, claim: terrainClaim.claim, rider: terrainFixture.knight, mount: terrainFixture.warhorse, destination: { x: 3, y: 2, altitudeFeet: 0 }, movementMode: "walk", terrain: { ladder: true } });

const strikeFixture = createPhase3C3BMountedFixture("strike");
const strikeTarget = makeActor("spearman", "enemy:strike-target", "enemy", { x: 3, y: 2, altitudeFeet: 0 });
const strikeWeapon = strikeFixture.knight.weaponProfiles[0];
const strikeClaim = claimCanonicalMountedAction({ registry: strikeFixture.registry, mountedTurnId: strikeFixture.turn.mountedTurn.mountedTurnId, actionKey: "mounted-rider-strike", owner: "rider", generationId: strikeFixture.generationId, initiativeTurnId: strikeFixture.initiativeTurnId, targetId: strikeTarget.id, attackId: strikeWeapon.profileKey });
let riderImpactCount = 0;
const strike = executeCanonicalMountedRiderAttack({ registry: strikeFixture.registry, claim: strikeClaim.claim, rider: strikeFixture.knight, mount: strikeFixture.warhorse, target: strikeTarget, weapon: strikeWeapon, pair: strikeFixture.pair, authorizeImpact: () => ({ accepted: true }), resolveImpact: ({ attacker, target }) => { riderImpactCount += 1; return { attacker, target, damage: 0, pipeline: "canonical-impact-pipeline" }; } });
const strikeComplete = completeCanonicalMountedAction({ registry: strikeFixture.registry, actionToken: strikeClaim.claim.actionToken });

const hoofFixture = createPhase3C3BMountedFixture("hoof");
const hoofTarget = makeActor("spearman", "enemy:hoof-target", "enemy", { x: 3, y: 2, altitudeFeet: 0 });
const hoof = hoofFixture.warhorse.naturalAttackProfiles[0];
const hoofClaim = claimCanonicalMountedAction({ registry: hoofFixture.registry, mountedTurnId: hoofFixture.turn.mountedTurn.mountedTurnId, actionKey: "mount-natural-attack", owner: "mount", generationId: hoofFixture.generationId, initiativeTurnId: hoofFixture.initiativeTurnId, targetId: hoofTarget.id, attackId: hoof.profileKey });
let hoofImpactCount = 0;
const hoofAttack = executeCanonicalMountNaturalAttack({ registry: hoofFixture.registry, claim: hoofClaim.claim, rider: hoofFixture.knight, mount: hoofFixture.warhorse, target: hoofTarget, naturalAttack: hoof, pair: hoofFixture.pair, authorizeImpact: () => ({ accepted: true }), resolveImpact: ({ attacker, target }) => { hoofImpactCount += 1; return { attacker, target, damage: 0, armorAuthority: "target" }; } });
const hoofComplete = completeCanonicalMountedAction({ registry: hoofFixture.registry, actionToken: hoofClaim.claim.actionToken });

const controlFixture = createPhase3C3BMountedFixture("control");
const controlClaim = claimCanonicalMountedAction({ registry: controlFixture.registry, mountedTurnId: controlFixture.turn.mountedTurn.mountedTurnId, actionKey: "control-mount", owner: "rider", generationId: controlFixture.generationId, initiativeTurnId: controlFixture.initiativeTurnId });
let moraleCalls = 0;
const routineControl = resolveCanonicalMountControl({ registry: controlFixture.registry, claim: controlClaim.claim, rider: controlFixture.knight, mount: controlFixture.warhorse, pressure: false, resolveExistingMorale: () => { moraleCalls += 1; return { outcome: "obey", rollMade: true }; } });
const pressureFixture = createPhase3C3BMountedFixture("pressure");
const pressureClaim = claimCanonicalMountedAction({ registry: pressureFixture.registry, mountedTurnId: pressureFixture.turn.mountedTurn.mountedTurnId, actionKey: "control-mount", owner: "rider", generationId: pressureFixture.generationId, initiativeTurnId: pressureFixture.initiativeTurnId });
const pressureControl = resolveCanonicalMountControl({ registry: pressureFixture.registry, claim: pressureClaim.claim, rider: pressureFixture.knight, mount: pressureFixture.warhorse, pressure: true, resolveExistingMorale: () => { moraleCalls += 1; return { outcome: "hesitate", rollMade: true, authority: "canonical-animal-morale" }; } });
const unconsciousControl = resolveCanonicalMountControl({ registry: pressureFixture.registry, claim: pressureClaim.claim, rider: { ...pressureFixture.knight, unconscious: true }, mount: pressureFixture.warhorse, pressure: true });

const riderTargetMelee = resolveCanonicalMountedTarget({ pair: targeted.pair, attacker: { ...targeted.archer, position: { x: 30, y: 30 } }, target: targeted.knight, deliveryType: "melee", reachFeet: 5 });
const grappleRider = resolveMountedGrappleTarget({ pair: targeted.pair, target: targeted.knight, requestedInteraction: "pull-rider" });
const grappleMount = resolveMountedGrappleTarget({ pair: targeted.pair, target: targeted.warhorse, requestedInteraction: "restrain-mount" });
const riderOutcome = resolveMountedOutcome({ rider: { ...targeted.knight, isSurrendered: true }, mount: targeted.warhorse, riderOutcome: "surrendered", mountOutcome: "contested" });
const riderIncap = resolveMountedIncapacitation({ registry: targeted.registry, linkId: targeted.mounted.link.linkId, rider: { ...targeted.knight, unconscious: true }, mount: targeted.warhorse, generationId: targeted.generationId, initiativeTurnId: targeted.initiativeTurnId, actionToken: `${targeted.initiativeTurnId}:incap` });

const continuation = createCanonicalMountedContinuation({ registry: moved.registry, mountedTurnId: moved.turn.mountedTurn.mountedTurnId, actionToken: moved.claim.claim.actionToken, nextOwner: "rider", targetId: "enemy:next", attackId: moved.rider.weaponProfiles[0].profileKey, position: moved.mount.position });
const consumed = consumeCanonicalMountedContinuation({ registry: moved.registry, receipt: continuation.receipt, mountedTurnId: moved.turn.mountedTurn.mountedTurnId, generationId: moved.generationId, initiativeTurnId: moved.initiativeTurnId });
const consumedAgain = consumeCanonicalMountedContinuation({ registry: moved.registry, receipt: continuation.receipt, mountedTurnId: moved.turn.mountedTurn.mountedTurnId, generationId: moved.generationId, initiativeTurnId: moved.initiativeTurnId });
const duplicateCompletion = completeCanonicalMountedAction({ registry: moved.registry, actionToken: moved.claim.claim.actionToken });
const independent = rejectMountedRiderIndependentMovement({ registry: targeted.registry, rider: targeted.knight, requestedPosition: { x: 99, y: 99 } });
const presentation = getCanonicalMountedPresentation({ pair: targeted.pair, mountedTurn: targeted.turn.mountedTurn });
const activeValidation = validateCanonicalMountedState({ registry: targeted.registry, actors: [targeted.knight, targeted.warhorse] });
const postOutcomeClaim = claimCanonicalMountedAction({ registry: targeted.registry, mountedTurnId: targeted.turn.mountedTurn.mountedTurnId, actionKey: "mounted-walk", owner: "mount", generationId: targeted.generationId, initiativeTurnId: targeted.initiativeTurnId, combatActive: false });

const eventTypes = (entries) => new Set((entries || []).map((entry) => entry.eventType));
const movedEvents = eventTypes(moved.diagnostics);
const chargeEvents = eventTypes(charged.diagnostics);
const forcedEvents = eventTypes(forced.diagnostics);
const forbiddenEvents = eventTypes(browser.diagnostics);
const checks = [
  ["1 Knight and Warhorse remain separate actors", moved.rider.id !== moved.mount.id && moved.rider.actorKey === "knight" && moved.mount.actorKey === "warhorse"],
  ["2 mounted link uses canonical carrierLink", moved.mounted.link.relationshipType === "mounted" && carrierSource.includes("establishCanonicalCarrierLink")],
  ["3 mount owns position", moved.movement.link.positionAuthority === "carrier"],
  ["4 rider position is derived", moved.rider.position.x === moved.mount.position.x && movedEvents.has("rider-position-derived")],
  ["5 rider cannot Walk independently", independent.accepted === false && independent.reason === "rider-independent-movement"],
  ["6 pair uses one coordinated initiative opportunity", moved.registry.turns.size === 1],
  ["7 rider and mount keep separate action ledgers", moved.turn.mountedTurn.riderActionsRemaining === 2 && moved.turn.mountedTurn.mountActionsRemaining === 2],
  ["8 rider action does not spend mount action", strikeComplete.mountedTurn.mountActionsRemaining === 2 && strikeComplete.mountedTurn.riderActionsRemaining === 1],
  ["9 mount action does not spend rider action", hoofComplete.mountedTurn.riderActionsRemaining === 2 && hoofComplete.mountedTurn.mountActionsRemaining === 1],
  ["10 coordinated charge claims both where required", charged.completion.mountedTurn.riderActionsRemaining === 1 && charged.completion.mountedTurn.mountActionsRemaining === 1],
  ["11 duplicate mounted turn is rejected", duplicateTurn.reason === "duplicate-mounted-turn"],
  ["12 stale mounted turn is rejected", staleTurn.reason === "stale-mounted-callback"],
  ["13 Mounted Walk spends mount stamina once", moved.movement.stamina.applied === 1],
  ["14 Mounted Run spends mount stamina once", runMove.accepted && runSpend.calls === 1 && runSpend.applied === 2],
  ["15 rejected mounted movement spends zero", !rejectedMove.accepted && rejectedSpend.calls === 0],
  ["16 mounted movement preserves rider attachment", moved.registry.carrierRegistry.activeByPassenger.get(moved.rider.id) === moved.mounted.link.linkId],
  ["17 occupied destination is rejected", rejectedMove.reason === "occupied-mounted-destination"],
  ["18 impossible terrain is rejected", terrainMove.reason === "impossible-mounted-terrain"],
  ["19 rider can target legal enemy", strike.accepted && strike.target.id === strikeTarget.id],
  ["20 rider attack uses rider weapon", strike.weapon.profileKey === strikeWeapon.profileKey],
  ["21 mount attack uses natural profile", hoofAttack.accepted && hoofAttack.naturalAttack.profileKey === hoof.profileKey],
  ["22 rider attack does not grant free hoof attack", riderImpactCount === 1 && hoofImpactCount === 1],
  ["23 rider weapon is not added to mount inventory", !strikeFixture.warhorse.inventory.some((item) => item.profileKey === strikeWeapon.profileKey)],
  ["24 hoof is not added to rider inventory", !hoofFixture.knight.inventory.some((item) => item.profileKey === hoof.profileKey)],
  ["25 Mounted Charge requires straight path", source.includes("path.straightLine !== true")],
  ["26 Mounted Charge uses mount movement", chargeEvents.has("mounted-movement-committed") || charged.charge.events.some((entry) => entry.eventType === "carrier-link-state-changed")],
  ["27 Lance impact uses rider attack identity", charged.charge.events.some((entry) => entry.eventType === "mounted-rider-attack-entered" && entry.data.attackId === "shop-item:205:lance")],
  ["28 charge passes through canonical impact pipeline", charged.charge.impact.pipeline === "canonical-impact-pipeline"],
  ["29 brace resolves before charge injury commit", charged.order.join(",") === "brace,authorized,impact"],
  ["30 charge cannot mutate HP before authorization", charged.order.indexOf("authorized") < charged.order.indexOf("impact")],
  ["31 rider and mount are independently targetable", targeted.riderTarget.targetKind === "rider" && targeted.mountTarget.targetKind === "mount"],
  ["32 rider armor protects rider only", targeted.riderTarget.armorAuthority === "rider" && targeted.riderArmor.profileKey === "armor.plate-harness"],
  ["33 mount hide protects mount only", targeted.mountTarget.armorAuthority === "mount" && targeted.mountArmor.armorClass === "natural-hide"],
  ["34 projectile may target rider", targeted.riderTarget.accepted],
  ["35 projectile may target mount", targeted.mountTarget.accepted],
  ["36 ordinary melee cannot target impossible rider geometry", riderTargetMelee.reason === "impossible-rider-geometry"],
  ["37 mount injury does not directly reduce rider HP", forced.forced.rider.currentHP === forced.knight.currentHP],
  ["38 rider injury does not directly reduce mount HP", strike.mount.currentHP === strikeFixture.warhorse.currentHP],
  ["39 mount natural attack enters armor authority", hoofAttack.impact.armorAuthority === "target"],
  ["40 mounted natural 20 remains subject to armor authority", source.includes("authorizeImpact") && !source.includes("naturalRoll === 20 ?")],
  ["41 routine control requires no unnecessary roll", routineControl.outcome === "obey" && !routineControl.rollMade && moraleCalls === 1],
  ["42 pressure may trigger control check", pressureControl.rollMade && moraleCalls === 1],
  ["43 failed control may produce hesitation", pressureControl.outcome === "hesitate"],
  ["44 mount panic uses canonical animal morale", pressureControl.events.some((entry) => entry.eventType === "mounted-link-control-lost")],
  ["45 unconscious rider cannot command movement", unconsciousControl.reason === "rider-cannot-control-mount"],
  ["46 rider incapacitation preserves mount actor", riderIncap.accepted && riderIncap.mount.id === targeted.warhorse.id],
  ["47 mount incapacitation starts forced dismount", forcedEvents.has("forced-dismount-started")],
  ["48 forced dismount uses canonical falling/stability authority", forced.forced.fall.accepted && forced.forced.release.fallClaim.accepted],
  ["49 forced dismount resolves once", forced.forced.forcedDismount.state === "completed"],
  ["50 stale forced-dismount callback is rejected", forced.duplicate.reason === "duplicate-forced-dismount"],
  ["51 rider does not remain attached after completed dismount", !forced.registry.carrierRegistry.activeByPassenger.has(forced.knight.id)],
  ["52 rider receives legal independent position", forced.forced.rider.position.x === 3 && forced.forced.rider.position.y === 2],
  ["53 occupied dismount position is rejected", carrierSource.includes("occupied-dismount-destination")],
  ["54 voluntary Dismount works", MOUNTED_ACTION_CONTRACTS.dismount.executor === "executeCanonicalDismountAction"],
  ["55 Emergency Dismount works", MOUNTED_ACTION_CONTRACTS["emergency-dismount"].executor === "executeCanonicalDismountAction"],
  ["56 grapple rider is distinguished from grapple mount", grappleRider.targetKind === "rider" && grappleMount.targetKind === "mount"],
  ["57 grapple cannot create synthetic sidearm", !grappleRider.syntheticSidearmAllowed],
  ["58 rider surrender does not delete mount", riderOutcome.mount.remainsInWorld && riderOutcome.mount.outcome === "contested"],
  ["59 mount does not open humanoid surrender panel", riderOutcome.mount.humanoidSurrenderPanel === false],
  ["60 mount escape remains independent outcome", resolveMountedOutcome({ rider: targeted.knight, mount: targeted.warhorse, mountOutcome: "escapes" }).mount.outcome === "escapes"],
  ["61 continuation preserves pair identity", continuation.receipt.pairId === moved.pair.pairId],
  ["62 continuation preserves separate action ledgers", continuation.receipt.riderActionsRemaining === moved.completion.mountedTurn.riderActionsRemaining && continuation.receipt.mountActionsRemaining === moved.completion.mountedTurn.mountActionsRemaining],
  ["63 continuation cannot mint random execution key", continuation.receipt.executionKey === continuation.receipt.continuationId],
  ["64 continuation is consumed exactly once", consumed.accepted && consumedAgain.reason === "mounted-continuation-rejected"],
  ["65 stale continuation cannot move", consumedAgain.accepted === false && moved.mount.position.x === 12],
  ["66 stale continuation cannot attack", consumedAgain.accepted === false && riderImpactCount === 1],
  ["67 duplicate completion is blocked", duplicateCompletion.reason === "duplicate-completion"],
  ["68 duplicate finalizer is blocked", moved.completion.mountedTurn.handoffCount <= 1],
  ["69 round rollback is blocked", source.includes("turn.generationId !== generationId")],
  ["70 turn-key mismatch is absent", !forbiddenEvents.has("turn-key-mismatch")],
  ["71 no post-outcome mounted movement", postOutcomeClaim.reason === "stale-mounted-callback"],
  ["72 no post-outcome mounted attack", source.includes("combatActive === false")],
  ["73 deterministic browser scenario has zero authority errors", browser.authorityErrorCount === 0 && activeValidation.valid],
  ["74 exactly one combat-over event occurs", browser.combatOverCount === 1 && presentation.riderTargetable && presentation.mountTargetable],
];

assert.equal(checks.length, 74);
for (const [name, passed] of checks) assert.equal(Boolean(passed), true, name);
console.log(`Phase 3C3B mounted ground combat passed: ${checks.length}/74`);
