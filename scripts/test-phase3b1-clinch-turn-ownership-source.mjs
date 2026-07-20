import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPage = readFileSync("src/pages/CombatPage.jsx", "utf8");
const grappleHandler = readFileSync("src/utils/combatActionHandlers/grappleActions.js", "utf8");
const grapplingSystem = readFileSync("src/utils/grapplingSystem.js", "utf8");
const relationshipHelper = readFileSync("src/utils/combat/grappleRelationship.js", "utf8");
const playerTurnAI = readFileSync("src/utils/ai/playerTurnAI.js", "utf8");

assert.match(combatPage, /const initiativeTurnIdRef = useRef\(null\)/);
assert.match(combatPage, /eventType:\s*"initiative-turn-created"/);
assert.match(combatPage, /eventType:\s*"initiative-action-token-created"/);
assert.match(combatPage, /eventType:\s*"grapple-action-selected"/);
assert.match(combatPage, /eventType:\s*"grapple-action-dispatched"/);
assert.match(combatPage, /eventType:\s*canonicalGrappleCompletion\?\.accepted === false \? "grapple-action-rejected" : "grapple-action-completed"/);
assert.match(combatPage, /eventType:\s*"grapple-round-advanced"/);
assert.match(combatPage, /eventType:\s*"grapple-state-ended"/);
assert.match(combatPage, /eventType:\s*"fumble-turn-handoff-started"/);
assert.match(combatPage, /eventType:\s*"fumble-turn-handoff-completed"/);
assert.match(combatPage, /remainingActionContinuationRegistryRef\.current\.delete\(key\)/);

assert.match(grappleHandler, /validateClinchWeaponProfile\(weapon\)/);
assert.match(grappleHandler, /eventType:\s*validation\.ok \? "clinch-weapon-profile-validated" : "clinch-weapon-profile-rejected"/);
assert.match(grappleHandler, /stripStandingAttackFieldsForClinch\(attacker,\s*weapon\)/);
assert.match(grappleHandler, /eventType:\s*"clinch-armor-contact-resolved"/);
assert.match(grappleHandler, /return\s*{[\s\S]*accepted:\s*true[\s\S]*completed:\s*true[\s\S]*armorContactResolved:/);

assert.doesNotMatch(
  grapplingSystem,
  /roundsInGrapple\s*\+=\s*1/,
  "roundsInGrapple should not advance per maintain action",
);
assert.match(relationshipHelper, /export function endGrappleRelationship/);
assert.match(relationshipHelper, /canUseLongWeapons:\s*true/);
assert.match(relationshipHelper, /roundsInGrapple:\s*0/);
assert.match(relationshipHelper, /grappleId:\s*null/);

assert.match(playerTurnAI, /source:\s*"player-ai-flanking-continuation"/);
assert.match(playerTurnAI, /flanking continuation calling attack after armored action resolution/);
assert.match(
  playerTurnAI,
  /dispatchGrappleTurnAction\(\s*livePlayer,\s*liveTarget,\s*null,\s*flankingArmoredAction\.armoredActionPlan,\s*movementContinuationAdmission,\s*\)/,
);

console.log("✅ Phase 3B1 clinch turn ownership source tests passed");
