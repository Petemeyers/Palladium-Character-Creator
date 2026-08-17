import fs from 'node:fs';
import path from 'node:path';

const target = path.resolve(process.cwd(), 'src/utils/three/HexArena.js');
const source = fs.readFileSync(target, 'utf8');
const invalid = ['.astaminandChild', '.dfocusose', '.fraidereContextLoss'];
const found = invalid.filter((token) => source.includes(token));
if (found.length) {
  console.error(`FAIL invalid HexArena runtime methods remain: ${found.join(', ')}`);
  process.exit(1);
}
if (!source.includes('.appendChild(renderer.domElement)')) {
  console.error('FAIL renderer canvas appendChild call not found');
  process.exit(1);
}
console.log('PASS HexArena runtime method corruption repaired');
