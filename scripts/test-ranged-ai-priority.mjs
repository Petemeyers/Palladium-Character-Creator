import assert from "node:assert/strict";

import SELECTABLE_ACTORS from "../src/data/selectableActors.js";
import {
  adaptSelectableActorToCombatant,
  getSelectableActorAttackForDistance,
} from "../src/utils/selectableActorAdapter.js";

const source = SELECTABLE_ACTORS.find((actor) => actor.id === "longbowman");
const longbowman = adaptSelectableActorToCombatant(source).combatant;
const knife = longbowman.attacks.find((attack) => attack.isMelee);
const canUseWithArrows = (attack) => !attack.ammunition || attack.ammunition === "arrows";

for (const distance of [50, 60, 80, 120]) {
  const attack = getSelectableActorAttackForDistance(
    longbowman,
    distance,
    knife,
    { canUseAttack: canUseWithArrows },
  );
  assert.equal(attack.name, "Longbow Shot", `Longbowman should shoot at ${distance}ft`);
}

assert.equal(
  getSelectableActorAttackForDistance(longbowman, 160, knife, { canUseAttack: canUseWithArrows }),
  knife,
  "Longbowman outside normal range may retain a movement-closing fallback",
);

const longbow = longbowman.attacks.find((attack) => attack.isRanged);
assert.equal(
  getSelectableActorAttackForDistance(longbowman, 60, longbow, {
    canUseAttack: (attack) => !attack.ammunition,
  }).name,
  "Knife Attack",
  "Longbowman without arrows should fall back instead of retrying an impossible shot",
);

assert.equal(
  getSelectableActorAttackForDistance(longbowman, 5, longbow, { canUseAttack: canUseWithArrows }).name,
  "Knife Attack",
  "Longbowman should retain the melee fallback at close range",
);

const goblin = adaptSelectableActorToCombatant(
  SELECTABLE_ACTORS.find((actor) => actor.id === "goblin-warrior"),
).combatant;
assert.equal(
  getSelectableActorAttackForDistance(goblin, 20, goblin.attacks[0], { canUseAttack: canUseWithArrows }),
  goblin.attacks[0],
  "melee actors should keep their existing attack selection",
);

const compatibilityArcher = {
  aiRole: "melee",
  attacks: [
    { name: "Bow Shot", type: "ranged", range: 100 },
    { name: "Club", type: "melee", reach: 5 },
  ],
};
assert.equal(
  getSelectableActorAttackForDistance(
    compatibilityArcher,
    60,
    compatibilityArcher.attacks[0],
    { canUseAttack: () => true },
  ).name,
  "Bow Shot",
  "an explicitly selected ranged weapon should retain priority within range",
);

console.log("ranged AI priority tests passed");
