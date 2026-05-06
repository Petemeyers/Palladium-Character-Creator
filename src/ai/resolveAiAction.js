import { ACTION_TYPES } from "./aiActionRegistry";

function rollPercentile(rng = Math.random) {
  return Math.floor(rng() * 100) + 1;
}

export function resolveAiAction(action, actor, world = {}, rng = Math.random) {
  const events = [];

  if (action.type === ACTION_TYPES.USE_SKILL) {
    const target = Number(action.executePayload?.skillPercent ?? 30);
    const roll = rollPercentile(rng);
    const success = roll <= target;

    events.push({
      type: "AI_SKILL_ROLL",
      actorId: action.actorId,
      skillName: action.skillName,
      roll,
      target,
      success,
      message: `${actor?.name ?? "AI"} uses ${action.skillName}: ${roll}/${target} ${
        success ? "success" : "fail"
      }`,
      round: world.round ?? world.turnCounter ?? null,
    });

    events.push({
      type: success
        ? action.executePayload.successEvent
        : action.executePayload.failureEvent,
      actorId: action.actorId,
      skillName: action.skillName,
      actionName: action.name,
      roll,
      target,
      round: world.round ?? world.turnCounter ?? null,
    });

    return {
      ok: true,
      success,
      reason: success ? null : "failed roll",
      action,
      events,
      consumesTurn: true,
    };
  }

  return {
    ok: true,
    success: true,
    action,
    events: [
      {
        type: "AI_ACTION_SELECTED",
        actorId: action.actorId,
        actionType: action.type,
        actionName: action.name,
        targetId: action.targetId,
        round: world.round ?? world.turnCounter ?? null,
      },
    ],
    consumesTurn: true,
  };
}
