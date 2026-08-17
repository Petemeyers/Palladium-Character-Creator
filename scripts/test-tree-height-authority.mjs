import assert from 'node:assert/strict';
import { getBattlefieldPropDefinition } from '../src/utils/maps/battlefieldPropCatalog.js';
const tree = getBattlefieldPropDefinition('tree');
assert.ok(tree.heightFeet >= 25, `tree height should represent a mature tree, got ${tree.heightFeet}`);
console.log(`PASS tree canonical height = ${tree.heightFeet} ft`);
