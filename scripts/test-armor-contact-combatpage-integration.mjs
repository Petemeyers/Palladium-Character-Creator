import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/pages/CombatPage.jsx", "utf8");

const resolverImport = source.indexOf('import { resolveArmorContact } from "../utils/combat/armorContactResolver.js"');
assert.ok(resolverImport >= 0, "CombatPage should import the authoritative armor-contact resolver");

const resolveIndex = source.indexOf("armorContactResult = resolveArmorContact");
const damageRollIndex = source.indexOf("damageRollResult = CryptoSecureDice.parseAndRoll", resolveIndex);
const hpMutationIndex = source.indexOf("applyHPToFighter(defender, newHP)", resolveIndex);
const impactIndex = source.indexOf("preDamageImpact = rollImpactLocation()", resolveIndex - 1000);
assert.ok(resolveIndex > 0, "CombatPage should resolve armor contact inside the attack chain");
assert.ok(impactIndex > 0 && impactIndex < resolveIndex, "hit location should be determined before armor contact resolution");
assert.ok(damageRollIndex > resolveIndex, "damage dice should be after armor contact resolution");
assert.ok(hpMutationIndex > resolveIndex, "HP mutation should be after armor contact resolution");

const preventedBranch = source.slice(resolveIndex, damageRollIndex);
assert.match(preventedBranch, /if \(!armorContactResult\.damageAllowed\)/, "solid plate prevention branch should run before damage dice");
assert.match(preventedBranch, /buildLayeredArmorImpactNarration\(\{|buildArmorStoppedNarration\(\{/, "player log should use canonical contact-aware armor narration");
assert.match(preventedBranch, /finishAttackAfterImpact\(\{/, "prevented contact should finalize through the normal attack finalizer");
assert.doesNotMatch(preventedBranch, /applyHPToFighter/, "prevented contact branch must not mutate HP");
assert.doesNotMatch(preventedBranch, /parseAndRoll\(damageFormula/, "prevented contact branch must not roll damage dice");
assert.match(preventedBranch, /damageAllowed:\s*false/);
assert.match(preventedBranch, /hpDamageApplied:\s*0/);
assert.match(preventedBranch, /mayBleed:\s*false/);
assert.match(preventedBranch, /mayCauseUnconsciousness:\s*false/);

assert.match(source, /eventType: "armor-contact-resolved"/, "developer diagnostic event should be structured");
assert.match(source, /Copy Entire Log|buildCombatLogText/, "canonical full-log export path should remain present");
assert.match(source, /suggestedModes: \["half-sword-thrust", "pommel-or-crossguard-strike", "grapple"\]/, "AI tactical memory should record non-cut options");

console.log("✅ CombatPage armor-contact integration tests passed");
