import assert from "node:assert/strict";

import {
  MORALE_STATES,
  ROUT_BEHAVIORS,
  ROUT_REASONS,
} from "../src/utils/morale/moraleConstants.js";
import {
  ORIGINAL_ATTRIBUTE_KEYS,
  getActorAttributes,
  getAttributeMod,
  getHiddenMoraleMod,
} from "../src/utils/morale/moraleAttributes.js";
import {
  attemptRoutRecovery,
  chooseRoutBehavior,
  getMoraleDefense,
  getRecoveryBonus,
  markActorFled,
  normalizeMoraleState,
  performMoraleCheck,
} from "../src/utils/morale/moraleChecks.js";
import {
  emitsMythicTerror,
  evaluateMoraleTriggers,
} from "../src/utils/morale/moraleTriggerChecks.js";

const fixedRoll = (roll) => () => (roll - 1) / 20;

assert.deepEqual(Object.values(MORALE_STATES), ["steady", "uneasy", "shaken", "routed", "broken", "fled"]);
assert.deepEqual(Object.values(ROUT_REASONS), [
  "fear",
  "pain",
  "fatigue",
  "isolation",
  "leaderDeath",
  "formationCollapse",
  "mythicTerror",
  "outnumbered",
  "confusion",
  "woundShock",
]);
assert.equal(ORIGINAL_ATTRIBUTE_KEYS.length, 13);
assert.equal(ORIGINAL_ATTRIBUTE_KEYS.includes("agility"), false);
assert.equal(getAttributeMod(14), 2);
assert.equal(getHiddenMoraleMod(4), 2);

const steadySoldier = {
  id: "steady-soldier",
  name: "Steady Soldier",
  attributes: {
    might: 10,
    deftness: 10,
    vigor: 12,
    endurance: 12,
    mobility: 10,
    intellect: 10,
    awareness: 11,
    cunning: 10,
    resolve: 14,
    discipline: 14,
    presence: 9,
    renown: 0,
    favor: 0,
  },
  moraleProfile: {
    courageTendency: 3,
    survivalInstinct: 2,
    aggressionUnderFear: 2,
    loyaltyBond: 3,
    commandTrust: 3,
    routSusceptibility: 1,
  },
  traits: [],
  state: { moraleState: MORALE_STATES.STEADY },
};

const lowResolveRecruit = {
  ...steadySoldier,
  id: "low-resolve-recruit",
  attributes: { ...steadySoldier.attributes, resolve: 8, discipline: 8 },
};
const soldierDefense = getMoraleDefense(steadySoldier, { routReason: ROUT_REASONS.FEAR });
const recruitDefense = getMoraleDefense(lowResolveRecruit, { routReason: ROUT_REASONS.FEAR });
assert.ok(soldierDefense > recruitDefense, "Resolve and Discipline improve morale defense");
assert.ok(soldierDefense > 0);

const recoveryActor = {
  ...steadySoldier,
  state: {
    moraleState: MORALE_STATES.ROUTED,
    routReason: ROUT_REASONS.FEAR,
    routTurns: 2,
    minimumRoutTurns: 2,
  },
};
const baseRecovery = getRecoveryBonus(recoveryActor);
const commanderRecovery = getRecoveryBonus(recoveryActor, {
  commanderNearby: true,
  commander: { attributes: { presence: 16 } },
});
assert.ok(commanderRecovery > baseRecovery, "commander Presence improves recovery");

const routSurvivorRecovery = getRecoveryBonus({ ...recoveryActor, traits: ["Rout Survivor"] });
const oathFastRecovery = getRecoveryBonus({ ...recoveryActor, traits: ["Oath-Fast"] });
assert.ok(routSurvivorRecovery > baseRecovery, "Rout Survivor helps recovery");
assert.ok(oathFastRecovery > baseRecovery, "Oath-Fast helps recovery");
assert.ok(getRecoveryBonus(recoveryActor, { enemyAdjacent: true }) < baseRecovery, "adjacent enemy reduces recovery");
assert.ok(getRecoveryBonus(recoveryActor, { surrounded: true }) < baseRecovery, "being surrounded reduces recovery");
assert.ok(getRecoveryBonus(recoveryActor, { badlyWounded: true }) < baseRecovery, "bad wounds reduce recovery");

