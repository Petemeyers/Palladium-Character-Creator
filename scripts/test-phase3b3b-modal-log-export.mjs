import assert from "node:assert/strict";
import fs from "node:fs";

const panel = fs.readFileSync(new URL("../src/components/SurrenderDecisionPanel.jsx", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(panel, />Copy Entire Log</);
assert.match(panel, />Download Entire Log</);
assert.match(panel, /onClick=\{onCopyEntireLog\}/);
assert.match(panel, /onClick=\{onDownloadEntireLog\}/);
assert.doesNotMatch(panel, /isDisabled=\{isSubmitting\}[^\n]*Copy Entire Log/);
assert.doesNotMatch(panel, /isDisabled=\{isSubmitting\}[^\n]*Download Entire Log/);
assert.match(page, /onCopyEntireLog=\{handleCopyEntireLog\}/);
assert.match(page, /onDownloadEntireLog=\{handleDownloadEntireLog\}/);
assert.match(page, /getEntireCombatLogTextForExport/);
assert.match(page, /getCanonicalLogSnapshot\(\)/);
assert.doesNotMatch(page, /onCopyEntireLog=.*setPendingManualSurrenderDecision/);
assert.doesNotMatch(page, /onDownloadEntireLog=.*setPendingManualSurrenderDecision/);
assert.match(panel, /submissionError/);
assert.match(panel, /isDisabled=\{isSubmitting\}/);
console.log("Phase 3B3B modal full-log export passed");
