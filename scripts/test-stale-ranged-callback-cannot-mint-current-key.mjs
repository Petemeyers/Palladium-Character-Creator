import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPage = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(combatPage, /const createAttackExecutionKey = useCallback/);
assert.match(combatPage, /reason=actor-not-active-fighter active=\$\{activeFighter\.name \|\| activeFighter\.id\}/);
assert.match(combatPage, /reason=no-current-action-grant/);
assert.match(combatPage, /return null;/);
assert.match(combatPage, /if \(!attackActionId && !bonusModifiers\?\.allowOutOfTurnAttack\)/);
assert.match(combatPage, /makeBlockedAttackResult\("execution-key-mint-rejected", attackActionId\)/);

const activeRejectIndex = combatPage.indexOf("reason=actor-not-active-fighter");
const registrySetIndex = combatPage.indexOf("attackExecutionRegistryRef.current.set", activeRejectIndex);
assert.ok(activeRejectIndex !== -1 && registrySetIndex !== -1 && activeRejectIndex < registrySetIndex);

console.log("stale ranged callbacks cannot mint a fresh current attack key");
