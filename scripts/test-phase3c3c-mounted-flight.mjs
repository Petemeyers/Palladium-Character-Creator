import assert from "node:assert/strict";
import fs from "node:fs";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import { buildCombatActionCatalog, getCombatActionContract } from "../src/utils/combatActionCatalog.js";
import {
  MOUNTED_FLIGHT_ACTION_CONTRACTS,
  claimCanonicalMountedFlightAction,
  completeCanonicalMountedFlightAction,
  consumeCanonicalMountedFlightContinuation,
  createCanonicalMountedFlightContinuation,
  executeCanonicalAerialRiderAttack,
  executeCanonicalAerialSeparation,
  executeCanonicalFlyingMountNaturalAttack,
  executeCanonicalMountedFlightTransition,
  filterCanonicalMountedFlightAIActions,
  getCanonicalMountedFlightPresentation,
  rejectCanonicalMountedRiderIndependentMovement,
  resolveCanonicalAerialTargetGeometry,
  resolveCanonicalIntelligentMountCommand,
  resolveCanonicalLinkedMountedFall,
  resolveFlyingMountLoad,
  resolveMountedFlightOutcome,
  validateCanonicalMountedFlightState,
  validateFlyingMountProfile,
} from "../src/utils/combat/canonicalMountedFlight.js";
import {
  INTERNAL_FLYING_MOUNT_FIXTURE_KEY,
  createInternalFlyingMountFixture,
  createPhase3C3CMountedFlightFixture,
  runAllPhase3C3CBrowserScenarios,
  runPhase3C3CAerialRiderRangedScenario,
  runPhase3C3CIntelligentCommandScenario,
  runPhase3C3CLinkedFallScenario,
  runPhase3C3CTakeoffMovementLandingScenario,
  runPhase3C3CTargetingScenario,
} from "../src/utils/combat/phase3c3cMountedFlightScenarios.js";

const source = fs.readFileSync(new URL("../src/utils/combat/canonicalMountedFlight.js", import.meta.url), "utf8");
const carrierSource = fs.readFileSync(new URL("../src/utils/combat/canonicalCarrierLink.js", import.meta.url), "utf8");
const catalogSource = fs.readFileSync(new URL("../src/utils/combatActionCatalog.js", import.meta.url), "utf8");
const takeoffScenario = runPhase3C3CTakeoffMovementLandingScenario();
const rangedScenario = runPhase3C3CAerialRiderRangedScenario();
const targetingScenario = runPhase3C3CTargetingScenario();
const fallScenario = runPhase3C3CLinkedFallScenario();
const commandScenario = runPhase3C3CIntelligentCommandScenario();
const browserScenarios = runAllPhase3C3CBrowserScenarios();

const eventTypes = (entries = []) => new Set(entries.map((entry) => entry.eventType));
const authorityErrors = new Set([
  "invalid-flying-mounted-link", "flying-mount-profile-missing", "overloaded-flying-mount",
  "rider-altitude-divergence", "rider-independent-movement", "duplicate-takeoff",
  "duplicate-landing", "duplicate-aerial-separation", "duplicate-linked-fall",
  "stale-mounted-flight-callback", "stale-linked-fall-callback",
  "mount-rider-hp-merge", "mount-rider-stamina-merge", "rider-weapon-on-mount",
  "mount-natural-attack-on-rider", "action-after-linked-fall",
  "unresolved-mounted-flight-continuation", "turn-key-mismatch", "round rollback",
  "previous-turn-busy", "busy-start-block", "duplicate completion", "duplicate finalizer",
  "post-outcome movement", "post-outcome attack", "unknown authoritative actor",
  "attack-resolution error",
]);
const browserDiagnostics = Object.values(browserScenarios).flatMap((scenario) => scenario.diagnostics || []);
const browserAuthorityErrorCount = browserDiagnostics.filter((entry) => authorityErrors.has(entry.eventType)).length;

const actionFixture = (suffix, options = {}) => createPhase3C3CMountedFlightFixture(suffix, options);
const claim = (fixture, actionKey, owner, extra = {}) => claimCanonicalMountedFlightAction({
  registry: fixture.registry,
  mountedTurnId: fixture.turn.mountedFlightTurn.mountedTurnId,
  actionKey,
  owner,
  generationId: extra.generationId ?? fixture.generationId,
  initiativeTurnId: extra.initiativeTurnId ?? fixture.initiativeTurnId,
  targetId: extra.targetId,
  attackId: extra.attackId,
  combatActive: extra.combatActive,
});

