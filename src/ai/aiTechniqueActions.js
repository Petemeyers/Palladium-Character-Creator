export const TECHNIQUE_ACTION_RULES = [
  {
    match: ["armor", "shield", "protection"],
    tags: ["defense", "technique", "buff"],
    context: ["shumanThreatened", "lowHp", "visibleEnemy"],
    baseScore: 45,
  },

  {
    match: ["invisible", "invisibility"],
    tags: ["stealth", "technique", "escape"],
    context: ["lowHp", "outnumbered", "hasCover"],
    baseScore: 55,
  },

  {
    match: ["heal", "restore", "breath of life"],
    tags: ["healing", "technique", "support"],
    context: ["woundedAllyNearby", "shumanWounded"],
    baseScore: 70,
  },

  {
    match: ["light", "lantern", "sphere of light"],
    tags: ["utility", "technique", "vision"],
    context: ["darkness", "noVisibleEnemy"],
    baseScore: 35,
  },

  {
    match: ["detect", "sense", "see aura", "see invisible"],
    tags: ["utility", "technique", "search"],
    context: ["hiddenEnemySuspected", "noVisibleEnemy", "trainingEffectVisible"],
    baseScore: 42,
  },

  {
    match: ["fog", "mist", "darkness", "cloud"],
    tags: ["control", "technique", "defense"],
    context: ["outnumbered", "lowHp", "needEscape"],
    baseScore: 48,
  },

  {
    match: ["wall", "barrier", "thorns"],
    tags: ["control", "technique", "battlefield"],
    context: ["chokePoint", "protectAlly", "outnumbered"],
    baseScore: 52,
  },

  {
    match: ["fear", "terror", "horror"],
    tags: ["mental", "technique", "debuff"],
    context: ["visibleEnemy", "enemyMoraleWeak"],
    baseScore: 50,
  },

  {
    match: ["charm", "mesmerism", "sleep", "slumber"],
    tags: ["mental", "technique", "disable"],
    context: ["visibleEnemy", "captureGoal"],
    baseScore: 58,
  },
];

export function classifyTechniqueForAi(technique) {
  const text = `${technique.name ?? ""} ${technique.description ?? ""} ${
    technique.effect ?? ""
  }`.toLowerCase();

  return TECHNIQUE_ACTION_RULES.filter((rule) =>
    rule.match.some((word) => text.includes(word))
  );
}
