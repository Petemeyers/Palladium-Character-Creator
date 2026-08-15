import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/pages/CombatPage.jsx", import.meta.url),
  "utf8",
);

const counterStart = source.indexOf("// Check for braced weapon counter-damage");
const counterEnd = source.indexOf(
  "// Knockdown check for massive attackers",
  counterStart,
);

assert.ok(counterStart !== -1, "braced-counter execution path must remain present");
assert.ok(counterEnd > counterStart, "braced-counter path must have a stable source boundary");

const counterSource = source.slice(counterStart, counterEnd);

assert.match(counterSource, /isBraced && bonusModifiers\.damageMultiplier >= 2 && defenderWeapon/);
assert.match(counterSource, /attackDiceRoll >= 18 && attackDiceRoll <= 20/);
assert.match(counterSource, /Math\.floor\(finalDamage \/ 3\)/);
assert.match(counterSource, /braced \$\{defenderWeapon\.name\} impales/);
assert.match(
  counterSource,
  /resolveBracedCounterDefenderWeapon\(defenderAfterHit\)/,
  "counter path must resolve spear/polearm from array or slot-shaped equipped weapons",
);

assert.match(
  counterSource,
  /isAttackActionLive\("braced-counter-hp-mutation"\)/,
  "counter HP mutation must revalidate the originating attack execution",
);
assert.match(
  counterSource,
  /updated\.find\(\(f\) => f\.id === normalAttackAttackerId\)/,
  "counter damage must resolve the charging attacker by stable actor id",
);
assert.match(
  counterSource,
  /applyHPToFighter\(attackerInUpdated,\s*counterResultHP\)/,
  "counter damage must use the canonical HP mutation authority",
);
assert.match(
  counterSource,
  /counterResultHP = clampHP\(\s*getFighterHP\(attackerInUpdated\) - counterDamage,\s*attackerInUpdated,\s*\)/,
  "counter damage must retain one-third damage while using canonical clamping",
);
assert.ok(
  counterSource.indexOf("applyHPToFighter(attackerInUpdated, counterResultHP)") <
    counterSource.indexOf("braced ${defenderWeapon.name} impales"),
  "counter state must resolve before the player-visible counter message",
);

assert.doesNotMatch(
  counterSource,
  /\.(?:currentHP|hp|HP|hitPoints)\s*[-+*/]?=/,
  "braced-counter code must not directly assign or subtract HP aliases",
);
assert.doesNotMatch(
  counterSource,
  /(?:currentHP|hp|HP|hitPoints)\s*:/,
  "braced-counter code must not independently synchronize HP aliases",
);

console.log("braced counter damage uses canonical HP authority");
