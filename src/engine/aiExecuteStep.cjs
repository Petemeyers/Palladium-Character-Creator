// src/engine/aiExecuteStep.cjs
// One-shot AI step: select intent + (if ATTACK) resolve it + consume actions.
// MOVE is returned as an intent for UI to execute (worker stays map/path agnostic).

const { aiSelectAction } = require("./aiSelectAction.cjs");
const { resolveAttack } = require("./resolveAttack.cjs");

function idOf(x) {
  return x?.id ?? x?._id ?? x ?? null;
}

function canActLite(f) {
  if (!f) return false;
  if (f.isDead) return false;
  if (f.isKO) return false;
  const status = String(f.status || "").toLowerCase();
  if (status === "defeated" || status === "fled") return false;
  const hp = Number(f.currentHP ?? 0);
  if (hp <= 0) return false;
  const ra = Number(f.remainingAttacks ?? 0);
  return ra > 0;
}

function findLite(fightersLite, id) {
  return (fightersLite || []).find((f) => idOf(f) === id) || null;
}

function updateFightersLite(fightersLite, patchById) {
  if (!patchById) return fightersLite;
  return (fightersLite || []).map((f) => {
    const fid = idOf(f);
    const patch = fid ? patchById[fid] : null;
    return patch ? { ...f, ...patch } : f;
  });
}

/**
 * payload = {
 *   state: {
 *     fightersLite: [{id, side, isEnemy, isNPC, currentHP, remainingAttacks, ...}],
 *     positionsLite: { [id]: {x,y} },
 *     ammoCountLite?: { [id]: { [ammoType]: number } }  // optional but enables ammo spend in worker
 *   },
 *   intent: {
 *     actorId,
 *     playerSides?: string[],
 *     enemySides?: string[],
 *     // mapping config for attack math:
 *     defaultCritMult?: number,
 *     critOn?: number,
 *     // cost model:
 *     actionCostAttack?: number, // default 1
 *     actionCostMove?: number,   // default 1 (set to 0 if your move shouldn't spend attacks)
 *   }
 * }
 *
 * returns:
 * {
 *   step: { kind, actorId, targetId, attackMode?, desiredRange?, approach? },
 *   events: [],
 *   delta: {
 *     fightersLite?: updated fightersLite array (only small fields changed),
 *     ammoDelta?: { ownerId, ammoType, next },
 *   }
 * }
 */
