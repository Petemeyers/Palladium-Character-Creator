import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/utils/combatActionHandlers/grappleActions.js", import.meta.url), "utf8");

assert.match(source, /const damageTargetLabel = labelActor\(defenderCopy, attacker, updated\)/);
assert.match(source, /\$\{damageTargetLabel\} takes \$\{damageTaken\} damage from \$\{attackerLabel\}/);
assert.match(source, /formatArmorGapContactOutcomeLog\(\{[\s\S]*?attackerLabel,[\s\S]*?targetLabel: damageTargetLabel/);

console.log("grapple follow-up damaged-actor log tests passed");
