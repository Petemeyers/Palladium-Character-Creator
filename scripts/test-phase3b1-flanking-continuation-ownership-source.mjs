import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/utils/ai/playerTurnAI.js", "utf8");
const selection = source.indexOf("const flankingArmoredAction = resolveArmoredCombatAction");
const grappleBranch = source.indexOf('flankingArmoredAction?.actionType === "grapple"', selection);
const attackKey = source.indexOf("flankingAttackActionId =", selection);
const attackCall = source.indexOf("const attackOutcome = await attack", attackKey);

assert.ok(selection >= 0, "flanking continuation must resolve an armored action");
assert.ok(grappleBranch > selection, "grapple branch must follow selection");
assert.ok(attackKey > grappleBranch, "generic attack ownership must be allocated only after the grapple branch");
assert.ok(attackCall > attackKey, "ordinary attack must use the post-selection key");
assert.match(source, /eventType: "flanking-armored-action-resolved"/);
assert.match(source, /eventType: "flanking-grapple-dispatch-started"/);
assert.match(source, /eventType: "flanking-attack-execution-key-created"/);
assert.match(source, /turnActionResolvingRef\.current = false;[\s\S]*?const grappleResult = dispatchGrappleTurnAction/);
assert.match(source, /eventType: "player-flanking-grapple-terminal-return-propagated"/);

console.log("✅ Phase 3B1 flanking continuation ownership source tests passed");
