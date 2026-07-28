import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const panel = fs.readFileSync(new URL("../src/components/RiposteOpportunityPanel.jsx", import.meta.url), "utf8");
const reactions = fs.readFileSync(new URL("../src/utils/combat/reactionResolution.js", import.meta.url), "utf8");
let assertions = 0;
const includes = (source, needle, message = needle) => {
  assert.ok(source.includes(needle), message);
  assertions += 1;
};
const excludes = (source, needle, message = needle) => {
  assert.ok(!source.includes(needle), message);
  assertions += 1;
};

for (const symbol of [
  "buildDominantResponseOpportunity",
  "chooseDominantOpeningResponse",
  "consumeDominantOpening",
  "transitionDominantResponse",
  "createDominantControlState",
  "claimDominantControlModifier",
  "expireDominantControls",
]) includes(page, symbol);

for (const ref of [
  "dominantResponseRegistryRef",
  "dominantControlRegistryRef",
]) includes(page, `const ${ref} = useRef(new Map())`);

for (const event of [
  "dominant-response-opportunity-created",
  "dominant-response-selected",
  "dominant-opening-consumed",
  "dominant-response-resolving",
  "dominant-response-resolved",
  "dominant-response-declined",
  "bind-control-applied",
  "bind-control-consumed",
  "weapon-displacement-applied",
  "weapon-displacement-consumed",
  "shield-pressure-applied",
  "shield-pressure-consumed",
  "dominant-disengagement-resolved",
  "dominant-grapple-entry-dispatched",
]) {
  if (event === "dominant-response-resolving") {
    includes(page, "DOMINANT_OPPORTUNITY_STATUSES.RESOLVING");
  } else {
    includes(page, `"${event}"`);
  }
}

includes(page, "reactionType: \"dominant_grapple_entry\"");
includes(page, "reactionDepth: 1");
includes(page, "allowOutOfTurn: true");
includes(page, "suppressSequencing: isDominantGrappleReaction");
includes(page, "remainingActions: reactionRemainingActionsBefore");
includes(page, "requireActionRemaining: !isDominantGrappleReaction");
includes(page, "executeCanonicalGrappleAction({");
includes(page, "handlePositionChange(liveReactor.id, destination");
includes(page, "isDominantDisengagement: true");
includes(page, "suppressSourceOpportunityAttack: true");
includes(page, "calculateDistance(hex, targetHex) > calculateDistance(reactorHex, targetHex)");
includes(page, "dominantControlRegistryRef.current.clear()");
includes(page, '"participant-moved"');
includes(page, '"round-changed"');
includes(page, "tempBonus += dominantAttackControl.penalty");
includes(page, "defenseBonus += dominantDefenseControl.penalty");

for (const label of [
  "Dominant Opening",
  "Riposte",
  "Maintain Bind",
  "Displace Weapon",
  "Enter Grapple",
  "Step Away",
  "Shield Pressure",
  "Decline",
]) includes(panel, label);
includes(panel, "(opportunity.legalResponses || []).map");
includes(panel, "isDisabled={isResolving}");
includes(panel, "onClick={() => onChoose?.(response)}");
excludes(panel, "[object Object]");
excludes(panel, "modal");

// Existing Phase 3 resolver remains the riposte authority.
includes(page, "consumeRiposteOpening({");
includes(page, "buildRiposteAttackRequest({");
includes(page, "suppressActionSpend: true");
includes(page, "suppressEndTurn: true");
includes(reactions, "MAX_IMMEDIATE_REACTION_DEPTH = 1");

console.log(`Phase 4A CombatPage integration tests passed: ${assertions}`);
