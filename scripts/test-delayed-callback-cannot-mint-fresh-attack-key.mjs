import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /attackActionGrantRegistryRef = useRef\(new Map\(\)\)/);
assert.match(source, /const createAttackActionGrant = useCallback/);
assert.match(source, /const isDelayedCallback = Boolean\(options\.isDelayedCallback \|\| options\.callbackSource\)/);
assert.match(source, /stale callback key mint blocked: actor=/);
assert.match(source, /reason=no-current-action-grant/);
assert.match(source, /isDelayedCallback && !isAttackActionGrantCurrent/);
assert.match(source, /callbackSource: options\.callbackSource \|\| null/);
assert.match(source, /isDelayedCallback,/);

console.log("delayed callbacks cannot mint fresh attack keys without a current action grant");
