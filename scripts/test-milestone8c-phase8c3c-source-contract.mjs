import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const combatPath = path.join(root, "src/pages/CombatPage.jsx");
const authorityPath = path.join(root, "src/utils/combat/aiTurnStabilityAuthority.js");
for (const file of [combatPath, authorityPath]) {
  assert.ok(fs.existsSync(file), `missing ${path.relative(root, file)}`);
}

const combat = fs.readFileSync(combatPath, "utf8");
const authority = fs.readFileSync(authorityPath, "utf8");

assert.match(authority, /AI_TURN_STABILITY_AUTHORITY_ID/);
assert.match(authority, /classifyPlayerAiProgressObservation/);
assert.match(authority, /filterAutomatedFormationOptionsForViability/);
assert.match(authority, /rally-formation/);

assert.match(combat, /aiTurnStabilityAuthority\.js/);
assert.match(combat, /initiativeTurnId:\s*initiativeTurnIdRef\.current/);
assert.match(combat, /round:\s*meleeRoundRef\.current/);
assert.match(combat, /turnCounter:\s*turnCounterRef\.current/);
assert.match(combat, /turnIndex:\s*turnIndexRef\.current/);
assert.match(combat, /const playerAiProgressObservation = classifyPlayerAiProgressObservation\(/);
assert.match(combat, /eventType: "player-ai-progress-audit-superseded"/);
assert.match(combat, /const playerAiMadeProgress = playerAiProgressObservation\.superseded \|\| hasPlayerAiActionProgress\(/);
assert.match(combat, /const activeTurnNeedsOwner = Boolean\(\s*!playerAiProgressObservation\.superseded &&/);
assert.match(combat, /if \(!playerAiProgressObservation\.superseded && !resolvedPlayerAi\.acted\) setTimeout/);

const selectorAt = combat.indexOf("const selectedFormationCommand = selectAutomatedFormationCommand({");
assert.ok(selectorAt >= 0, "missing automated formation selector");
const selectorEnd = combat.indexOf("});", selectorAt);
assert.ok(selectorEnd > selectorAt, "missing automated formation selector end");
const selectorRegion = combat.slice(selectorAt, selectorEnd);
assert.match(selectorRegion, /options:\s*filterAutomatedFormationOptionsForViability\(\{/);
assert.match(selectorRegion, /combatants:\s*fightersRef\.current \|\| fighters/);

assert.doesNotMatch(
  combat,
  /^\s*(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*const\s+[A-Za-z_$][\w$]*\s*=/m,
  "nested const declarations must not be introduced"
);
console.log("PASS Milestone 8C-8C.3C source contract");
