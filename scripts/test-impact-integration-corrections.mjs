import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const combatPagePath = path.join(root, 'src/pages/CombatPage.jsx');
const grappleActionsPath = path.join(root, 'src/utils/combatActionHandlers/grappleActions.js');
const routerPath = path.join(root, 'src/utils/ai/resolveGrappleTurnAction.js');
const engagementPatchPath = path.join(root, 'patches/melee-engagement-distance-fix.patch');

const combatPage = fs.readFileSync(combatPagePath, 'utf8');
const damageMetadata = fs.readFileSync(path.join(root, 'src/utils/combat/canonicalDamageMetadata.js'), 'utf8');
const grappleActions = fs.readFileSync(grappleActionsPath, 'utf8');
const routerSource = fs.readFileSync(routerPath, 'utf8');
const engagementPatch = fs.readFileSync(engagementPatchPath, 'utf8');
let assertions = 0;
const check = (condition, message) => { assert.ok(condition, message); assertions += 1; };

// Forced movement must update every positional authority and clear invalid links.
check((combatPage.match(/committedPositionsRef\.current = nextPositions;/g) || []).length >= 2,
  'Both layered-impact movement paths must update committed position authority.');
check(combatPage.includes('forced-movement-relationship-reconciled'),
  'Forced separation must emit a reconciliation event.');
check(combatPage.includes('postImpactDistance > 5.5'),
  'Relationship reconciliation must use physical separation.');
check(combatPage.includes('clearForcedSeparationRelationship(fighter, defender.id)'),
  'The attacker relationship must be cleared.');
check(combatPage.includes('clearForcedSeparationRelationship(fighter, impactAttackerId)'),
  'The defender relationship must be cleared.');
check(combatPage.includes('state: "neutral"') && combatPage.includes('canUseLongWeapons: true'),
  'Separation cleanup must restore neutral weapon eligibility.');

// Stale grapple state may not convert a distant melee profile.
check(combatPage.includes('Number.isFinite(preResolveAttackDistance)') &&
      combatPage.includes('preResolveAttackDistance <= 5.5 &&'),
  'Grapple-range substitutions must require physical proximity.');
check(combatPage.includes('minotaur-technique-profile-restored'),
  'Rock Smash fallback restoration must be logged.');
check(combatPage.includes('requestedTechniqueKey === "rocksmash"'),
  'Rock Smash restoration must require the selected canonical technique.');
check(combatPage.includes('isFallbackUnarmed: false'),
  'Restored Rock Smash may not remain flagged as fallback unarmed.');

// Armor-converted damage type must own final damage narration and audit.
const convertedIndex = damageMetadata.indexOf('contact.convertedDamageType || contact.damageType || impact.damageType');
const originalIndex = damageMetadata.indexOf('attack.damageType || attack.typeOfDamage', convertedIndex);
check(combatPage.includes('resolveCanonicalDamageMetadata({') && convertedIndex >= 0 && originalIndex > convertedIndex,
  'Canonical damage commit must prefer converted blunt damage.');
check((combatPage.match(/canonicalDamageMetadata\.damageType/g) || []).length >= 4,
  'Canonical audit and player damage events must share resolved damage type.');

// Canonical attributes and carried equipment must participate in lifting.
check(combatPage.includes('fighter?.attributes?.might'),
  'Legacy lift helpers must recognize canonical Might.');
check(combatPage.includes('targetEquipmentWeight = getEquippedLoadWeight(target)'),
  'Lift calculations must include worn equipment.');
check(combatPage.includes('powerfulBuildBonus = hasPowerfulBuildForLift(carrier) ? 4 : 0'),
  'Powerful Build must affect lift capacity.');
check(combatPage.includes('compatibilityCarrier') && combatPage.includes('compatibilityTarget'),
  'Legacy carry checks must receive canonical compatibility values.');
check(combatPage.includes('liftedTargetId: targetId') && combatPage.includes('controlState: "dominant"'),
  'Successful lift must establish the state required by Minotaur follow-ups.');
check(combatPage.includes('grappleActionType === "lift"'),
  'Enemy active-grapple routing must execute Lift.');
check(combatPage.includes('grappleActionType === "slam"'),
  'Enemy active-grapple routing must execute Slam.');
check(combatPage.includes('attackDataOverride: slamAttack'),
  'Slam must preserve its canonical attack profile.');
check(combatPage.includes('spendAction: false') && combatPage.includes('silentRelease: true'),
  'Post-slam carry cleanup must not spend a second action.');

// Canonical grapple strength and control progression.
check(grappleActions.includes('getCanonicalGrappleStrength'),
  'Grapple resolution must normalize canonical strength.');
check(grappleActions.includes('fighter?.abilityScores?.strength') && grappleActions.includes('fighter?.attributes?.might'),
  'Strength normalization must recognize both canonical sources.');
check(grappleActions.includes('powerfulBuildBonus'),
  'Powerful Build must enter the opposed grapple values.');
check(grappleActions.includes('let attacker = withCanonicalGrappleAttributes'),
  'The admitted attacker must be normalized before validation and rolling.');
check(grappleActions.includes('actionType === "improveControl" && result?.success'),
  'Improve Control must mutate control state on success.');
check(grappleActions.includes('const nextControl = ["advantage", "dominant", "pinned"]'),
  'Control must progress from advantage to dominant.');

// Execute the small AI router using dependency stubs.
const executableRouter = routerSource
  .replace(/import \{[\s\S]*?\} from "\.\.\/combat\/grappleWeaponTransitions\.js";\n/, `const findEligibleClinchWeapon = () => null;\nconst isGroundedGrapple = () => false;\nconst isStandingClinch = () => true;\nconst normalizeCombatWeaponState = () => ({ clinchWeaponReady: false });\n`)
  .replace(/import \{ hasSufficientGroundControl \} from "\.\.\/combat\/exhaustionCollapseState\.js";\n/, 'const hasSufficientGroundControl = () => false;\n');