const beforeMinimum = attemptRoutRecovery({
  ...recoveryActor,
  state: { ...recoveryActor.state, routTurns: 0 },
}, {}, fixedRoll(20));
assert.equal(beforeMinimum.result, "no_attempt", "recovery waits for minimum rout turns");
assert.equal(beforeMinimum.actor.state.routTurns, 1, "a routed turn advances the recovery clock");

const oathFastEarly = attemptRoutRecovery({
  ...recoveryActor,
  traits: ["Oath-Fast"],
  state: { ...recoveryActor.state, routTurns: 1 },
}, {}, fixedRoll(20));
assert.equal(oathFastEarly.result, "strong_recovery", "Oath-Fast permits an earlier recovery attempt");

for (const [label, context] of [
  ["bad wounds", { badlyWounded: true }],
  ["leader death", { leaderDead: true }],
  ["outnumbered", { outnumbered: true }],
  ["mythic terror", { mythicTerror: true, terrorPenalty: 3 }],
]) {
  assert.ok(
    getMoraleDefense(steadySoldier, { routReason: ROUT_REASONS.FEAR, ...context }) < soldierDefense,
    `${label} penalizes morale defense`,
  );
}

const minotaur = {
  id: "minotaur",
  name: "Minotaur",
  category: "mythic",
  modelKey: "minotaur",
  attributes: {
    might: 18,
    deftness: 11,
    vigor: 17,
    endurance: 14,
    mobility: 12,
    intellect: 6,
    awareness: 11,
    cunning: 9,
    resolve: 12,
    discipline: 6,
    presence: 18,
    renown: 3,
    favor: 0,
  },
  moraleProfile: {
    courageTendency: 3,
    survivalInstinct: 4,
    aggressionUnderFear: 5,
    loyaltyBond: 0,
    commandTrust: 0,
    routSusceptibility: 2,
    temperament: "beastlike",
  },
  traits: ["Terrifying Presence", "Cornered Fury", "Labyrinth-Born"],
  state: { moraleState: MORALE_STATES.STEADY },
};
const distanceFeet = (left, right) => Math.hypot(left.x - right.x, left.y - right.y) * 5;
const moraleTriggerContext = (fighters, positions, turnKey) => ({
  fighters,
  positions,
  calculateDistance: distanceFeet,
  routingEnabled: true,
  turnKey,
});
assert.ok(getAttributeMod(getActorAttributes(minotaur).presence) > 0, "Minotaur Presence can generate terror pressure");
assert.ok(
  getMoraleDefense(steadySoldier, {
    routReason: ROUT_REASONS.MYTHIC_TERROR,
    mythicTerror: true,
    terrorSource: minotaur,
  }) < getMoraleDefense(steadySoldier, { routReason: ROUT_REASONS.MYTHIC_TERROR }),
  "high-Presence mythic actor penalizes an opponent's morale check",
);

const badlyWoundedRecruit = {
  ...lowResolveRecruit,
  currentHP: 2,
  maxHP: 10,
  state: { moraleState: MORALE_STATES.STEADY },
};
const woundFailure = evaluateMoraleTriggers(
  badlyWoundedRecruit,
  moraleTriggerContext([badlyWoundedRecruit], { [badlyWoundedRecruit.id]: { x: 1, y: 1 } }, "wound-1"),
  fixedRoll(5),
);
assert.equal(woundFailure.trigger, "badlyWounded");
assert.equal(woundFailure.actor.state.moraleState, MORALE_STATES.ROUTED, "bad wound pressure can cause routing");

