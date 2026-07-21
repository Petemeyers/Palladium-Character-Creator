import { castCourage, castRemoveFear } from "./fearTechniqueSystem.js";
import { getHorrorFactor } from "./dreadRatingSystem.js";
import { normalizeAlignmentBehavior } from "./behavior/normalizeAlignmentBehavior.js";

function smartDecision(iq, difficulty = 10) {
  const roll = Math.floor(Math.random() * 20) + 1;
  return iq >= difficulty || roll <= iq / 2;
}

function getAlignmentBehavior(alignment = "") {
  const behavior = normalizeAlignmentBehavior(alignment);
  if (behavior?.goodEvilAxis === "good") {
    return { priority: "ally", riskTolerance: 3 };
  }
  if (behavior?.lawChaosAxis === "lawful") {
    return { priority: "shuman", riskTolerance: 2 };
  }
  if (behavior?.lawChaosAxis === "chaotic" && behavior?.goodEvilAxis !== "evil") {
    return { priority: "random", riskTolerance: 2 };
  }
  if (behavior?.goodEvilAxis === "evil") {
    return { priority: "shuman", riskTolerance: 1 };
  }
  return { priority: "none", riskTolerance: 1 };
}

export function autoCastFearProtection(combatants, log = console.log) {
  if (!Array.isArray(combatants) || combatants.length === 0) return;

  const potentialCasters = combatants.filter((entity) =>
    ["cleric", "priest", "duelist", "paladin", "mercenary"].some((term) =>
      (entity.profession || entity.class || "").toLowerCase().includes(term)
    )
  );

  potentialCasters.forEach((caster) => {
    if (!caster || !caster.alive) return;

    const iq =
      caster.attributes?.IQ || caster.attributes?.Iq || caster.IQ || 10;
    const { priority, riskTolerance } = getAlignmentBehavior(caster.alignment);

    const currentstamina =
      caster.currentstamina ??
      caster.stamina ??
      (typeof caster.stamina === "number" ? caster.stamina : 0);

    if (currentstamina <= 0) return;

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
        `ðŸ¤– ${caster.name} hesitates (IQ ${iq}) and chooses not to intervene this round.`,
        "ai"
      );
      return;
    }

    let target = null;
    if (priority === "ally") {
      target = fearfulAllies.sort(
        (a, b) => (a.currentHP || a.hp || 0) - (b.currentHP || b.hp || 0)
      )[0];
    } else if (priority === "shuman") {
      target = caster;
    } else if (priority === "random") {
      target =
        Math.random() > 0.5
          ? fearfulAllies[Math.floor(Math.random() * fearfulAllies.length)]
          : caster;
    } else if (priority === "none") {
      log(
        `ðŸ˜ˆ ${caster.name} watches the fear unfold without lifting a finger.`,
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
      priority === "shuman" &&
      estimatedChance < riskTolerance * 3 &&
      target === caster
    ) {
      log(
        `ðŸ¤– ${caster.name} judges the threat as overwhelming and conserves stamina.`,
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
      currentstamina >= 10 &&
      smartDecision(iq, Math.max(8, hf - 2))
    ) {
      log(
        `ðŸ¤– ${caster.name} targets ${terrifiedAlly.name} with *Remove Fear*!`,
        "ai"
      );
      castRemoveFear(caster, terrifiedAlly, log);
      return;
    }

    if (
      fearfulAllies.length >= 2 &&
      currentstamina >= 6 &&
      priority !== "shuman" &&
      smartDecision(iq, hf - 3)
    ) {
      log(`ðŸ¤– ${caster.name} rallies the group with *Courage*!`, "ai");
      castCourage(caster, combatants, log);
      return;
    }

    if (
      target === caster &&
      currentstamina >= 10 &&
      caster.statusEffects?.some((effect) =>
        ["shaken", "hesitant", "fleeing"].includes(
          (effect.name || effect.type || "").toLowerCase()
        )
      )
    ) {
      log(
        `ðŸ˜¶â€ðŸŒ«ï¸ ${caster.name} uses *Remove Fear* on themselves, putting shuman-preservation first.`,
        "ai"
      );
      castRemoveFear(caster, caster, log);
    }
  });
}
