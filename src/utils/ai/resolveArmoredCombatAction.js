import {
  buildArmoredTacticalMemoryKey,
  getArmoredTacticalMemory,
} from "../combat/armoredTacticalMemory.js";
import {
  ARMORED_TECHNIQUES,
  buildArmoredTechniqueAttack,
  selectArmoredCombatTechnique,
} from "./selectArmoredCombatTechnique.js";
import { validateArmoredTechniqueWeapon } from "../combat/armoredTechniqueWeaponValidation.js";
import { createAuthoritativeArmoredPlanTurnIdentity } from "../combat/armoredActionPlanRegistry.js";

function hasActiveGrappleBetween(attacker = {}, defender = {}) {
  const attackerOpponent = attacker?.grappleState?.opponent || attacker?.grappleState?.opponentId;
  const defenderOpponent = defender?.grappleState?.opponent || defender?.grappleState?.opponentId;
  const attackerState = String(attacker?.grappleState?.state || "").toLowerCase();
  const defenderState = String(defender?.grappleState?.state || "").toLowerCase();
  return Boolean(
    (attackerOpponent && attackerOpponent === (defender?.id || defender?._id)) ||
    (defenderOpponent && defenderOpponent === (attacker?.id || attacker?._id)) ||
    /grapple|clinch|pinned|held|ground/.test(attackerState) ||
    /grapple|clinch|pinned|held|ground/.test(defenderState)
  );
}

function snapshotWeapon(weapon = {}) {
  return Object.freeze({
    id: weapon?.id || weapon?.weaponId || weapon?.key || weapon?.name || "unknown-weapon",
    name: weapon?.name || weapon?.label || weapon?.weaponName || "Unknown Weapon",
    type: weapon?.type || weapon?.weaponType || weapon?.category || null,
    profileKey: weapon?.profileKey || weapon?.armorProfileKey || weapon?.weaponProfileKey || null,
    damage: weapon?.damage,
    damageType: weapon?.damageType,
    reach: weapon?.reach,
    range: weapon?.range,
    armorContactTraits: weapon?.armorContactTraits
      ? Object.freeze({ ...weapon.armorContactTraits })
      : null,
  });
}

