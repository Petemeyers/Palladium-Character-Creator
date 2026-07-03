import assert from "node:assert/strict";
import fs from "node:fs";

import { sanitizeCombatLogMessage } from "../src/utils/combatLogSanitizer.js";

assert.equal(
  sanitizeCombatLogMessage("ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ Knight #1 selects Short Sword."),
  "Knight #1 selects Short Sword.",
);
assert.equal(
  sanitizeCombatLogMessage("⚔ Knight #1 attacks Minotaur."),
  "Knight #1 attacks Minotaur.",
);
assert.equal(
  sanitizeCombatLogMessage("Knight #1 weapon check: 1 equipped weapons found"),
  "Knight #1 weapon check: 1 equipped weapons found",
);

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPage, /const readableMessage = sanitizeCombatLogMessage\(message\)/);
assert.match(combatPage, /message: readableMessage/,
  "only sanitized messages enter the browser combat log queue");
assert.doesNotMatch(
  combatPage.slice(combatPage.indexOf("const logEntry = {"), combatPage.indexOf("logQueueRef.current.push", combatPage.indexOf("const logEntry = {"))),
  /\n\s*message,\s*\n/,
  "raw messages cannot bypass sanitation when the log entry is constructed",
);

const playerAi = fs.readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
assert.doesNotMatch(playerAi, /flanking continuation aborted safely/);
assert.match(playerAi, /flanking continuation stopped: reason=/);

console.log("combat-log readability tests passed");
