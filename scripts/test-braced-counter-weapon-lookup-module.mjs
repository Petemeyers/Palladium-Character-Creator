import assert from "node:assert/strict";

import { resolveBracedCounterDefenderWeapon as productionLookup } from "../src/utils/combat/bracedCounterWeaponLookup.js";
import { resolveBracedCounterDefenderWeapon as fixtureLookup } from "../src/utils/combat/phase2eBracedCounterFixture.js";
import { readFileSync } from "node:fs";

const spear = { name: "Spear" };
assert.equal(productionLookup({ equistaminadWeapons: [spear, { name: "Dagger" }] })?.name, "Spear");
assert.equal(productionLookup({ equistaminadWeapons: { primary: { name: "Pike" } } })?.name, "Pike");
assert.equal(fixtureLookup({ equistaminadWeapons: [spear] })?.name, "Spear");
assert.equal(productionLookup, fixtureLookup);

const combatPage = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPage, /from "\.\.\/utils\/combat\/bracedCounterWeaponLookup\.js"/);
assert.doesNotMatch(
  combatPage,
  /resolveBracedCounterDefenderWeapon,\s*\n\s*summarizeFighter,\s*\n} from "\.\.\/utils\/combat\/phase2eBracedCounterFixture\.js"/,
);

console.log("braced-counter weapon lookup is a production helper re-exported by the DEV fixture");
