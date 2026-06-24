const hasValue = (value) => value !== undefined && value !== null && value !== "";

const toNumber = (value) => {
  if (!hasValue(value) || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const cleanText = (value, fallback = "") => {
  if (typeof value === "string") {
    const trimmed = value.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
};

const getId = (value) =>
  cleanText(value?.id || value?._id || value?.fighterId || value?.characterId || value?.name, "");

const skillNameFrom = (skill, action) =>
  cleanText(
    skill?.name ||
      skill?.label ||
      skill?.skillName ||
      action?.metadata?.skillName ||
      action?.metadata?.actionName ||
      action?.skillName ||
      action?.name,
    ""
  );

const skillIdFrom = (skill, action) =>
  cleanText(
    skill?.id ||
      skill?._id ||
      skill?.skillId ||
      action?.metadata?.skillId ||
      action?.skillId,
    ""
  );

const skillSourceFrom = (skill, action) =>
  cleanText(
    action?.metadata?.skillSource ||
      action?.source ||
      skill?.source ||
      skill?.origin ||
      "skill",
    "skill"
  );

const skillCategoryFrom = (skill, action) =>
  cleanText(
    skill?.category ||
      skill?.type ||
      action?.metadata?.skillCategory ||
      action?.metadata?.skillType,
    ""
  );

export function getSkillCommandPreview({ actor, skill, action } = {}) {
  const skillName = skillNameFrom(skill, action);
  const skillSource = skillSourceFrom(skill, action);
  const skillCategory = skillCategoryFrom(skill, action);

  return {
    actionName: cleanText(action?.name, skillName ? `Use Skill: ${skillName}` : "Use Skill"),
    actorName: cleanText(actor?.name, "Current combatant"),
    skillName: skillName || "Unavailable skill",
    skillId: skillIdFrom(skill, action),
    skillSource,
    skillCategory,
    actionCost: toNumber(action?.costActions) ?? 1,
    staminaCost: toNumber(action?.costStamina) ?? 0,
    handlerStatus: "Skill handler pending.",
    previewSummary: cleanText(action?.previewSummary, "Skill handler pending."),
  };
}

export function canUseSkillCommand({ actor, skill, action, currentTurnEntry } = {}) {
  const actorId = getId(actor);
  const turnId = getId(currentTurnEntry);
  const actionActorId = cleanText(action?.metadata?.actorId, actorId);
  const remainingActions = toNumber(currentTurnEntry?.remainingActions ?? actor?.remainingActions);
  const actionCost = toNumber(action?.costActions) ?? 1;
  const skillName = skillNameFrom(skill, action);
  const skillId = skillIdFrom(skill, action);

  if (!actorId || !turnId || actorId !== turnId || (actionActorId && actionActorId !== turnId)) {
    return { ok: false, reason: "Use Skill can only be used by the current turn combatant." };
  }
  if (actionCost > 0 && (remainingActions === null || remainingActions <= 0)) {
    return { ok: false, reason: "No actions remaining. End Turn manually." };
  }
  if (!skillName && !skillId) {
    return { ok: false, reason: "Skill data unavailable." };
  }

  return { ok: false, reason: "Skill handler pending." };
}

export function buildUseSkillCommandResult({ actor, skill, action, currentTurnEntry } = {}) {
  const preview = getSkillCommandPreview({ actor, skill, action });
  const guard = canUseSkillCommand({ actor, skill, action, currentTurnEntry });

  return {
    ok: guard.ok,
    preview,
    message: guard.reason || preview.handlerStatus,
  };
}

export default {
  buildUseSkillCommandResult,
  canUseSkillCommand,
  getSkillCommandPreview,
};
