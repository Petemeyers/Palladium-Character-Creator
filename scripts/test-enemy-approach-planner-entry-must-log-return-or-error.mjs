import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const entry = source.indexOf("enemy approach branch entering movement planner");
const returned = source.indexOf("enemy approach movement planner returned", entry);
const error = source.indexOf("enemy approach movement planner error", entry);

assert.ok(entry >= 0, "approach planner entry diagnostic should exist");
assert.ok(returned > entry, "approach planner should log returned plan after entry");
assert.ok(error > entry, "approach planner should have targeted error logging after entry");
assert.match(
  source.slice(entry, error + 1200),
  /try \{[\s\S]*enemy approach movement planner returned[\s\S]*\} catch \(error\) \{[\s\S]*enemy approach movement planner error/,
  "approach planner entry should be guarded by return/error diagnostics",
);

console.log("enemy approach planner entry return/error tests passed");