const overloadMount = createInternalFlyingMountFixture("internal:overload");
const overloadRider = {
  id: "rider:overload", size: "medium", weight: 600, equipment: [],
  riderProfile: structuredClone(getCanonicalCombatActorDefinition("knight").riderProfile),
};
const overloaded = resolveFlyingMountLoad({ mount: overloadMount, rider: overloadRider });
const impossibleMount = { ...overloadMount, flyingMountProfile: { ...overloadMount.flyingMountProfile, carryingCapacity: 0, flightLoadProfile: { ...overloadMount.flyingMountProfile.flightLoadProfile, maximumFlightLoad: 0 } } };
const impossible = resolveFlyingMountLoad({ mount: impossibleMount, rider: overloadRider });
const equipmentLoad = resolveFlyingMountLoad({
  mount: overloadMount,
  rider: { ...overloadRider, weight: 180 },
  riderEquipment: [{ weight: 30 }],
  mountEquipment: [{ weight: 20 }],
});
const missingProfile = validateFlyingMountProfile({ mount: { id: "ordinary-flyer", flightProfile: { kind: "biological" } }, rider: overloadRider });

const rejectedTakeoffFixture = actionFixture("rejected-takeoff");
const rejectedTakeoffClaim = claim(rejectedTakeoffFixture, "flying-mount-takeoff", "mount");
const rejectedTakeoff = executeCanonicalMountedFlightTransition({
  registry: rejectedTakeoffFixture.registry,
  claim: rejectedTakeoffClaim.claim,
  rider: rejectedTakeoffFixture.rider,
  mount: rejectedTakeoffFixture.mount,
  destination: { x: 2, y: 2, altitudeFeet: 10 },
  mountStaminaCost: 1,
  clearance: { takeoffBlocked: true },
});

const attackLedgerFixture = actionFixture("ledger", { airborne: true });
const target = { id: "enemy:target", name: "Target", position: { x: 5, y: 2, altitudeFeet: 20 }, currentHP: 10 };
const riderWeapon = attackLedgerFixture.rider.weaponProfiles[0];
const riderAttackClaim = claim(attackLedgerFixture, "mounted-aerial-rider-melee-attack", "rider", { targetId: target.id, attackId: riderWeapon.profileKey });
let riderImpactCount = 0;
const riderAttack = executeCanonicalAerialRiderAttack({
  registry: attackLedgerFixture.registry, claim: riderAttackClaim.claim,
  rider: attackLedgerFixture.rider, mount: attackLedgerFixture.mount, target,
  weapon: riderWeapon, horizontalDistanceFeet: 3,
  authorizeImpact: () => ({ accepted: true }),
  resolveImpact: ({ attacker, target: currentTarget }) => {
    riderImpactCount += 1;
    return { attacker, target: currentTarget, damage: 0 };
  },
});
const riderAttackCompletion = completeCanonicalMountedFlightAction({ registry: attackLedgerFixture.registry, actionToken: riderAttackClaim.claim.actionToken });

const mountAttackFixture = actionFixture("mount-attack", { airborne: true });
const naturalAttack = mountAttackFixture.mount.naturalAttackProfiles[0];
const mountAttackClaim = claim(mountAttackFixture, "flying-mount-natural-attack", "mount", { targetId: target.id, attackId: naturalAttack.profileKey });
let mountImpactCount = 0;
const mountAttack = executeCanonicalFlyingMountNaturalAttack({
  registry: mountAttackFixture.registry, claim: mountAttackClaim.claim,
  rider: mountAttackFixture.rider, mount: mountAttackFixture.mount, target,
  attack: naturalAttack, horizontalDistanceFeet: 3,
  authorizeImpact: () => ({ accepted: true }),
  resolveImpact: ({ attacker, target: currentTarget }) => {
    mountImpactCount += 1;
    return { attacker, target: currentTarget, damage: 0 };
  },
});
const mountAttackCompletion = completeCanonicalMountedFlightAction({ registry: mountAttackFixture.registry, actionToken: mountAttackClaim.claim.actionToken });