function aiExecuteStep(payload = {}) {
  const { state = {}, intent = {} } = payload;

  const fightersLite = Array.isArray(state.fightersLite) ? state.fightersLite : [];
  const positionsLite = state.positionsLite || {};
  const ammoCountLite = state.ammoCountLite || null;
  const attackProfilesById = state.attackProfilesById || {};
  const attackOverrideByKey = state.attackOverrideByKey || null;

  const actorId = intent.actorId ?? idOf(fightersLite[Number(state.turnIndex ?? 0)]);

  const playerSides = Array.isArray(intent.playerSides) ? intent.playerSides : ["player", "party", "ally"];
  const enemySides = Array.isArray(intent.enemySides) ? intent.enemySides : ["enemy"];

  const actor = findLite(fightersLite, actorId);
  if (!actor || !canActLite(actor)) {
    return {
      step: { kind: "HOLD", actorId },
      events: [{ type: "AI_NOOP", actorId, reason: "Cannot act" }],
      delta: {},
    };
  }

  // 1) pick intent
  const plan = aiSelectAction({
    enemyId: actorId,
    fightersLite,
    positionsLite,
    playerSides,
    enemySides,
  });

  const chosen = plan?.intent || { kind: "HOLD" };
  const events = [];

  // Always emit what we decided (good for logs + GM narration)
  events.push({
    type: "AI_INTENT",
    actorId,
    intent: chosen,
    reason: plan?.reason || "AI",
  });

  // Defaults (can be overridden per-attack via attackOverrideByKey)
  const actionCostAttack = Number(intent.actionCostAttack ?? 1);
  const actionCostMove = Number(intent.actionCostMove ?? 1);

  // Helper: consume actions on actor
  function consumeActions(cost) {
    const prev = Number(actor.remainingAttacks ?? 0);
    const next = Math.max(0, prev - Math.max(0, cost));
    events.push({ type: "ATTACKS_CONSUMED", attackerId: actorId, prev, next });

    const patchById = { [actorId]: { remainingAttacks: next } };

    if (next <= 0) {
      events.push({ type: "TURN_SHOULD_END", actorId, reason: "No remaining attacks" });
    }

    return patchById;
  }

  // 2) Execute ATTACK fully in worker
  if (chosen.kind === "ATTACK" && chosen.targetId) {
    const targetId = chosen.targetId;
    const target = findLite(fightersLite, targetId);

    if (!target) {
      events.push({ type: "AI_TARGET_INVALID", actorId, targetId });
      const patches = consumeActions(actionCostAttack);
      return {
        step: { kind: "ATTACK", actorId, targetId, attackMode: chosen.attackMode || "melee" },
        events,
        delta: { fightersLite: updateFightersLite(fightersLite, patches) },
      };
    }

    const attackerProfile = attackProfilesById[actorId] || {};
    const targetProfile = attackProfilesById[targetId] || {};

    const attackMode = chosen.attackMode || "melee";
    const overrideKey = `${actorId}::${targetId}::${attackMode}`;
    const override = attackOverrideByKey ? attackOverrideByKey[overrideKey] : null;

    if (!override) {
      return {
        step: { kind: "ATTACK", actorId, targetId, attackMode },
        events: [
          {
            type: "REQUEST_ATTACK_OVERRIDE",
            actorId,
            targetId,
            attackMode,
            reason: "Need situational bonuses",
          },
        ],
        delta: {},
      };
    }

    const toHitBonus = Number(override?.toHitBonus ?? attackerProfile.baseStrikeBonus ?? 0);
    const targetAR = Number(override?.targetAR ?? targetProfile.baseAR ?? target.AR ?? 10);
    const damageFormula = String(override?.damageFormula ?? attackerProfile.damageFormula ?? "1d6");

    const critOn = Number(override?.critOn ?? intent.critOn ?? 20);
    const critMult = Number(override?.critMult ?? intent.defaultCritMult ?? 2);

    // ammo support (only if UI provides ammoCountLite)
    let ammoPayload = null;
    if (chosen.attackMode === "ranged" && ammoCountLite) {
      const ammoType = override?.ammoType ?? attackerProfile.ammoType ?? null;
      if (ammoType) {
        const current = ammoCountLite?.[actorId]?.[ammoType] ?? 0;
        ammoPayload = { ammoOwnerId: actorId, ammoType, spend: 1, current };
      }
    }

    // supply hpById based on fightersLite
    const hpById = {};
    for (const f of fightersLite) {
      const fid = idOf(f);
      if (fid) hpById[fid] = Number(f.currentHP ?? 0);
    }

    const attackRes = resolveAttack({
      attackerId: actorId,
      targetId,
      attack: {
        toHitBonus,
        targetAR,
        damageFormula,
        critOn,
        critMult,
        remainingAttacks: Number(actor.remainingAttacks ?? 1),
      },
      state: { hpById, positions: positionsLite, fighters: fightersLite },
      ...(ammoPayload ? { ammo: ammoPayload } : {}),
      ...(state.rngState ? { rngState: state.rngState } : {}),
    });

    // Merge events
    (attackRes?.events || []).forEach((e) => events.push(e));

    // Convert hp delta → fightersLite patches
    const patchById = {};

    const hpDelta = attackRes?.delta?.hpById || null;
    if (hpDelta) {
      for (const [id, nextHP] of Object.entries(hpDelta)) {
        patchById[id] = { ...(patchById[id] || {}), currentHP: Number(nextHP) };
      }
    }

    // If resolveAttack already returns remainingAttacksById (Patch 11), prefer that.
    const raDelta = attackRes?.delta?.remainingAttacksById || null;
    if (raDelta && raDelta[actorId] !== undefined) {
      patchById[actorId] = { ...(patchById[actorId] || {}), remainingAttacks: raDelta[actorId] };
      if (Number(raDelta[actorId]) <= 0) {
        events.push({ type: "TURN_SHOULD_END", actorId, reason: "No remaining attacks" });
      }
    } else {
      Object.assign(patchById, consumeActions(actionCostAttack));
    }

    // Ammo delta passthrough
    const ammoDelta = attackRes?.delta?.ammo || null;
    if (ammoDelta) {
      events.push({ type: "AMMO_SPENT", ...ammoDelta, spent: 1 });
    }

    const nextFightersLite = updateFightersLite(fightersLite, patchById);

    return {
      step: { kind: "ATTACK", actorId, targetId, attackMode: chosen.attackMode || "melee" },
      events,
      delta: {
        fightersLite: nextFightersLite,
        ...(ammoDelta ? { ammoDelta } : {}),
        ...(attackRes?.delta?.rngState ? { rngState: attackRes.delta.rngState } : {}),
      },
    };
  }

  // 3) MOVE is returned for UI to execute, but we still optionally consume actions
  if (chosen.kind === "MOVE" && chosen.targetId) {
    const patches = actionCostMove > 0 ? consumeActions(actionCostMove) : null;

    return {
      step: {
        kind: "MOVE",
        actorId,
        targetId: chosen.targetId,
        desiredRange: chosen.desiredRange ?? 1,
        approach: chosen.approach ?? "toward",
      },
      events,
      delta: {
        ...(patches ? { fightersLite: updateFightersLite(fightersLite, patches) } : {}),
      },
    };
  }

  // 4) HOLD
  const patches = consumeActions(1);
  return {
    step: { kind: "HOLD", actorId },
    events,
    delta: { fightersLite: updateFightersLite(fightersLite, patches) },
  };
}

module.exports = { aiExecuteStep };

