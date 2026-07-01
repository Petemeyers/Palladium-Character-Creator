import assert from "node:assert/strict";
import fs from "node:fs";

import { getPlayerAiProfessionText } from "../src/utils/playerAiProfileText.js";
import { awaitPlayerAiTurnResult } from "../src/utils/playerAiTurnResult.js";

const playerAiSource = fs.readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
assert.equal(/\boccText\b/.test(playerAiSource), false,
  "player AI contains no undeclared occText reference");
assert.match(playerAiSource, /getPlayerAiProfessionText\(fighter\)/,
  "profession-based player AI uses the safe profile helper");

const spearman = { id: "party-spearman", name: "Spearman", role: "Spearman" };
assert.equal(getPlayerAiProfessionText(spearman), "spearman",
  "basic Spearman profile resolves safely");
assert.equal(getPlayerAiProfessionText({ name: "Unclassified Fighter" }), "",
  "missing profession fields resolve to neutral text without throwing");

const healer = {
  OCC: "Field Priest",
  occupation: "Temple Healer",
  className: "Clergy",
  archetype: "Support",
};
const healerText = getPlayerAiProfessionText(healer);
assert.match(healerText, /field priest/);
assert.match(healerText, /temple healer/);
assert.match(healerText, /clergy/);
assert.match(healerText, /support/);

const result = await awaitPlayerAiTurnResult(
  async () => {
    getPlayerAiProfessionText(spearman);
    return { actionTaken: true, action: "move" };
  },
  () => false,
);
assert.equal(result.summary, "move");
assert.notEqual(result.summary, "failed");

console.log("player AI profession-text tests passed");
