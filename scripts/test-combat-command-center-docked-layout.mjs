import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(source, /data-testid="combat-command-center-docked"/);
assert.match(source, /maxW="1200px"[\s\S]*mx="auto"[\s\S]*overflowY="auto"[\s\S]*overflowX="hidden"/);
assert.doesNotMatch(source, /title="Combat Arena - Controls"[\s\S]{0,300}<FloatingPanel/);
assert.doesNotMatch(source, /position="fixed"[\s\S]{0,300}Combat Arena Controls/);
assert.match(source, /fighters\.length > 0 && !combatActive && \(showDeploymentModal \|\| manualDeploymentOpen\) && !combatControlsExpanded/);

console.log("combat command center docked layout tests passed");
