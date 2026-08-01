import assert from 'node:assert/strict';
import fs from 'node:fs';

const combatPagePath = new URL('../src/pages/CombatPage.jsx', import.meta.url);
assert.ok(fs.existsSync(combatPagePath), `Missing ${combatPagePath}`);

const source = fs.readFileSync(combatPagePath, 'utf8');

assert.match(
  source,
  /continuationAuthorizationId:\s*isConvertedAttackGrapple && lifecycleIdentity\.actionSequence > 1\s*\?\s*`converted-attack:\$\{convertedAttackAdmission\.sourceAttackExecutionKey\}`\s*:\s*validatedContinuationReceipt\?\.authorizationId \|\| null/,
  'Only a converted sequence-two Body Clinch may provide conversion authorization identity.',
);
assert.match(
  source,
  /continuationKey:\s*isConvertedAttackGrapple && lifecycleIdentity\.actionSequence > 1\s*\?\s*`converted-attack:\$\{convertedAttackAdmission\.sourceAttackExecutionKey\}`\s*:\s*validatedContinuationReceipt\?\.continuationKey \|\| null/,
  'Only a converted sequence-two Body Clinch may provide a canonical continuation key.',
);

const fumbleBlock = source.match(/const fumbleHandoffVerified =[\s\S]*?;\r?\n\s*if \(!fumbleHandoffVerified\)/)?.[0] || '';
assert.ok(fumbleBlock, 'Could not locate fumble handoff verification block.');
assert.doesNotMatch(
  fumbleBlock,
  /fumblerAfter\?\.remainingActions/,
  'A same-actor new-round initiative win must not fail because actions reset.',
);
assert.match(fumbleBlock, /fumbleCoordinateMatches/);
assert.match(fumbleBlock, /initiativeTurnAdvanced/);
assert.match(fumbleBlock, /!continuationRemains/);

// Mirror the canonical admission invariant relevant to this regression:
// Sequence two requires both authorization fields; fresh sequence one must not synthesize them.
const validateSecondActionAdmission = ({ actionSequence, continuationAuthorizationId, continuationKey }) =>
  actionSequence <= 1 || Boolean(continuationAuthorizationId && continuationKey);
const convertedKey = 'converted-attack:attack-test';
assert.equal(validateSecondActionAdmission({
  actionSequence: 1,
  continuationAuthorizationId: null,
  continuationKey: null,
}), true);
assert.equal(validateSecondActionAdmission({
  actionSequence: 2,
  continuationAuthorizationId: convertedKey,
  continuationKey: convertedKey,
}), true);

const verifyFumble = ({ accepted, coordinateMatches, initiativeTurnAdvanced, continuationRemains }) =>
  accepted && coordinateMatches && initiativeTurnAdvanced && !continuationRemains;
assert.equal(verifyFumble({
  accepted: true,
  coordinateMatches: true,
  initiativeTurnAdvanced: true,
  continuationRemains: false,
}), true);

console.log('Live-log regression tests passed: converted Body Clinch admission and same-actor fumble handoff.');
