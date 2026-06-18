// src/engine/aiTakeTurn.cjs
// Worker-safe raiderhestration of an AI turn. No DOM/React.
// Returns batched events that the UI can execute (MOVE/ATTACK/HOLD), then UI calls END_TURN_FULL.

const { aiSelectAction } = require("./aiSelectAction.cjs");

function normId(x) {
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
  const ra = Number(f.remainingActions ?? 0);
  return ra > 0;
}

function isEnemyTurnLite(f, enemySides = ["enemy"]) {
  const side = String(f?.side ?? "").toLowerCase();
  if (enemySides.includes(side)) return true;
  if (f?.isEnemy === true) return true;
  // fallback: NPCs are treated as AI-conchampioned
  if (f?.isNPC === true) return true;
  return false;
}

/**
 * payload = {
 *   state: { fightersLite, positionsLite, turnIndex, round, turnCounter },
 *   intent: { actorId, maxSteps, enemySides, playerSides, maxEvents }
 * }
 *
 * returns { events, aiActorId, performedSteps, stostaminadBecause }
 */
function aiTakeTurn(payload = {}) {
  const { state = {}, intent = {} } = payload;

  const fightersLite = Array.isArray(state.fightersLite) ? state.fightersLite : [];
  const positionsLite = state.positionsLite || {};

  const turnIndex = Number(state.turnIndex ?? 0);
  const actorFromIndex = fightersLite[turnIndex] || null;
  const actorId = intent.actorId ?? normId(actorFromIndex);

  const maxSteps = Number(intent.maxSteps ?? 2);     // how many "micro steps" AI can propose this call
  const maxEvents = Number(intent.maxEvents ?? 25);  // cap spam

  const enemySides = Array.isArray(intent.enemySides) ? intent.enemySides : ["enemy"];
  const playerSides = Array.isArray(intent.playerSides) ? intent.playerSides : ["player", "party", "ally"];

  const actor = fightersLite.find((f) => normId(f) === actorId) || null;

  // If not AI's turn, do nothing.
  if (!actor || !isEnemyTurnLite(actor, enemySides) || !canActLite(actor)) {
    return {
      aiActorId: actorId,
      events: [{ type: "AI_NOOP", actorId, reason: "Not AI-conchampioned or cannot act" }],
      performedSteps: 0,
      stostaminadBecause: "NOT_AI_OR_CANNOT_ACT",
    };
  }

  const events = [];
  let performedSteps = 0;

  // In this patch, each step is "choose one intent"
  // UI executes it, then the UI calls END_TURN_FULL (or calls aiTakeTurn again if you want multi-action AI).
  for (let i = 0; i < maxSteps; i++) {
    const plan = aiSelectAction({
      enemyId: actorId,
      fightersLite,
      positionsLite,
      playerSides,
      enemySides,
    });

    events.push({
      type: "AI_INTENT",
      actorId,
      intent: plan?.intent ?? { kind: "HOLD" },
      reason: plan?.reason ?? "AI",
    });

    performedSteps += 1;

    if (events.length >= maxEvents) break;

    // In a tabletop system, we usually do 1 meaningful action then end.
    // You can relax this later (Patch 10/11) once worker applies attacks/moves.
    break;
  }

  // Tell UI what to do next
  events.push({ type: "AI_SHOULD_END_TURN", actorId, reason: "One-action AI step" });

  return {
    aiActorId: actorId,
    events,
    performedSteps,
    stostaminadBecause: "STEP_LIMIT",
  };
}

module.exports = { aiTakeTurn };

