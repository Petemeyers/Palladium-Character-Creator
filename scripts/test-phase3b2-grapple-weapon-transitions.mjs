import assert from "node:assert/strict";
import fs from "node:fs";
import {
  applyInitialGrappleTurnEndingCommitment,
  drawClinchDaggerTransition,
  getPhase3B2GrappleActions,
  normalizeCombatWeaponState,
  recoverDroppedWeaponTransition,
  resolveGrappleWeaponDisposition,
  restoreRetainedWeaponAfterGrapple,
} from "../src/utils/combat/grappleWeaponTransitions.js";
import { resolveGrappleTurnAction } from "../src/utils/ai/resolveGrappleTurnAction.js";
import { transitionCanonicalGrappleExecutionRecord } from "../src/utils/combat/canonicalGrappleExecution.js";
const GRAPPLE_STATES = { NEUTRAL: "neutral", CLINCH: "grapple_clinch", GROUND: "grapple_ground", GRAPPLED: "grappled" };

const hex = { x: 2, y: 3 };
const poleaxe = { id: "poleaxe", name: "Poleaxe", requiresTwoHands: true, category: "polearm", damage: "1d10" };
const sword = { id: "long-sword", name: "Long Sword", handed: "one-handed", category: "sword", damage: "1d8" };
const dagger = { id: "dagger", name: "Dagger", handed: "one-handed", category: "dagger", usableInClinch: true, damage: "1d4" };
const neutral = (id, weapon) => ({ id, name: id, remainingActions: 2, equistaminadWeapons: weapon ? [weapon, dagger] : [dagger], hex, position: hex, grappleState: { state: GRAPPLE_STATES.NEUTRAL, opponent: null } });
const clinched = (fighter, opponentId, isAttacker) => ({
  ...fighter,
  grappleState: { state: GRAPPLE_STATES.CLINCH, positionState: "standing", opponent: opponentId, isAttacker, sharedHex: hex },
});

// A/B: a true metadata-defined two-handed weapon drops before either success or failure.
const poleaxeFighter = neutral("poleaxe-knight", poleaxe);
const drop = resolveGrappleWeaponDisposition({ fighter: poleaxeFighter, position: hex, initiativeTurnId: "turn-a", actionToken: "token-a", round: 1, turn: 1 });
assert.equal(drop.disposition, "dropped-two-handed");
assert.equal(drop.combatWeaponState.readyWeaponId, null);
assert.equal(drop.droppedItemRecord.currentHex.x, 2);
assert.deepEqual(drop.droppedItemRecord.itemSnapshot, poleaxe, "permanent weapon snapshot remains available");
assert.equal(drop.droppedItemRecord.recoverable, true);
assert.equal(drop.combatWeaponState.droppedWeaponIds.includes("poleaxe"), true);
const failedAttemptState = { ...poleaxeFighter, combatWeaponState: drop.combatWeaponState };
assert.equal(normalizeCombatWeaponState(failedAttemptState).droppedWeaponIds.includes("poleaxe"), true, "failed opposed roll does not restore the dropped weapon");
assert.equal(normalizeCombatWeaponState(failedAttemptState).readyWeaponId, null, "combat-only null readiness must not resurrect a dropped permanent-inventory weapon");
const successfulCommit = applyInitialGrappleTurnEndingCommitment(failedAttemptState, { grappleState: { state: GRAPPLE_STATES.CLINCH, opponent: "target" } });
assert.equal(successfulCommit.remainingActions, 0);
assert.equal(successfulCommit.attacksRemaining, 0);

// C: one-handed weapons are retained but cannot attack in the clinch.
const swordFighter = neutral("sword-knight", sword);
const retained = resolveGrappleWeaponDisposition({ fighter: swordFighter, position: hex, initiativeTurnId: "turn-c", actionToken: "token-c" });
assert.equal(retained.disposition, "retained-unusable-in-clinch");
assert.equal(retained.retainedWeaponId, "long-sword");
assert.equal(retained.combatWeaponState.readyWeaponId, null);
assert.equal(retained.clinchWeaponReady, false);

// D/E: either role can draw; drawing ends the turn, rolls nothing, and drops a retained primary.
const defender = clinched({ ...swordFighter, combatWeaponState: retained.combatWeaponState, remainingActions: 1 }, "controller", false);
const controller = clinched({ ...neutral("controller", sword), remainingActions: 2 }, defender.id, true);
const defenderDraw = drawClinchDaggerTransition({ fighter: defender, opponent: controller, position: hex, actionToken: "draw-d" });
assert.equal(defenderDraw.ok, true);
assert.equal(defenderDraw.fighter.remainingActions, 0);
assert.equal(defenderDraw.combatWeaponState.clinchWeaponReady, true);
assert.equal(defenderDraw.primaryWeaponDropped, true);
assert.equal(defenderDraw.droppedItemRecord.itemId, "long-sword");
const controllerDisposition = resolveGrappleWeaponDisposition({ fighter: controller, position: hex, actionToken: "controller-entry" });
const controllingDraw = drawClinchDaggerTransition({ fighter: { ...controller, combatWeaponState: controllerDisposition.combatWeaponState }, opponent: defender, position: hex, actionToken: "draw-e" });
assert.equal(controllingDraw.ok, true);
assert.equal(controllingDraw.fighter.remainingActions, 0);

