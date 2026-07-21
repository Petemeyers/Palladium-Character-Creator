import { normalizeAlignmentBehavior } from "./normalizeAlignmentBehavior.js";

export const SURRENDER_RESOLUTION_ACTIONS = Object.freeze([
  "takePrisoner",
  "setRansomDisposition",
  "confiscateAndCapture",
  "disarmAndRelease",
  "acceptYieldWithoutCapture",
  "revokeSurrenderAcceptance",
  "executeSurrenderedOpponent",
]);

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const words = (value) => String(value || "").trim().toLowerCase();
const includesTrait = (traits, pattern) => traits.some((trait) => pattern.test(words(trait)));
const clampWeight = (value) => Math.max(0, Math.round(finite(value) * 1000) / 1000);

export function normalizePrisonerPolicy(value) {
  const candidate = words(typeof value === "object" ? value?.prisonerPolicy : value);
  return new Set(["accept", "prefer-capture", "prefer-ransom", "release", "no-quarter", "commander-discretion"]).has(candidate)
    ? candidate
    : "commander-discretion";
}

function getBehavior(victor, alignmentBehavior) {
  return normalizeAlignmentBehavior(alignmentBehavior || victor?.behaviorProfile || victor?.alignment, victor?.behavior || {}) || {
    alignmentKey: "unmapped", dimensions: {}, surrenderWeights: {},
    honor: finite(victor?.behavior?.honor, 50), mercy: finite(victor?.behavior?.mercy, 50),
    discipline: finite(victor?.behavior?.discipline, 50), greed: finite(victor?.behavior?.greed, 50),
    cruelty: finite(victor?.behavior?.cruelty, 25), pride: finite(victor?.behavior?.pride, 50),
    acceptsSurrenderWeight: 50, prisonerWeight: 50, ransomWeight: 40, releaseWeight: 35,
    confiscationWeight: 35, executionWeight: 15,
  };
}

export function scoreSurrenderResponseDecision({ victor = {}, surrenderedActor = {}, alignmentBehavior = null, factionOrders = null, battlefieldContext = {} } = {}) {
  const behavior = getBehavior(victor, alignmentBehavior);
  const policy = normalizePrisonerPolicy(factionOrders || victor.factionOrders || victor.orders);
  const traits = [...(victor.traits || []), ...(victor.tags || [])];
  let accept = finite(behavior.acceptsSurrenderWeight, 50) + finite(behavior.mercy) * 0.2 + finite(behavior.honor) * 0.12;
  let refuse = 35 + finite(behavior.cruelty) * 0.25 + finite(behavior.pride) * 0.08;
  if (includesTrait(traits, /merciful|honorable|chival/)) accept += 12;
  if (includesTrait(traits, /cruel|bloodthirst|vengeful/)) refuse += 12;
  if (policy === "accept" || policy === "prefer-capture" || policy === "prefer-ransom" || policy === "release") accept += 18 + finite(behavior.discipline) * 0.08;
  if (policy === "no-quarter") refuse += 22 + finite(behavior.discipline) * 0.08;
  if (finite(battlefieldContext.hostileFightersRemaining) > 0) refuse += 5;
  if (finite(battlefieldContext.witnesses) > 0 && finite(battlefieldContext.legalAuthority) > 0) accept += 8;
  if (surrenderedActor.isDead || surrenderedActor.dead || surrenderedActor.isUnconscious || surrenderedActor.unconscious) accept = 0;
  return {
    scores: { accept: clampWeight(accept), refuse: clampWeight(refuse) },
    behavior,
    policy,
    reasons: ["alignment-behavior-weighted", `prisoner-policy:${policy}`],
  };
}

function selectWeighted(scores, rng = Math.random) {
  const entries = Object.entries(scores).filter(([, score]) => score > 0);
  const total = entries.reduce((sum, [, score]) => sum + score, 0);
  const deterministicRoll = Math.min(0.999999999, Math.max(0, finite(rng?.(), 0))) * total;
  let cursor = 0;
  for (const [key, score] of entries) {
    cursor += score;
    if (deterministicRoll < cursor) return { selectedDecision: key, deterministicRoll, totalWeight: total };
  }
  return { selectedDecision: entries.at(-1)?.[0] || null, deterministicRoll, totalWeight: total };
}

export function selectSurrenderResponse(input = {}) {
  const scored = scoreSurrenderResponseDecision(input);
  const selection = selectWeighted(scored.scores, input.rng);
  return { ...selection, ...scored, source: "canonical-surrender-response-selector" };
}

