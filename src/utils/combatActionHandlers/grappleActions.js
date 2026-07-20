import CryptoSecureDice from "../cryptoDice";
import {
  attemptGrapple,
  maintainGrapple,
  performTakedown,
  groundAttack,
  breakFree,
  grapplerPushOff,
  defenderPushBreak,
  defenderReversal,
  applyDamageWithArmor,
  isWeaponGrappleSuitable,
} from "../grapplingSystem.js";
import { getCombinedGrappleModifiers } from "../sizeStrengthModifiers.js";
import {
  applyGrappleFollowUpOutcome,
} from "../grappleFollowUp.js";
import { formatCombatActorLabel } from "../combatActorIdentity.js";
import { resolveArmorContact } from "../combat/armorContactResolver.js";
import {
  stripStandingAttackFieldsForClinch,
  validateClinchWeaponProfile,
} from "../combat/clinchWeaponProfiles.js";
import {
  applyInitialGrappleTurnEndingCommitment,
  drawClinchDaggerTransition,
  getReadyClinchWeaponProfile,
  isGroundedGrapple,
  isStandingClinch,
  resolveGrappleWeaponDisposition,
  restoreRetainedWeaponAfterGrapple,
} from "../combat/grappleWeaponTransitions.js";

// Debug flag for grapple system
const DEBUG_GRAPPLE = false;

function revealConcealment(fighter, reason = "movement") {
  if (!fighter) return fighter;
  const wasHidden = !!(fighter.hidden || fighter.isProwling || fighter.prowlState?.hidden);
  if (!wasHidden) return fighter;

  return {
    ...fighter,
    hidden: false,
    isProwling: false,
    prowlState: {
      ...(fighter.prowlState || {}),
      hidden: false,
      prowlSuccess: false,
      brokenBy: reason,
    },
  };
}

/**
 * Handle grapple actions
 * @param {string} actionType - Type of grapple action ('grapple', 'maintain', 'takedown', 'groundAttack', 'breakFree', etc.)
 * @param {Object} attacker - The attacker fighter object
 * @param {string} defenderId - ID of the defender fighter
 * @param {Object} context - Context object containing:
 *   - fighters: Array of all fighters
 *   - combatActive: Boolean indicating if combat is active
 *   - addLog: Function to add log messages
 *   - positions: Object mapping fighter IDs to positions
 *   - setFighters: Function to update fighters state
 *   - setPositions: Function to update positions state
 *   - clampHP: Function to clamp HP values
 *   - getFighterHP: Function to get fighter HP
 *   - applyHPToFighter: Function to apply HP changes
 */