const swordGeometry = resolveCanonicalAerialTargetGeometry({
  attacker: { position: { x: 0, y: 0, altitudeFeet: 20 } },
  target: { position: { x: 0, y: 0, altitudeFeet: 0 } },
  deliveryType: "melee", reachFeet: 5, horizontalDistanceFeet: 0,
});
const lanceGeometry = resolveCanonicalAerialTargetGeometry({
  attacker: { position: { x: 0, y: 0, altitudeFeet: 10 } },
  target: { position: { x: 0, y: 0, altitudeFeet: 0 } },
  deliveryType: "melee", reachFeet: 10, horizontalDistanceFeet: 0,
});
const polearmGeometry = resolveCanonicalAerialTargetGeometry({
  attacker: { position: { x: 0, y: 0, altitudeFeet: 8 } },
  target: { position: { x: 0, y: 0, altitudeFeet: 0 } },
  deliveryType: "melee", reachFeet: 10, horizontalDistanceFeet: 0,
});

const independent = rejectCanonicalMountedRiderIndependentMovement({
  registry: targetingScenario.registry,
  rider: targetingScenario.rider,
  requestedPosition: { x: 99, y: 99, altitudeFeet: 0 },
});

const safeSeparationFixture = actionFixture("safe-separation");
const safeSeparationClaim = claim(safeSeparationFixture, "release-from-flying-mount", "rider");
const safeSeparation = executeCanonicalAerialSeparation({
  registry: safeSeparationFixture.registry, claim: safeSeparationClaim.claim,
  rider: safeSeparationFixture.rider, mount: safeSeparationFixture.mount,
  landingPosition: { x: 3, y: 2, altitudeFeet: 0 },
});
const airborneDismountFixture = actionFixture("unsafe-dismount", { airborne: true });
const airborneDismountClaim = claim(airborneDismountFixture, "release-from-flying-mount", "rider");
const unsafeDismount = executeCanonicalAerialSeparation({
  registry: airborneDismountFixture.registry, claim: airborneDismountClaim.claim,
  rider: airborneDismountFixture.rider, mount: airborneDismountFixture.mount,
  landingPosition: { x: 3, y: 2, altitudeFeet: 0 },
});
const emergencyFixture = actionFixture("emergency-separation", { airborne: true });
const emergencyClaim = claim(emergencyFixture, "emergency-aerial-separation", "rider");
const emergencySeparation = executeCanonicalAerialSeparation({
  registry: emergencyFixture.registry, claim: emergencyClaim.claim,
  rider: emergencyFixture.rider, mount: emergencyFixture.mount,
  landingPosition: { x: 3, y: 2, altitudeFeet: 0 },
  authorizeImpact: () => ({ accepted: true }),
  resolveImpact: ({ actor }) => ({ actor, damage: 0 }),
});
const emergencyDuplicate = executeCanonicalAerialSeparation({
  registry: emergencyFixture.registry, claim: emergencyClaim.claim,
  rider: emergencyFixture.rider, mount: emergencyFixture.mount,
  landingPosition: { x: 3, y: 2, altitudeFeet: 0 },
});
const staleSeparationFixture = actionFixture("stale-separation", { airborne: true });
const staleSeparationClaim = claim(staleSeparationFixture, "emergency-aerial-separation", "rider", { generationId: "wrong-generation" });
const staleSeparation = executeCanonicalAerialSeparation({
  registry: staleSeparationFixture.registry, claim: staleSeparationClaim.claim,
  rider: staleSeparationFixture.rider, mount: staleSeparationFixture.mount,
});

