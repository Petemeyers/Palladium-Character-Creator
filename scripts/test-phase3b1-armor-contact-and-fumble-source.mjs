import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(
  source,
  /armor-contact-required-but-missing/,
  "missing armor-contact invariant must block damage before HP mutation",
);
assert.match(
  source,
  /isArmoredLongswordTechnique\(/,
  "armored longsword modes must force armor-contact resolution even through presentation attacks",
);
assert.match(
  source,
  /validateArmoredTechniqueWeapon\(/,
  "armored technique/source weapon compatibility must be validated at attack boundary",
);
assert.match(
  source,
  /armored-source-weapon-validated/,
  "source weapon validation diagnostic should be emitted",
);
assert.match(
  source,
  /completeTurnEndingFumble/,
  "natural-1 path should use explicit fumble completion",
);
assert.match(
  source,
  /fumble-turn-handoff/,
  "fumble completion should emit initiative handoff diagnostic",
);
assert.doesNotMatch(
  source,
  /if \(isCriticalMiss\) \{[\s\S]{0,140}deferMultiAttackHitEnd\(\);[\s\S]{0,40}return;/,
  "critical miss branch must not use generic deferred end-turn handoff",
);
assert.match(
  source,
  /gap-critical-resolved/,
  "gap criticals should keep gap contact wording/location",
);

console.log("✅ Phase 3B1 armor-contact/fumble source tests passed");
