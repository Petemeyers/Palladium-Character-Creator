import { getCanonicalCombatActorDefinition } from "../../data/canonicalCombatActors.js";
import { planAiToggleResume } from "../aiToggleResume.js";
import { applyAuthoritativeExhaustionCollapse, isConsciousExhaustionCollapse } from "./exhaustionCollapseState.js";
import { resolveGrappleWeaponDisposition } from "./grappleWeaponTransitions.js";
import { normalizeReferenceCombatActor } from "./normalizeCombatActorSchema.js";
import { applySurrenderResponse, offerRoutedExhaustedCowerSurrender, offerSurrender } from "./surrenderState.js";
import { validateCombatActor } from "./validateCombatActor.js";

export function runPhase3C0ReferenceActorScenario() {
  const inputs = [
    { ...getCanonicalCombatActorDefinition("knight"), id: "party-knight", team: "party", side: "party", controlMode: "manual", position: { x: 1, y: 1 } },
    { ...getCanonicalCombatActorDefinition("goblin-warrior"), id: "enemy-goblin", team: "enemy", side: "enemy", position: { x: 7, y: 1 } },
    { ...getCanonicalCombatActorDefinition("minotaur"), id: "enemy-minotaur", team: "enemy", side: "enemy", position: { x: 9, y: 1 } },
  ];
  const fighters = inputs.map((actor) => normalizeReferenceCombatActor(actor, { source: "phase3c0-reference-scenario" }).normalizedActor);
  const validations = fighters.map((actor) => validateCombatActor(actor, { normalize: false }));
  const knight = fighters[0];
  const goblin = { ...fighters[1], position: { x: 6, y: 1 } };
  const minotaur = fighters[2];
  const takeover = planAiToggleResume({ aiControlEnabled: true, isPartyActor: true, effectiveControlMode: "ai" });
  const axeDisposition = resolveGrappleWeaponDisposition({
    fighter: minotaur,
    readyWeapon: minotaur.weaponProfiles.find((profile) => profile.profileKey === "weapon.minotaur-heavy-axe"),
    position: minotaur.position,
    initiativeTurnId: "phase3c0:turn:minotaur",
    actionToken: "phase3c0:turn:minotaur:1",
  });
  const sharedHex = { x: 4, y: 1 };
  const grapplingKnight = { ...knight, currentStamina: 0, combatStamina: { ...knight.combatStamina, current: 0 }, grappleState: { state: "grapple_clinch", positionState: "standing", opponent: minotaur.id, sharedHex } };
  const grapplingMinotaur = { ...minotaur, combatWeaponState: axeDisposition.combatWeaponState, grappleState: { state: "grapple_clinch", positionState: "standing", opponent: knight.id, sharedHex } };
  const collapse = applyAuthoritativeExhaustionCollapse({ fighters: [grapplingKnight, goblin, grapplingMinotaur], fighterId: knight.id, currentStamina: 0, round: 1, turn: 3 });
  const collapsedKnight = collapse.fighters.find((actor) => actor.id === knight.id);
  const surrenderOffer = offerRoutedExhaustedCowerSurrender({ ...goblin, currentHP: 3, moraleState: { status: "ROUTED" }, currentStamina: 0 }, { offeredToId: knight.id, actionToken: "phase3c0:turn:goblin:1" });
  const surrenderedGoblin = applySurrenderResponse(surrenderOffer, "accepted", { acceptedById: knight.id });
  const surrenderedMinotaur = applySurrenderResponse(
    offerSurrender(collapse.fighters.find((actor) => actor.id === minotaur.id), {
      offeredToId: knight.id,
      actionToken: "phase3c0:turn:minotaur:2",
      reason: "controlled-and-exhausted",
    }),
    "accepted",
    { acceptedById: knight.id },
  );
  const actionLedger = [
    { actorId: goblin.id, actionToken: "phase3c0:turn:goblin:1", actionType: "move" },
    { actorId: minotaur.id, actionToken: "phase3c0:turn:minotaur:1", actionType: "grapple" },
    { actorId: knight.id, actionToken: "phase3c0:turn:knight:1", actionType: "holdAndRest" },
    { actorId: knight.id, actionToken: "phase3c0:turn:knight:2", actionType: "demandSurrender" },
  ];
  const battleOutcome = {
    completed: surrenderedGoblin.defeated === true && surrenderedMinotaur.defeated === true,
    winnerSide: "party",
    schemaErrors: validations.reduce((count, result) => count + result.errors.length, 0),
    deadFighterIds: [],
  };
  const scenarioCompleted = battleOutcome.completed && battleOutcome.schemaErrors === 0 &&
    validations.every((result) => result.valid) && actionLedger.every((entry) => Boolean(entry.actionToken));
  return {
    fighters: collapse.fighters,
    validations,
    positionsAuthoritative: inputs.every((actor, index) => fighters[index].position.x === actor.position.x && fighters[index].position.y === actor.position.y),
    goblinMoved: goblin.position.x === 6,
    manualToAiTakeover: takeover.eligible && takeover.shouldSchedule,
    axeDisposition,
    minotaurNaturalAttacks: minotaur.attacks.filter((attack) => attack.isNaturalAttack),
    collapseNonterminal: collapse.combatTerminal === false && isConsciousExhaustionCollapse(collapsedKnight),
    surrenderOffer,
    surrenderResolutions: [surrenderedGoblin, surrenderedMinotaur],
    battleOutcome,
    actionLedger,
    scenarioCompleted,
    normalizationSources: fighters.map((actor) => actor.schemaNormalizedAt),
  };
}

export default runPhase3C0ReferenceActorScenario;
