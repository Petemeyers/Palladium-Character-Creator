import assert from "node:assert/strict";
import {
  createPersistentWeaponBind,
  getActorWeaponBindState,
  WEAPON_BIND_STATES,
} from "../src/utils/combat/weaponBindAuthority.js";
import {
  WEAPON_BIND_ACTIONS,
  applyWeaponBindCounterplay,
  getWeaponBindCounterplayOptions,
  resolveWeaponBindCounterplay,
} from "../src/utils/combat/weaponBindCounterplayAuthority.js";

const registry = new Map();
const bind = createPersistentWeaponBind({
  sourceActorId: "controller",
  targetActorId: "controlled",
  sourceWeaponId: "spear",
  targetWeaponId: "sword",
  currentRound: 3,
  durationRounds: 3,
});
registry.set(bind.bindId, bind);
const controlledState = getActorWeaponBindState(registry, "controlled", 3);
const options = getWeaponBindCounterplayOptions({ bindState: controlledState, canWithdraw: true, canGrapple: true });
assert.ok(options.some((option) => option.id === WEAPON_BIND_ACTIONS.BREAK_BIND));
assert.ok(options.some((option) => option.id === WEAPON_BIND_ACTIONS.REVERSE_BIND));

const breakResult = resolveWeaponBindCounterplay({
  actionId: WEAPON_BIND_ACTIONS.BREAK_BIND,
  bindState: controlledState,
  actor: { id: "controlled", attributes: { might: 16 }, proficiencyBonus: 3, stamina: 12 },
  opponent: { id: "controller", attributes: { might: 10 }, proficiencyBonus: 1, stamina: 12 },
  actorRoll: 18,
  opponentRoll: 4,
  currentRound: 3,
});
assert.equal(breakResult.breakBind, true);
applyWeaponBindCounterplay({ registry, resolution: breakResult, bindState: controlledState, currentRound: 3 });
assert.notEqual(registry.get(bind.bindId).state, WEAPON_BIND_STATES.ACTIVE);

const reverseRegistry = new Map();
const reverseBind = createPersistentWeaponBind({ sourceActorId: "a", targetActorId: "b", currentRound: 1, durationRounds: 3 });
reverseRegistry.set(reverseBind.bindId, reverseBind);
const reverseState = getActorWeaponBindState(reverseRegistry, "b", 1);
const reverseResult = resolveWeaponBindCounterplay({
  actionId: WEAPON_BIND_ACTIONS.REVERSE_BIND,
  bindState: reverseState,
  actor: { id: "b", attributes: { deftness: 18 }, proficiencyBonus: 3, stamina: 15 },
  opponent: { id: "a", attributes: { might: 10 }, proficiencyBonus: 0, stamina: 15 },
  actorRoll: 20,
  opponentRoll: 2,
  currentRound: 1,
});
assert.equal(reverseResult.reverseBind, true);
const reversed = applyWeaponBindCounterplay({ registry: reverseRegistry, resolution: reverseResult, bindState: reverseState, currentRound: 1 });
assert.equal(reversed.sourceActorId, "b");
assert.equal(reversed.targetActorId, "a");

const strike = resolveWeaponBindCounterplay({
  actionId: WEAPON_BIND_ACTIONS.STRIKE_FROM_BIND,
  bindState: { bind: reversed, role: "controller" },
  actor: { id: "b" },
  opponent: { id: "a" },
});
assert.equal(strike.continueAttack, true);
assert.equal(strike.attackModifier, 1);
console.log("weapon bind counterplay authority test passed");
