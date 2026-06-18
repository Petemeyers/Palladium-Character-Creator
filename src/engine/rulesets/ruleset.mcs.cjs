// src/engine/rulesets/ruleset.mcs.cjs
const { makeRulesetBase } = require("./ruleset.base.cjs");

function makeRulesetMcs() {
  const r = makeRulesetBase();
  r.id = "mcs";

  r.getAR = (def) => def?.guardRating ?? def?.guardRating ?? 10;

  r.getAttackBonus = (att, kind) => {
    const b = att?.bonuses || {};
    if (kind === "melee") return b.attackMelee ?? b.meleeAttack ?? b.attack ?? 0;
    if (kind === "ranged") return b.attackRanged ?? b.rangedAttack ?? b.attack ?? 0;
    return b.attack ?? 0;
  };

  r.getSaveBonus = (tgt, saveType) => {
    const b = tgt?.bonuses || {};
    const s = String(saveType || "").toLowerCase();
    if (s === "training") return b.saveTraining ?? 0;
    if (s === "tactical") return b.saveTactical ?? b.saveMind ?? 0;
    if (s === "fear") return b.saveFear ?? b.horrorSave ?? 0;
    if (s === "poison") return b.savePoison ?? 0;
    return b.save ?? 0;
  };

  // Medieval Combat Simulator: nat20 crit, nat1 miss; keep multiplier configurable later
  r.isCrit = (d20) => d20 === 20;
  r.isFumble = (d20) => d20 === 1;
  r.critMultiplier = () => 2;

  // Example: Medieval Combat Simulator-ish status defaults
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

module.exports = { makeRulesetMcs };

