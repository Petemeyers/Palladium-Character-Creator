import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const start = source.indexOf("const completeMoraleAction");
const end = source.indexOf("commitFighters((prev)", start);
const completion = source.slice(start, end);
assert.match(completion, /actionType,\s*actionSpent:/, "structured result must use the requested morale action type");
assert.doesNotMatch(completion, /actionType:\s*["']grapple["']/);
assert.doesNotMatch(completion, /grappleActionExecutionRegistryRef|grappleActionCompletionRegistryRef/);
assert.match(source, /eventType:\s*["']surrender-offered["'][\s\S]*?data:\s*\{\s*actionType:\s*["']cower["']/);
assert.doesNotMatch(source, /still cannot reach \$\{target\.name\} for attack! \([^\n]+\),\s*["']error["']/);
console.log("morale cower completion action type test passed");
