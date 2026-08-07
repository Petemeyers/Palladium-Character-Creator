import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const combatPagePath = path.join(root, "src/pages/CombatPage.jsx");
const footprintPath = path.join(root, "src/utils/combat/combatFootprintDistance.js");
const engagementPath = path.join(root, "src/utils/meleeEngagementContext.js");

const combatPage = fs.readFileSync(combatPagePath, "utf8");
const engagementSource = fs.readFileSync(engagementPath, "utf8");

let assertions = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  assertions += 1;
};

const footprintModule = await import(`${pathToFileURL(footprintPath).href}?v=${Date.now()}`);
const {
  getCombatantFootprintRadiusHexes,
  resolveFootprintAdjustedMeleeDistance,
  isWithinFootprintAdjustedMeleeReach,
} = footprintModule;

check(getCombatantFootprintRadiusHexes({ sizeCategory: "MEDIUM", sizeRank: 2 }) === 0,
  "Medium combatants must retain the normal center-hex distance rule.");
check(getCombatantFootprintRadiusHexes({ sizeCategory: "SMALL", sizeRank: 1 }) === 0,
  "Small combatants may not inherit a Large footprint from sizeRank alone.");
check(getCombatantFootprintRadiusHexes({ sizeCategory: "LARGE", sizeRank: 3 }) === 1,
  "Large combatants must contribute one occupied footprint ring.");
check(getCombatantFootprintRadiusHexes({ sizeCategory: "HUGE", sizeRank: 4 }) === 2,
  "Huge combatants must contribute two occupied footprint rings.");
check(getCombatantFootprintRadiusHexes({ sizeCategory: "LARGE_HEAVY", sizeRank: 5 }) === 3,
  "The heaviest size category must contribute three occupied footprint rings.");
check(getCombatantFootprintRadiusHexes({ sizeCategory: "MEDIUM", footprint: { radiusHex: 2 } }) === 2,
  "Explicit canonical footprint metadata must override inferred size.");

let distance = resolveFootprintAdjustedMeleeDistance({
  attacker: { sizeCategory: "LARGE" },
  defender: { sizeCategory: "MEDIUM" },
  centerDistanceFeet: 10,
  cellSizeFeet: 5,
});
check(distance.adjustedDistanceFeet === 5 && distance.footprintAllowanceFeet === 5,
  "A Large attacker 10 feet center-to-center from a Medium target must be 5 effective melee feet away.");

let reach = isWithinFootprintAdjustedMeleeReach({
  attacker: { sizeCategory: "LARGE" },
  defender: { sizeCategory: "MEDIUM" },
  centerDistanceFeet: 10,
  reachFeet: 5.5,
});
check(reach.canReach === true,
  "A Large creature must be able to make an ordinary melee attack at the tested 10-foot center distance.");

reach = isWithinFootprintAdjustedMeleeReach({
  attacker: { sizeCategory: "MEDIUM" },
  defender: { sizeCategory: "MEDIUM" },
  centerDistanceFeet: 10,
  reachFeet: 5.5,
});
check(reach.canReach === false,
  "Two Medium creatures 10 feet center-to-center must remain outside ordinary melee reach.");

reach = isWithinFootprintAdjustedMeleeReach({
  attacker: { sizeCategory: "LARGE" },
  defender: { sizeCategory: "LARGE" },
  centerDistanceFeet: 15,
  reachFeet: 5.5,
});
check(reach.canReach === true,
  "Two Large occupied footprints 15 feet center-to-center must be able to reach across the remaining 5 feet.");

reach = isWithinFootprintAdjustedMeleeReach({
  attacker: { footprint: { radiusHex: 2 } },
  defender: { sizeCategory: "MEDIUM" },
  centerDistanceFeet: 15,
  reachFeet: 5.5,
});
check(reach.canReach === true,
  "Explicit two-ring footprint metadata must participate in melee reach.");

check(combatPage.includes('from "../utils/combat/combatFootprintDistance.js"'),
  "CombatPage must import the canonical footprint-distance helper.");
check((combatPage.match(/resolveMeleeFootprintDistance\(\)/g) || []).length >= 2,
  "Both unknown and database-backed melee profiles must use footprint-adjusted distance.");
check(combatPage.includes("const rangeCheckDistance = looksRanged") &&
      combatPage.includes(": footprintDistance.adjustedDistanceFeet;"),
  "Database-backed melee validation must receive adjusted distance.");
check(combatPage.includes("const canAttack = meleeDistance <= effectiveRange"),
  "Natural and unknown melee attacks must compare adjusted distance against reach.");
check(combatPage.includes("center →") && combatPage.includes("after footprint"),
  "Range diagnostics must expose center and footprint-adjusted distances.");

const explicitRangedIndex = combatPage.indexOf("if (isExplicitRanged) {");
const meleeResolverIndex = combatPage.indexOf("const resolveMeleeFootprintDistance = () =>");
check(explicitRangedIndex >= 0 && meleeResolverIndex > explicitRangedIndex,
  "Projectile range must resolve before melee footprint adjustment is introduced.");
check(combatPage.includes("const canAttack = distance <= maxRange;"),
  "Explicit ranged attacks must continue using raw projectile distance.");
check((combatPage.match(/canAttackFrom: \(position, candidate, candidatePosition\) => \{/g) || []).length >= 2 &&
      combatPage.includes("return validateWeaponRange("),
  "Enemy attack-hex planning must flow through the same footprint-aware range validator.");

check(engagementSource.includes("const isGround = hasGroundState && linkedGrapple;"),
  "Ground-combat restrictions must require a linked actor/target grapple.");
check(!engagementSource.includes("hasGroundState && (linkedGrapple || isAdjacent)"),
  "Adjacency alone may not convert a prone opponent into a ground grapple.");

const engagementModule = await import(`${pathToFileURL(engagementPath).href}?v=${Date.now()}`);
const { getMeleeEngagementContext } = engagementModule;
const neutralKnight = {
  id: "knight",
  grappleState: { state: "neutral", opponent: null },
};
const proneMinotaur = {
  id: "minotaur",
  prone: true,
  grappleState: { state: "neutral", opponent: null },
};
let context = getMeleeEngagementContext({
  actor: neutralKnight,
  target: proneMinotaur,
  distanceFeet: 5,
});
check(context.isGround === false && context.isGrappling === false,
  "A neutral Knight beside a prone Minotaur must remain ordinary close melee.");
check(context.rangeBand === "close-melee",
  "Prone adjacency without a grapple must retain the close-melee range band.");

const grapplingKnight = {
  ...neutralKnight,
  prone: true,
  grappleState: { state: "ground", opponent: "minotaur" },
};
const grappledMinotaur = {
  ...proneMinotaur,
  grappleState: { state: "ground", opponent: "knight" },
};
context = getMeleeEngagementContext({
  actor: grapplingKnight,
  target: grappledMinotaur,
  distanceFeet: 5,
});
check(context.isGround === true && context.isGrappling === true,
  "A genuinely linked prone pair must retain ground-grapple restrictions.");
check(context.rangeBand === "ground",
  "A linked ground grapple must retain the ground range band.");

const thirdPartyTarget = {
  ...proneMinotaur,
  grappleState: { state: "ground", opponent: "other-knight" },
};
context = getMeleeEngagementContext({
  actor: neutralKnight,
  target: thirdPartyTarget,
  distanceFeet: 5,
});
check(context.isGround === false && context.isGrappling === false,
  "A target grappling a third fighter may not restrict the acting Knight's weapon.");

console.log(`Footprint reach and grapple-pairing tests passed: ${assertions} assertions.`);
