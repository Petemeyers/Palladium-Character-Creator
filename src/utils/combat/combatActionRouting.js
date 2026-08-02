import { resolveExertionActionPolicy } from "./exertionState.js";

const normalize = (value) => String(value ?? "").trim().toLowerCase();

export const CANONICAL_GRAPPLE_DISPATCHER_ROUTE = "canonical-grapple-dispatcher";

export function shouldRouteAttackToCanonicalGrapple({
  intent = null,
  attackData = null,
} = {}) {
  return normalize(intent?.resolverRoute || attackData?.resolverRoute) ===
    CANONICAL_GRAPPLE_DISPATCHER_ROUTE;
}

export function createConvertedAttackGrappleAdmission({
  sourceAttackExecutionKey,
  generationId,
  round,
  initiativeTurnId,
  actionSequence,
  actorId,
  targetId,
  resolverRoute = CANONICAL_GRAPPLE_DISPATCHER_ROUTE,
} = {}) {
  return Object.freeze({
    conversionType: "canonical-attack-to-grapple",
    sourceAttackExecutionKey: sourceAttackExecutionKey || null,
    generationId,
    round,
    initiativeTurnId: initiativeTurnId || null,
    actionSequence: Number(actionSequence),
    actorId: actorId || null,
    targetId: targetId || null,
    resolverRoute,
  });
}

export function validateConvertedAttackGrappleAdmission({
  admission,
  activeSourceAttackExecutionKey,
  generationId,
  round,
  initiativeTurnId,
  actionSequence,
  actorId,
  targetId,
} = {}) {
  const reject = (reason) => ({ valid: false, reason });
  if (!admission) return reject("missing-conversion-admission");
  if (admission.conversionType !== "canonical-attack-to-grapple") {
    return reject("invalid-conversion-type");
  }
  if (normalize(admission.resolverRoute) !== CANONICAL_GRAPPLE_DISPATCHER_ROUTE) {
    return reject("invalid-conversion-route");
  }
  if (
    !admission.sourceAttackExecutionKey ||
    admission.sourceAttackExecutionKey !== activeSourceAttackExecutionKey
  ) {
    return reject("source-attack-ownership-mismatch");
  }
  if (admission.generationId !== generationId) return reject("generation-mismatch");
  if (Number(admission.round) !== Number(round)) return reject("round-mismatch");
  if (admission.initiativeTurnId !== initiativeTurnId) {
    return reject("initiative-turn-mismatch");
  }
  if (Number(admission.actionSequence) !== Number(actionSequence)) {
    return reject("action-sequence-mismatch");
  }
  if (admission.actorId !== actorId || admission.targetId !== targetId) {
    return reject("participant-mismatch");
  }
  return { valid: true, reason: "valid" };
}

export function resolveAttackOverexertionPolicy({
  currentStamina,
  maxStamina,
  attackCost,
  alreadyOverexerted = false,
  survivalOverride = null,
  manualChoice = false,
} = {}) {
  const numericCurrentStamina = Number(currentStamina);
  const numericMaxStamina = Number(maxStamina);
  const resolvedMaxStamina = Number.isFinite(numericMaxStamina) && numericMaxStamina > 0
    ? numericMaxStamina
    : Math.max(1, Number.isFinite(numericCurrentStamina) ? numericCurrentStamina : 1);
  const policy = resolveExertionActionPolicy({
    currentStamina,
    maxStamina: resolvedMaxStamina,
    cost: attackCost,
    alreadyOverexerted,
    survivalOverride,
    manualChoice,
  });
  return {
    ...policy,
    attackCost: Math.max(0, Number(attackCost) || 0),
  };
}

export function normalizeRepeatedCombatMode(value) {
  const normalized = normalize(value).replace(/\s+/g, " ");
  if (!normalized) return "melee";

  const parts = normalized.split(" ");
  if (parts.length % 2 === 0) {
    const half = parts.length / 2;
    const first = parts.slice(0, half).join(" ");
    const second = parts.slice(half).join(" ");
    if (first === second) return first;
  }

  return parts.filter((part, index) => index === 0 || part !== parts[index - 1]).join(" ");
}

export function buildArmorStoppedNarration({
  attackData = {},
  contactResult = {},
} = {}) {
  const text = [
    attackData?.name,
    attackData?.damageType,
    attackData?.resolverRoute,
    contactResult?.attackMode,
    contactResult?.convertedDamageType,
    contactResult?.contactType,
  ].map(normalize).join(" ");

  if (/grapple|clinch|control/.test(text)) {
    return "The armored contact prevents the clinch from gaining control; no grapple is established.";
  }
  if (/bludge|blunt|headbutt|rock|pommel|crossguard|slam|crush|trample/.test(text)) {
    return "The armor absorbs the impact; no bodily damage is dealt.";
  }
  if (/pierc|thrust|gore|horn|spear|arrow|bolt/.test(text)) {
    return "The armor deflects the point; no bodily damage is dealt.";
  }
  if (/slash|cut|edge|sword|axe/.test(text)) {
    return "The armor stops the edge; no bodily damage is dealt.";
  }
  return "The armor prevents bodily injury; no bodily damage is dealt.";
}
