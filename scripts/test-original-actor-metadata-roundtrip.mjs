import assert from "node:assert/strict";

import Character from "../backend/models/Character.js";
import { buildCombatStateDto } from "../backend/services/combatStateDto.js";
import SELECTABLE_ACTORS from "../src/data/selectableActors.js";
import { normalizeCombatant } from "../src/utils/normalizeCombatant.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { awardOriginalTrait, hasOriginalTrait } from "../src/utils/originalActorTraits.js";
import {
  loadPublicArenaRosterEntries,
  repairStagedSavedCharacterEntry,
  savePublicArenaRosterEntries,
} from "../src/utils/publicStagedRosterStorage.js";
import {
  adaptPublicCharacterToRosterEntry,
  resolveStagedSavedCharacterForImport,
} from "../src/utils/publicRosterAdapter.js";

const data = new Map();
global.window = {
  localStorage: {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  },
};

assert.ok(Character.schema.path("originalActorMetadata"), "saved-character schema permits original metadata persistence");

const blooded = {
  id: "blooded",
  name: "Blooded",
  layer: "tempered",
  rank: 1,
  source: "combat",
  description: "Survived real combat.",
  effects: { resolveVsFear: 1 },
  drawbacks: {},
};

const partialMetadata = {
  attributes: { might: 19, customBearing: 3 },
  training: { weapons: { spear: 7 }, customDoctrine: "ford-watch" },
  traits: [blooded],
  state: { morale: 73, customState: "watchful" },
  reputation: { local: 4, titles: ["Ford Watcher"], customRepute: "trusted" },
  favor: { folk: 2, customFavor: "river-shrine" },
  behavior: { caution: 8, customInstinct: "guard the line" },
  movement: { modes: ["ground"], pace: 28, customMovement: "measured" },
  customRootField: "preserved",
};

const combatState = buildCombatStateDto({
  party: { _id: "party-roundtrip", members: [] },
  map: { _id: "map-roundtrip", width: 20, height: 20, entities: [], hexes: [] },
  characters: [{ _id: "dto-roundtrip", name: "DTO Roundtrip", hp: 10, originalActorMetadata: partialMetadata }],
});
assert.deepEqual(
  combatState.fighters[0].originalActorMetadata,
  partialMetadata,
  "backend combat-state projection preserves original metadata",
);

const legacyActor = {
  id: "roundtrip-guard",
  name: "Roundtrip Guard",
  team: "party",
  controlMode: "manual",
  playable: true,
  modelKey: "guard",
  aiRole: "defensive",
  PS: 30,
  PP: 12,
  PE: 14,
  HP: 18,
  guardRating: 15,
  speed: 30,
  movementModes: ["ground"],
  attacks: [{ name: "Spear Thrust", damage: "1d6+2" }],
  originalActorMetadata: partialMetadata,
};
const legacySnapshot = JSON.stringify(legacyActor);
const normalized = normalizeCombatant(legacyActor);

assert.equal(normalized.originalActorMetadata.attributes.might, 19, "existing original Might wins over compatibility PS");
assert.equal(normalized.originalActorMetadata.attributes.deftness, 12, "missing original attributes are filled from compatibility data");
assert.equal(normalized.originalActorMetadata.attributes.customBearing, 3);
assert.equal(normalized.originalActorMetadata.training.formationDrill, 0);
assert.equal(normalized.originalActorMetadata.training.customDoctrine, "ford-watch");
assert.equal(normalized.originalActorMetadata.state.morale, 73);
assert.equal(normalized.originalActorMetadata.state.fatigue, 0);
assert.equal(normalized.originalActorMetadata.state.customState, "watchful");
assert.equal(normalized.originalActorMetadata.reputation.customRepute, "trusted");
assert.equal(normalized.originalActorMetadata.favor.customFavor, "river-shrine");
assert.equal(normalized.originalActorMetadata.behavior.customInstinct, "guard the line");
assert.equal(normalized.originalActorMetadata.movement.customMovement, "measured");
assert.equal(normalized.originalActorMetadata.customRootField, "preserved");
assert.equal(hasOriginalTrait(normalized, "blooded"), true, "Blooded survives normalizeCombatant");
assert.equal(normalized.str, 30, "legacy combat ability calculation remains unchanged");
assert.equal(normalized.hp, 18);
assert.equal(normalized.ac, 15);
assert.equal(normalized.speed, 30);
assert.equal(JSON.stringify(legacyActor), legacySnapshot, "normalization does not mutate the source actor");

