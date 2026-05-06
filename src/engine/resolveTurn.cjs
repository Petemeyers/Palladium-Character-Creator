// src/engine/resolveTurn.cjs
// Keep this PURE. No DOM, no React, no window.

const { advanceStatuses } = require("./statusEngine.cjs");

let CryptoSecureDice;
try {
  CryptoSecureDice = require("../utils/cryptoDice.js");
} catch {
  CryptoSecureDice = null;
}

function rollDice(formula) {
  if (CryptoSecureDice?.parseAndRoll) {
    const r = CryptoSecureDice.parseAndRoll(formula);
    return r.totalWithBonus ?? r.total ?? 0;
  }
  const m = String(formula).trim().match(/^(\d+)d(\d+)$/i);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const d = parseInt(m[2], 10);
  let total = 0;
  for (let i = 0; i < n; i++) total += 1 + Math.floor(Math.random() * d);
  return total;
}

function canFighterActLite(f) {
  if (!f) return false;

  // Match your CombatPage patterns: dead/KO/defeated/fled/HP<=0 can't act
  if (f.isDead) return false;
  if (f.isKO) return false;

  const status = (f.status || "").toLowerCase();
  if (status === "defeated" || status === "fled") return false;

  const hp = Number(f.currentHP ?? f.hp ?? 0);
  if (hp <= 0) return false;

  return true;
}

function hasActionsLeftLite(f) {
  // Your CombatPage checks remainingAttacks > 0 for "fightersWithActions"
  const ra = Number(f?.remainingAttacks ?? 0);
  return canFighterActLite(f) && ra > 0;
}

async function resolveTurn(payload) {
  const { state, intent, ruleset } = payload || {};
  if (!state || !intent) throw new Error("resolveTurn: missing state/intent");

  // --- NEW: END_TURN_FULL is the real turn boundary ---
  if (intent.type === "END_TURN_FULL") {
    // Prefer fightersLite (preferred) and full fighters (backward compat)
    const fighters = Array.isArray(state.fightersLite)
      ? state.fightersLite
      : (Array.isArray(state.fighters) ? state.fighters : []);
    const turnIndex = Number(state.turnIndex ?? 0);
    const meleeRound = Number(state.round ?? state.meleeRound ?? 1);
    const turnCounter = Number(state.turnCounter ?? 0);

    // 1) Determine if melee round is complete (no one has actions left)
    const anyActionsLeft = fighters.some(hasActionsLeftLite);
    const meleeRoundComplete = !anyActionsLeft;

    // 2) Build a "turn order" snapshot (your UI currently uses fighters array order)
    // Keep this simple: next eligible in array order, wrapping around.
    let nextIndex = turnIndex;
    let steps = 0;

    // If melee round complete, we still advance to "start of next round" at index 0 by convention
    if (meleeRoundComplete) {
      nextIndex = 0;
    } else {
      // Otherwise, advance to next eligible fighter that can act and has actions left
      do {
        nextIndex = (nextIndex + 1) % Math.max(1, fighters.length);
        steps += 1;
        if (steps > fighters.length + 1) break; // safety
      } while (!hasActionsLeftLite(fighters[nextIndex]));
    }

    const nextRound = meleeRoundComplete ? (meleeRound + 1) : meleeRound;
    const nextTurnCounter = turnCounter + 1;

    // Advance statuses (expire old ones, apply DOT ticks)
    const statusEvents = [];
    if (state.fighters?.length) {
      const statusResult = advanceStatuses(state, {
        now: nextTurnCounter,
        rollDice,
        ruleset,
      });
      statusEvents.push(...(statusResult.events || []));
    }

    // Extract next actor ID robustly (handles id, _id, uuid)
    const nextActor = fighters[nextIndex] || null;
    const nextActorId = nextActor?.id ?? nextActor?._id ?? nextActor?.uuid ?? null;

    const events = [
      { type: "TURN_ENDED", actorId: intent.actorId ?? null },
      ...statusEvents,
      ...(meleeRoundComplete
        ? [{ type: "MELEE_ROUND_ENDED", round: meleeRound }, { type: "ROUND_STARTED", round: nextRound }]
        : []),
      { type: "TURN_STARTED", actorId: nextActorId, turnIndex: nextIndex },
    ];

    return {
      nextState: {
        // return only the things CombatPage needs to set
        turnIndex: nextIndex,
        turnCounter: nextTurnCounter,
        round: nextRound,
        meleeRoundComplete,
      },
      events,
    };
  }

  // keep your existing END_TURN / ROLL_D20 here if you still want them
  if (intent.type === "ROLL_D20") {
    const value = 1 + Math.floor(Math.random() * 20);
    return { nextState: state, events: [{ type: "ROLLED", sides: 20, value }] };
  }

  return { nextState: state, events: [{ type: "NOOP", intentType: intent.type }] };
}