const executableRouterWithPairing = executableRouter.replace(
  /import \{ hasReciprocalGrapplePair \} from "\.\.\/combat\/grapplePairing\.js";\n/,
  `const hasReciprocalGrapplePair = (actor = {}, target = {}) => Boolean(
    actor?.id && target?.id &&
    String(actor?.grappleState?.state || '').toLowerCase() !== 'neutral' &&
    String(target?.grappleState?.state || '').toLowerCase() !== 'neutral' &&
    (actor?.grappleState?.opponent || actor?.grappleState?.opponentId) === target.id &&
    (target?.grappleState?.opponent || target?.grappleState?.opponentId) === actor.id
  );\n`,
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(executableRouterWithPairing).toString('base64')}`;
const { resolveGrappleTurnAction } = await import(moduleUrl);
const minotaur = {
  id: 'minotaur', actorKey: 'minotaur', name: 'Minotaur', size: 'large', aiRole: 'brute',
  abilityScores: { strength: 19 }, remainingActions: 2,
  grappleState: { state: 'grapple_clinch', opponent: 'knight', isAttacker: true },
};
const knight = {
  id: 'knight', name: 'Knight', abilityScores: { strength: 15 },
  grappleState: { state: 'grapple_clinch', opponent: 'minotaur', isAttacker: false },
};
let route = resolveGrappleTurnAction({ actor: minotaur, opponent: knight });
check(route.actionType === 'improveControl', 'A powerful initiating Minotaur must improve control first.');
route = resolveGrappleTurnAction({
  actor: { ...minotaur, grappleState: { ...minotaur.grappleState, controlState: 'dominant' } },
  opponent: knight,
});
check(route.actionType === 'lift', 'Dominant Minotaur control must unlock Lift.');
route = resolveGrappleTurnAction({
  actor: { ...minotaur, liftedTargetId: 'knight', grappleState: { ...minotaur.grappleState, controlState: 'dominant', liftedTargetId: 'knight' } },
  opponent: { ...knight, grappleState: { ...knight.grappleState, lifted: true, carriedBy: 'minotaur' } },
});
check(route.actionType === 'slam', 'A lifted target must unlock Slam.');
route = resolveGrappleTurnAction({
  actor: { ...knight, remainingActions: 2 },
  opponent: minotaur,
});
check(route.actionType === 'breakFree', 'A standing defender must continue to prefer escape.');

// Verify the shared engagement patch applies to the exact current source shape.
check(engagementPatch.includes('hasGroundState && (linkedGrapple || isAdjacent)'),
  'Prone/ground classification must require adjacency or a linked grapple.');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcs-impact-patch-'));
fs.mkdirSync(path.join(temp, 'src/utils'), { recursive: true });
const fixture = `const text = (...values) => values.filter(Boolean).join(" ").toLowerCase();\n\nconst positionOf = (actor, positions = {}) => (\n  positions?.[actor?.id] || actor?.position || actor?.hex || null\n);\n\nconst isNeutralGrappleState = (actor) => {\n  const state = text(actor?.grappleState?.state || "neutral");\n  return !state || state === "neutral";\n};\n\nconst hasGrappleStatus = (actor) => {\n  const status = text(actor?.grappleState?.state, actor?.status, actor?.condition);\n  return /grapple|clinch|pinned|held|restrained/.test(status);\n};\n\nexport function getMeleeEngagementContext({ actor = {}, target = {}, distanceFeet } = {}) {\n  const distance = Number(distanceFeet);\n  const actorState = text(actor?.grappleState?.state);\n  const targetState = text(target?.grappleState?.state);\n  const actorNamesTarget = actor?.grappleState?.opponent === target?.id;\n  const targetNamesActor = target?.grappleState?.opponent === actor?.id;\n  const linkedGrapple = Boolean(\n    actor?.id &&\n    target?.id &&\n    (actorNamesTarget || targetNamesActor) &&\n    (!isNeutralGrappleState(actor) || !isNeutralGrappleState(target))\n  );\n  const isGround = Boolean(\n    actor?.prone || target?.prone ||\n    actorState.includes("ground") || targetState.includes("ground")\n  );\n  const isClinched = Boolean(\n    linkedGrapple &&\n    (actorState.includes("clinch") || targetState.includes("clinch"))\n  );\n  const isGrappling = Boolean(\n    linkedGrapple ||\n    (hasGrappleStatus(actor) && actorNamesTarget) ||\n    (hasGrappleStatus(target) && targetNamesActor)\n  );\n  const isAdjacent = Number.isFinite(distance) && distance <= 5.5;\n  const rangeBand = isGround\n    ? "ground"\n    : isClinched\n      ? "clinch"\n      : isGrappling\n        ? "grapple"\n        : isAdjacent\n          ? "close-melee"\n          : "open-melee";\n  return { isGround, isAdjacent, rangeBand };\n}\n`;
fs.writeFileSync(path.join(temp, 'src/utils/meleeEngagementContext.js'), fixture);
execFileSync('git', ['init', '-q'], { cwd: temp });
execFileSync('git', ['add', '.'], { cwd: temp });
execFileSync('git', ['apply', '--check', engagementPatchPath], { cwd: temp, stdio: 'pipe' });
assertions += 1;
fs.rmSync(temp, { recursive: true, force: true });

console.log(`Impact integration correction tests passed: ${assertions} assertions.`);
