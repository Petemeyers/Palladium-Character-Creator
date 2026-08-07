import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const sourcePath = path.resolve(process.cwd(), 'src/pages/CombatPage.jsx');
const source = fs.readFileSync(sourcePath, 'utf8');
let assertions = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  assertions += 1;
};

check(
  source.includes('isConvertedAttackGrapple && lifecycleIdentity.actionSequence > 1'),
  'converted grapple authorization must be limited to action sequence > 1',
);
check(
  (source.match(/isConvertedAttackGrapple && lifecycleIdentity\.actionSequence > 1/g) || []).length === 2,
  'both converted continuation identity fields must use the sequence guard',
);
check(
  !source.includes('continuationAuthorizationId: isConvertedAttackGrapple\n        ? `converted-attack:'),
  'unconditional converted continuation authorization must be removed',
);
check(
  source.includes('actionResult?.blocked === true') &&
    source.includes('actionResult?.completed === true') &&
    source.includes('Number(actionResult?.staminaSpent || 0) === 0'),
  'zero-stamina terminal blocks must be recognized as no-roll completions',
);

const convertedContinuationIdentity = ({ actionSequence, attackKey }) => ({
  continuationAuthorizationId: actionSequence > 1 ? `converted-attack:${attackKey}` : null,
  continuationKey: actionSequence > 1 ? `converted-attack:${attackKey}` : null,
});

const firstAction = convertedContinuationIdentity({ actionSequence: 1, attackKey: 'attack-first' });
check(firstAction.continuationAuthorizationId === null && firstAction.continuationKey === null,
  'first-action Body Clinch must not synthesize continuation authorization');

const secondAction = convertedContinuationIdentity({ actionSequence: 2, attackKey: 'attack-second' });
check(secondAction.continuationAuthorizationId === 'converted-attack:attack-second',
  'second-action Body Clinch must receive converted continuation authorization');
check(secondAction.continuationKey === 'converted-attack:attack-second',
  'second-action Body Clinch must receive a matching converted continuation key');

const isNoRollCompletion = (actionResult) =>
  actionResult?.noRollAction === true ||
  (actionResult?.blocked === true && actionResult?.completed === true && Number(actionResult?.staminaSpent || 0) === 0);

check(isNoRollCompletion({ blocked: true, completed: true, staminaSpent: 0 }),
  'zero-stamina automated grapple block must complete without a roll claim');
check(!isNoRollCompletion({ blocked: false, completed: true, staminaSpent: 0 }),
  'ordinary completed grapple results must not bypass the roll claim');

console.log(`Grapple edge-case correction tests passed: ${assertions} assertions.`);
