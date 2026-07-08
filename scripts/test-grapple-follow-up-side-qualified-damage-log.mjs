import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/utils/combatActionHandlers/grappleActions.js", import.meta.url), "utf8");

assert.match(source, /import \{ formatCombatActorLabel \} from "\.\.\/combatActorIdentity\.js"/);
assert.match(source, /const labelActor = \(actor, counterpart = null, roster = getLiveFighters\(\)\) =>/);
assert.match(source, /formatCombatActorLabel\(actor, \{ roster, counterpart \}\)/);
assert.match(source, /labelActor\(attacker, defender\).*attacks.*labelActor\(defender, attacker\)/s);

console.log("grapple follow-up side-qualified damage log tests passed");
