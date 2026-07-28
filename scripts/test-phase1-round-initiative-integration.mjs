import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const combatEngine = fs.readFileSync(new URL("../src/utils/combatEngine.js", import.meta.url), "utf8");
const tracker = fs.readFileSync(new URL("../src/components/InitiativeTracker.jsx", import.meta.url), "utf8");

let assertions = 0;
const check = (condition, message) => {
  assertions += 1;
  assert.ok(condition, message);
};

check(
  combatPage.includes('import { rollRoundInitiative } from "../utils/combat/roundInitiative.js"'),
  "CombatPage imports the canonical initiative helper",
);
[
  'source: "combat-start"',
  'source: "new-melee-round-direct"',
  'source: "new-melee-round-safety"',
  'source: "engine-new-melee-round"',
].forEach((source) => {
  check(combatPage.includes(source), `${source} routes through canonical round initiative`);
});
check(
  combatPage.includes("fightersRef.current = orderedFighters") &&
    combatPage.includes("turnIndexRef.current = firstEligibleIndex >= 0 ? firstEligibleIndex : 0"),
  "direct round wrapping commits the sorted roster before selecting the active slot",
);
check(
  combatPage.includes("fightersRef.current = ordered") &&
    combatPage.includes("turnIndexRef.current = 0"),
  "engine-driven round reset commits sorted order and resets the active index",
);
check(
  !combatPage.includes("fighter.initiative += tieBreaker"),
  "CombatPage no longer inflates visible initiative to resolve ties",
);
check(
  combatEngine.includes('import { rollRoundInitiative } from "./combat/roundInitiative.js"') &&
    combatEngine.includes("this.rollInitiative();"),
  "the standalone combat engine uses canonical initiative at start and round wrap",
);
check(
  tracker.includes('import { rollRoundInitiative } from "../utils/combat/roundInitiative.js"') &&
    tracker.includes("createTrackerInitiativeOrder(newRound, order)"),
  "the legacy initiative tracker rerolls through the canonical helper on round wrap",
);
check(
  !tracker.includes("const totalInitiative = baseRoll + dexModifier"),
  "the tracker no longer maintains a competing inline initiative formula",
);

console.log(`Phase 1 initiative integration: ${assertions}/${assertions} assertions passed`);