const woundedVeteran = {
  ...steadySoldier,
  currentHP: 2,
  maxHP: 10,
  attributes: {
    ...steadySoldier.attributes,
    vigor: 18,
    endurance: 18,
    resolve: 18,
    discipline: 18,
  },
};
const woundResistance = evaluateMoraleTriggers(
  woundedVeteran,
  moraleTriggerContext([woundedVeteran], { [woundedVeteran.id]: { x: 1, y: 1 } }, "wound-2"),
  fixedRoll(5),
);
assert.equal(woundResistance.result, "strong_success", "high Resolve and Discipline resist wound pressure");

const firstEnemy = { ...lowResolveRecruit, id: "enemy-one", type: "enemy", team: "enemy" };
const secondEnemy = { ...lowResolveRecruit, id: "enemy-two", type: "enemy", team: "enemy" };
const surroundedActor = { ...steadySoldier, type: "player", team: "party" };
const surroundedCheck = evaluateMoraleTriggers(
  surroundedActor,
  moraleTriggerContext(
    [surroundedActor, firstEnemy, secondEnemy],
    {
      [surroundedActor.id]: { x: 4, y: 4 },
      [firstEnemy.id]: { x: 3, y: 4 },
      [secondEnemy.id]: { x: 5, y: 4 },
    },
    "surrounded-1",
  ),
  fixedRoll(10),
);
assert.equal(surroundedCheck.trigger, "surrounded");
assert.equal(surroundedCheck.triggerContext.outnumbered, true);
assert.equal(surroundedCheck.triggerContext.surrounded, true);
assert.ok(surroundedCheck.defense < soldierDefense, "surrounded pressure reduces morale defense");

const disabledTrigger = evaluateMoraleTriggers(
  badlyWoundedRecruit,
  { ...moraleTriggerContext([badlyWoundedRecruit], {}, "disabled-1"), routingEnabled: false },
  fixedRoll(1),
);
assert.equal(disabledTrigger.result, "routing_disabled");
assert.equal(disabledTrigger.actor.state.moraleState, MORALE_STATES.STEADY);

const terrorTarget = {
  ...steadySoldier,
  type: "player",
  team: "party",
  attributes: { ...steadySoldier.attributes, resolve: 18, discipline: 18, favor: 14 },
};
const terrorMinotaur = { ...minotaur, type: "enemy", team: "enemy" };
assert.equal(emitsMythicTerror(terrorMinotaur), true, "Minotaur Terrifying Presence emits mythic terror");
const terrorCheck = evaluateMoraleTriggers(
  terrorTarget,
  moraleTriggerContext(
    [terrorTarget, terrorMinotaur],
    { [terrorTarget.id]: { x: 2, y: 2 }, [terrorMinotaur.id]: { x: 3, y: 2 } },
    "terror-1",
  ),
  fixedRoll(10),
);
assert.equal(terrorCheck.trigger, "mythicTerror");
assert.equal(terrorCheck.triggerContext.terrorPenalty, 4, "terror pressure derives from Presence");

const lesserTerrorSource = {
  ...terrorMinotaur,
  id: "lesser-terror",
  attributes: { ...terrorMinotaur.attributes, presence: 10 },
};
const lesserTerrorCheck = evaluateMoraleTriggers(
  { ...terrorTarget, id: "lesser-terror-target", state: { moraleState: MORALE_STATES.STEADY } },
  moraleTriggerContext(
    [{ ...terrorTarget, id: "lesser-terror-target" }, lesserTerrorSource],
    { "lesser-terror-target": { x: 2, y: 2 }, [lesserTerrorSource.id]: { x: 3, y: 2 } },
    "terror-2",
  ),
  fixedRoll(10),
);
assert.ok(
  terrorCheck.triggerContext.terrorPenalty > lesserTerrorCheck.triggerContext.terrorPenalty,
  "higher Presence creates stronger mythic terror pressure",
);

