import assert from "node:assert/strict";
import fs from "node:fs";

import {
  getCombatantSide,
  isManualPlayerCombatant,
  resolveExplicitCombatControlMode,
} from "../src/utils/combatantSide.js";
import { buildCombatCommandTurnBridge } from "../src/utils/combatCommandTurnBridge.js";
import {
  didPlayerAiAct,
  createPlayerAiActionResult,
  summarizePlayerAiResult,
} from "../src/utils/playerAiTurnResult.js";
import {
  createTurnFinalizerSnapshot,
  acceptTurnFinalizerKey,
  shouldAcceptTurnFinalizer,
  shouldDeferTurnStartUntilRefsSettle,
} from "../src/utils/turnFinalizerOwnership.js";

const resolveTurnMode = (actor, aiControlEnabled) => {
  const side = getCombatantSide(actor);
  const explicit = resolveExplicitCombatControlMode(actor, {
    aiControlEnabled,
    schedulerSide: side,
  });
  if (explicit) return explicit;
  if (side === "enemy") return "ai";
  return aiControlEnabled ? "ai" : "player";
};

const battle = [
  { id: "party-1", name: "Longbowman One", team: "party", type: "player", controlMode: "manual" },
  { id: "enemy-1", name: "Goblin One", team: "enemy", type: "enemy", controlMode: "ai" },
  { id: "party-2", name: "Longbowman Two", team: "party", type: "player", controlMode: "manual" },
  { id: "enemy-2", name: "Knight", team: "enemy", type: "enemy", controlMode: "ai" },
  { id: "party-3", name: "Longbowman Three", team: "party", type: "player", controlMode: "manual" },
  { id: "enemy-3", name: "Minotaur", team: "enemy", type: "enemy", controlMode: "ai" },
];

const resolvedTurns = Array.from({ length: battle.length * 2 }, (_, turn) => {
  const actor = battle[turn % battle.length];
  return { actor: actor.id, mode: resolveTurnMode(actor, true) };
});
assert.equal(resolvedTurns.every((turn) => turn.mode === "ai"), true,
  "AI button mode keeps both sides automated across multiple initiative cycles");

assert.equal(resolveTurnMode(battle[0], false), "player",
  "manual party behavior returns when AI button mode is disabled");
assert.equal(isManualPlayerCombatant(battle[0], { aiControlEnabled: false }), true);
assert.equal(isManualPlayerCombatant(battle[0], { aiControlEnabled: true }), false,
  "AI button mode prevents the end-turn guard from treating party actors as manual wait points");
assert.equal(didPlayerAiAct(createPlayerAiActionResult("pending-continuation")), true,
  "automated movement continuations count as actions in large battles");
assert.equal(didPlayerAiAct({ ok: false, blocked: true }), false,
  "a rejected continuation is not mistaken for a completed action result");
assert.equal(didPlayerAiAct(createPlayerAiActionResult("routed-move")), true,
  "routed party AI movement remains action-positive during auto-run");
assert.equal(summarizePlayerAiResult({ ok: true, acted: true }), "acted",
  "auto-run result logging cannot throw when an action label is absent");
const oldFinalizer = createTurnFinalizerSnapshot({ generation: 1, fighterId: "party-1", turnIndex: 0 });
const currentFinalizer = createTurnFinalizerSnapshot({ generation: 2, fighterId: "party-2", turnIndex: 2 });
assert.equal(shouldAcceptTurnFinalizer(oldFinalizer, currentFinalizer), false,
  "large-battle auto-run rejects finalizers from previous actors");
assert.equal(shouldDeferTurnStartUntilRefsSettle({ deferTurnStart: true }), true,
  "accepted player finalizers wait for authoritative refs before large-battle handoff");
const largeBattleFinalizers = new Set();
assert.equal(acceptTurnFinalizerKey(largeBattleFinalizers, "same-turn").accepted, true);
assert.equal(acceptTurnFinalizerKey(largeBattleFinalizers, "same-turn").duplicate, true);

const combatPageSource = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPageSource, /pending continuation owns turn/,
  "large-battle auto-run defers same-actor restarts while continuation work owns the turn");

const partyBridge = buildCombatCommandTurnBridge({
  combatActive: true,
  liveActor: battle[0],
  aiControlEnabled: true,
});
assert.equal(partyBridge.isEnemyControlled, true, "command bridge exposes the party actor as automated");
assert.equal(partyBridge.isPlayerControlled, false);

const manualEnemy = {
  id: "manual-enemy",
  name: "Player-Controlled Enemy",
  team: "enemy",
  type: "enemy",
  controlMode: "manual",
  playable: true,
};
assert.equal(resolveTurnMode(manualEnemy, true), "player",
  "global party AI does not erase an explicitly manual enemy decision point");
assert.equal(isManualPlayerCombatant(manualEnemy, { aiControlEnabled: true }), true);

const passiveActor = { id: "civilian", team: "party", type: "npc", controlMode: "passive" };
assert.equal(resolveTurnMode(passiveActor, true), "passive", "passive actors remain passive");

console.log("AI button large-battle auto-run tests passed");
