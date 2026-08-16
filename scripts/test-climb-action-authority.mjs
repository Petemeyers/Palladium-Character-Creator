import assert from "node:assert/strict";
import {
  CANONICAL_CLIMB_SKILL,
  canonicalizeClimbingSkillName,
  chooseAiClimbOption,
  findActorClimbingSkill,
  getAdjacentClimbOptions,
  resolveClimbAttempt,
} from "../src/utils/combat/climbActionAuthority.js";

const makeMap = (leftHeight, rightHeight, edge = null, terrain = "grass") => ({
  width: 2,
  height: 1,
  grid: [[
    {
      terrain,
      terrainType: terrain,
      height: leftHeight,
      elevation: leftHeight,
      ...(edge ? { edgeTransitions: { E: edge } } : {}),
    },
    {
      terrain,
      terrainType: terrain,
      height: rightHeight,
      elevation: rightHeight,
    },
  ]],
});

assert.equal(canonicalizeClimbingSkillName("Scale Walls (+15%)"), "Climbing (+15%)");
assert.equal(canonicalizeClimbingSkillName("Scaling Walls"), "Climbing");
assert.equal(CANONICAL_CLIMB_SKILL, "Climbing");

{
  const trained = findActorClimbingSkill({ skills: ["Scale Walls (+15%)"] });
  assert.equal(trained.trained, true);
  assert.equal(trained.canonicalName, "Climbing (+15%)");
}
{
  const trained = findActorClimbingSkill({ skills: ["Climbing (+10%)"] });
  assert.equal(trained.trained, true);
}
{
  const map = makeMap(0, 3);
  const actor = { id: "a", skills: ["Climbing"], dexterity: 10, remainingActions: 2, currentStamina: 10 };
  const options = getAdjacentClimbOptions({
    mapDefinition: map,
    actor,
    from: { x: 0, y: 0 },
    positions: { a: { x: 0, y: 0 } },
    getSkillPercentageFn: () => 50,
  });
  assert.equal(options.length, 1);
  const option = options[0];
  assert.equal(option.transition.type, "cliff");
  assert.equal(option.verticalFeet, 7.5);
  assert.equal(option.targetPercent, 60);
  assert.equal(option.totalStaminaCost, option.baseStaminaCost + option.terrainStaminaCost);
  const success = resolveClimbAttempt({ option, actor, roll: 40 });
  assert.equal(success.success, true);
  assert.deepEqual(success.destination, { x: 1, y: 0 });
}
{
  const map = makeMap(3, 0);
  const actor = { id: "a", skills: ["Climbing"], dexterity: 10 };
  const [option] = getAdjacentClimbOptions({
    mapDefinition: map,
    actor,
    from: { x: 0, y: 0 },
    positions: { a: { x: 0, y: 0 } },
    getSkillPercentageFn: () => 40,
  });
  const fail = resolveClimbAttempt({ option, actor, roll: 100 });
  assert.equal(fail.success, false);
  assert.equal(fail.falls, true);
  assert.equal(fail.fallHeightFeet, 7.5);
  assert.deepEqual(fail.destination, { x: 1, y: 0 });
}
{
  const map = makeMap(0, 0, "wall");
  const actor = {
    id: "a",
    skills: ["Climbing"],
    dexterity: 10,
    armor: { name: "Full Plate Armor" },
    shield: { name: "Heater Shield" },
  };
  const [option] = getAdjacentClimbOptions({
    mapDefinition: map,
    actor,
    from: { x: 0, y: 0 },
    positions: { a: { x: 0, y: 0 } },
    getSkillPercentageFn: () => 70,
  });
  assert.equal(option.transition.type, "wall");
  assert.equal(option.surface.key, "stone-wall");
  assert.ok(option.equipmentPenalty <= -25);
  assert.ok(option.totalStaminaCost >= 5);
}
{
  const map = makeMap(0, 3);
  const actor = { id: "a", skills: ["Climbing"], dexterity: 10, remainingActions: 2, currentStamina: 10 };
  const options = getAdjacentClimbOptions({
    mapDefinition: map,
    actor,
    from: { x: 0, y: 0 },
    positions: { a: { x: 0, y: 0 } },
    getSkillPercentageFn: () => 70,
  });
  const decision = chooseAiClimbOption({
    actor,
    options,
    targetPosition: { x: 1, y: 0 },
    calculateDistanceFeet: (a, b) => Math.abs(a.x - b.x) * 5 + Math.abs(a.y - b.y) * 5,
  });
  assert.equal(decision.accepted, true);
  assert.deepEqual(decision.option.to, { x: 1, y: 0 });
}

console.log("PASS climb action authority");
