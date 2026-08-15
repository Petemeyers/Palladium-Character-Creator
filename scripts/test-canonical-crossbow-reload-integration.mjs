import assert from "node:assert/strict";
import fs from "node:fs";

import { CANONICAL_RANGED_AND_REACH_WEAPON_FIXTURES as W } from "../src/data/canonicalCombatActors.js";
import {
  claimCanonicalAmmunitionSpend,
  commitCanonicalAmmunitionSpend,
  completeCanonicalRangedReload,
  normalizeCanonicalAmmunitionState,
  validateCanonicalRangedAttack,
} from "../src/utils/combat/canonicalRangedCombat.js";

const actor = {
  id: "crossbowman",
  name: "Crossbowman",
  team: "party",
  remainingActions: 2,
  inventory: [{ name: "bolts", ammunitionType: "bolt", quantity: 2 }],
};
const target = { id: "target", team: "enemy", currentHP: 20 };
const unloaded = {
  weaponId: W.crossbow.weaponId,
  ammunitionType: "bolt",
  current: 2,
  maximum: 2,
  chambered: false,
  reloadState: "reload-required",
  lastSpentActionToken: null,
  spentActionTokens: [],
  lastReloadActionToken: null,
  reloadActionTokens: [],
};
const reload = (overrides = {}) => completeCanonicalRangedReload({
  actor,
  ammunitionState: unloaded,
  weaponProfile: W.crossbow,
  actionToken: "reload:1",
  activeActionToken: "reload:1",
  activeActorId: actor.id,
  ...overrides,
});

const preReloadShot = validateCanonicalRangedAttack({
  actor,
  target,
  weaponProfile: W.crossbow,
  ammunitionState: unloaded,
  actionToken: "shot:before",
  activeActionToken: "shot:before",
  activeActorId: actor.id,
  distanceFeet: 30,
});
assert.equal(preReloadShot.reason, "reload-required", "unloaded crossbow cannot fire");

const completed = reload();
assert.equal(completed.accepted, true, "canonical reload succeeds");
assert.equal(completed.actionCost, 1, "reload costs one normal action");
assert.equal(completed.staminaCost, 0, "reload has no stamina cost");
assert.equal(completed.ammunitionConsumed, 0, "reload does not consume a bolt");
assert.equal(completed.ammunitionState.current, 2);
assert.equal(completed.ammunitionState.chambered, true);
assert.equal(completed.ammunitionState.reloadState, "loaded");
assert.deepEqual(completed.ammunitionState.reloadActionTokens, ["reload:1"]);

assert.equal(reload({ ammunitionState: completed.ammunitionState }).reason, "duplicate-reload");
assert.equal(
  reload({
    ammunitionState: { ...completed.ammunitionState, lastReloadActionToken: null, reloadActionTokens: [] },
    actionToken: "reload:2",
    activeActionToken: "reload:2",
  }).reason,
  "already-loaded",
);
assert.equal(reload({ ammunitionState: { ...unloaded, current: 0 } }).reason, "ammunition-empty");
assert.equal(reload({ actionToken: "stale", activeActionToken: "live" }).reason, "stale-action-token");
assert.equal(reload({ actor: { ...actor, unconscious: true } }).reason, "actor-cannot-reload");
assert.equal(reload({ actor: { ...actor, grappled: true } }).reason, "weapon-unavailable-in-grapple");
assert.equal(reload({ actor: { ...actor, remainingActions: 0 } }).reason, "no-actions-remaining");
assert.equal(reload({ activeActorId: "someone-else" }).reason, "stale-action-owner");
assert.equal(reload({ weaponProfile: W.archerBow }).reason, "weapon-does-not-require-reload");

const admittedShot = validateCanonicalRangedAttack({
  actor,
  target,
  weaponProfile: W.crossbow,
  ammunitionState: completed.ammunitionState,
  actionToken: "shot:1",
  activeActionToken: "shot:1",
  activeActorId: actor.id,
  distanceFeet: 30,
});
assert.equal(admittedShot.accepted, true);

const aliasedProfile = {
  name: "Crossbow",
  type: "ranged",
  weaponFamily: "crossbow",
  ammunition: "bolts",
  range: 120,
};
const aliasedState = normalizeCanonicalAmmunitionState(
  { ...actor, ammunitionState: completed.ammunitionState },
  aliasedProfile,
);
assert.equal(aliasedState.chambered, true, "chamber survives weaponId aliasing");
assert.equal(aliasedState.reloadState, "loaded");
assert.equal(aliasedState.weaponId, completed.ammunitionState.weaponId, "canonical weaponId is preserved");
assert.equal(
  validateCanonicalRangedAttack({
    actor,
    target,
    weaponProfile: aliasedProfile,
    ammunitionState: aliasedState,
    actionToken: "shot:alias",
    activeActionToken: "shot:alias",
    activeActorId: actor.id,
    distanceFeet: 30,
  }).accepted,
  true,
  "aliased crossbow profile can fire a loaded chamber",
);
const claim = claimCanonicalAmmunitionSpend({
  ammunitionState: completed.ammunitionState,
  weaponProfile: W.crossbow,
  actionToken: "shot:1",
  activeActionToken: "shot:1",
});
assert.equal(claim.accepted, true);
const shot = commitCanonicalAmmunitionSpend({
  ammunitionState: completed.ammunitionState,
  weaponProfile: W.crossbow,
  claim: claim.claim,
});
assert.equal(shot.accepted, true);
assert.equal(shot.ammunitionState.current, 1, "exactly one bolt is spent at release");
assert.equal(shot.ammunitionState.chambered, false, "shot empties chamber");
assert.equal(shot.ammunitionState.reloadState, "reload-required");

const combatPageSource = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const actionCatalogSource = fs.readFileSync(new URL("../src/utils/combatActionCatalog.js", import.meta.url), "utf8");
const selectedActionPanelSource = fs.readFileSync(new URL("../src/components/SelectedCombatActionPanel.jsx", import.meta.url), "utf8");
const playerAiSource = fs.readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
const enemyAiSource = fs.readFileSync(new URL("../src/utils/ai/enemyTurnAI.js", import.meta.url), "utf8");
assert.match(actionCatalogSource, /const buildRangedReloadActions/);
assert.match(actionCatalogSource, /chambered === true[\s\S]*return \[\]/, "loaded crossbow offers no redundant reload");
assert.match(actionCatalogSource, /costActions:\s*1[\s\S]*costStamina:\s*0/);
assert.match(actionCatalogSource, /No compatible bolts remain/);
assert.match(combatPageSource, /completeCanonicalRangedReload\(\{/);
assert.match(combatPageSource, /source:\s*"manual-combat-crossbow-reload"/);
assert.match(combatPageSource, /source:\s*"manual-canonical-crossbow-reload"/);
assert.match(combatPageSource, /reconcileProjectileAmmunitionForCombat/);
assert.match(combatPageSource, /reloadCrossbow:\s*executePlayerAICrossbowReload/);
assert.match(combatPageSource, /reloadCrossbow:\s*executeEnemyAICrossbowReload/);
assert.match(selectedActionPanelSource, /type === "reload"/);
assert.match(playerAiSource, /createPlayerAiActionResult\("reload"/);
assert.match(enemyAiSource, /enemy-ai-crossbow-reload-selection/);

console.log("canonical crossbow reload integration tests passed");
