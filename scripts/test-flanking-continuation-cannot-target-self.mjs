import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
const continuation = source.indexOf("const liveTarget =", source.indexOf("player-ai-flanking-continuation"));
const identityGuard = source.indexOf("isSameCombatActor(livePlayer, liveTarget)", continuation);
const attack = source.indexOf("flankingAttackActionId", continuation);
assert.ok(continuation >= 0 && identityGuard > continuation && attack > identityGuard);
assert.match(source.slice(identityGuard, attack), /target is self or no longer hostile/);
console.log("flanking continuation self-target guard tests passed");
