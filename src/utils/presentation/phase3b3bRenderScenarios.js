import { getCanonicalCombatActorDefinition } from "../../data/canonicalCombatActors.js";
import { getAlignmentDisplayName } from "../behavior/normalizeAlignmentBehavior.js";
import { getCombatDisplayLabel } from "./getCombatDisplayLabel.js";

export function buildPhase3B3BRenderScenarios() {
  return ["knight", "goblin-warrior", "minotaur"].map((actorKey) => {
    const actor = getCanonicalCombatActorDefinition(actorKey);
    return {
      actorKey,
      actorName: actor.name,
      alignment: getAlignmentDisplayName(actor.alignment),
      weapons: actor.weaponProfiles.map((weapon) => getCombatDisplayLabel(weapon)),
      equipment: actor.equipment.map((item) => getCombatDisplayLabel(item)),
    };
  });
}

export default buildPhase3B3BRenderScenarios;
