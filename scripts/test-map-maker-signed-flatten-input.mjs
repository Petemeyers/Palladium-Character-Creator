import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync(
  "src/components/maps/MapMakerToolSidebar.jsx",
  "utf8"
);

assert.ok(source.includes("flattenHeightDraft"));
assert.ok(source.includes("commitFlattenHeightDraft"));
assert.ok(source.includes('value={flattenHeightDraft}'));
assert.ok(source.includes('text === "-"'));
assert.ok(source.includes("setFlattenHeightDraft(next)"));
assert.ok(source.includes("onEditorFlattenHeightChange?.(numeric)"));
assert.ok(source.includes("Negative values lower terrain"));
assert.ok(!source.includes("value={Number(editorFlattenHeight) || 0}"));

// Regression model: typing -2 must permit "-" as a draft and eventually
// commit -2 rather than snapping the input back to zero.
function shouldCommit(text) {
  const trimmed = String(text ?? "").trim();
  if (
    ["", "-", "+", ".", "-.", "+."].includes(trimmed)
  ) return false;
  return /^[+-]?\d+(?:\.\d+)?$/.test(trimmed);
}

assert.equal(shouldCommit("-"), false);
assert.equal(shouldCommit("-2"), true);
assert.equal(Number("-2"), -2);
assert.equal(shouldCommit("0"), true);
assert.equal(shouldCommit("2"), true);
assert.equal(shouldCommit("-10"), true);

console.log("PASS signed negative Flatten input source contract");
