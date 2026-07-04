import assert from "node:assert/strict";
import fs from "node:fs";

const game = fs.readFileSync(new URL("../game.md", import.meta.url), "utf8");
assert.match(game, /## 13 Sheet Attributes/);
assert.match(game, /These attributes should be the clean project-safe vocabulary for new systems/);
assert.match(game, /# Legacy Attribute Migration/);
assert.match(game, /\| strength \| might \|/);
assert.match(game, /retain an `alignment` field/);
assert.match(game, /legacy\/compatibility metadata/);
console.log("game.md alignment and attribute terminology audit passed");
