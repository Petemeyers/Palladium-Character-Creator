import assert from "node:assert/strict";
import fs from "node:fs";
import { buildActorSheetDisplay } from "../src/utils/actorSheetDisplay.js";

assert.equal(buildActorSheetDisplay({ alignment: "Anarchist" }).legacy.alignment, "Anarchist");
const source = fs.readFileSync(new URL("../src/components/CharacterSheet.jsx", import.meta.url), "utf8");
assert.match(source, /Legacy Alignment/);
assert.doesNotMatch(source, /placeholder="Alignment"/);
console.log("character sheet legacy alignment label tests passed");
