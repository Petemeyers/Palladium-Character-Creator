const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const key = (value) => String(value || "").trim().toLowerCase();

export const MINOTAUR_TECHNIQUES = Object.freeze({
  heavyAxe: { deliveryMethod: "manufactured-melee", resolverRoute: "standard-weapon-impact", contactSurface: "axe-edge-or-haft", recoveryOnCommittedMiss: true },
  gore: { deliveryMethod: "natural-thrust", resolverRoute: "standard-natural-impact", contactSurface: "horn-point", mayEstablish: "horn-engagement" },
  chargingGore: { deliveryMethod: "collision-thrust", resolverRoute: "movement-collision-impact", contactSurface: "horn-and-body", minimumStraightLineFeet: 15, staminaCost: 6, mayEstablish: "horn-engagement" },
  hornHook: { deliveryMethod: "grapple-control", resolverRoute: "canonical-grapple-control", contactSurface: "engaged-horn", requiresState: "horn-engagement" },
  hookAndLift: { deliveryMethod: "opposed-lift", resolverRoute: "canonical-lift-contest", requiresState: "horn-engagement", targetSizeLimit: "large" },
  bodyClinch: { deliveryMethod: "grapple-entry", resolverRoute: "canonical-grapple-dispatcher" },
  lift: { deliveryMethod: "opposed-lift", resolverRoute: "canonical-lift-contest", requiresControl: "dominant", targetSizeLimit: "large" },
  slam: { deliveryMethod: "controlled-collision", resolverRoute: "fall-collision-impact", requiresState: "lifted" },
  throw: { deliveryMethod: "forced-movement", resolverRoute: "canonical-throw-forced-movement", requiresControl: "advantage" },
  crush: { deliveryMethod: "grapple-pressure", resolverRoute: "canonical-grapple-pressure", requiresControl: "dominant-or-pin" },
  headbutt: { deliveryMethod: "natural-blunt", resolverRoute: "standard-natural-impact", contactSurface: "forehead-and-horns" },
  trample: { deliveryMethod: "hoof-impact", resolverRoute: "standard-natural-impact", contactSurface: "hoof", requiresTargetState: "prone-or-overrun" },
  rockThrow: { deliveryMethod: "projectile", resolverRoute: "canonical-projectile", contactSurface: "improvised-heavy-projectile" },
  rockSmash: { deliveryMethod: "manufactured-melee", resolverRoute: "standard-weapon-impact", contactSurface: "improvised-rock" },
});

export function deriveCanonicalAttackModifier({ actor = {}, technique = {}, position = {}, fatigue = {} } = {}) {
  const strength = num(actor.abilityScores?.strength ?? actor.attributes?.might, 10);
  const attribute = Math.floor((strength - 10) / 2);
  const proficiency = num(actor.proficiencyBonuses?.melee ?? actor.proficiency?.melee ?? actor.bonuses?.proficiency, 2);
  const fatiguePenalty = num(fatigue.attackPenalty ?? actor.fatigueState?.attackPenalty, 0);
  const positionModifier = num(position.attackModifier, 0);
  const reachModifier = num(technique.reachModifier, 0);
  const techniqueModifier = num(technique.attackModifier, 0);
  const components = { attribute, proficiency, fatigue: fatiguePenalty, position: positionModifier, reach: reachModifier, technique: techniqueModifier };
  return { total: Object.values(components).reduce((sum, value) => sum + value, 0), components };
}

export function validateMinotaurTechniquePrerequisites({
  techniqueKey,
  actor = {},
  target = {},
  movement = {},
  environment = {},
} = {}) {
  const technique = MINOTAUR_TECHNIQUES[techniqueKey];
  const reject = (reason) => ({ accepted: false, reason, techniqueKey, eventType: "minotaur-technique-prerequisite-failed" });
  if (!technique) return reject("unknown-technique");
  if (!actor.id || !target.id || actor.dead || actor.unconscious || actor.surrendered) return reject("invalid-combatant-state");
  const grapple = actor.grappleState || {};
  const targetState = key(target.positionState || target.grappleState?.positionState);
  const control = key(grapple.groundControl?.state || grapple.controlState || grapple.control);
  const hornEngaged = grapple.hornEngagement?.targetId === target.id || actor.hornEngagement?.targetId === target.id;
  if (technique.requiresState === "horn-engagement" && !hornEngaged) return reject("horn-engagement-required");
  if (technique.requiresState === "lifted" && grapple.liftedTargetId !== target.id && actor.liftedTargetId !== target.id) return reject("lifted-target-required");
  if (technique.requiresControl === "advantage" && !["advantage", "dominant", "pinned"].includes(control)) return reject("grapple-control-required");
  if (technique.requiresControl === "dominant" && !["dominant", "pinned"].includes(control)) return reject("dominant-grapple-control-required");
  if (technique.requiresControl === "dominant-or-pin" && !["dominant", "pinned"].includes(control) && !(targetState === "prone" && grapple.active)) return reject("crush-control-required");
  if (technique.requiresTargetState === "prone-or-overrun" && targetState !== "prone" && movement.overrunEstablished !== true) return reject("prone-or-overrun-required");
  if (technique.minimumStraightLineFeet && num(movement.straightLineFeet) < technique.minimumStraightLineFeet) return reject("minimum-straight-line-movement-required");
  if (technique.minimumStraightLineFeet && (movement.sharpTurn || environment.pathObstructed)) return reject("charge-path-invalid");
  const sizeOrder = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
  if (technique.targetSizeLimit && sizeOrder.indexOf(key(target.size)) > sizeOrder.indexOf(technique.targetSizeLimit)) return reject("target-size-limit");
  return { accepted: true, techniqueKey, technique, eventType: "minotaur-technique-prerequisite-passed" };
}

export function createCanonicalMinotaurTechniqueIntent(input = {}) {
  const prerequisite = validateMinotaurTechniquePrerequisites(input);
  if (!prerequisite.accepted) return prerequisite;
  const modifier = deriveCanonicalAttackModifier({ actor: input.actor, technique: prerequisite.technique, position: input.position, fatigue: input.fatigue });
  return {
    accepted: true,
    techniqueKey: input.techniqueKey,
    technique: prerequisite.technique,
    resolverRoute: prerequisite.technique.resolverRoute,
    derivedAttackModifier: modifier,
    directHpMutationAllowed: false,
    requiredStages: Object.freeze([
      "attack-intent", "prerequisite-validation", "movement-setup", "attack-or-grapple-contest",
      "active-defense", "shield-interception", "hit-location", "armor-coverage",
      "contact-geometry", "penetration-deflection-impact-transfer", "stability-forced-movement",
      "injury", "morale", "stamina-recovery", "canonical-action-completion",
    ]),
  };
}

export function filterLegalMinotaurTechniqueCandidates({
  actor = {},
  target = {},
  candidates = [],
  movement = {},
  environment = {},
} = {}) {
  const legal = [];
  const rejected = [];
  for (const candidate of candidates) {
    if (!candidate?.techniqueKey) {
      legal.push(candidate);
      continue;
    }
    const prerequisite = validateMinotaurTechniquePrerequisites({
      techniqueKey: candidate.techniqueKey,
      actor,
      target,
      movement,
      environment,
    });
    if (prerequisite.accepted) legal.push(candidate);
    else rejected.push({ candidate, prerequisite });
  }
  return Object.freeze({
    legal: Object.freeze(legal),
    rejected: Object.freeze(rejected),
  });
}
