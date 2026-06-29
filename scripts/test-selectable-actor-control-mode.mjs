import assert from "node:assert/strict";

import SELECTABLE_ACTORS from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { buildCombatCommandTurnBridge } from "../src/utils/combatCommandTurnBridge.js";
import { getCombatantSide } from "../src/utils/combatantSide.js";
import {
  clearStagedRosterEntries,
  getStagedRosterEntries,
  upsertPublicArenaRosterEntry,
} from "../src/utils/publicStagedRosterStorage.js";

const data = new Map();
global.window = {
  localStorage: {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  },
};

const getActor = (id) => SELECTABLE_ACTORS.find((actor) => actor.id === id);
const configure = (id, team, controlMode) =>
  adaptSelectableActorToCombatant(getActor(id), { team, controlMode }).combatant;

const enemyManualLongbowman = configure("longbowman", "enemy", "manual");
assert.equal(enemyManualLongbowman.team, "enemy");
assert.equal(enemyManualLongbowman.side, "enemy");
assert.equal(enemyManualLongbowman.battleSide, "enemy");
assert.equal(enemyManualLongbowman.type, "enemy");
assert.equal(enemyManualLongbowman.controlMode, "manual");
assert.equal(enemyManualLongbowman.playable, true);
assert.equal(getCombatantSide(enemyManualLongbowman), "enemy");

const partyManualLongbowman = configure("longbowman", "party", "manual");
assert.equal(partyManualLongbowman.team, "party");
assert.equal(partyManualLongbowman.side, "party");
assert.equal(partyManualLongbowman.type, "player");
assert.equal(partyManualLongbowman.controlMode, "manual");

const partyAiLongbowman = configure("longbowman", "party", "ai");
const partyAiBridge = buildCombatCommandTurnBridge({ combatActive: true, liveActor: partyAiLongbowman });
assert.equal(partyAiBridge.isPlayerControlled, false, "party AI actor should not wait for manual control");
assert.equal(partyAiBridge.isEnemyControlled, true);

const manualMinotaur = configure("minotaur", "enemy", "manual");
assert.equal(manualMinotaur.name, "Minotaur");
assert.equal(manualMinotaur.modelKey, "minotaur");
assert.equal(manualMinotaur.team, "enemy");
assert.equal(manualMinotaur.controlMode, "manual");

const aiHawk = configure("hawk", "enemy", "ai");
assert.equal(aiHawk.controlMode, "ai");
assert.ok(aiHawk.movementModes.includes("flying"));
assert.equal(aiHawk.movement.flying, 60);

upsertPublicArenaRosterEntry(enemyManualLongbowman);
upsertPublicArenaRosterEntry(partyManualLongbowman);
const staged = getStagedRosterEntries();
assert.equal(staged.length, 2, "the same actor may be staged independently on opposing sides");
const stagedEnemy = staged.find((entry) => entry.team === "enemy");
const stagedParty = staged.find((entry) => entry.team === "party");
assert.equal(stagedEnemy.side, "enemy");
assert.equal(stagedEnemy.controlMode, "manual");
assert.equal(stagedEnemy.playable, true);
assert.equal(stagedEnemy.modelKey, "longbowman");
assert.ok(stagedEnemy.inventory.some((item) => item.name === "Arrows"));
assert.equal(stagedParty.side, "party");
assert.equal(stagedParty.controlMode, "manual");
assert.equal(stagedParty.source, "normalized-legacy-actor");
assert.deepEqual(clearStagedRosterEntries(), []);

console.log("selectable actor control mode tests passed");
