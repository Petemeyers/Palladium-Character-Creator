import assert from "node:assert/strict";

import { buildCombatActionCatalog } from "../src/utils/combatActionCatalog.js";
import {
  buildUseSkillCommandResult,
  canUseSkillCommand,
  getSkillCommandPreview,
} from "../src/utils/combatSkillCommand.js";

const hasFunction = (value) => {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(hasFunction);
};

const hasRawObjectInPreview = (value) =>
  Object.entries(value || {}).some(([, entry]) => entry && typeof entry === "object");

const actor = {
  id: "fighter-1",
  name: "Border Ranger",
  remainingActions: 1,
  currentStamina: 3,
  skills: [
    {
      id: "skill-prowl",
      name: "Prowl",
      category: "fieldcraft",
      roll: () => "ignored",
    },
  ],
};
const skill = actor.skills[0];
const actorSnapshot = JSON.stringify({
  id: actor.id,
  name: actor.name,
  remainingActions: actor.remainingActions,
  currentStamina: actor.currentStamina,
  skills: [{ id: skill.id, name: skill.name, category: skill.category }],
});
const skillSnapshot = JSON.stringify({ id: skill.id, name: skill.name, category: skill.category });

const catalog = buildCombatActionCatalog({
  actor,
  currentTurnEntry: actor,
  compatibilityActions: [{ value: "Use Skill", label: "Use Skill" }],
});
const skillAction = catalog.find((action) => action.type === "use-skill" && action.metadata.skillName === "Prowl");
const compatibilitySkillAction = catalog.find((action) => action.type === "use-skill" && action.name === "Use Skill");

assert.ok(skillAction, "actor skill creates a use-skill action");
assert.ok(compatibilitySkillAction, "compatibility skill action is still available");
assert.equal(skillAction.name, "Use Skill: Prowl");
assert.equal(skillAction.metadata.actorId, "fighter-1");
assert.equal(skillAction.metadata.actorName, "Border Ranger");
assert.equal(skillAction.metadata.skillName, "Prowl");
assert.equal(skillAction.metadata.actionName, "Prowl");
assert.equal(skillAction.metadata.skillId, "skill-prowl");
assert.equal(skillAction.metadata.skillSource, "skills");
assert.equal(skillAction.metadata.skillCategory, "fieldcraft");
assert.equal(hasFunction(skillAction), false, "use-skill action contains no functions");

const preview = getSkillCommandPreview({ actor, skill, action: skillAction });
assert.equal(preview.skillName, "Prowl");
assert.equal(preview.skillSource, "skills");
assert.equal(preview.skillCategory, "fieldcraft");
assert.equal(preview.handlerStatus, "Skill handler pending.");
assert.equal(hasFunction(preview), false, "skill preview contains no functions");
assert.equal(hasRawObjectInPreview(preview), false, "skill preview contains no raw objects");

const pending = canUseSkillCommand({
  actor,
  skill,
  action: skillAction,
  currentTurnEntry: actor,
});
assert.equal(pending.ok, false);
assert.equal(pending.reason, "Skill handler pending.");

const missingSkill = canUseSkillCommand({
  actor,
  skill: null,
  action: null,
  currentTurnEntry: actor,
});
assert.equal(missingSkill.ok, false);
assert.equal(missingSkill.reason, "Skill data unavailable.");

const wrongActor = canUseSkillCommand({
  actor,
  skill,
  action: skillAction,
  currentTurnEntry: { ...actor, id: "other-fighter" },
});
assert.equal(wrongActor.ok, false);
assert.equal(wrongActor.reason, "Use Skill can only be used by the current turn combatant.");

const noActions = canUseSkillCommand({
  actor,
  skill,
  action: skillAction,
  currentTurnEntry: { ...actor, remainingActions: 0 },
});
assert.equal(noActions.ok, false);
assert.equal(noActions.reason, "No actions remaining. End Turn manually.");

const result = buildUseSkillCommandResult({
  actor,
  skill,
  action: skillAction,
  currentTurnEntry: actor,
});
assert.equal(result.ok, false);
assert.equal(result.message, "Skill handler pending.");
assert.equal(hasFunction(result), false, "skill command result contains no functions");

assert.doesNotThrow(() => getSkillCommandPreview({ actor: null, skill: null, action: null }));
assert.doesNotThrow(() => canUseSkillCommand({ actor: null, skill: null, currentTurnEntry: null }));
assert.equal(JSON.stringify({
  id: actor.id,
  name: actor.name,
  remainingActions: actor.remainingActions,
  currentStamina: actor.currentStamina,
  skills: [{ id: skill.id, name: skill.name, category: skill.category }],
}), actorSnapshot, "skill helper does not mutate actor");
assert.equal(JSON.stringify({ id: skill.id, name: skill.name, category: skill.category }), skillSnapshot, "skill helper does not mutate skill");

console.log("combat skill command tests passed");
