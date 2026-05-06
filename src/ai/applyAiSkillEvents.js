import { AI_KNOWLEDGE_SCOPE, makeKnowledgePatch } from "./aiKnowledge";
import { addAiUnlock } from "./aiUnlocks";

export function applyAiSkillEvents({ events, actor, world }) {
  let nextWorld = { ...world };
  const logs = [];

  for (const event of events) {
    switch (event.type) {
      case "ENEMY_TRAIL_FOUND": {
        const actorId = event.actorId;

        const possibleEnemy =
          world.lastKnownEnemyByActorId?.[actorId] ||
          world.recentEnemyPositions?.[0] ||
          null;

        if (possibleEnemy) {
          nextWorld = addAiUnlock(makeKnowledgePatch(AI_KNOWLEDGE_SCOPE.PRIVATE, {
            ...nextWorld,
            lastKnownEnemyByActorId: {
              ...(nextWorld.lastKnownEnemyByActorId ?? {}),
              [actorId]: possibleEnemy,
            },
          }), actorId, "HUNT_REVEALED_ENEMY", {
            round: world.round ?? 0,
            ttlRounds: 3,
            data: {
              position: possibleEnemy?.position,
              targetId: possibleEnemy?.targetId ?? possibleEnemy?.id,
            },
          });

          logs.push({
            type: "LOG",
            level: "info",
            message: `${actor.name} finds signs of enemy movement.`,
          });
        } else {
          logs.push({
            type: "LOG",
            level: "info",
            message: `${actor.name} finds tracks, but cannot identify a clear direction.`,
          });
        }

        break;
      }

      case "TRACK_FAILED": {
        logs.push({
          type: "LOG",
          level: "info",
          message: `${actor.name} loses the trail.`,
        });
        break;
      }

      case "ACTOR_HIDDEN": {
        const actorId = event.actorId;

        nextWorld = addAiUnlock(makeKnowledgePatch(AI_KNOWLEDGE_SCOPE.PRIVATE, {
          ...nextWorld,
          hiddenActorIds: [
            ...new Set([...(nextWorld.hiddenActorIds ?? []), actorId]),
          ],
        }), actorId, "AMBUSH_ATTACK", {
          round: world.round ?? 0,
          ttlRounds: 1,
        });

        logs.push({
          type: "LOG",
          level: "info",
          message: `${actor.name} slips into cover.`,
        });

        break;
      }

      case "PROWL_FAILED": {
        logs.push({
          type: "LOG",
          level: "info",
          message: `${actor.name} tries to hide, but makes too much noise.`,
        });
        break;
      }

      case "AMBUSH_DETECTED": {
        nextWorld = addAiUnlock(makeKnowledgePatch(AI_KNOWLEDGE_SCOPE.PRIVATE, {
          ...nextWorld,
          flags: {
            ...(nextWorld.flags ?? {}),
            ambushDetected: true,
            suspectedAmbush: false,
          },
        }), event.actorId, "WARN_ALLIES", {
          round: world.round ?? 0,
          ttlRounds: 1,
        });

        logs.push({
          type: "LOG",
          level: "info",
          message: `${actor.name} detects signs of an ambush.`,
        });

        break;
      }

      case "AMBUSH_NOT_DETECTED": {
        logs.push({
          type: "LOG",
          level: "info",
          message: `${actor.name} scans for danger but notices nothing.`,
        });
        break;
      }

      case "FIRST_AID_SUCCESS": {
        logs.push({
          type: "LOG",
          level: "info",
          message: `${actor.name} successfully applies first aid.`,
        });

        break;
      }

      case "FIRST_AID_FAILED": {
        logs.push({
          type: "LOG",
          level: "info",
          message: `${actor.name} attempts first aid but cannot stabilize the wound.`,
        });

        break;
      }

      default:
        logs.push(event);
        break;
    }
  }

  return {
    world: nextWorld,
    events: logs,
  };
}
