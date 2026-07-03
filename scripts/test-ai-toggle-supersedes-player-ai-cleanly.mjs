import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const manualBranch = source.indexOf("const activeExecution = playerAIExecutionRef.current;");
const clearOwnership = source.indexOf("playerAIExecutionRef.current = null;", manualBranch);
const settleExecution = source.indexOf('activeExecution.settle?.({ kind: "superseded", reason: "manual-toggle" })', manualBranch);
const manualLog = source.indexOf("player AI execution superseded fighter=", manualBranch);
const tokenInvalidation = source.indexOf("playerAITurnTokenRef.current = (playerAITurnTokenRef.current || 0) + 1", manualBranch);

assert.ok(manualBranch >= 0);
assert.ok(clearOwnership > manualBranch);
assert.ok(settleExecution > clearOwnership);
assert.ok(manualLog > settleExecution);
assert.ok(tokenInvalidation > manualLog,
  "manual toggle settles executor ownership before invalidating delayed callbacks");
assert.match(source, /if \(executionResult\?\.kind === "superseded"\) \{\s*return;\s*\}/,
  "superseded executor exits without finalizing the manual actor's turn");

console.log("AI-toggle executor supersession tests passed");
