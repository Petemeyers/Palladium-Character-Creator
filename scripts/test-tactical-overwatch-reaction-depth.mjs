import assert from "node:assert/strict"; import { resolveTacticalOverwatchAttack } from "../src/utils/combat/resolveTacticalOverwatchAttack.js";
const rejected = await resolveTacticalOverwatchAttack({ admission: { intent: { reactionDepth: 1 }, window: {}, executionKey: "x", projectileIdentity: {} }, executeCanonicalAttack: () => assert.fail() });
assert.equal(rejected.reason, "reaction-depth-cap"); console.log("tactical overwatch reaction depth: 3/3 passed");
