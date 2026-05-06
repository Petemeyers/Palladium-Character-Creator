// src/engine/statusEngine.cjs
const { getStatusRule } = require("./statusRules.cjs");
const { resolveDamage } = require("./damageEngine.cjs");

function uid(prefix = "id") {
  return `${prefix}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

function getFighter(state, id) {
  return state.fighters?.find((f) => f.id === id);
}

function ensureStatuses(fighter) {
  if (!fighter.statuses) fighter.statuses = [];
  return fighter.statuses;
}

function computeExpiresAt({ now, duration }) {
  if (duration == null) return Infinity;
  if (duration === Infinity) return Infinity;
  const d = Math.max(0, Math.floor(duration));
  return now + d;
}

/**
 * Apply status with stacking rules.
 * params:
 *  - targetId, key, durationTicks, sourceId, stacks (optional), meta (optional)
 *  - now (turnCounter)
 *  - ruleset: optional ruleset object (for getStatusRule)
 */
function applyStatus(state, params) {
  const { targetId, key, durationTicks, sourceId, stacks = 1, meta, now, ruleset } = params;

  const events = [];
  const target = getFighter(state, targetId);
  if (!target)
    return {
      ok: false,
      events,
      delta: null,
      error: { message: "TARGET_NOT_FOUND" },
    };

  // Use ruleset if provided, otherwise fall back to statusRules
  const rule = ruleset?.getStatusRule ? ruleset.getStatusRule(key) : getStatusRule(key);
  const list = ensureStatuses(target);

  const existingIndex = list.findIndex(
    (s) => s.key === key && (rule.unique ? true : s.sourceId === sourceId)
  );
  const expiresAt = computeExpiresAt({ now, duration: durationTicks });

  if (existingIndex >= 0) {
    const cur = list[existingIndex];
    const next = { ...cur };

    switch (rule.stacking) {
      case "ignore":
        // do nothing
        events.push({
          type: "STATUS_IGNORED",
          targetId,
          key,
          reason: "stacking_ignore",
        });
        return { ok: true, events, delta: { fighters: state.fighters } };

      case "replace":
        next.stacks = Math.min(rule.maxStacks ?? 99, stacks);
        next.expiresAt = expiresAt;
        next.sourceId = sourceId ?? next.sourceId;
        next.meta = meta ?? next.meta;
        break;

      case "stack":
        next.stacks = Math.min(rule.maxStacks ?? 99, (cur.stacks ?? 1) + stacks);
        // usually refresh duration on stack; tweak if you want "independent stacks"
        next.expiresAt = Math.max(cur.expiresAt ?? 0, expiresAt);
        next.meta = meta ?? next.meta;
        break;

      case "refresh":
      default:
        next.stacks = Math.min(rule.maxStacks ?? 99, cur.stacks ?? 1);
        next.expiresAt = Math.max(cur.expiresAt ?? 0, expiresAt);
        next.meta = meta ?? next.meta;
        break;
    }

    list[existingIndex] = next;

    events.push({
      type: "STATUS_UPDATED",
      targetId,
      status: next,
    });

    return { ok: true, events, delta: { fighters: state.fighters } };
  }

  const status = {
    id: uid("status"),
    key,
    sourceId: sourceId ?? null,
    stacks: Math.min(rule.maxStacks ?? 99, stacks),
    expiresAt,
    meta: meta ?? null,
  };

  list.push(status);

  events.push({
    type: "STATUS_APPLIED",
    targetId,
    status,
  });

  return { ok: true, events, delta: { fighters: state.fighters } };
}

/**
 * Remove a status by id or key.
 */
function removeStatus(state, { targetId, statusId, key, reason }) {
  const events = [];
  const target = getFighter(state, targetId);
  if (!target?.statuses?.length)
    return { ok: true, events, delta: { fighters: state.fighters } };

  const before = target.statuses.length;
  target.statuses = target.statuses.filter((s) => {
    if (statusId) return s.id !== statusId;
    if (key) return s.key !== key;
    return true;
  });

  if (target.statuses.length !== before) {
    events.push({
      type: "STATUS_REMOVED",
      targetId,
      statusId: statusId ?? null,
      key: key ?? null,
      reason,
    });
  }

  return { ok: true, events, delta: { fighters: state.fighters } };
}

/**
 * Advance statuses for 1 melee tick.
 * - expires statuses whose expiresAt <= now
 * - optional: applies DOT ticks
 * - ruleset: optional ruleset object (for getStatusRule)
 */
function advanceStatuses(state, { now, rollDice, ruleset }) {
  const events = [];

  for (const f of state.fighters || []) {
    if (!f.statuses?.length) continue;

    // expire
    const expired = f.statuses.filter(
      (s) => Number.isFinite(s.expiresAt) && s.expiresAt <= now
    );
    if (expired.length) {
      for (const s of expired) {
        events.push({
          type: "STATUS_REMOVED",
          targetId: f.id,
          statusId: s.id,
          key: s.key,
          reason: "expired",
        });
      }
      f.statuses = f.statuses.filter(
        (s) => !(Number.isFinite(s.expiresAt) && s.expiresAt <= now)
      );
    }

    // DOT ticks
    for (const s of f.statuses) {
      // Use ruleset if provided, otherwise fall back to statusRules
      const rule = ruleset?.getStatusRule ? ruleset.getStatusRule(s.key) : getStatusRule(s.key);
      if (!rule.tickDamage) continue;

      const every = rule.tickEvery ?? 1;
      if (every <= 0) continue;

      // tick when now is multiple of every since application; simplest: tick every melee
      // If you want exact cadence, store appliedAt in status.meta.
      if (now % every !== 0) continue;

      const baseDmg = rollDice ? rollDice(rule.tickDamage) : 0;
      if (baseDmg > 0) {
        const totalBase = baseDmg * (s.stacks ?? 1);
        const out = resolveDamage({
          target: f,
          baseAmount: totalBase,
          damageType: rule.tickDamageType || "poison",
          ruleset,
        });

        if (out.breakdown.immune) {
          events.push({
            type: "LOG",
            level: "info",
            message: `🛡️ ${f.name} is immune to ${out.breakdown.type} from ${s.key}.`,
          });
        } else if (out.final > 0) {
          events.push({
            type: "DAMAGE",
            targetId: f.id,
            amount: out.final,
            sourceId: s.sourceId ?? null,
            kind: "status",
            damageType: out.breakdown.type,
            statusKey: s.key,
            breakdown: out.breakdown,
          });
          events.push({
            type: "LOG",
            level: "combat",
            message: `☠️ ${f.name} suffers ${out.final} damage from ${s.key}.`,
          });
        }
      }
    }
  }

  return { ok: true, events, delta: { fighters: state.fighters } };
}

module.exports = {
  applyStatus,
  removeStatus,
  advanceStatuses,
};