function isHumanLite(f) {
  // Adjust this to match your actual flags.
  // Common patterns: f.isNPC, f.isEnemy, f.team, f.side
  // For now: treat anything with isNPC === true as non-human
  return !(f?.isNPC === true);
}

async function advanceUntilHuman(payload) {
  const { state, intent, ruleset } = payload || {};
  if (!state) throw new Error("advanceUntilHuman: missing state");

  const maxSteps = Number(intent?.maxSteps ?? 50);

  let curState = { ...state };
  let allEvents = [];

  for (let i = 0; i < maxSteps; i++) {
    // Step one turn boundary
    const res = await resolveTurn({
      state: curState,
      intent: { type: "END_TURN_FULL", actorId: intent?.actorId ?? null },
      ruleset,
    });

    // resolveTurn returns { nextState, events }
    curState = { ...curState, ...res.nextState };
    allEvents = allEvents.concat(res.events || []);

    // Find who is next
    const fighters = Array.isArray(curState.fightersLite)
      ? curState.fightersLite
      : (Array.isArray(curState.fighters) ? curState.fighters : []);

    const next = fighters[curState.turnIndex] || null;

    // Stop when we land on a human-controlled actor
    if (isHumanLite(next)) break;
  }

  return {
    nextState: curState,
    events: allEvents,
    stoppedBecause: "HUMAN_OR_MAXSTEPS",
  };
}

function isPlayerControlledLite(f, playerSides) {
  if (!f) return false;

  // If you have explicit flags:
  if (f.isNPC === true) return false;

  // Prefer side/team matching when provided
  const side = String(f.side ?? "").toLowerCase();

  if (Array.isArray(playerSides) && playerSides.length) {
    return playerSides.map(s => String(s).toLowerCase()).includes(side);
  }

  // Default fallback:
  // treat non-enemy as player
  return f.isEnemy !== true;
}

async function advanceUntilPlayer(payload) {
  const { state, intent } = payload || {};
  if (!state) throw new Error("advanceUntilPlayer: missing state");

  const maxSteps = Number(intent?.maxSteps ?? 200);
  const playerSides = Array.isArray(intent?.playerSides) ? intent.playerSides : ["player", "party", "ally"];

  let curState = { ...state };
  let allEvents = [];
  let roundsAdvanced = 0;

  for (let i = 0; i < maxSteps; i++) {
    const res = await resolveTurn({
      state: curState,
      intent: { type: "END_TURN_FULL", actorId: intent?.actorId ?? null },
    });

    curState = { ...curState, ...res.nextState };
    allEvents = allEvents.concat(res.events || []);

    // detect round transitions (your END_TURN_FULL emits ROUND_STARTED)
    const justAdvancedRound = (res.events || []).some(e => e?.type === "ROUND_STARTED");
    if (justAdvancedRound) roundsAdvanced += 1;

    const fighters = Array.isArray(curState.fightersLite)
      ? curState.fightersLite
      : (Array.isArray(curState.fighters) ? curState.fighters : []);

    const next = fighters[curState.turnIndex] || null;

    if (isPlayerControlledLite(next, playerSides)) {
      return {
        nextState: curState,
        events: allEvents,
        roundsAdvanced,
        stoppedBecause: "PLAYER_TURN",
      };
    }
  }

  return {
    nextState: curState,
    events: allEvents,
    roundsAdvanced,
    stoppedBecause: "MAX_STEPS",
  };
}

module.exports = { resolveTurn, advanceUntilHuman, advanceUntilPlayer };

