// src/engine/rulesets/ruleset.palladium.cjs
const { makeRulesetBase } = require("./ruleset.base.cjs");

function makeRulesetPalladium() {
  const r = makeRulesetBase();
  r.id = "palladium";

  r.getAR = (def) => def?.AR ?? def?.armorRating ?? 10;

  r.getStrikeBonus = (att, kind) => {
    const b = att?.bonuses || {};
    if (kind === "melee") return b.strikeMelee ?? b.meleeStrike ?? b.strike ?? 0;
    if (kind === "ranged") return b.strikeRanged ?? b.rangedStrike ?? b.strike ?? 0;
    return b.strike ?? 0;
  };

  r.getSaveBonus = (tgt, saveType) => {
    const b = tgt?.bonuses || {};
    const s = String(saveType || "").toLowerCase();
    if (s === "magic") return b.saveMagic ?? 0;
    if (s === "psionic") return b.savePsionic ?? b.saveMind ?? 0;
    if (s === "fear") return b.saveFear ?? b.horrorSave ?? 0;
    if (s === "poison") return b.savePoison ?? 0;
    return b.save ?? 0;
  };

  // Palladium: nat20 crit, nat1 miss; keep multiplier configurable later
  r.isCrit = (d20) => d20 === 20;
  r.isFumble = (d20) => d20 === 1;
  r.critMultiplier = () => 2;

  // Example: Palladium-ish status defaults
  r.getStatusRule = (key) => {
    const k = String(key || "");
    if (k === "Paralyzed" || k === "Stunned")
      return { unique: true, stacking: "refresh", maxStacks: 1, blocks: { move: true, act: true } };
    if (k === "Poisoned")
      return { unique: true, stacking: "stack", maxStacks: 5, tickDamage: "1d6", tickEvery: 1 };
    return { unique: true, stacking: "refresh", maxStacks: 1 };
  };

  return r;
}

module.exports = { makeRulesetPalladium };