const repeatedTerrorCheck = evaluateMoraleTriggers(
  terrorCheck.actor,
  moraleTriggerContext(
    [terrorCheck.actor, terrorMinotaur],
    { [terrorTarget.id]: { x: 2, y: 2 }, [terrorMinotaur.id]: { x: 3, y: 2 } },
    "terror-1",
  ),
  fixedRoll(1),
);
assert.equal(repeatedTerrorCheck.result, "already_checked", "trigger memory blocks duplicate same-turn checks");

const fallenCommander = {
  ...steadySoldier,
  id: "fallen-commander",
  type: "player",
  team: "party",
  aiRole: "commander",
  currentHP: 0,
  status: "defeated",
};
const leaderDeathCheck = evaluateMoraleTriggers(
  surroundedActor,
  moraleTriggerContext(
    [surroundedActor, fallenCommander],
    { [surroundedActor.id]: { x: 4, y: 4 } },
    "leader-death-1",
  ),
  fixedRoll(15),
);
assert.equal(leaderDeathCheck.trigger, "leaderDead", "explicit allied commander death is a reliable trigger");

const pressuredMinotaur = evaluateMoraleTriggers(
  {
    ...minotaur,
    currentHP: 10,
    maxHP: 52,
    state: { moraleState: MORALE_STATES.STEADY },
  },
  moraleTriggerContext([minotaur], { [minotaur.id]: { x: 1, y: 1 } }, "minotaur-wound"),
  fixedRoll(2),
);
assert.equal(pressuredMinotaur.actor.state.moraleState, MORALE_STATES.ROUTED, "low Discipline still lets Minotaur rout");

const routedMinotaur = performMoraleCheck(minotaur, {
  routingEnabled: true,
  routReason: ROUT_REASONS.PAIN,
  badlyWounded: true,
  outnumbered: true,
  dc: 20,
}, fixedRoll(3));
assert.equal(routedMinotaur.actor.state.moraleState, MORALE_STATES.ROUTED);
assert.equal(
  chooseRoutBehavior(routedMinotaur.actor, { escapeBlocked: true }),
  ROUT_BEHAVIORS.CORNERED_FURY,
);

const earlyRecoveryActor = {
  ...recoveryActor,
  traits: ["Rout Survivor", "Oath-Fast"],
  state: { ...recoveryActor.state, routTurns: 1 },
};
const recovered = attemptRoutRecovery(earlyRecoveryActor, {
  recoveryDc: 12,
  commanderNearby: true,
  commanderPresenceBonus: 2,
}, fixedRoll(10));
assert.ok([MORALE_STATES.SHAKEN, MORALE_STATES.UNEASY].includes(recovered.actor.state.moraleState));

const fled = markActorFled(routedMinotaur.actor, "escapeThreshold");
assert.equal(fled.state.hasFledBattle, true);
assert.equal(fled.state.moraleState, MORALE_STATES.FLED);
assert.equal(fled.inBattle, false);
assert.equal(fled.canAct, false);
assert.equal(fled.modelKey, "minotaur", "fleeing preserves Minotaur identity and model");
assert.equal(
  evaluateMoraleTriggers(fled, { routingEnabled: true, turnKey: "fled-check" }, fixedRoll(20)).result,
  "already_fled",
  "fled actors are skipped by morale triggers",
);

const routingDisabled = normalizeMoraleState({
  ...fled,
  routingEnabled: false,
  inBattle: true,
  canAct: true,
});
assert.equal(routingDisabled.state.moraleState, MORALE_STATES.FLED);
assert.equal(routingDisabled.state.hasFledBattle, true);
assert.equal(routingDisabled.inBattle, false, "routing disabled does not revive fled actors");
assert.equal(routingDisabled.canAct, false);
assert.equal(
  performMoraleCheck(routingDisabled, { routingEnabled: false }, fixedRoll(20)).result,
  "already_fled",
);

const sourceSnapshot = structuredClone(steadySoldier);
performMoraleCheck(steadySoldier, { routReason: ROUT_REASONS.FEAR, dc: 15 }, fixedRoll(8));
assert.deepEqual(steadySoldier, sourceSnapshot, "morale helpers do not mutate source actors");

console.log("attribute morale routing tests passed");