export function resolveArmoredCombatAction({
  attacker,
  defender,
  selectedWeapon,
  distance,
  remainingActions,
  generationId = "default",
  tacticalMemoryStore,
  getTacticalMemory,
  rng,
  rngSource = "unknown",
  source = "unknown",
  turnToken = attacker?.turnToken || null,
  round = null,
  initiativeIndex = null,
  initiativeTurnId = null,
  actionToken = turnToken,
  authoritativeTurn = null,
  addLog,
} = {}) {
  const turnIdentity = createAuthoritativeArmoredPlanTurnIdentity({
    authoritativeTurn,
    generationId,
    round,
    initiativeIndex,
    initiativeTurnId,
    actionToken,
    turnToken,
  });
  const planGenerationId = turnIdentity.generationId;
  const planRound = turnIdentity.round;
  const planInitiativeIndex = turnIdentity.initiativeIndex;
  const planInitiativeTurnId = turnIdentity.initiativeTurnId;
  const planActionToken = turnIdentity.actionToken;
  const planTurnToken = turnIdentity.turnToken;
  const attackerId = attacker?.id || attacker?._id;
  const defenderId = defender?.id || defender?._id;
  const moraleState = attacker?.state?.moraleState || attacker?.moraleState || attacker?.routingState;
  if (["routed", "broken", "panicked", "surrendering", "cowering"].includes(String(moraleState || ""))) {
    addLog?.({
      audience: "developer",
      channel: "ai",
      eventType: "offensive-ai-suppressed",
      level: "warning",
      type: "warning",
      actorId: attackerId,
      targetId: defenderId,
      source,
      message: `offensive ai suppressed: actor=${attacker?.name || attackerId} reason=routed moraleState=${moraleState} source=${source}`,
      data: { actorId: attackerId, defenderId, reason: "routed", moraleState, source },
    }, "warning");
    return {
      actionType: "suppressed",
      technique: null,
      weapon: selectedWeapon,
      target: defender,
      selection: null,
      tacticalMemory: null,
      memoryKey: null,
      suppressed: true,
      reason: "routed",
    };
  }
  const memoryKey = buildArmoredTacticalMemoryKey({ generationId, attackerId, defenderId });
  if (hasActiveGrappleBetween(attacker, defender)) {
    addLog?.({
      audience: "developer",
      channel: "ai",
      eventType: "combat-obligation-routed",
      level: "info",
      type: "debug",
      actorId: attackerId,
      targetId: defenderId,
      source,
      message:
        `combat obligation routed: actorId=${attackerId} opponentId=${defenderId} ` +
        `obligation=active-grapple generationId=${generationId} turnToken=${turnToken || "missing"}`,
      data: { actorId: attackerId, opponentId: defenderId, obligation: "active-grapple", generationId, turnToken, source },
    }, "debug");
    addLog?.({
      audience: "developer",
      channel: "ai",
      eventType: "grapple-state-read",
      level: "info",
      type: "debug",
      actorId: attackerId,
      targetId: defenderId,
      source,
      message: `grapple state read: actor=${attacker?.name || attackerId} target=${defender?.name || defenderId} active=true`,
      data: { attackerGrappleState: attacker?.grappleState || null, defenderGrappleState: defender?.grappleState || null },
    }, "debug");
    addLog?.({
      audience: "developer",
      channel: "ai",
      eventType: "standing-armored-selector-suppressed",
      level: "info",
      type: "debug",
      actorId: attackerId,
      targetId: defenderId,
      source,
      message: `standing armored selector suppressed: actor=${attacker?.name || attackerId} reason=active-grapple grappleOpponent=${defender?.name || defenderId}`,
      data: { reason: "active-grapple", grappleOpponent: defenderId },
    }, "debug");
    return {
      actionType: "grapple-obligation",
      technique: null,
      weapon: selectedWeapon,
      target: defender,
      selection: null,
      tacticalMemory: null,
      memoryKey,
      suppressed: false,
      handled: false,
      reason: "active-grapple",
    };
  }
  const memoryFound = Boolean(
    tacticalMemoryStore?.has?.(memoryKey) ||
    (typeof getTacticalMemory === "function" && getTacticalMemory(attackerId, defenderId)?.lastTechnique)
  );
  const tacticalMemory =
    typeof getTacticalMemory === "function"
      ? getTacticalMemory(attackerId, defenderId)
      : getArmoredTacticalMemory(tacticalMemoryStore, { generationId, attackerId, defenderId });

  addLog?.({
    audience: "developer",
    channel: "ai",
    eventType: "armored-selector-invoked",
    level: "info",
    type: "debug",
    actorId: attackerId,
    targetId: defenderId,
    source,
    message: `armored selector invoked: actor=${attacker?.name || attackerId} target=${defender?.name || defenderId} source=${source}`,
    data: { generationId, attackerId, defenderId, memoryKey, distance, remainingActions, rngSource },
  }, "debug");

  addLog?.({
    audience: "developer",
    channel: "ai",
    eventType: "armored-memory-read",
    level: "info",
    type: "debug",
    actorId: attackerId,
    targetId: defenderId,
    source,
    message:
      `armored memory read: key=${memoryKey} found=${memoryFound} ` +
      `ineffectiveCuts=${tacticalMemory.ineffectiveCutContacts || 0} ` +
      `failedGapAttempts=${tacticalMemory.failedGapAttempts || 0} successfulGapHits=${tacticalMemory.successfulGapHits || 0}`,
    data: { generationId, attackerId, defenderId, memoryKey, tacticalMemory, found: memoryFound },
  }, "debug");
  const selection = selectArmoredCombatTechnique({
    attacker,
    defender,
    weapon: selectedWeapon,
    distance,
    remainingActions,
    tacticalMemory,
    rng,
  });

  if (!selection?.selectedTechnique) {
    return {
      actionType: "attack",
      technique: null,
      weapon: selectedWeapon,
      target: defender,
      selection,
      tacticalMemory,
      memoryKey,
    };
  }

  addLog?.({
    audience: "developer",
    channel: "ai",
    eventType: "armored-technique-candidates",
    level: "info",
    type: "debug",
    actorId: attackerId,
    targetId: defenderId,
    source,
    message: `armored technique candidates: actor=${attacker?.name || attackerId} target=${defender?.name || defenderId}`,
    data: {
      generationId,
      attackerId,
      defenderId,
      memoryKey,
      candidates: selection.candidates,
      rejectedCandidates: selection.rejectedCandidates,
      totalScore: selection.totalScore,
      deterministicRoll: selection.deterministicRoll,
      cumulativeRanges: selection.cumulativeRanges,
      selectedRange: selection.selectedRange,
      selectedTechnique: selection.selectedTechnique,
      rngSource,
      tacticalMemory,
    },
  }, "debug");

  addLog?.({
    audience: "developer",
    channel: "ai",
    eventType: "armored-technique-selected",
    level: "info",
    type: "debug",
    actorId: attackerId,
    targetId: defenderId,
    source,
    message:
      `armored technique selected: actor=${attacker?.name || attackerId} target=${defender?.name || defenderId} ` +
      `technique=${selection.selectedTechnique}`,
    data: {
      generationId,
      attackerId,
      defenderId,
      memoryKey,
      selectedTechnique: selection.selectedTechnique,
      score: selection.score,
      totalScore: selection.totalScore,
      deterministicRoll: selection.deterministicRoll,
      selectedRange: selection.selectedRange,
      rngSource,
    },
  }, "debug");

  if (selection.selectedTechnique === ARMORED_TECHNIQUES.GRAPPLE) {
    const selectionId = `${planGenerationId}:${planActionToken}:${attackerId}:${defenderId}:${selection.selectedTechnique}:${selection.deterministicRoll ?? "none"}`;
    if (!planTurnToken || !turnIdentity.complete) {
      addLog?.({
        audience: "developer",
        channel: "validation",
        eventType: "armored-action-plan-rejected",
        level: "error",
        type: "error",
        actorId: attackerId,
        targetId: defenderId,
        source,
        message: `armored action plan rejected: actor=${attacker?.name || attackerId} technique=grapple reason=missing-turn-token`,
        data: { actionType: "grapple", selectedTechnique: "grapple", reason: "missing-authoritative-turn-identity", turnIdentity, attackerId, defenderId },
      }, "error");
      return { actionType: "rejected", technique: "grapple", suppressed: true, reason: "missing-turn-token" };
    }
    const planId = selectionId;
    const plan = Object.freeze({
      planId,
      actionType: "grapple",
      selectedTechnique: selection.selectedTechnique,
      sourceWeaponId: null,
      sourceWeaponName: null,
      sourceWeaponProfileKey: null,
      sourceWeaponSnapshot: null,
      resolvedAttackMode: "grapple",
      attackerId,
      defenderId,
      generationId: planGenerationId,
      round: Number(planRound),
      initiativeIndex: Number(planInitiativeIndex),
      initiativeTurnId: planInitiativeTurnId,
      actionToken: planActionToken,
      turnToken: planTurnToken,
      source,
      selectionSource: source,
      selectionId,
      state: "created",
    });
    addLog?.({
      audience: "developer",
      channel: "ai",
      eventType: "armored-action-plan-created",
      level: "info",
      type: "debug",
      actorId: attackerId,
      targetId: defenderId,
      source,
      message: `armored action plan created: actor=${attacker?.name || attackerId} target=${defender?.name || defenderId} technique=${selection.selectedTechnique}`,
      data: plan,
    }, "debug");
    return {
      actionType: "grapple",
      technique: selection.selectedTechnique,
      weapon: selectedWeapon,
      target: defender,
      selection,
      tacticalMemory,
      memoryKey,
      armoredActionPlan: plan,
    };
  }

  const compatibility = validateArmoredTechniqueWeapon({
    selectedTechnique: selection.selectedTechnique,
    sourceWeapon: selectedWeapon,
  });
  if (!compatibility.ok) {
    addLog?.({
      audience: "developer",
      channel: "validation",
      eventType: "armored-action-plan-rejected",
      level: "error",
      type: "error",
      actorId: attackerId,
      targetId: defenderId,
      source,
      message:
        `armored action plan rejected: actor=${attacker?.name || attackerId} technique=${selection.selectedTechnique} ` +
        `sourceWeapon=${selectedWeapon?.name || "Unknown"} reason=${compatibility.reason}`,
      data: { selectedTechnique: selection.selectedTechnique, sourceWeapon: snapshotWeapon(selectedWeapon), reason: compatibility.reason },
    }, "error");
    return {
      actionType: "rejected",
      technique: selection.selectedTechnique,
      weapon: selectedWeapon,
      target: defender,
      selection,
      tacticalMemory,
      memoryKey,
      suppressed: true,
      reason: compatibility.reason,
    };
  }

  const selectionId = `${planGenerationId}:${planActionToken}:${attackerId}:${defenderId}:${selection.selectedTechnique}:${selection.deterministicRoll ?? "none"}`;
  if (!planTurnToken || !turnIdentity.complete) {
    addLog?.({
      audience: "developer",
      channel: "validation",
      eventType: "armored-action-plan-rejected",
      level: "error",
      type: "error",
      actorId: attackerId,
      targetId: defenderId,
      source,
      message: `armored action plan rejected: actor=${attacker?.name || attackerId} technique=${selection.selectedTechnique} reason=missing-turn-token`,
      data: { selectedTechnique: selection.selectedTechnique, reason: "missing-authoritative-turn-identity", turnIdentity, attackerId, defenderId },
    }, "error");
    return { actionType: "rejected", technique: selection.selectedTechnique, suppressed: true, reason: "missing-turn-token" };
  }

  const planId = selectionId;
  const sourceWeaponSnapshot = snapshotWeapon(selectedWeapon);
  const plannedAttackProfile = Object.freeze({
    ...buildArmoredTechniqueAttack(sourceWeaponSnapshot, selection.selectedTechnique),
    sourceWeaponId: sourceWeaponSnapshot.id,
    sourceWeaponName: sourceWeaponSnapshot.name,
  });
  const armoredActionPlan = Object.freeze({
      planId,
      actionType: "attack",
      selectedTechnique: selection.selectedTechnique,
      sourceWeaponId: selectedWeapon?.id || selectedWeapon?.weaponId || selectedWeapon?.name || "unknown-weapon",
      sourceWeaponName: selectedWeapon?.name || selectedWeapon?.label || "Unknown Weapon",
      sourceWeaponProfileKey: selectedWeapon?.profileKey || selectedWeapon?.armorProfileKey || null,
      sourceWeaponSnapshot,
      attackSnapshot: plannedAttackProfile,
      resolvedAttackMode: selection.selectedTechnique,
      attackerId,
      defenderId,
      generationId: planGenerationId,
      round: Number(planRound),
      initiativeIndex: Number(planInitiativeIndex),
      initiativeTurnId: planInitiativeTurnId,
      actionToken: planActionToken,
      turnToken: planTurnToken,
      source,
      selectionSource: source,
      selectionId,
      state: "created",
  });
  const plannedWeapon = {
    ...plannedAttackProfile,
    sourceWeapon: sourceWeaponSnapshot,
    sourceWeaponSnapshot,
    presentationAttackName: plannedAttackProfile.name,
    armoredActionPlan,
  };
  addLog?.({
    audience: "developer",
    channel: "ai",
    eventType: "armored-action-plan-created",
    level: "info",
    type: "debug",
    actorId: attackerId,
    targetId: defenderId,
    source,
    message: `armored action plan created: actor=${attacker?.name || attackerId} target=${defender?.name || defenderId} technique=${selection.selectedTechnique}`,
    data: plannedWeapon.armoredActionPlan,
  }, "debug");

  return {
    actionType: "attack",
    technique: selection.selectedTechnique,
    weapon: plannedWeapon,
    target: defender,
    selection,
    tacticalMemory,
    memoryKey,
  };
}
