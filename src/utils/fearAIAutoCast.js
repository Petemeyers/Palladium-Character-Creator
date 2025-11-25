import { castCourage, castRemoveFear } from "./fearSpellSystem.js";
import { getHorrorFactor } from "./horrorFactorSystem.js";

function smartDecision(iq, difficulty = 10) {
  const roll = Math.floor(Math.random() * 20) + 1;
  return iq >= difficulty || roll <= iq / 2;
}

function getAlignmentBehavior(alignment = "") {
  const a = (alignment || "").toLowerCase();
  if (["principled", "scrupulous"].some((term) => a.includes(term))) {
    return { priority: "ally", riskTolerance: 3 };
  }
  if (["unprincipled", "aberrant"].some((term) => a.includes(term))) {
    return { priority: "self", riskTolerance: 2 };
  }
  if (a.includes("anarchist")) {
    return { priority: "random", riskTolerance: 2 };
  }
  if (["miscreant", "diabolic"].some((term) => a.includes(term))) {
    return { priority: "self", riskTolerance: 1 };
  }
  return { priority: "none", riskTolerance: 1 };
}

export function autoCastFearProtection(combatants, log = console.log) {
  if (!Array.isArray(combatants) || combatants.length === 0) return;

  const potentialCasters = combatants.filter((entity) =>
    ["cleric", "priest", "wizard", "paladin", "warlock"].some((term) =>
      (entity.occ || entity.class || "").toLowerCase().includes(term)
    )
  );

  potentialCasters.forEach((caster) => {
    if (!caster || !caster.alive) return;

    const iq =
      caster.attributes?.IQ || caster.attributes?.Iq || caster.IQ || 10;
    const { priority, riskTolerance } = getAlignmentBehavior(caster.alignment);

    const currentPPE =
      caster.currentPPE ??
      caster.PPE ??
      (typeof caster.ppe === "number" ? caster.ppe : 0);

    if (currentPPE <= 0) return;

    const allies = combatants.filter(
      (entity) =>
        entity &&
        entity.alive &&
        entity.type !== "enemy" &&
        entity.id !== caster.id
    );

    if (allies.length === 0) return;

    const fearfulAllies = allies.filter((ally) => {
      if (!ally.statusEffects || ally.statusEffects.length === 0) return false;
      return ally.statusEffects.some((effect) =>
        ["shaken", "hesitant", "fleeing"].includes(
          (effect.name || effect.type || "").toLowerCase()
        )
      );
    });

    if (fearfulAllies.length === 0) return;

    if (!smartDecision(iq, 10)) {
      log(
        `🤖 ${caster.name} hesitates (IQ ${iq}) and chooses not to intervene this round.`,
        "ai"
      );
      return;
    }

    let target = null;
    if (priority === "ally") {
      target = fearfulAllies.sort(
        (a, b) => (a.currentHP || a.hp || 0) - (b.currentHP || b.hp || 0)
      )[0];
    } else if (priority === "self") {
      target = caster;
    } else if (priority === "random") {
      target =
        Math.random() > 0.5
          ? fearfulAllies[Math.floor(Math.random() * fearfulAllies.length)]
          : caster;
    } else if (priority === "none") {
      log(
        `😈 ${caster.name} watches the fear unfold without lifting a finger.`,
        "ai"
      );
      return;
    }

    const horrorSource = combatants.find(
      (entity) => entity && getHorrorFactor(entity) > 0
    );
    const hf = horrorSource ? getHorrorFactor(horrorSource) : 14;
    const estimatedChance = iq + 10 - hf;

    if (
      priority === "self" &&
      estimatedChance < riskTolerance * 3 &&
      target === caster
    ) {
      log(
        `🤖 ${caster.name} judges the threat as overwhelming and conserves PPE.`,
        "ai"
      );
      return;
    }

    const terrifiedAlly = fearfulAllies.find((ally) =>
      ally.statusEffects.some(
        (effect) =>
          (effect.name || effect.type || "").toLowerCase() === "fleeing"
      )
    );

    if (
      terrifiedAlly &&
      currentPPE >= 10 &&
      smartDecision(iq, Math.max(8, hf - 2))
    ) {
      log(
        `🤖 ${caster.name} targets ${terrifiedAlly.name} with *Remove Fear*!`,
        "ai"
      );
      castRemoveFear(caster, terrifiedAlly, log);
      return;
    }

    if (
      fearfulAllies.length >= 2 &&
      currentPPE >= 6 &&
      priority !== "self" &&
      smartDecision(iq, hf - 3)
    ) {
      log(`🤖 ${caster.name} rallies the group with *Courage*!`, "ai");
      castCourage(caster, combatants, log);
      return;
    }

    if (
      target === caster &&
      currentPPE >= 10 &&
      caster.statusEffects?.some((effect) =>
        ["shaken", "hesitant", "fleeing"].includes(
          (effect.name || effect.type || "").toLowerCase()
        )
      )
    ) {
      log(
        `😶‍🌫️ ${caster.name} uses *Remove Fear* on themselves, putting self-preservation first.`,
        "ai"
      );
      castRemoveFear(caster, caster, log);
    }
  });
}
