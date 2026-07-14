import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

const factoryIndex = source.indexOf("const createAttackExecutionKey = useCallback");
const activeCheckIndex = source.indexOf("String(activeFighter.id) !== String(actorId)", factoryIndex);
const rejectLogIndex = source.indexOf("reason=actor-not-active-fighter", activeCheckIndex);
const returnNullIndex = source.indexOf("return null;", rejectLogIndex);
const registrySetIndex = source.indexOf("attackExecutionRegistryRef.current.set", factoryIndex);

assert.ok(factoryIndex !== -1, "attack key factory should exist");
assert.ok(activeCheckIndex > factoryIndex, "factory should compare actor to active fighter");
assert.ok(rejectLogIndex > activeCheckIndex, "factory should log active-fighter mint rejection");
assert.ok(returnNullIndex > rejectLogIndex, "factory should return null on active-fighter mismatch");
assert.ok(registrySetIndex > returnNullIndex, "registry write must happen after active-fighter rejection");
assert.match(source, /allowOutOfTurnAttack/);

console.log("attack registry rejects non-active actor key creation");
