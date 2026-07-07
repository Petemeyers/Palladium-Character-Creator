import assert from "node:assert/strict";
import { humanFighters } from "../src/data/humanFighters.js";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import {
  ensureKnightCloseWeaponLoadout,
  hasKnightCloseWeapon,
} from "../src/utils/knightLoadout.js";

const profiles = [
  humanFighters.find((actor) => actor.id === "knight"),
  getSelectableActorById("knight"),
  getSelectableActorById("veteran-knight"),
  ensureKnightCloseWeaponLoadout({ id: "staged-knight", name: "Knight", inventory: [] }),
  ensureKnightCloseWeaponLoadout({ id: "saved-knight", publicClassName: "Knight", autoRollCharacter: { name: "Imported Knight" } }),
];

profiles.forEach((profile) => {
  assert.ok(profile, "Knight profile should exist");
  assert.equal(hasKnightCloseWeapon(profile) || hasKnightCloseWeapon(profile.autoRollCharacter), true);
});

console.log("All Knight profile close-weapon tests passed");
