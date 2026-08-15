import assert from "node:assert/strict";

import { PHASE3_CANONICAL_EFFECT_FIXTURE } from "../src/utils/combat/phase3CanonicalEffectFixture.js";
import { readFileSync } from "node:fs";

assert.equal(PHASE3_CANONICAL_EFFECT_FIXTURE.windowApiName, "__mcsPhase3CanonicalEffectFixture");
assert.equal(PHASE3_CANONICAL_EFFECT_FIXTURE.physical.protectionPolicy, "physical-armor");
assert.equal(PHASE3_CANONICAL_EFFECT_FIXTURE.bypass.protectionPolicy, "bypass-physical");

const combatPage = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPage, /window\[PHASE3_CANONICAL_EFFECT_FIXTURE\.windowApiName\]/);
assert.match(combatPage, /handleEngineEventRef\.current\?\.\(event\)/);
assert.doesNotMatch(
  combatPage.slice(
    combatPage.indexOf("window[PHASE3_CANONICAL_EFFECT_FIXTURE.windowApiName]"),
    combatPage.indexOf("delete window[PHASE3_CANONICAL_EFFECT_FIXTURE.windowApiName]"),
  ),
  /currentHP\s*-=/,
);

console.log("phase 3 canonical-effect fixture is DEV-only and uses production handleEngineEvent");