const fallDuplicate = resolveCanonicalLinkedMountedFall({
  registry: fallScenario.registry, rider: fallScenario.rider, mount: fallScenario.incapacitatedMount,
  linkId: fallScenario.mounted.link.linkId, generationId: fallScenario.generationId,
  initiativeTurnId: fallScenario.initiativeTurnId, actionToken: `${fallScenario.initiativeTurnId}:linked-fall`,
  landingPosition: { x: 2, y: 2, altitudeFeet: 0 },
});
const staleFallFixture = actionFixture("stale-fall", { airborne: true });
const staleFall = resolveCanonicalLinkedMountedFall({
  registry: staleFallFixture.registry,
  rider: staleFallFixture.rider,
  mount: { ...staleFallFixture.mount, currentHP: 0, unconscious: true },
  linkId: staleFallFixture.mounted.link.linkId,
  generationId: "wrong-generation",
  initiativeTurnId: staleFallFixture.initiativeTurnId,
  actionToken: "stale-fall",
  landingPosition: { x: 2, y: 2, altitudeFeet: 0 },
});

const incapacitatedCommandFixture = actionFixture("incap-command");
const incapacitatedCommandClaim = claim(incapacitatedCommandFixture, "command-intelligent-mount", "rider");
const incapacitatedCommand = resolveCanonicalIntelligentMountCommand({
  registry: incapacitatedCommandFixture.registry, claim: incapacitatedCommandClaim.claim,
  rider: { ...incapacitatedCommandFixture.rider, unconscious: true },
  mount: incapacitatedCommandFixture.mount, command: "land",
});

const continuationFixture = actionFixture("continuation", { airborne: true });
const continuationClaim = claim(continuationFixture, "command-intelligent-mount", "rider");
const continuationCommand = resolveCanonicalIntelligentMountCommand({
  registry: continuationFixture.registry, claim: continuationClaim.claim,
  rider: continuationFixture.rider, mount: continuationFixture.mount,
  command: "hold altitude", survivalRisk: "routine",
});
const continuationCompletion = completeCanonicalMountedFlightAction({ registry: continuationFixture.registry, actionToken: continuationClaim.claim.actionToken });
const continuation = createCanonicalMountedFlightContinuation({
  registry: continuationFixture.registry,
  mountedTurnId: continuationFixture.turn.mountedFlightTurn.mountedTurnId,
  actionToken: continuationClaim.claim.actionToken,
  nextOwner: "mount",
  rider: continuationFixture.rider,
  mount: continuationFixture.mount,
  targetId: target.id,
  attackId: naturalAttack.profileKey,
});
const consumedContinuation = consumeCanonicalMountedFlightContinuation({
  registry: continuationFixture.registry, receipt: continuation.receipt,
  mountedTurnId: continuationFixture.turn.mountedFlightTurn.mountedTurnId,
  generationId: continuationFixture.generationId,
  initiativeTurnId: continuationFixture.initiativeTurnId,
});
const duplicateContinuation = consumeCanonicalMountedFlightContinuation({
  registry: continuationFixture.registry, receipt: continuation.receipt,
  mountedTurnId: continuationFixture.turn.mountedFlightTurn.mountedTurnId,
  generationId: continuationFixture.generationId,
  initiativeTurnId: continuationFixture.initiativeTurnId,
});
const duplicateCompletion = completeCanonicalMountedFlightAction({ registry: continuationFixture.registry, actionToken: continuationClaim.claim.actionToken });
const staleContinuationMoveClaim = claim(continuationFixture, "mounted-flight-move", "mount", { generationId: "wrong-generation" });
const staleContinuationAttackClaim = claim(continuationFixture, "flying-mount-natural-attack", "mount", { generationId: "wrong-generation" });
const postOutcomeFixture = actionFixture("post-outcome", { airborne: true });
const postOutcomeMove = claim(postOutcomeFixture, "mounted-flight-move", "mount", { combatActive: false });
const postOutcomeAttack = claim(postOutcomeFixture, "mounted-aerial-rider-ranged-attack", "rider", { combatActive: false });
const rollbackClaim = claim(postOutcomeFixture, "mounted-flight-move", "mount", { generationId: "previous-generation" });

