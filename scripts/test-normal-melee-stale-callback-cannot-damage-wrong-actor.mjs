import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

const rollGuardIndex = source.indexOf('isAttackActionLive("attack-roll-log")');
const rollLogIndex = source.indexOf('eventType: "critical-miss"', rollGuardIndex);
const damageGuardIndex = source.indexOf('isAttackActionLive("damage-application")');
const targetLookupIndex = source.indexOf("liveDamageFighters.find((f) => f.id === normalAttackTargetId)");

assert.ok(rollGuardIndex >= 0, "attack roll logging should have a stale callback guard");
assert.ok(rollLogIndex > rollGuardIndex, "stale guard should run before player-visible critical roll logs");
assert.ok(damageGuardIndex > rollGuardIndex, "damage application still has its stale guard");
assert.ok(targetLookupIndex > damageGuardIndex, "target lookup should happen after damage stale guard");
assert.match(source, /addLog\("stale delayed attack ignored\.", "warning"\)/);

console.log("normal melee stale callback guard tests passed");
