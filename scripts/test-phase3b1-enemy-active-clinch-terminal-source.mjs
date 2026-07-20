import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(
  combatPage,
  /source:\s*"enemy-inline-attack"[\s\S]*?eventType:\s*"combat-obligation-routed"[\s\S]*?executeCanonicalGrappleAction\(\{/,
  "enemy inline active grapple should route through the grapple dispatcher before generic attack selection.",
);

assert.match(
  combatPage,
  /eventType:\s*"enemy-grapple-terminal-return-propagated"[\s\S]*?return\s*\{\s*[\s\S]*?terminal:\s*true[\s\S]*?routeType:\s*"grapple-terminal"/,
  "enemy inline active grapple should return a terminal grapple result.",
);

assert.match(
  combatPage,
  /eventType:\s*"standing-armored-selector-suppressed"[\s\S]*?reason:\s*"active-grapple"/,
  "standing armored selector should be suppressed before enemy inline active-clinch dispatch.",
);

const activeBlockIndex = combatPage.indexOf("inlineActiveGrappleObligation");
const standingSelectorIndex = combatPage.indexOf("const inlineArmoredAction", activeBlockIndex);
const genericAttackIndex = combatPage.indexOf("const executeEnemyAttackOnce", activeBlockIndex);
assert.ok(activeBlockIndex >= 0, "enemy inline active-grapple obligation block should exist.");
assert.ok(standingSelectorIndex > activeBlockIndex, "standing selection should occur after active-grapple obligation routing.");
assert.ok(genericAttackIndex > standingSelectorIndex, "generic attack helper should stay after standing selection.");

console.log("✅ Phase 3B1 enemy active-clinch terminal source checks passed");
