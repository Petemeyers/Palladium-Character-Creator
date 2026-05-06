import { HUMAN_MORPH_KEYS } from "../../data/visuals/humanMorphConfig";

export function applyHumanMorphTargets(model, visualProfile) {
  if (!model || !visualProfile?.morphs) return;

  const allMorphKeys = Object.values(HUMAN_MORPH_KEYS).reduce(
    (accumulator, group) => ({
      ...accumulator,
      ...group,
    }),
    {}
  );

  model.traverse((obj) => {
    if (!obj.morphTargetDictionary || !obj.morphTargetInfluences) return;

    for (const [logicalKey, morphName] of Object.entries(allMorphKeys)) {
      const index = obj.morphTargetDictionary[morphName];
      if (index == null) continue;
      obj.morphTargetInfluences[index] = visualProfile.morphs[logicalKey] ?? 0;
    }
  });
}