const getActor = (id) => SELECTABLE_ACTORS.find((actor) => actor.id === id);
const catalogLongbowman = {
  ...getActor("longbowman"),
  originalActorMetadata: partialMetadata,
};
const longbowman = adaptSelectableActorToCombatant(catalogLongbowman).combatant;
assert.equal(hasOriginalTrait(longbowman, "blooded"), true, "selectable adapter preserves metadata traits");
assert.equal(longbowman.originalActorMetadata.attributes.might, 19);
assert.equal(longbowman.attacks[0].name, "Longbow Shot");
assert.equal(longbowman.attacks[0].rangeProfile.normal, 150);
assert.equal(longbowman.aiRole, "archer");
assert.equal(longbowman.modelKey, "longbowman");

savePublicArenaRosterEntries([longbowman]);
const stagedLongbowman = loadPublicArenaRosterEntries()[0];
assert.deepEqual(stagedLongbowman.originalActorMetadata, longbowman.originalActorMetadata, "staged storage preserves full metadata");
assert.equal(hasOriginalTrait(stagedLongbowman, "blooded"), true);

const savedCharacter = {
  _id: "saved-roundtrip",
  name: "Saved Roundtrip",
  publicClassName: "Fighter",
  publicSpeciesName: "Human",
  publicBackgroundName: "Guard",
  finalAbilityScores: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 9 },
  publicDerivedStats: { hitPoints: 13, baseArmorClass: 14 },
  speed: 30,
  originalActorMetadata: partialMetadata,
};
const rosterEntry = adaptPublicCharacterToRosterEntry(savedCharacter);
assert.equal(hasOriginalTrait(rosterEntry, "blooded"), true, "saved-character staging preserves traits");
assert.equal(hasOriginalTrait(rosterEntry.autoRollCharacter, "blooded"), true, "saved combat snapshot preserves traits");

const repaired = repairStagedSavedCharacterEntry(
  { ...rosterEntry, sourceCharacterId: "stale-id" },
  savedCharacter,
);
assert.equal(hasOriginalTrait(repaired, "blooded"), true, "saved-character repair preserves traits");
assert.equal(repaired.originalActorMetadata.customRootField, "preserved");

const imported = resolveStagedSavedCharacterForImport(repaired, [savedCharacter]);
assert.equal(imported.ok, true);
assert.equal(hasOriginalTrait(imported.entry, "blooded"), true, "saved-character import preserves traits");
assert.equal(hasOriginalTrait(imported.entry.autoRollCharacter, "blooded"), true, "import combat payload preserves traits");

const hawk = awardOriginalTrait(adaptSelectableActorToCombatant(getActor("hawk")).combatant, "blooded");
const normalizedHawk = normalizeCombatant(hawk);
assert.ok(normalizedHawk.movementModes.includes("flying"));
assert.equal(normalizedHawk.movement.flying, 60);
assert.equal(normalizedHawk.abilities.movement.flight.active, true);
assert.equal(hasOriginalTrait(normalizedHawk, "blooded"), true);

const minotaur = awardOriginalTrait(adaptSelectableActorToCombatant(getActor("minotaur")).combatant, "blooded");
const normalizedMinotaur = normalizeCombatant(minotaur);
assert.equal(normalizedMinotaur.name, "Minotaur");
assert.equal(normalizedMinotaur.category, "mythic");
assert.equal(normalizedMinotaur.modelKey, "minotaur");
assert.equal(normalizedMinotaur.aiRole, "brute");
assert.equal(normalizedMinotaur.attacks.find((attack) => attack.name === "Heavy Axe").reach, 10);

console.log("original actor metadata round-trip tests passed");
