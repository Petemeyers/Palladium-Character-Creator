import assert from "node:assert/strict";
import fs from "node:fs";

import { sanitizeCombatLogMessage } from "../src/utils/combatLogSanitizer.js";

const cases = [
  [
    "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Knight #1 is 5ft from Minotaur",
    "Knight #1 is 5ft from Minotaur.",
  ],
  [
    "Ã°Å¸Å’Â² Crowded conditions (4 nearby combatants)",
    "Crowded conditions: 4 nearby combatants.",
  ],
  [
    "ðŸŒ² Crowded conditions (4 nearby combatants)",
    "Crowded conditions: 4 nearby combatants.",
  ],
  [
    "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ Knight #1 will attack with Short Sword",
    "Knight #1 will attack with Short Sword.",
  ],
  [
    "ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â Knight #1 is 20ft from Minotaur (melee range: ÃƒÂ¢Ã¢â‚¬Â°Ã‚Â¤5ft)",
    "Knight #1 is 20ft from Minotaur (melee range: 5ft).",
  ],
];

for (const [input, expected] of cases) {
  const output = sanitizeCombatLogMessage(input);
  assert.equal(output, expected);
  assert.doesNotMatch(output, /ÃƒÆ’|Ã°Å¸|ðŸŒ²|Ã|Â|�/u);
}

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPage, /message: readableMessage/,
  "CombatPage queues the sanitized string rather than the raw input");

const initiativeTracker = fs.readFileSync(new URL("../src/components/InitiativeTracker.jsx", import.meta.url), "utf8");
assert.match(initiativeTracker, /event: sanitizeCombatLogMessage\(text\)/,
  "legacy persisted combat events use the same sanitizer boundary");

console.log("player-AI combat-log sanitizer coverage tests passed");
