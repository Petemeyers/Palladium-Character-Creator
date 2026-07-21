import assert from "node:assert/strict";
import fs from "node:fs";
import { PUBLIC_ALIGNMENTS } from "../src/data/publicAlignment.js";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import { normalizeAlignmentBehavior } from "../src/utils/behavior/normalizeAlignmentBehavior.js";
import { normalizeCharacterSavePayload } from "../src/utils/characterSave.js";

const keys = ["lawful-good", "neutral-good", "chaotic-good", "lawful-neutral", "true-neutral", "chaotic-neutral", "lawful-evil", "neutral-evil", "chaotic-evil"];
assert.deepEqual(PUBLIC_ALIGNMENTS.filter((entry) => entry.value).map((entry) => entry.value), keys);
for (const key of keys) {
  const normalized = normalizeAlignmentBehavior(key);
  assert.equal(normalized.alignmentKey, key);
  assert.deepEqual(normalizeAlignmentBehavior(normalized), normalized);
  assert.ok(normalized.alignmentName);
  assert.ok(normalized.lawChaosAxis);
  assert.ok(normalized.goodEvilAxis);
  assert.ok(Object.isFrozen(normalized.dimensions));
  assert.ok(Object.isFrozen(normalized.surrenderWeights));
}
const aliases = { Principled: "lawful-good", Scrupulous: "neutral-good", Unprincipled: "true-neutral", Anarchist: "chaotic-neutral", Miscreant: "neutral-evil", Aberrant: "lawful-evil", Diabolic: "chaotic-evil" };
for (const [legacy, canonical] of Object.entries(aliases)) {
  const migrated = normalizeAlignmentBehavior(legacy);
  assert.equal(migrated.alignmentKey, canonical);
  assert.equal(migrated.alignmentSource, "legacy-alias");
}
const explicit = normalizeAlignmentBehavior("Scrupulous", { mercy: 37, executionWeight: 11 });
assert.equal(explicit.dimensions.mercy, 37);
assert.equal(explicit.surrenderWeights.execute, 11);
assert.equal(normalizeCharacterSavePayload({ alignment: "Scrupulous" }).alignment, "neutral-good");
assert.equal(normalizeCharacterSavePayload({ alignment: "chaotic-evil" }).alignment, "chaotic-evil");
for (const key of ["knight", "goblin-warrior", "minotaur"]) assert.ok(keys.includes(getCanonicalCombatActorDefinition(key).alignment));
const canonicalSource = fs.readFileSync(new URL("../src/data/canonicalCombatActors.js", import.meta.url), "utf8");
assert.doesNotMatch(canonicalSource, /Principled|Scrupulous|Unprincipled|Anarchist|Miscreant|Aberrant|Diabolic|Oathbound|Compassionate|Pragmatic|Independent|Self-Serving|Iron-Code|Malevolent/i);
console.log("Nine-grid alignment normalization and legacy migration passed");
