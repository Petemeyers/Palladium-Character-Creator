import fs from 'node:fs';
import path from 'node:path';

const target = path.resolve('src/utils/three/HexArena.js');
const source = fs.readFileSync(target, 'utf8');
const failures = [];

if (!source.includes('function disposeThreeMaterial(material)')) {
  failures.push('disposeThreeMaterial helper is missing');
}
if (!source.includes('Array.isArray(material)')) {
  failures.push('material-array handling is missing');
}
if (/\b[A-Za-z_$][\w$]*\.material\.dispose\(\);/.test(source)) {
  failures.push('unsafe direct object.material.dispose() remains');
}
if (!source.includes('disposeThreeMaterial(obj.material);')) {
  failures.push('grid/object traversal does not use safe material disposal');
}

if (failures.length) {
  console.error('FAIL HexArena material disposal repair');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('PASS HexArena multi-material disposal repair');
