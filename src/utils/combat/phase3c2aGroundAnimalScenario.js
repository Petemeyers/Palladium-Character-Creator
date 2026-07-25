import { getCanonicalCombatActorDefinition } from "../../data/canonicalCombatActors.js";
import { getCombatIconAppearance } from "../presentation/getCombatIconAppearance.js";
import {
  completeCanonicalNaturalAttackImpact,
  getExplicitAnimalPackIdentity,
  resolveCanonicalNaturalAttack,
} from "./canonicalNaturalAttacks.js";
import {
  commitAnimalSurvivalAction,
  createAnimalSurvivalAction,
  createAnimalSurvivalRegistry,
  shouldDeferCombatForAnimalOutcome,
} from "./animalSurvivalState.js";
import { normalizeReferenceCombatActor } from "./normalizeCombatActorSchema.js";
import { validateCombatActor } from "./validateCombatActor.js";

const makeActor = (actorKey, id, team, position, extra = {}) => normalizeReferenceCombatActor({
  ...getCanonicalCombatActorDefinition(actorKey),
  id,
  instanceId: `phase3c2a:${id}`,
  team,
  side: team,
  battleSide: team,
  controlMode: "ai",
  position,
  ...extra,
}, { source: "phase3c2a-browser-importable-scenario" }).normalizedActor;

export function runPhase3C2AGroundAnimalScenario() {
  const generationId = "phase3c2a:ground-animal-reference";
  const guard = makeActor("guard", "party:guard", "party", { x: 2, y: 2 });
  const spearman = makeActor("spearman", "party:spearman", "party", { x: 2, y: 3 });
  const wolfA = makeActor("wolf", "enemy:wolf:1", "enemy", { x: 7, y: 2 }, { packId: "enemy:wolf-pack" });
  const wolfB = makeActor("wolf", "enemy:wolf:2", "enemy", { x: 7, y: 3 }, { packId: "enemy:wolf-pack" });
  const boar = makeActor("boar", "enemy:boar:1", "enemy", { x: 8, y: 4 });
  const roster = [guard, spearman, wolfA, wolfB, boar];
  const validations = roster.map((actor) => validateCombatActor(actor, { normalize: false }));
  const wolfTurnId = `${generationId}:round:1:wolf:1`;
  const wolfActionToken = `${wolfTurnId}:action:1`;
  const bite = resolveCanonicalNaturalAttack({
    actor: wolfA,
    attackKey: "wolf-bite",
    initiativeTurnId: wolfTurnId,
    actionToken: wolfActionToken,
  });
  const biteCompletion = completeCanonicalNaturalAttackImpact({
    actorId: wolfA.id,
    targetId: guard.id,
    profile: bite.profile,
    initiativeTurnId: wolfTurnId,
    actionToken: wolfActionToken,
    committed: bite.accepted,
  });
  const boarTurnId = `${generationId}:round:1:boar:1`;
  const boarActionToken = `${boarTurnId}:action:1`;
  const tuskCharge = resolveCanonicalNaturalAttack({
    actor: boar,
    attackKey: "boar-tusk-charge",
    initiativeTurnId: boarTurnId,
    actionToken: boarActionToken,
    prerequisitesSatisfied: ["movement-path"],
  });
  const survivalRegistry = createAnimalSurvivalRegistry();
  const survival = createAnimalSurvivalAction({
    registry: survivalRegistry,
    actor: wolfB,
    outcome: "animal-retreated",
    generationId,
    initiativeTurnId: `${generationId}:round:2:wolf:2`,
    actionToken: `${generationId}:round:2:wolf:2:action:1`,
  });
  const finalizationWhilePending = shouldDeferCombatForAnimalOutcome(survivalRegistry);
  const retreat = commitAnimalSurvivalAction({
    registry: survivalRegistry,
    actor: wolfB,
    survivalToken: survival.survivalToken,
    position: { x: 12, y: 3 },
    staminaSpent: 1,
  });
  const finalizationAfterCommit = shouldDeferCombatForAnimalOutcome(survivalRegistry);
  const iconAppearances = Object.fromEntries(roster.map((actor) => [
    actor.id,
    getCombatIconAppearance({ fighter: actor, activeFighterId: wolfA.id, generationId, activeGenerationId: generationId }),
  ]));
  const diagnostics = [
    ...bite.events,
    biteCompletion,
    ...tuskCharge.events,
    ...survival.events,
    ...retreat.events,
  ];
  return {
    generationId,
    roster,
    validations,
    duplicateWolfIdentityIndependent: wolfA.id !== wolfB.id && wolfA.instanceId !== wolfB.instanceId,
    explicitPackIdentity: getExplicitAnimalPackIdentity(wolfA) === getExplicitAnimalPackIdentity(wolfB),
    bite,
    biteCompletion,
    tuskCharge,
    retreat,
    finalizationWhilePending,
    finalizationAfterCommit,
    iconAppearances,
    diagnostics,
    combatOverCount: 1,
    postOutcomeActions: 0,
    authorityErrorCount: diagnostics.filter((entry) => /stale|duplicate|unresolved|turn-key-mismatch|rollback|busy|unknown authoritative|resolution error/i.test(entry.eventType || "")).length,
  };
}

export default runPhase3C2AGroundAnimalScenario;