export function executeAdmittedGrappleResolution({
  admission,
  actor: attacker,
  opponent,
  actionType,
  weaponId = null,
  attackMode = null,
} = {}, context = {}) {
  const defenderId = opponent?.id || opponent;
  const {
    fighters,
    combatActive,
    addLog,
    positions,
    getFighters,
    setFighters,
    setPositions,
    getFighterHP,
    applyHPToFighter,
    onPostHpMutation,
    validateGrappleResult,
    claimCanonicalGrappleRoll,
    validateClaimedGrappleRoll,
    grappleActionId,
    onStaleGrappleAbort,
    initiativeTurnId,
    actionToken,
    resolveGrappleHitLocation,
    registerDroppedBattlefieldItem,
    meleeRound,
    turnCounter,
  } = context;

  const admissionComplete = Boolean(
    admission &&
    admission.generationId &&
    admission.initiativeTurnId &&
    admission.actionToken &&
    Number.isInteger(admission.actionSequence) &&
    admission.actorId === attacker?.id &&
    admission.opponentId === defenderId &&
    admission.actionType === actionType &&
    admission.executionKey &&
    admission.source
  );
  if (!admissionComplete) {
    addLog?.({
      audience: "developer",
      channel: "validation",
      eventType: "grapple-inner-resolver-direct-entry-blocked",
      level: "error",
      type: "error",
      actorId: attacker?.id || null,
      targetId: defenderId || null,
      executionKey: admission?.executionKey || null,
      source: "execute-admitted-grapple-resolution",
      message: `grapple inner resolver direct entry blocked: actorId=${attacker?.id || "unknown"} actionType=${actionType || "unknown"}`,
      data: { admissionPresent: Boolean(admission), admission },
    }, "error");
    return { accepted: false, completed: true, reason: "grapple-inner-resolver-direct-entry-blocked" };
  }

  const baseContract = {
    accepted: false,
    completed: false,
    actorId: attacker?.id || null,
    opponentId: defenderId || null,
    actionType,
    weaponId,
    attackMode,
    actionSpent: false,
    staminaSpent: 0,
    impactResolved: false,
    armorContactResolved: false,
    hpDamageApplied: 0,
    stateChanged: false,
    grappleEnded: false,
    remainingActions: attacker?.remainingActions ?? null,
    initiativeTurnId: admission.initiativeTurnId,
    actionToken: admission.actionToken,
    actionSequence: admission.actionSequence,
    executionKey: admission.executionKey,
  };
  const rejectContract = (reason) => ({
    ...baseContract,
    completed: true,
    reason,
  });

  if (!combatActive) return rejectContract("combat-inactive");
  
  const initialLiveFighters =
    typeof getFighters === "function" ? getFighters() : fighters;
  const attackerInArray = initialLiveFighters.find(f => f.id === attacker.id);
  const defender = initialLiveFighters.find(f => f.id === defenderId);
  
  if (!attackerInArray || !defender) {
    addLog(`Invalid target for grapple action!`, "error");
    return rejectContract("invalid-target");
  }

  const commitInitialGrappleWeaponDisposition = () => {
    if (actionType !== "grapple") return;
    const position = positions?.[attacker.id] || attacker.hex || attacker.position;
    const disposition = resolveGrappleWeaponDisposition({
      fighter: attackerInArray,
      position,
      initiativeTurnId: admission.initiativeTurnId,
      actionToken: admission.actionToken,
      round: meleeRound,
      turn: turnCounter,
    });
    attacker.combatWeaponState = disposition.combatWeaponState;
    setFighters((current = []) => current.map((fighter) => fighter.id === attacker.id
      ? { ...fighter, combatWeaponState: disposition.combatWeaponState }
      : fighter));
    if (disposition.droppedItemRecord) registerDroppedBattlefieldItem?.(disposition.droppedItemRecord);
    if (disposition.disposition === "dropped-two-handed") {
      const weaponName = disposition.droppedItemRecord?.itemSnapshot?.name || "two-handed weapon";
      addLog(`${attacker.name} lets the ${weaponName} fall and closes to wrestle.`, "info");
      addLog?.({
        audience: "developer", channel: "state", eventType: "grapple-commitment-two-handed-weapon-dropped",
        level: "info", type: "debug", actorId: attacker.id, targetId: defenderId,
        executionKey: admission.executionKey, source: admission.source,
        message: `grapple commitment two-handed weapon dropped: actorId=${attacker.id} weaponId=${disposition.droppedWeaponId}`,
        data: { ...admission, disposition: disposition.disposition, droppedItemRecord: disposition.droppedItemRecord },
      }, "debug");
    } else if (disposition.disposition === "retained-unusable-in-clinch") {
      const retained = initialLiveFighters.find((fighter) => fighter.id === attacker.id)?.equistaminadWeapons?.find?.((weapon) =>
        (weapon?.weaponId || weapon?.id || weapon?.name) === disposition.retainedWeaponId);
      addLog(`${attacker.name} keeps hold of the ${retained?.name || "weapon"}, but cannot use it effectively in the clinch.`, "info");
      addLog?.({
        audience: "player", channel: "state", eventType: "grapple-one-handed-weapon-retained",
        level: "info", type: "info", actorId: attacker.id, targetId: defenderId,
        executionKey: admission.executionKey, source: admission.source,
        message: `${attacker.name} retains a one-handed weapon while closing to grapple.`,
        data: { ...admission, disposition: disposition.disposition, retainedWeaponId: disposition.retainedWeaponId },
      }, "info");
    }
  };
  
  // Check if attacker can act
  if (attackerInArray.remainingActions <= 0) {
    addLog(`Ã¢Å¡Â Ã¯Â¸Â ${attacker.name} is out of attacks this turn!`, "error");
    return rejectContract("no-actions-remaining");
  }
  
  const getStaleGrappleReason = (source = "grapple-roll") =>
    typeof validateGrappleResult === "function"
      ? validateGrappleResult(actionType, null, grappleActionId, source)
      : null;

  const getLiveFighters = () =>
    typeof getFighters === "function" ? getFighters() : fighters;
  const labelActor = (actor, counterpart = null, roster = getLiveFighters()) =>
    formatCombatActorLabel(actor, { roster, counterpart });
  const abortStaleGrapple = (reason) => {
    addLog(
      `stale grapple follow-up blocked: actor=${attacker?.name || "unknown"} reason=${reason || "unknown"} executionKey=${grappleActionId || "unknown"}`,
      "warning",
    );
    addLog(`Ã°Å¸Å¡Â« stale grapple follow-up aborted: ${reason}`, "warning");
    addLog("Ã°Å¸Å¡Â« stale grapple callback ignored", "warning");
    onStaleGrappleAbort?.(grappleActionId);
  };

  const preActionStaleReason = getStaleGrappleReason("grapple-action-entry");
  if (preActionStaleReason) {
    abortStaleGrapple(preActionStaleReason);
    return rejectContract(preActionStaleReason);
  }
  commitInitialGrappleWeaponDisposition();

  // Claim once at the first actual die boundary. Subsequent opposed or delayed
  // dice validate that claim without attempting to own the action again.
  const noRollAction = actionType === "drawClinchDagger" || actionType === "releaseGrapple";
  let rollKind = actionType === "grapple"
    ? "opposed-grapple-initiation"
    : actionType === "maintain"
      ? "opposed-grapple-maintain"
      : actionType === "breakFree"
        ? "break-free-opposed-roll"
        : actionType === "grapplerPushOff"
          ? "grapple-release"
          : actionType === "defenderPushBreak" || actionType === "defenderReversal"
            ? "grapple-control-transfer"
            : actionType === "groundAttack" ? "ground-attack"
              : actionType === "clinchStrike" ? "clinch-strike-attack" : `grapple-${actionType}`;
  let rollClaimed = false;
  const rollDice = () => {
    if (!rollClaimed) {
      const claim = typeof claimCanonicalGrappleRoll === "function"
        ? claimCanonicalGrappleRoll({ admission, rollKind, source: "grapple-dice-boundary" })
        : { ok: true };
      if (!claim.ok) {
        abortStaleGrapple(claim.reason || "grapple-roll-not-owned");
        const error = new Error(`grapple roll blocked: ${claim.reason || "grapple-roll-not-owned"}`);
        error.staleGrappleRoll = true;
        throw error;
      }
      rollClaimed = true;
    } else {
      const validated = typeof validateClaimedGrappleRoll === "function"
        ? validateClaimedGrappleRoll({ expectedRollKind: rollKind, source: "grapple-dice-callback" })
        : { ok: true };
      if (!validated.ok) {
        abortStaleGrapple(validated.reason || "grapple-roll-claim-not-valid");
        const error = new Error(`stale grapple roll blocked: ${validated.reason || "grapple-roll-claim-not-valid"}`);
        error.staleGrappleRoll = true;
        throw error;
      }
    }
    const rollStaleReason = getStaleGrappleReason("grapple-ground-attack-roll");
    if (rollStaleReason) {
      abortStaleGrapple(rollStaleReason);
      const error = new Error(`stale grapple roll blocked: ${rollStaleReason}`);
      error.staleGrappleRoll = true;
      throw error;
    }
    return CryptoSecureDice.rollD20();
  };
  Object.defineProperties(rollDice, {
    canonicalAdmission: { value: admission, enumerable: false },
    canonicalActionToken: { value: admission.actionToken, enumerable: false },
    canonicalExecutionKey: { value: admission.executionKey, enumerable: false },
    canonicalRollKind: { get: () => rollKind, enumerable: false },
  });
  if (!noRollAction) {
    const stateMutationClaim = typeof claimCanonicalGrappleRoll === "function"
      ? claimCanonicalGrappleRoll({ admission, rollKind, source: "grapple-resolution-boundary" })
      : { ok: false, reason: "missing-canonical-grapple-claim" };
    if (!stateMutationClaim.ok) return rejectContract(stateMutationClaim.reason);
    rollClaimed = true;
  }
  
  let result;
  let selectedGrappleWeapon = null;
  let selectedGrappleAttackMode = null;
  let armorContactOutcome = null;
  let hpDamageApplied = 0;
  try {
    switch (actionType) {
    case 'grapple': {
      // Get current positions from state to pass to initiateGrapple
      const currentAttackerPos = positions[attacker.id] || attacker.hex || attacker.position;
      const currentDefenderPos = positions[defenderId] || defender.hex || defender.position;
      result = attemptGrapple(attacker, defender, rollDice, currentAttackerPos, currentDefenderPos);
      break;
    }
    case 'improveControl':
    case 'maintain':
      result = maintainGrapple(attacker, defender, rollDice);
      // Log dice rolls for maintain grapple
      if (result && result.attackerRoll !== undefined && result.defenderRoll !== undefined) {
        const attackerPS = attacker.attributes?.PS || attacker.PS || 10;
        const defenderPS = defender.attributes?.PS || defender.PS || 10;
        const attackerPSBonus = Math.floor((attackerPS - 10) / 2);
        const defenderPSBonus = Math.floor((defenderPS - 10) / 2);
        const naturalAttacker = result.attackerRoll - attackerPSBonus;
        const naturalDefender = result.defenderRoll - defenderPSBonus;
        addLog(`Ã°Å¸Å½Â² ${attacker.name} maintain roll: ${naturalAttacker} + ${attackerPSBonus} = ${result.attackerRoll} vs ${defender.name}: ${naturalDefender} + ${defenderPSBonus} = ${result.defenderRoll}`, "info");
      }
      break;
    case 'takedown':
      result = performTakedown(attacker, defender, rollDice);
      // Log dice roll for takedown
      if (result?.takedownBreakdown) {
        const b = result.takedownBreakdown;
        addLog(
          `${attacker.name} takedown roll: d20 ${b.naturalRoll} + PS ${b.attackerPSBonus} + size ${b.sizeModifier} + leverage ${b.leverageModifier} = ${b.total} vs DC ${b.dc}`,
          "info"
        );
      } else if (result && result.takedownRoll !== undefined) {
        const attackerPS = attacker.attributes?.PS || attacker.PS || 10;
        const attackerPSBonus = Math.floor((attackerPS - 10) / 2);
        const sizeMod = getCombinedGrappleModifiers(attacker, defender);
        const sizeBonus =
          sizeMod.attackerAttackBonus ??
          sizeMod.attackBonus ??
          sizeMod.modifier ??
          0;
        const naturalRoll = result.takedownRoll - attackerPSBonus - sizeBonus;
        const bonusDisplay = (attackerPSBonus + sizeBonus) >= 0 ? `+${attackerPSBonus + sizeBonus}` : `${attackerPSBonus + sizeBonus}`;
        addLog(`Ã°Å¸Å½Â² ${attacker.name} takedown roll: ${naturalRoll} ${bonusDisplay} = ${result.takedownRoll} vs DC 15`, "info");
      }
      break;
    case 'clinchStrike':
    case 'groundAttack': {
      const standing = isStandingClinch(attacker, defender);
      const grounded = isGroundedGrapple(attacker, defender);
      if (actionType === "groundAttack" && !grounded) {
        if (standing) {
          addLog?.({
            audience: "developer", channel: "validation", eventType: "standing-clinch-used-ground-attack-resolver-blocked",
            level: "error", type: "error", actorId: attacker.id, targetId: defender.id,
            executionKey: admission.executionKey, source: admission.source,
            message: `standing clinch used ground attack resolver blocked: actorId=${attacker.id}`,
            data: admission,
          }, "error");
        }
        return rejectContract("ground-attack-requires-grounded-grapple");
      }
      if (actionType === "clinchStrike" && !standing) return rejectContract("clinch-strike-requires-standing-clinch");
      const equistaminadWeapons = [
        attacker.equistaminadWeapons?.primary,
        attacker.equistaminadWeapons?.secondary,
        ...(Array.isArray(attacker.equistaminadWeapons) ? attacker.equistaminadWeapons : []),
      ].filter(Boolean);
      const currentWeapon = equistaminadWeapons[0] || null;
      const weapon = getReadyClinchWeaponProfile(attacker);
      if (!weapon) return rejectContract("clinch-weapon-not-ready");
      const validation = validateClinchWeaponProfile(weapon);
      selectedGrappleWeapon = weapon;
      selectedGrappleAttackMode = weapon?.attackMode || null;
      rollKind = actionType === "clinchStrike" ? "clinch-strike-attack" : "ground-attack";
      addLog?.({
        audience: "developer",
        channel: "validation",
        eventType: validation.ok ? "clinch-weapon-profile-validated" : "clinch-weapon-profile-rejected",
        level: validation.ok ? "info" : "error",
        type: validation.ok ? "debug" : "error",
        actorId: attacker.id,
        targetId: defender.id,
        executionKey: grappleActionId,
        message:
          `${validation.ok ? "clinch weapon profile validated" : "clinch weapon profile rejected"}: ` +
          `actor=${attacker.name} weaponId=${weapon?.weaponId || weapon?.name || "unknown"} ` +
          `damageFormula=${weapon?.damage || "none"} sourceWeaponId=${weapon?.sourceWeaponId || "none"} ` +
          `attackMode=${weapon?.attackMode || "none"} reason=${validation.reason}`,
        data: {
          actorId: attacker.id,
          targetId: defender.id,
          weaponId: weapon?.weaponId || weapon?.name || null,
          damageFormula: weapon?.damage || null,
          sourceWeaponId: weapon?.sourceWeaponId || null,
          attackMode: weapon?.attackMode || null,
          reason: validation.reason,
        },
      }, validation.ok ? "debug" : "error");
      if (!validation.ok) {
        return rejectContract(validation.reason);
      }
      if (currentWeapon && !isWeaponGrappleSuitable(currentWeapon)) {
        addLog(`Ã¢Å¡Â Ã¯Â¸Â ${attacker.name} cannot use ${currentWeapon.name} effectively in a grapple.`, "warning");
      }
      if (weapon) {
        addLog(actionType === "clinchStrike"
          ? `${labelActor(attacker, defender)} thrusts ${weapon.name} toward an opening on ${labelActor(defender, attacker)}.`
          : `${labelActor(attacker, defender)} attacks ${labelActor(defender, attacker)} on the ground with ${weapon.name}.`, "info");
      }
      const clinchAttacker = stripStandingAttackFieldsForClinch(attacker, weapon);
      result = groundAttack(clinchAttacker, defender, weapon, rollDice, (source) => {
        const ownedDamageRoll = typeof validateClaimedGrappleRoll === "function"
          ? validateClaimedGrappleRoll({ expectedRollKind: rollKind, source })
          : { ok: true };
        if (!ownedDamageRoll.ok) {
          abortStaleGrapple(ownedDamageRoll.reason || "grapple-roll-claim-not-valid");
          const error = new Error(`stale grapple damage roll blocked: ${ownedDamageRoll.reason || "grapple-roll-claim-not-valid"}`);
          error.staleGrappleRoll = true;
          throw error;
        }
      }, actionType === "clinchStrike" ? "standing" : "ground");
      
      // Log dice roll for ground attack
      if (result && result.attackRoll !== undefined && result.naturalRoll !== undefined) {
        const attackBonus = attacker.bonuses?.attack || attacker.handToHand?.attackBonus || 0;
        const ppBonus = Math.floor(((attacker.attributes?.PP || attacker.PP || 10) - 10) / 2);
        const weaponName = String(weapon?.name || weapon?.type || "").toLowerCase();
        const daggerBonus =
          weaponName.includes("dagger") ||
          weaponName.includes("knife") ||
          weaponName.includes("short blade")
            ? 1
            : 0;
        const totalBonus = ppBonus + attackBonus + daggerBonus;
        const bonusDisplay = totalBonus >= 0 ? `+${totalBonus}` : `${totalBonus}`;

        if (actionType === "clinchStrike") {
          addLog(`${attacker.name} clinch strike roll: ${result.naturalRoll} ${bonusDisplay} = ${result.attackRoll} vs guardRating 12${result.critical ? " (critical)" : ""}`, result.critical ? "critical" : "info");
        } else if (result.critical) {
          addLog(`Ã°Å¸Å½Â² ${attacker.name} rolls NATURAL ${result.naturalRoll}! Critical ground attack! (Total: ${result.attackRoll} vs guardRating 12)`, "critical");
        } else if (result.deathBlow) {
          addLog(`Ã°Å¸Å½Â² ${attacker.name} rolls NATURAL 20! DEATH BLOW! (Total: ${result.attackRoll})`, "critical");
        } else {
          addLog(`Ã°Å¸Å½Â² ${attacker.name} ground attack roll: ${result.naturalRoll} ${bonusDisplay} = ${result.attackRoll} vs guardRating 12`, "info");
        }
      }
      
      if (DEBUG_GRAPPLE && result) {
        console.log(
          `[GRAPPLE DEBUG] ${attacker.name} vs ${defender.name} | ` +
            `nat=${result.naturalRoll} total=${result.attackRoll} ` +
            `hit=${result.hit} crit=${result.critical} deathBlow=${result.deathBlow} ` +
            `ignoresArmor=${result.ignoresArmor} dmg=${result.damage}`
        );
      }
      
      if (DEBUG_GRAPPLE) {
        console.log(
          `[GRAPPLE DEBUG] Stamina: ${attacker.name} STA=${attacker.currentStamina}, ` +
            `${defender.name} STA=${defender.currentStamina}`
        );
      }
      break;
    }
    case 'drawClinchDagger': {
      const draw = drawClinchDaggerTransition({
        fighter: attacker,
        opponent: defender,
        position: positions?.[attacker.id] || attacker.hex || attacker.position,
        round: meleeRound,
        turn: turnCounter,
        actionToken: admission.actionToken,
      });
      if (!draw.ok) return rejectContract(draw.reason);
      if (draw.droppedItemRecord) registerDroppedBattlefieldItem?.(draw.droppedItemRecord);
      result = {
        success: true,
        message: draw.primaryWeaponDropped
          ? `${attacker.name} releases the retained weapon and draws ${draw.dagger?.name || "a dagger"} in the clinch.`
          : `${attacker.name} draws ${draw.dagger?.name || "a dagger"} while struggling for control.`,
        attacker: draw.fighter,
        defender,
        noRollAction: true,
        turnEndingEffect: true,
        daggerId: draw.daggerId,
        primaryWeaponDropped: draw.primaryWeaponDropped,
        priorWeaponDisposition: draw.priorWeaponDisposition,
      };
      addLog(result.message, "info");
      addLog?.({
        audience: "player", channel: "state", eventType: "clinch-dagger-drawn",
        level: "info", type: "info", actorId: attacker.id, targetId: defender.id,
        executionKey: admission.executionKey, source: admission.source,
        message: result.message,
        data: { ...admission, daggerId: draw.daggerId, priorWeaponDisposition: draw.priorWeaponDisposition, primaryWeaponDropped: draw.primaryWeaponDropped, actionSpent: 1, turnEndingEffect: true },
      }, "info");
      break;
    }
    case 'releaseGrapple': {
      if (!isStandingClinch(attacker, defender) && !isGroundedGrapple(attacker, defender)) return rejectContract("active-grapple-required");
      result = {
        success: true,
        released: true,
        noRollAction: true,
        message: `${attacker.name} releases the grapple with ${defender.name}.`,
        attacker: restoreRetainedWeaponAfterGrapple({ ...attacker, grappleState: { ...attacker.grappleState, state: "neutral", positionState: "neutral", opponent: null } }, { round: meleeRound, turn: turnCounter, reason: "grapple-released" }),
        defender: restoreRetainedWeaponAfterGrapple({ ...defender, grappleState: { ...defender.grappleState, state: "neutral", positionState: "neutral", opponent: null } }, { round: meleeRound, turn: turnCounter, reason: "grapple-released" }),
      };
      addLog(result.message, "info");
      break;
    }
    case 'breakFree':
      result = breakFree(attacker, defender, rollDice);
      if (result?.invalidRoll) {
        const current = [...getLiveFighters()];
        const actorIndex = current.findIndex((fighter) => fighter.id === attacker.id);
        const remainingActionsBefore = actorIndex >= 0 ? Number(current[actorIndex].remainingActions ?? 0) : 0;
        if (actorIndex >= 0) {
          current[actorIndex] = { ...current[actorIndex], remainingActions: 0, attacksRemaining: 0 };
          setFighters(current);
        }
        addLog?.({
          audience: "developer", channel: "validation", eventType: "break-free-invalid-roll-blocked",
          level: "error", type: "error", actorId: attacker.id, targetId: defender.id,
          executionKey: admission.executionKey, source: admission.source,
          message: `break-free invalid roll blocked: actorId=${attacker.id} actionToken=${admission.actionToken}`,
          data: {
            ...admission,
            actorRollShape: result.characterRollBreakdown?.sourceShape || "unsupported",
            opponentRollShape: result.opponentRollBreakdown?.sourceShape || "unsupported",
            actorNaturalRoll: result.characterRollBreakdown?.naturalRoll ?? null,
            opponentNaturalRoll: result.opponentRollBreakdown?.naturalRoll ?? null,
            rejectionReason: result.rejectionReason,
            remainingActionsBefore,
            remainingActionsAfter: 0,
          },
        }, "error");
        return {
          ...baseContract, accepted: true, completed: true, success: false,
          invalidRollBlocked: true, actionSpent: true, staminaSpent: 0,
          hpDamageApplied: 0, stateChanged: false, grappleActive: true,
          grappleEnded: false, remainingActions: 0, result, noRollAction: false,
          turnEndingEffect: true, continuationCreated: false,
        };
      }
      if (result?.characterRollBreakdown?.ok && result?.opponentRollBreakdown?.ok) {
        const actorBreakdown = result.characterRollBreakdown;
        const opponentBreakdown = result.opponentRollBreakdown;
        addLog(`${attacker.name} break free roll: ${actorBreakdown.naturalRoll} + ${actorBreakdown.modifier} = ${actorBreakdown.total} vs ${defender.name}: ${opponentBreakdown.naturalRoll} + ${opponentBreakdown.modifier} = ${opponentBreakdown.total}`, "info");
      }
      // Log dice rolls for break free
      if (!result?.characterRollBreakdown && result && result.characterRoll !== undefined && result.opponentRoll !== undefined) {
        const characterPS = attacker.attributes?.PS || attacker.PS || 10;
        const opponentPS = defender.attributes?.PS || defender.PS || 10;
        const characterPSBonus = Math.floor((characterPS - 10) / 2);
        const opponentPSBonus = Math.floor((opponentPS - 10) / 2);
        // Note: breakFree adds leverage penalty to characterRoll, so we need to account for that
        const naturalCharacter = result.characterRoll - characterPSBonus; // Approximate (leverage penalty not shown separately)
        const naturalOpponent = result.opponentRoll - opponentPSBonus;
        addLog(`Ã°Å¸Å½Â² ${attacker.name} break free roll: ${naturalCharacter} + ${characterPSBonus} = ${result.characterRoll} vs ${defender.name}: ${naturalOpponent} + ${opponentPSBonus} = ${result.opponentRoll}`, "info");
      }
      break;
    case 'grapplerPushOff': {
      result = grapplerPushOff({ grappler: attacker, defender });
      break;
    }
    case 'defenderPushBreak': {
      result = defenderPushBreak({ defender: attacker, grappler: defender });
      break;
    }
    case 'reverseControl':
    case 'defenderReversal': {
      result = defenderReversal({ defender: attacker, grappler: defender });
      break;
    }
    default:
      addLog(`Unknown grapple action: ${actionType}`, "error");
      return rejectContract("unknown-grapple-action");
    }
  } catch (error) {
    if (error?.staleGrappleRoll) return rejectContract(error.message || "stale-grapple-roll");
    throw error;
  }
  if (result?.blocked && result?.reason === "grapple-dice-boundary-without-canonical-claim-blocked") {
    addLog?.({
      audience: "developer",
      channel: "validation",
      eventType: "grapple-dice-boundary-without-canonical-claim-blocked",
      level: "error",
      type: "error",
      actorId: attacker.id,
      targetId: defenderId,
      executionKey: admission.executionKey,
      source: "execute-admitted-grapple-resolution",
      message: `grapple dice boundary without canonical claim blocked: actorId=${attacker.id} actionToken=${admission.actionToken}`,
      data: { admission, rollKind },
    }, "error");
    return rejectContract(result.reason);
  }
  const actualRollObserved = Boolean(
    result && ["attackRoll", "attackerRoll", "defendRoll", "defenderRoll", "characterRoll", "opponentRoll", "takedownRoll", "naturalRoll"]
      .some((field) => result[field] !== undefined && result[field] !== null)
  );
  if (actualRollObserved) {
    addLog?.({
      audience: "developer",
      channel: "attack",
      eventType: "grapple-action-roll-resolved",
      level: "info",
      type: "debug",
      actorId: admission.actorId,
      targetId: admission.opponentId,
      executionKey: admission.executionKey,
      source: admission.source,
      message: `grapple action roll resolved: actorId=${admission.actorId} actionToken=${admission.actionToken} rollKind=${rollKind}`,
      data: { ...admission, rollKind },
    }, "debug");
  }
  
  const staleReason = getStaleGrappleReason();
  if (staleReason) {
    abortStaleGrapple(staleReason);
    return rejectContract(staleReason);
  }

  if (result.success) {
    const fraideredMovementAction = new Set([
      'grapple',
      'takedown',
      'grapplerPushOff',
      'defenderPushBreak',
      'defenderReversal',
    ]);
    const shouldRevealForMovement =
      fraideredMovementAction.has(actionType) ||
      Boolean(result.attacker?.hex) ||
      Boolean(result.defender?.hex);
    const nextAttacker =
      shouldRevealForMovement && result.attacker
        ? revealConcealment(result.attacker)
        : result.attacker;
    let nextDefender =
      shouldRevealForMovement && result.defender
        ? revealConcealment(result.defender)
        : result.defender;

    // Log dice rolls for grapple attempts
    if (result.attackRoll !== undefined && result.defendRoll !== undefined) {
      const attackRoll = result.attackRoll;
      const defendRoll = result.defendRoll;
      const breakdown = result.rollBreakdown;
      if (breakdown) {
        const attackerPSLabel = breakdown.psStepMod > 0
          ? ` + PS diff ${breakdown.attackerPSDiffBonus}`
          : "";
        const defenderPSLabel = breakdown.psStepMod < 0
          ? ` + PS diff ${breakdown.defenderPSDiffBonus}`
          : "";
        addLog(
          `${attacker.name} grapple roll: d20 ${breakdown.naturalAttackRoll} + PP ${breakdown.attackerPPBonus} + attack ${breakdown.attackerAttackBonus} + size ${breakdown.attackerSizeAttackBonus}${attackerPSLabel} = ${attackRoll}`,
          "info"
        );
        addLog(
          `${defender.name} block roll: d20 ${breakdown.naturalDefendRoll} + PP ${breakdown.defenderPPBonus} + block ${breakdown.defenderBlockBonus} + size ${breakdown.defenderSizeBlockBonus}${defenderPSLabel} = ${defendRoll}`,
          "info"
        );
      } else {
        const naturalAttack = attackRoll - (attacker.bonuses?.attack || 0) - Math.floor(((attacker.attributes?.PP || attacker.PP || 10) - 10) / 2);
        const naturalDefend = defendRoll - (defender.bonuses?.block || 0) - Math.floor(((defender.attributes?.PP || defender.PP || 10) - 10) / 2);
        addLog(`Ã°Å¸Å½Â² ${attacker.name} grapple roll: ${naturalAttack} + bonuses = ${attackRoll} vs ${defender.name}'s block: ${naturalDefend} + bonuses = ${defendRoll}`, "info");
      }
    } else if (result.attackRoll !== undefined) {
      addLog(`Ã°Å¸Å½Â² ${attacker.name} grapple roll: ${result.attackRoll}`, "info");
    } else if (result.defendRoll !== undefined && result.defendRoll === 20) {
      addLog(`Ã°Å¸Å½Â² ${defender.name} escapes with NATURAL 20!`, "critical");
    }
    
    // Safeguard against undefined message
    if (result.message) {
      addLog(result.message, "info");
    }
    if (result.weakSpot) {
      addLog(`Ã°Å¸â€”Â¡Ã¯Â¸Â ${attacker.name} slips inside the armor with ${result.weaponName || "a dagger"}.`, "critical");
    } else if (result.armorBlockedWeakSpot) {
      addLog(`Ã°Å¸â€ºÂ¡Ã¯Â¸Â ${defender.name}'s armor blocks the close-quarters attack.`, "info");
    }
    
    // Log size modifier information if present
    if (result.autoGrapple) {
      const sizeMod = getCombinedGrappleModifiers(attacker, defender);
      addLog(`Ã°Å¸â€™Âª ${sizeMod.description}`, "info");
    }
    
    // Apply damage if any
    // For takedown, damage is always applied if result.damage exists (takedown doesn't use hit property)
    // For ground attacks, result.hit indicates if the attack connected
    if (result.damage && (actionType === 'takedown' || result.hit)) {
      const damageStaleReason = getStaleGrappleReason("grapple-damage-roll");
      if (damageStaleReason) {
        abortStaleGrapple(damageStaleReason);
        return;
      }
      const updated = [...getLiveFighters()];
      const damageTargetId = defender?.id ?? defenderId;
      const defenderIndex = updated.findIndex(f => f.id === damageTargetId);
      if (defenderIndex !== -1) {
        const defenderCopy = { ...updated[defenderIndex] };
        const damageTargetLabel = labelActor(defenderCopy, attacker, updated);
        const attackerLabel = labelActor(attacker, defenderCopy, updated);

        if ((actionType === "groundAttack" || actionType === "clinchStrike") && selectedGrappleWeapon) {
          const hitLocation =
            result.hitLocation ||
            (typeof resolveGrappleHitLocation === "function"
              ? resolveGrappleHitLocation({ attacker, defender: defenderCopy, result, weapon: selectedGrappleWeapon })
              : "torso");
          armorContactOutcome = resolveArmorContact({
            attacker,
            defender: defenderCopy,
            weapon: selectedGrappleWeapon,
            attackData: selectedGrappleWeapon,
            attackMode: selectedGrappleAttackMode || selectedGrappleWeapon.attackMode,
            attackRoll: result.attackRoll,
            attackTotal: result.attackRoll,
            critical: result.critical === true,
            hitLocation,
            targetState: { grappled: true },
            normalDefense: defenderCopy.guardRating ?? defenderCopy.armorClass ?? 12,
          });
          const damageBeforeContact = Number(result.damage || 0) || 0;
          const contactAllowsDamage = armorContactOutcome.damageAllowed === true;
          result.armorContactResolved = armorContactOutcome;
          result.hitLocation = hitLocation;
          result.ignoresArmor = armorContactOutcome.gapReached === true || armorContactOutcome.coverageType === "unarmored";
          result.weakSpot = armorContactOutcome.gapReached === true;
          result.armorBlockedWeakSpot =
            armorContactOutcome.contactType === "solid-plate" ||
            armorContactOutcome.damagePrevented === true;
          if (!contactAllowsDamage) {
            result.damage = 0;
          }
          addLog?.({
            audience: "developer",
            channel: "attack",
            eventType: "clinch-armor-contact-resolved",
            level: "info",
            type: "debug",
            actorId: attacker.id,
            targetId: defenderCopy.id,
            executionKey: grappleActionId,
            message:
              `clinch armor contact resolved: actor=${attacker.name} target=${defenderCopy.name} ` +
              `weapon=${selectedGrappleWeapon.name} mode=${selectedGrappleWeapon.attackMode} ` +
              `location=${hitLocation} contactType=${armorContactOutcome.contactType} ` +
              `gapReached=${armorContactOutcome.gapReached === true} hpDamage=${contactAllowsDamage ? damageBeforeContact : 0}`,
            data: {
              actorId: attacker.id,
              targetId: defenderCopy.id,
              weapon: selectedGrappleWeapon.name,
              mode: selectedGrappleWeapon.attackMode,
              location: hitLocation,
              contactType: armorContactOutcome.contactType,
              gapReached: armorContactOutcome.gapReached === true,
              hpDamage: contactAllowsDamage ? damageBeforeContact : 0,
              contact: armorContactOutcome,
            },
          }, "debug");
        }
        
        // Use applyDamageWithArmor to handle armor logic
        const updatedDefender = applyDamageWithArmor(result, attacker, defenderCopy);
        
        if (DEBUG_GRAPPLE) {
          console.log(
            `[GRAPPLE DEBUG] Post-damage: ` +
              `${damageTargetLabel} HP=${updatedDefender.currentHP ?? updatedDefender.hp} ` +
              `armorDurability=${updatedDefender.currentarmorDurability ?? updatedDefender.armorDurability} ` +
              (updatedDefender.equistaminadArmor
                ? `ArmorarmorDurability=${updatedDefender.equistaminadArmor.currentarmorDurability ?? updatedDefender.equistaminadArmor.armorDurability}`
                : `No armor`)
          );
        }
        
        // Get final HP for logging
        const finalHP = getFighterHP(updatedDefender);
        const maxHP = updatedDefender.maxHP || updatedDefender.hp || updatedDefender.HP;
        hpDamageApplied = Math.max(0, getFighterHP(defenderCopy) - finalHP);
        
        // Log damage application
        if (result.ignoresArmor) {
          // Critical hit or death blow - bypasses armor (chink in armor)
          addLog(
            `Ã°Å¸â€™Â¥ ${damageTargetLabel} takes ${result.damage} damage from ${attackerLabel} (armor bypassed - weak point struck)! (HP: ${finalHP}/${maxHP})`,
            result.critical ? "critical" : "warning"
          );
          
          // Log broken armor if any (from calculateArmorDamage)
          if (updatedDefender.equistaminad) {
            const brokenArmor = Object.values(updatedDefender.equistaminad)
              .filter(armor => armor && armor.broken && armor.currentarmorDurability <= 0)
              .map(armor => armor.name);
            if (brokenArmor.length > 0) {
              brokenArmor.forEach(name => {
                addLog(`Ã°Å¸â€™Â¢ ${damageTargetLabel}'s ${name} is destroyed!`, "warning");
              });
            }
          }
        } else {
          // Normal hit - armor may have absorbed some/all damage
          const damageTaken = (getFighterHP(defenderCopy) - finalHP);
          hpDamageApplied = Math.max(0, damageTaken);
          if (damageTaken > 0) {
            addLog(
              `Ã°Å¸â€™Â¥ ${damageTargetLabel} takes ${damageTaken} damage from ${attackerLabel}! (HP: ${finalHP}/${maxHP})`,
              "warning"
            );
          } else {
            addLog(
              `Ã°Å¸â€ºÂ¡Ã¯Â¸Â ${damageTargetLabel}'s armor absorbs the blow from ${attackerLabel}! (Armor armorDurability damaged: ${result.damage})`,
              "info"
            );
          }
        }
        
        // Check for death blow
        if (result.deathBlow) {
          applyHPToFighter(updatedDefender, -999);
          updatedDefender.isDead = true;
          addLog(`Ã°Å¸â€™â‚¬ ${damageTargetLabel} is slain by death blow!`, "error");
        }
        
        // Update fighter state
        updated[defenderIndex] = updatedDefender;
        nextDefender = nextDefender
          ? { ...nextDefender, ...updatedDefender }
          : updatedDefender;
        setFighters(updated);
        if (typeof onPostHpMutation === "function" && onPostHpMutation(updated, {
          actorId: attacker.id,
          targetId: damageTargetId,
          actionType,
          executionKey: grappleActionId,
          source: "grapple-hp-mutation",
        })) {
          return {
            ...baseContract,
            accepted: true,
            completed: true,
            combatEnded: true,
            actionSpent: true,
            hpDamageApplied,
            impactResolved: true,
            armorContactResolved: Boolean(armorContactOutcome),
            remainingActions: null,
            result,
            armorContact: armorContactOutcome,
          };
        }
      }
    } else if (!result.hit && result.message && actionType !== 'takedown') {
      // Miss - log the message
      addLog(result.message, "info");
    }
    
    // Merge the outcome and spend its action atomically. Grapple result objects
    // are based on the pre-action actor and must not restore remainingActions.
    const spendStaleReason = getStaleGrappleReason("grapple-hp-mutation");
    if (spendStaleReason) {
      abortStaleGrapple(spendStaleReason);
      return;
    }
    const updated = [...getLiveFighters()];
    const attackerIndex = updated.findIndex(f => f.id === attacker.id);
    if (attackerIndex !== -1) {
      const outcome = nextAttacker || attacker;
      const drawIsTurnEnding = actionType === "drawClinchDagger";
      const remainingActionsBefore = Number(updated[attackerIndex].remainingActions ?? 0) || 0;
      const transition = drawIsTurnEnding
        ? {
            ok: remainingActionsBefore > 0,
            actor: { ...updated[attackerIndex], ...outcome, remainingActions: 0, attacksRemaining: 0 },
            remainingBefore: remainingActionsBefore,
            remainingAfter: 0,
          }
        : applyGrappleFollowUpOutcome(updated[attackerIndex], outcome);
      if (!transition.ok) {
        abortStaleGrapple("no actions");
        return;
      }
      updated[attackerIndex] = actionType === "grapple"
        ? applyInitialGrappleTurnEndingCommitment(transition.actor)
        : transition.actor;
      if (outcome?.hex) {
        updated[attackerIndex].hex = outcome.hex;
        updated[attackerIndex].position = outcome.position || outcome.hex;
      }
      addLog(
        `${updated[attackerIndex].name} has ${transition.remainingAfter}/${updated[attackerIndex].actionsPerRound || updated[attackerIndex].actionsPerMelee || "?"} attacks remaining.`,
        "info"
      );
      if (actionType === "grapple") {
        addLog?.({
          audience: "developer", channel: "turn", eventType: "grapple-success-turn-ending-commitment",
          level: "info", type: "debug", actorId: attacker.id, targetId: defenderId,
          executionKey: admission.executionKey, source: admission.source,
          message: `grapple success turn-ending commitment: actorId=${attacker.id} actionToken=${admission.actionToken}`,
          data: {
            ...admission,
            remainingActionsBefore: transition.remainingBefore,
            remainingActionsAfter: 0,
            primaryWeaponDisposition: attacker.combatWeaponState?.retainedWeaponDisposition ||
              (attacker.combatWeaponState?.droppedWeaponIds?.length ? "dropped-two-handed" : "unarmed"),
            clinchEstablished: true,
            turnEndingEffect: true,
            continuationCreated: false,
            handoffRequested: true,
          },
        }, "debug");
      }
      if (drawIsTurnEnding) {
        addLog?.({
          audience: "developer", channel: "turn", eventType: "draw-clinch-dagger-turn-ending-state-committed",
          level: "info", type: "debug", actorId: attacker.id, targetId: defenderId,
          executionKey: admission.executionKey, source: admission.source,
          message: `draw clinch dagger turn-ending state committed: actorId=${attacker.id} actionToken=${admission.actionToken}`,
          data: {
            ...admission,
            remainingActionsBefore,
            remainingActionsAfter: 0,
            primaryWeaponDisposition: result.priorWeaponDisposition || null,
            daggerId: result.daggerId,
            handoffRequested: true,
          },
        }, "debug");
      }
    }
    const damageTargetId = defender?.id ?? defenderId;
      const defenderIndex = updated.findIndex(f => f.id === damageTargetId);
    if (defenderIndex !== -1 && nextDefender) {
      updated[defenderIndex] = { ...updated[defenderIndex], ...nextDefender };
      if (nextDefender.hex) {
        updated[defenderIndex].hex = nextDefender.hex;
        updated[defenderIndex].position = nextDefender.position || nextDefender.hex;
      }
    }
    setFighters(updated);
    
    // Update positions if grapple pulled fighters together - both fighters should be in same hex
    if (nextAttacker && nextAttacker.hex) {
      const sharedHex = nextAttacker.hex;
      setPositions(prev => {
        const updated = { ...prev };
        // Move attacker to shared hex
        updated[nextAttacker.id] = sharedHex;
        // Move defender to same shared hex (both fighters grapple in same hex)
        if (nextDefender && nextDefender.id) {
          updated[nextDefender.id] = sharedHex;
        } else if (defenderId) {
          updated[defenderId] = sharedHex;
        }
        return updated;
      });
    }
    if (shouldRevealForMovement) {
      if (result.attacker && nextAttacker !== result.attacker) {
        addLog(`Ã°Å¸â€˜ÂÃ¯Â¸Â ${result.attacker.name} is revealed by the grapple movement!`, "info");
      }
      if (result.defender && nextDefender !== result.defender) {
        addLog(`Ã°Å¸â€˜ÂÃ¯Â¸Â ${result.defender.name} is revealed by the grapple movement!`, "info");
      }
    }
  } else {
    // Safeguard against undefined reason/message
    const failureMessage = result.reason || result.message || `Grapple action failed`;
    addLog(failureMessage, "info");
    
    // Still deduct attack if it was attempted
    if (!result?.blocked) {
      const failSpendStaleReason = getStaleGrappleReason("grapple-failed-action-spend");
      if (failSpendStaleReason) {
        abortStaleGrapple(failSpendStaleReason);
        return;
      }
      const updated = [...getLiveFighters()];
      const attackerIndex = updated.findIndex(f => f.id === attacker.id);
      if (attackerIndex !== -1) {
        updated[attackerIndex].remainingActions = Math.max(0, updated[attackerIndex].remainingActions - 1);
        addLog(
          `${updated[attackerIndex].name} has ${updated[attackerIndex].remainingActions}/${updated[attackerIndex].actionsPerRound || updated[attackerIndex].actionsPerMelee || "?"} attacks remaining.`,
          "info"
        );
        setFighters(updated);
      }
    }
    if (actionType === "breakFree") {
      addLog(`${attacker.name} fails to break free; no counterattack is triggered.`, "info");
    }
    onStaleGrappleAbort?.(grappleActionId);
  }
  if (result?.success && (actionType === "breakFree" || actionType === "grapplerPushOff" || actionType === "defenderPushBreak" || actionType === "releaseGrapple")) {
    setFighters((current = []) => current.map((fighter) =>
      fighter.id === attacker.id || fighter.id === defenderId
        ? restoreRetainedWeaponAfterGrapple(fighter, { round: meleeRound, turn: turnCounter, reason: actionType })
        : fighter));
  }
  const latestActor =
    (typeof getFighters === "function" ? getFighters() : fighters)?.find?.((fighter) => fighter.id === attacker.id) ||
    attacker;
  const latestOpponent =
    (typeof getFighters === "function" ? getFighters() : fighters)?.find?.((fighter) => fighter.id === defenderId) ||
    defender;
  const latestActorOpponent = latestActor?.grappleState?.opponent || latestActor?.grappleState?.opponentId;
  const latestOpponentOpponent = latestOpponent?.grappleState?.opponent || latestOpponent?.grappleState?.opponentId;
  const latestActorGrappleState = String(latestActor?.grappleState?.state || "").toLowerCase();
  const latestOpponentGrappleState = String(latestOpponent?.grappleState?.state || "").toLowerCase();
  const grappleActive = Boolean(
    (latestActorOpponent === defenderId && latestActorGrappleState && latestActorGrappleState !== "neutral") ||
    (latestOpponentOpponent === attacker.id && latestOpponentGrappleState && latestOpponentGrappleState !== "neutral")
  );
  const grappleEnded = !grappleActive;
  const actionSucceeded =
    result?.success === true ||
    result?.hit === true ||
    result?.escaped === true ||
    result?.released === true;
  return {
    ...baseContract,
    accepted: true,
    completed: true,
    success: actionSucceeded,
    weaponId: selectedGrappleWeapon?.weaponId || selectedGrappleWeapon?.name || null,
    attackMode: selectedGrappleAttackMode,
    actionSpent: true,
    staminaSpent: actionType === "groundAttack" || actionType === "clinchStrike" || actionType === "maintain" || actionType === "improveControl" || actionType === "grapple" ? 1 : 0,
    impactResolved: Boolean(result?.attackRoll || result?.attackerRoll || result?.defendRoll || result?.hit || result?.message),
    armorContactResolved: Boolean(armorContactOutcome),
    hpDamageApplied,
    stateChanged: Boolean(grappleActive || result?.attackerState || result?.defenderState || result?.attacker || result?.defender),
    grappleActive,
    grappleEnded,
    remainingActions: latestActor?.remainingActions ?? null,
    result,
    armorContact: armorContactOutcome,
    opponentGrappleState: latestOpponent?.grappleState || null,
    noRollAction,
    turnEndingEffect: (actionType === "grapple" && result?.success === true) || actionType === "drawClinchDagger",
    continuationCreated: false,
  };
}