// F: a later, already-ready dagger routes to one explicit strike action.
const daggerReady = { ...defenderDraw.fighter, remainingActions: 2 };
const daggerOpponent = { ...controller, grappleState: { ...controller.grappleState, opponent: daggerReady.id } };
assert.equal(resolveGrappleTurnAction({ actor: daggerReady, opponent: daggerOpponent, remainingActions: 2, availableClinchWeapons: daggerReady.equistaminadWeapons }).actionType, "clinchStrike");

// G: standing menu excludes groundAttack; grounded state enables it.
const standingActions = getPhase3B2GrappleActions(daggerReady, daggerOpponent);
assert.equal(standingActions.includes("clinchStrike"), true);
assert.equal(standingActions.includes("groundAttack"), false);
const takedownActor = { ...daggerReady, grappleState: { ...daggerReady.grappleState, state: GRAPPLE_STATES.GROUND, positionState: "grounded" } };
const takedownTarget = { ...daggerOpponent, grappleState: { ...daggerOpponent.grappleState, state: GRAPPLE_STATES.GRAPPLED, positionState: "grounded" } };
assert.equal(getPhase3B2GrappleActions(takedownActor, takedownTarget).includes("groundAttack"), true);

// H: recovery requires neutral state, same hex, and one action; it ends the turn.
const escaped = restoreRetainedWeaponAfterGrapple({ ...failedAttemptState, remainingActions: 1, grappleState: { state: GRAPPLE_STATES.NEUTRAL, opponent: null } });
const recovered = recoverDroppedWeaponTransition({ fighter: escaped, droppedItem: drop.droppedItemRecord, round: 2, turn: 4 });
assert.equal(recovered.ok, true);
assert.equal(recovered.fighter.remainingActions, 0);
assert.equal(recovered.combatWeaponState.readyWeaponId, "poleaxe");
assert.equal(recovered.combatWeaponState.droppedWeaponIds.includes("poleaxe"), false);

// AI: defender tries escape with action one; action two draws. Controller draws; ready dagger strikes later.
const route = (actor, opponent) => resolveGrappleTurnAction({ actor, opponent, grappleState: actor.grappleState, remainingActions: actor.remainingActions, availableClinchWeapons: actor.equistaminadWeapons, initiativeTurnId: "turn", turnToken: "token" });
assert.equal(route({ ...defender, remainingActions: 2 }, controller).actionType, "breakFree");
assert.equal(route({ ...defender, remainingActions: 1 }, controller).actionType, "drawClinchDagger");
assert.equal(route({ ...controller, combatWeaponState: controllerDisposition.combatWeaponState }, defender).actionType, "drawClinchDagger");
assert.equal(route(daggerReady, daggerOpponent).actionType, "clinchStrike");

// Canonical no-roll utility actions still traverse selected -> dispatched -> resolving -> committed -> completed.
let noRollRecord = { state: "created", rollStarted: false };
for (const nextState of ["selected", "dispatched", "resolving", "committed", "completed"]) {
  const transition = transitionCanonicalGrappleExecutionRecord(noRollRecord, nextState, 10);
  assert.equal(transition.ok, true, `no-roll action must permit canonical ${noRollRecord.state} -> ${nextState}`);
  noRollRecord = transition.record;
}
assert.equal(noRollRecord.state, "completed");
assert.equal(noRollRecord.rollStarted, false);

// Runtime source no longer imports or invokes automatic follow-up weapon selection.
const handlerSource = fs.readFileSync(new URL("../src/utils/combatActionHandlers/grappleActions.js", import.meta.url), "utf8");
const grapplingSource = fs.readFileSync(new URL("../src/utils/grapplingSystem.js", import.meta.url), "utf8");
assert.doesNotMatch(handlerSource, /selectGrappleFollowUpWeapon/);
assert.match(handlerSource, /grapple-success-turn-ending-commitment/);
assert.match(handlerSource, /clinch-dagger-drawn/);
assert.match(grapplingSource, /requiredPosition = "ground"/);
assert.match(grapplingSource, /positionState = "grounded"/);

console.log("Phase 3B2 grapple weapon-transition fixtures passed (A-H, AI routing, no automatic dagger route)");
