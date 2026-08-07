import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const combatPage = fs.readFileSync(path.join(root, 'src/pages/CombatPage.jsx'), 'utf8');
const grappleActions = fs.readFileSync(path.join(root, 'src/utils/combatActionHandlers/grappleActions.js'), 'utf8');
const routerSource = fs.readFileSync(path.join(root, 'src/utils/ai/resolveGrappleTurnAction.js'), 'utf8');
const pairingSource = fs.readFileSync(path.join(root, 'src/utils/combat/grapplePairing.js'), 'utf8');

let assertions = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  assertions += 1;
};

// Separation cleanup must be pair-scoped. A target's unrelated grapple with a
// third fighter may not be erased or routed as the current actor's obligation.
check(pairingSource.includes('export function hasReciprocalGrapplePair(actor = {}, target = {})'),
  'Combat utilities must define the shared reciprocal grapple helper.');
check(combatPage.includes('const snapshotPairLinked = hasReciprocalGrapplePair(actor, target || currentTarget);'),
  'Separation cleanup must evaluate the captured actor/target pair.');
check(combatPage.includes('const authoritativePairLinked = hasReciprocalGrapplePair(currentActor, currentTarget);'),
  'Separation cleanup must evaluate the authoritative actor/target pair.');
check(combatPage.includes('clearForcedSeparationRelationship(fighter, counterpartId)'),
  'The actor must clear only its relationship to the separated counterpart.');
check(combatPage.includes('clearForcedSeparationRelationship(fighter, actorId)'),
  'The counterpart must clear only its relationship to the actor.');
check(!combatPage.includes('f.id === actorId || f.id === targetId\n          ? { ...f, grappleState: initializeGrappleState(f) }'),
  'Separation cleanup may not reset both fighters unconditionally.');
check(combatPage.includes('Object.assign(actor, nextActor)'),
  'Captured actor snapshots must be reconciled before player AI continues.');
check(combatPage.includes('Object.assign(target, nextTarget)'),
  'Captured target snapshots must preserve unrelated third-party grapples.');

// A rejected armored fallback must settle its action instead of leaving an
// active initiative turn permanently owned by a failed attack.
const missingPlanIndex = combatPage.indexOf('if (requiresArmoredActionPlan && !hasArmoredActionPlan)');
const recoveryIndex = combatPage.indexOf('return recoverRejectedArmoredActionPlan({', missingPlanIndex);
const nextBranchIndex = combatPage.indexOf('if (armoredActionPlanId) {', missingPlanIndex);
check(missingPlanIndex >= 0, 'The missing armored-plan guard must exist.');
check(recoveryIndex > missingPlanIndex && recoveryIndex < nextBranchIndex,
  'The missing-plan guard must route through authoritative rejection recovery.');
check(combatPage.includes('reason: "missing-armored-action-plan"'),
  'Missing-plan recovery must record a stable reason.');
check(combatPage.includes('stage: "attack-entry-missing-plan"'),
  'Missing-plan recovery must identify the attack-entry stage.');
check(combatPage.includes('armored-action-plan-rejection-recovery-completed'),
  'Rejected attacks must emit a terminal recovery audit event.');

// Clinch narration must follow the canonical armor-contact result, not the
// preliminary grapple result object.
const armorResolveIndex = grappleActions.indexOf('armorContactOutcome = resolveArmorContact({');
const gapNarrationIndex = grappleActions.indexOf('slips through a gap in ${damageTargetLabel}', armorResolveIndex);
const blockNarrationIndex = grappleActions.indexOf("${damageTargetLabel}'s armor stops the close-quarters strike", armorResolveIndex);
check(armorResolveIndex >= 0, 'Clinch attacks must resolve canonical armor contact.');
check(gapNarrationIndex > armorResolveIndex,
  'Armor-gap narration must occur after canonical contact resolution.');
check(blockNarrationIndex > armorResolveIndex,
  'Armor-block narration must occur after canonical contact resolution.');
check(!grappleActions.includes("${attacker.name}'s armor blocks the close-quarters attack"),
  'The attacker may not be described as wearing the armor that blocked its own strike.');