const riderOutcome = resolveMountedFlightOutcome({
  rider: { ...targetingScenario.rider, surrendered: true },
  mount: targetingScenario.mount,
});
const pendingOutcome = resolveMountedFlightOutcome({ rider: targetingScenario.rider, mount: targetingScenario.mount, pendingOwnership: true });
const presentationPair = {
  accepted: true,
  rider: targetingScenario.rider,
  mount: targetingScenario.mount,
  link: targetingScenario.mounted.link,
};
const presentation = getCanonicalMountedFlightPresentation({ pair: presentationPair, mountedTurn: targetingScenario.turn.mountedFlightTurn });
const validation = validateCanonicalMountedFlightState({ registry: targetingScenario.registry, actors: [targetingScenario.rider, targetingScenario.mount] });
const availableCatalog = buildCombatActionCatalog({
  actor: targetingScenario.rider,
  currentTurnEntry: targetingScenario.rider,
  selectedTarget: targetingScenario.archer,
  carrierContext: { activeLink: targetingScenario.mounted.link, mount: targetingScenario.mount, mountedFlightTurn: targetingScenario.turn.mountedFlightTurn },
});
const filteredAI = filterCanonicalMountedFlightAIActions({
  actions: [
    { key: "mounted-flight-move" },
    { key: "flying-mount-takeoff" },
    { key: "flying-mount-natural-attack", attack: targetingScenario.mount.naturalAttackProfiles[0], targetId: targetingScenario.archer.id },
  ],
  pair: presentationPair, rider: targetingScenario.rider, mount: targetingScenario.mount,
  target: targetingScenario.archer,
});

