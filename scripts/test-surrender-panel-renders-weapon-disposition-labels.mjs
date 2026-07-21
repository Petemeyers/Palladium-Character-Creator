import assert from "node:assert/strict";
import fs from "node:fs";
import { getCombatDisplayLabel } from "../src/utils/presentation/getCombatDisplayLabel.js";

const panel = fs.readFileSync(new URL("../src/components/SurrenderDecisionPanel.jsx", import.meta.url), "utf8");
assert.match(panel, /getCombatDisplayLabel\(weaponDisposition\.weaponName \|\| weaponDisposition\.weaponId\)/);
assert.doesNotMatch(panel, /\{weaponDisposition\}/);
assert.equal(getCombatDisplayLabel({ weaponId: "weapon.dagger", name: "Dagger" }), "Dagger");
console.log("Surrender panel renders weapon disposition labels as text");