check(grappleActions.includes('collapses and can no longer fight.'),
  'A grapple attack reducing a conscious fighter to zero HP must narrate incapacitation.');

// Execute the routing helper with dependency stubs to reproduce the team-log
// defect: the target is grappling a third fighter, not the acting Knight.
const executableRouter = routerSource
  .replace(/import \{[\s\S]*?\} from "\.\.\/combat\/grappleWeaponTransitions\.js";\n/, `const findEligibleClinchWeapon = () => null;\nconst isGroundedGrapple = () => false;\nconst isStandingClinch = () => true;\nconst normalizeCombatWeaponState = () => ({ clinchWeaponReady: false });\n`)
  .replace(/import \{ hasSufficientGroundControl \} from "\.\.\/combat\/exhaustionCollapseState\.js";\n/, 'const hasSufficientGroundControl = () => false;\n');
const executableRouterWithPairing = executableRouter.replace(
  /import \{ hasReciprocalGrapplePair \} from "\.\.\/combat\/grapplePairing\.js";\n/,
  `const hasReciprocalGrapplePair = (actor = {}, target = {}) => {
    const actorId = actor?.id;
    const targetId = target?.id;
    const actorState = String(actor?.grappleState?.state || '').toLowerCase();
    const targetState = String(target?.grappleState?.state || '').toLowerCase();
    const actorOpponent = actor?.grappleState?.opponent || actor?.grappleState?.opponentId;
    const targetOpponent = target?.grappleState?.opponent || target?.grappleState?.opponentId;
    return Boolean(actorId && targetId && actorState !== 'neutral' && targetState !== 'neutral' && actorOpponent === targetId && targetOpponent === actorId);
  };\n`,
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(executableRouterWithPairing).toString('base64')}`;
const { hasActiveGrappleState, resolveGrappleTurnAction } = await import(moduleUrl);

const actingKnight = {
  id: 'party-2',
  name: 'Knight #2',
  remainingActions: 2,
  grappleState: { state: 'neutral', opponent: null, opponentId: null },
};
const targetGrapplingThirdParty = {
  id: 'enemy-2',
  name: 'Enemy Knight #2',
  grappleState: { state: 'grapple_clinch', opponent: 'party-1', opponentId: 'party-1' },
};
check(hasActiveGrappleState(actingKnight, targetGrapplingThirdParty) === false,
  'A target grappling a third fighter may not create an active-grapple obligation for the acting Knight.');
const unrelatedRoute = resolveGrappleTurnAction({ actor: actingKnight, opponent: targetGrapplingThirdParty });
check(unrelatedRoute.handled === false && unrelatedRoute.reason === 'no-active-grapple',
  'Third-party grapple state must leave ordinary armored selection available.');

const linkedTarget = {
  ...targetGrapplingThirdParty,
  grappleState: { state: 'grapple_clinch', opponent: 'party-2', opponentId: 'party-2' },
};
check(hasActiveGrappleState(actingKnight, linkedTarget) === false,
  'A target-only link must not count as the acting Knight\'s active grapple.');

const actorLinked = {
  ...actingKnight,
  grappleState: { state: 'grapple_clinch', opponent: 'enemy-2', opponentId: 'enemy-2', isAttacker: true },
};
check(hasActiveGrappleState(actorLinked, targetGrapplingThirdParty) === false,
  'An actor-only link must not count while the opponent names a third fighter.');

const reciprocalTarget = {
  ...targetGrapplingThirdParty,
  grappleState: { state: 'grapple_clinch', opponent: 'party-2', opponentId: 'party-2' },
};
check(hasActiveGrappleState(actorLinked, reciprocalTarget) === true,
  'Exact reciprocal non-neutral links must count as an active grapple.');
const linkedRoute = resolveGrappleTurnAction({ actor: actorLinked, opponent: reciprocalTarget });
check(linkedRoute.handled === true,
  'A genuinely reciprocal grapple must continue through canonical grapple routing.');

console.log(`Knight grapple deadlock correction tests passed: ${assertions} assertions.`);