export function selectSurrenderResolution({
  victor = {}, surrenderedActor = {}, alignmentBehavior = null, traits = null,
  factionOrders = null, battlefieldContext = {}, rng = Math.random,
} = {}) {
  const behavior = getBehavior(victor, alignmentBehavior);
  const policy = normalizePrisonerPolicy(factionOrders || victor.factionOrders || victor.orders);
  const allTraits = traits || [...(victor.traits || []), ...(victor.tags || [])];
  const guards = finite(battlefieldContext.guardsAvailable ?? battlefieldContext.guardsPresent);
  const restraints = finite(battlefieldContext.restraintsAvailable);
  const danger = finite(battlefieldContext.battlefieldDanger);
  const witnesses = finite(battlefieldContext.witnesses ?? battlefieldContext.witnessesPresent);
  const legalAuthority = finite(battlefieldContext.legalAuthority);
  const prisonerValue = finite(battlefieldContext.prisonerValue ?? surrenderedActor.prisonerValue);
  const escapeRisk = finite(battlefieldContext.escapeRisk);
  const vengeance = finite(battlefieldContext.vengeanceRelationship);
  const priorAtrocities = finite(battlefieldContext.priorAtrocities);
  const supplies = finite(battlefieldContext.availableSupplies, 1);
  const helpless = surrenderedActor.isSurrendered === true || surrenderedActor.isCaptured === true ||
    surrenderedActor.prisonerState?.status === "prisoner" || ["dominant", "pinned"].includes(surrenderedActor.grappleState?.groundControl?.state);
  const executionLegal = battlefieldContext.allowExecution === true && helpless;
  const candidates = [...SURRENDER_RESOLUTION_ACTIONS];
  const rejectedCandidates = [];
  if (!executionLegal) rejectedCandidates.push({ action: "executeSurrenderedOpponent", reason: "explicit-legal-execution-context-required" });
  if (battlefieldContext.acceptanceRevocable !== true) rejectedCandidates.push({ action: "revokeSurrenderAcceptance", reason: "acceptance-revocation-not-authorized" });

  const scores = {
    takePrisoner: finite(behavior.prisonerWeight, 50) + guards * 8 + restraints * 6 + prisonerValue * 2 - escapeRisk * 3 - (supplies <= 0 ? 12 : 0),
    setRansomDisposition: finite(behavior.ransomWeight, 40) + finite(behavior.greed) * 0.22 + prisonerValue * 6,
    confiscateAndCapture: finite(behavior.confiscationWeight, 35) + finite(behavior.greed) * 0.25 + guards * 4,
    disarmAndRelease: finite(behavior.releaseWeight, 35) + finite(behavior.mercy) * 0.2 + finite(behavior.honor) * 0.12 - danger * 4 - escapeRisk * 3,
    acceptYieldWithoutCapture: finite(behavior.releaseWeight, 35) + finite(behavior.mercy) * 0.22 + finite(behavior.honor) * 0.16 - danger * 3,
    revokeSurrenderAcceptance: 8 + finite(behavior.cruelty) * 0.12 + vengeance * 3,
    executeSurrenderedOpponent: finite(behavior.executionWeight, 10) + finite(behavior.cruelty) * 0.3 + vengeance * 8 + priorAtrocities * 5 - witnesses * 3 - legalAuthority * 4,
  };
  if (policy === "accept") { scores.takePrisoner += 15; scores.acceptYieldWithoutCapture += 10; }
  if (policy === "prefer-capture") { scores.takePrisoner += 28; scores.confiscateAndCapture += 18; }
  if (policy === "prefer-ransom") scores.setRansomDisposition += 32;
  if (policy === "release") { scores.disarmAndRelease += 30; scores.acceptYieldWithoutCapture += 25; }
  if (policy === "no-quarter") { scores.revokeSurrenderAcceptance += 22; scores.executeSurrenderedOpponent += 28; }
  if (includesTrait(allTraits, /merciful|honorable|chival/)) { scores.disarmAndRelease += 12; scores.acceptYieldWithoutCapture += 12; }
  if (includesTrait(allTraits, /cruel|bloodthirst|vengeful/)) { scores.executeSurrenderedOpponent += 15; scores.revokeSurrenderAcceptance += 8; }
  rejectedCandidates.forEach(({ action }) => { scores[action] = 0; });
  Object.keys(scores).forEach((key) => { scores[key] = clampWeight(scores[key]); });
  const selection = selectWeighted(scores, rng);
  return {
    ...selection,
    candidates: candidates.filter((action) => !rejectedCandidates.some((entry) => entry.action === action)),
    rejectedCandidates,
    scores,
    reasons: ["normalized-alignment-dimensions", `prisoner-policy:${policy}`, "contextual-legality-filter"],
    source: "canonical-surrender-resolution-selector",
    alignmentBehavior: behavior,
    policy,
  };
}

export default selectSurrenderResolution;