const takeoffEvents = eventTypes(takeoffScenario.takeoff.execution.events);
const movementEvents = eventTypes(takeoffScenario.movement.execution.events);
const fallEvents = eventTypes(fallScenario.fall.events);
const commandEvents = eventTypes(commandScenario.diagnostics);
const checks = [
  ["1 flying-mounted relationship uses carrierLink", takeoffScenario.mounted.link.relationshipType === "flying-mounted" && carrierSource.includes('"flying-mounted"')],
  ["2 rider and mount remain separate actors", takeoffScenario.rider.id !== takeoffScenario.mount.id],
  ["3 mount owns horizontal position", takeoffScenario.mounted.link.positionAuthority === "carrier"],
  ["4 mount owns altitude", takeoffScenario.mounted.link.altitudeAuthority === "carrier"],
  ["5 rider position is derived", takeoffScenario.movement.rider.position.x === takeoffScenario.movement.mount.position.x],
  ["6 rider altitude is derived", takeoffScenario.takeoff.rider.position.altitudeFeet === takeoffScenario.takeoff.mount.position.altitudeFeet && takeoffEvents.has("rider-altitude-derived")],
  ["7 rider cannot move independently", !independent.accepted && independent.reason === "passenger-independent-movement"],
  ["8 public Dragon is not invented when absent", getCanonicalCombatActorDefinition("dragon") == null],
  ["9 internal flying-mount fixture is not selectable", createInternalFlyingMountFixture("internal").selectable === false && !catalogSource.includes(INTERNAL_FLYING_MOUNT_FIXTURE_KEY)],
  ["10 flying mount requires explicit profile", !missingProfile.accepted && missingProfile.reason === "flying-mount-profile-missing"],
  ["11 load includes rider weight", equipmentLoad.passengerWeight === 180],
  ["12 load includes rider equipment", equipmentLoad.passengerEquipmentWeight === 30],
  ["13 load includes mount equipment", equipmentLoad.mountEquipmentWeight === 20],
  ["14 overloaded mount cannot take off", !overloaded.allowed && overloaded.reason === "overloaded-flying-mount"],
  ["15 impossible load is rejected", !impossible.allowed && impossible.reason === "impossible-flying-mount-load"],
  ["16 legal takeoff spends mount stamina once", takeoffScenario.takeoff.execution.staminaSpent === 1 && takeoffScenario.takeoff.mount.currentStamina === 19],
  ["17 rejected takeoff spends zero", !rejectedTakeoff.accepted && rejectedTakeoff.staminaSpent === 0 && rejectedTakeoffFixture.mount.currentStamina === 20],
  ["18 takeoff commits rider and mount altitude atomically", takeoffScenario.takeoff.rider.altitudeFeet === 10 && takeoffScenario.takeoff.mount.altitudeFeet === 10],
  ["19 flight movement preserves attachment", takeoffScenario.movement.execution.link.mountedFlightState.attachmentState === "saddled"],
  ["20 flight movement spends mount stamina once", takeoffScenario.movement.execution.staminaSpent === 1 && takeoffScenario.movement.mount.currentStamina === 18],
  ["21 rider attack does not spend mount action", riderAttackCompletion.mountedTurn.mountActionsRemaining === 6 && riderAttackCompletion.mountedTurn.riderActionsRemaining === 5],
  ["22 mount action does not spend rider action", mountAttackCompletion.mountedTurn.riderActionsRemaining === 6 && mountAttackCompletion.mountedTurn.mountActionsRemaining === 5],
  ["23 rider ranged attack uses rider ammunition", rangedScenario.attack.ammunition.spent === 1 && rangedScenario.attack.rider.fixtureAmmoSpent === 1],
  ["24 altitude does not extend projectile range", rangedScenario.attack.geometry.maximumDistanceFeet === rangedScenario.weapon.longRangeFeet],
  ["25 rider melee requires legal geometry", riderAttack.accepted && riderAttack.geometry.distanceFeet <= riderAttack.geometry.maximumDistanceFeet],
  ["26 sword cannot reach distant ground target", !swordGeometry.accepted],
  ["27 Lance uses existing reach only", lanceGeometry.accepted && lanceGeometry.maximumDistanceFeet === 10],
  ["28 mount natural attack uses mount identity", mountAttack.accepted && mountAttack.impact.attacker.id === mountAttackFixture.mount.id],
  ["29 rider attack grants no free mount attack", riderImpactCount === 1 && mountImpactCount === 1],
  ["30 intelligent mount may accept safe command", commandScenario.accepted.outcome === "accepted"],
  ["31 intelligent mount may reject impossible command", commandScenario.refused.outcome === "refused"],
  ["32 routine cooperative command requires no unnecessary roll", commandScenario.accepted.rollMade === false],
  ["33 rider may explicitly target ground enemy with ranged weapon", rangedScenario.attack.accepted && rangedScenario.attack.target.id === rangedScenario.target.id],
  ["34 ground attacker may target rider when geometry is legal", targetingScenario.riderTarget.accepted],
  ["35 ground attacker may target mount when geometry is legal", targetingScenario.mountTarget.accepted],
  ["36 ground melee cannot reach excessive altitude", !swordGeometry.accepted],
  ["37 polearm reach remains canonical", polearmGeometry.accepted && polearmGeometry.maximumDistanceFeet === 10],
  ["38 rider armor protects rider only", targetingScenario.rider.armorProfile !== targetingScenario.mount.armorProfile],
  ["39 mount armor or hide protects mount only", targetingScenario.mount.armorProfile.profileKey !== targetingScenario.rider.armorProfile.profileKey],
  ["40 mount incapacitation starts linked fall", fallEvents.has("linked-fall-started")],
  ["41 rider does not remain suspended", fallScenario.fall.rider.altitudeFeet === 0 && fallScenario.fall.rider.position.altitudeFeet === 0],
  ["42 linked fall creates separate rider and mount impacts", fallScenario.fall.linkedFall.impactCount === 2 && fallScenario.fall.riderFall.fallState.fallId !== fallScenario.fall.mountFall.fallState.fallId],
  ["43 mount damage does not directly become rider damage", fallScenario.fall.mountFall.damage === 3 && fallScenario.fall.riderFall.damage === 2],
  ["44 rider damage does not directly become mount damage", fallScenario.fall.rider.currentHP === fallScenario.rider.currentHP - 2 && fallScenario.fall.mount.currentHP === fallScenario.incapacitatedMount.currentHP - 3],
  ["45 linked fall resolves exactly once", fallScenario.fall.linkedFall.state === "completed" && fallDuplicate.reason === "duplicate-linked-fall"],
  ["46 stale linked-fall callback is rejected", staleFall.reason === "stale-linked-fall-callback"],
  ["47 secured rider may remain attached during descent", takeoffScenario.descend.execution.link.mountedFlightState.attachmentState === "saddled"],
  ["48 loose rider may separate", MOUNTED_FLIGHT_ACTION_CONTRACTS["emergency-aerial-separation"].attachmentRequirements.includes("loose")],
  ["49 separation creates independent rider fall", emergencySeparation.fall.accepted && emergencySeparation.fall.fallState.actorId === emergencyFixture.rider.id],
  ["50 ordinary Dismount is rejected at unsafe altitude", unsafeDismount.reason === "unsafe-aerial-dismount"],
  ["51 safe grounded dismount remains legal", safeSeparation.accepted && safeSeparation.release.link.state === "released"],
  ["52 emergency aerial separation resolves through falling", emergencySeparation.accepted && emergencySeparation.rider.position.altitudeFeet === 0],
  ["53 stale separation callback cannot mutate state", staleSeparation.reason === "stale-mounted-flight-callback" && staleSeparationFixture.registry.carrierRegistry.activeByPassenger.has(staleSeparationFixture.rider.id)],
  ["54 rider incapacitation prevents commands", incapacitatedCommand.reason === "rider-cannot-command"],
  ["55 rider incapacitation does not delete mount", incapacitatedCommand.mount == null && incapacitatedCommandFixture.mount.id.includes("internal-flying-mount")],
  ["56 mount survival remains independent", riderOutcome.mount.remainsInWorld && !riderOutcome.mount.surrendered],
  ["57 rider surrender does not automatically surrender mount", riderOutcome.rider.surrendered && !riderOutcome.mount.surrendered],
  ["58 animal mount does not open humanoid surrender panel", riderOutcome.mount.humanoidSurrenderPanel === false],
  ["59 continuation preserves altitude", continuation.receipt.altitudeFeet === 20],
  ["60 continuation preserves attachment", continuation.receipt.attachmentState === "saddled"],
  ["61 continuation preserves load", continuation.receipt.loadState === continuationFixture.mounted.load.loadState],
  ["62 continuation preserves both ledgers", continuation.receipt.riderActionsRemaining === continuationCompletion.mountedTurn.riderActionsRemaining && continuation.receipt.mountActionsRemaining === continuationCompletion.mountedTurn.mountActionsRemaining],
  ["63 continuation cannot mint random execution key", continuation.receipt.executionKey === continuation.receipt.continuationId],
  ["64 stale continuation cannot move", duplicateContinuation.reason === "mounted-continuation-rejected" && !staleContinuationMoveClaim.accepted],
  ["65 stale continuation cannot attack", !staleContinuationAttackClaim.accepted && mountImpactCount === 1],
  ["66 duplicate completion is blocked", duplicateCompletion.reason === "duplicate-completion"],
  ["67 duplicate finalizer is blocked", continuationCompletion.mountedTurn.handoffCount <= 1],
  ["68 round rollback is blocked", !rollbackClaim.accepted && rollbackClaim.reason === "stale-mounted-callback"],
  ["69 turn-key mismatch is absent", !browserDiagnostics.some((entry) => entry.eventType === "turn-key-mismatch")],
  ["70 no post-outcome flight", !postOutcomeMove.accepted],
  ["71 no post-outcome attack", !postOutcomeAttack.accepted],
  ["72 deterministic browser scenarios have zero authority errors", browserAuthorityErrorCount === 0 && validation.valid && movementEvents.has("mounted-flight-position-committed")],
  ["73 exactly one combat-over event occurs", pendingOutcome.finalizationDeferred && browserDiagnostics.filter((entry) => entry.eventType === "combat-over").length === 1 && presentation.riderTargetable && presentation.mountTargetable && commandEvents.has("intelligent-mount-command-resolved")],
];

assert.equal(Object.keys(MOUNTED_FLIGHT_ACTION_CONTRACTS).length, 13, "exactly thirteen mounted-flight actions");
assert.equal(checks.length, 73);
for (const [name, passed] of checks) assert.equal(Boolean(passed), true, name);
assert.ok(availableCatalog.some((action) => action.id === "mounted-aerial-rider-melee-attack"), "live action catalog exposes legal aerial rider action");
assert.equal(getCombatActionContract("mounted-flight-move").executorIdentity, "canonical-mounted-flight-executor");
assert.equal(filteredAI.some((action) => action.key === "flying-mount-takeoff"), false, "AI filters illegal takeoff while airborne");
assert.equal(continuationCommand.accepted && consumedContinuation.accepted, true);
assert.equal(emergencyDuplicate.accepted, false);
assert.match(source, /resolveCanonicalLinkedMountedFall/);
console.log(`Phase 3C3C mounted flight passed: ${checks.length}/${checks.length}`);
