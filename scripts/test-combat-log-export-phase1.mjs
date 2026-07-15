import assert from "node:assert/strict";

import { COMBAT_LOG_AUDIENCES } from "../src/utils/combat/combatLogEvents.js";
import {
  buildCombatLogFilename,
  buildCombatLogText,
} from "../src/utils/combat/combatLogExport.js";

const events = [
  {
    id: "dev-2",
    seq: 2,
    displayTimestamp: "8:04:11 PM",
    audience: COMBAT_LOG_AUDIENCES.DEVELOPER,
    channel: "execution",
    eventType: "execution-gate",
    level: "warning",
    type: "warning",
    actorId: "enemy-archer-1",
    targetId: "party-knight-1",
    round: 4,
    turn: 17,
    turnToken: "turn-token-17",
    executionKey: "attack-key-17",
    source: "attack-roll",
    message: "attack key registry validated",
    data: { actionSource: "enemy-ranged-attack", position: { x: 32, y: 15 } },
    diceInfo: { roll: 14, total: 17 },
  },
  {
    id: "player-1",
    seq: 1,
    displayTimestamp: "8:04:10 PM",
    audience: COMBAT_LOG_AUDIENCES.PLAYER,
    channel: "damage",
    eventType: "attack-result",
    level: "info",
    type: "damage",
    message: "Archer fires Bow Shot.",
  },
];

const text = buildCombatLogText(events, { chronological: true });
const lines = text.split("\n");

assert.match(lines[0], /^\[#000001 8:04:10 PM\] \[PLAYER\/damage\/attack-result\/info\] Archer fires Bow Shot\./);
assert.match(lines[1], /^\[#000002 8:04:11 PM\] \[DEVELOPER\/execution\/execution-gate\/warning\] attack key registry validated/);
assert.match(lines[1], /actorId=enemy-archer-1/);
assert.match(lines[1], /targetId=party-knight-1/);
assert.match(lines[1], /round=4/);
assert.match(lines[1], /turn=17/);
assert.match(lines[1], /turnToken=turn-token-17/);
assert.match(lines[1], /executionKey=attack-key-17/);
assert.match(lines[1], /source=attack-roll/);
assert.match(lines[1], /data=.*enemy-ranged-attack/);
assert.match(lines[1], /dice=.*17/);

const trimText = buildCombatLogText(events, { chronological: true, trimNoticeCount: 3 });
assert.match(trimText, /^\[3 older combat log event\(s\) were trimmed from live memory\.\]/);

assert.equal(
  buildCombatLogFilename(new Date("2026-07-14T20:04:11")),
  "combat-log-2026-07-14-200411.txt",
  "download filename is stable and timestamped",
);

console.log("✅ combat log Phase 1 export tests passed");
