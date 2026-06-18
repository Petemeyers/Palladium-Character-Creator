// src/engine/aiSelectAction.cjs
// Pure worker-safe AI selection. No DOM/React.

function canActLite(f) {
  if (!f) return false;
  if (f.isDead) return false;
  if (f.isKO) return false;
  const status = String(f.status || "").toLowerCase();
  if (status === "defeated" || status === "fled") return false;
  const hp = Number(f.currentHP ?? 0);
  if (hp <= 0) return false;
  const ra = Number(f.remainingActions ?? 0);
  return ra > 0;
}

function distManhattan(a, b) {
  if (!a || !b) return Infinity;
  return Math.abs((a.x ?? 0) - (b.x ?? 0)) + Math.abs((a.y ?? 0) - (b.y ?? 0));
}

function normSide(s) {
  return String(s || "").toLowerCase();
}

function isOnSide(f, sideList) {
  const side = normSide(f.side);
  return sideList.includes(side);
}

/**
 * Returns:
 * { type:"AI_INTENT", actorId, intent:{ kind:"ATTACK"|"MOVE"|"HOLD", ... }, reason }
 */
function aiSelectAction(payload = {}) {
  const {
    enemyId,
    fightersLite = [],
    positionsLite = {},
    playerSides = ["player", "party", "ally"],
  } = payload;

  const enemy = fightersLite.find((f) => f?.id === enemyId) || null;
  if (!enemy || !canActLite(enemy)) {
    return {
      type: "AI_INTENT",
      actorId: enemyId ?? null,
      intent: { kind: "HOLD" },
      reason: "No enemy or cannot act",
    };
  }

  const players = fightersLite
    .filter((f) => canActLite(f) && f.id && isOnSide(f, playerSides));

  if (players.length === 0) {
    return {
      type: "AI_INTENT",
      actorId: enemyId,
      intent: { kind: "HOLD" },
      reason: "No targets",
    };
  }

  // Choose nearest target by distance (fast O(N))
  const ePos = positionsLite[enemyId];
  let best = null;
  let bestD = Infinity;

  for (const p of players) {
    const pPos = positionsLite[p.id];
    const d = distManhattan(ePos, pPos);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }

  if (!best) {
    return {
      type: "AI_INTENT",
      actorId: enemyId,
      intent: { kind: "HOLD" },
      reason: "No positions",
    };
  }

  // Decide ranged vs melee
  const hasRanged = enemy.hasRanged === true && Number(enemy.rangedRange ?? 0) > 1;
  const desiredRange = Number(enemy.preferredRange ?? (hasRanged ? 5 : 1)) || (hasRanged ? 5 : 1);

  // If we have ranged and are within ranged envelope, prefer ranged attack.
  if (hasRanged) {
    const maxRange = Number(enemy.rangedRange ?? 0);
    if (bestD >= 2 && bestD <= maxRange) {
      return {
        type: "AI_INTENT",
        actorId: enemyId,
        intent: { kind: "ATTACK", attackMode: "ranged", targetId: best.id },
        reason: `Ranged attack (d=${bestD}, max=${maxRange})`,
      };
    }

    // Too close? back up. Too far? approach.
    const approach = bestD < desiredRange ? "away" : "toward";
    return {
      type: "AI_INTENT",
      actorId: enemyId,
      intent: { kind: "MOVE", targetId: best.id, desiredRange, approach },
      reason: `Reposition for ranged (d=${bestD}, wantâ‰ˆ${desiredRange})`,
    };
  }

  // Melee: attack if adjacent/engaged, else move toward
  if (bestD <= 1) {
    return {
      type: "AI_INTENT",
      actorId: enemyId,
      intent: { kind: "ATTACK", attackMode: "melee", targetId: best.id },
      reason: "Melee in range",
    };
  }

  return {
    type: "AI_INTENT",
    actorId: enemyId,
    intent: { kind: "MOVE", targetId: best.id, desiredRange: 1, approach: "toward" },
    reason: `Close to melee (d=${bestD})`,
  };
}

module.exports = { aiSelectAction };

