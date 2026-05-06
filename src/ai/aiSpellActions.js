export const SPELL_ACTION_RULES = [
  {
    match: ["armor", "shield", "protection"],
    tags: ["defense", "spell", "buff"],
    context: ["selfThreatened", "lowHp", "visibleEnemy"],
    baseScore: 45,
  },

  {
    match: ["invisible", "invisibility"],
    tags: ["stealth", "spell", "escape"],
    context: ["lowHp", "outnumbered", "hasCover"],
    baseScore: 55,
  },

  {
    match: ["heal", "restore", "breath of life"],
    tags: ["healing", "spell", "support"],
    context: ["woundedAllyNearby", "selfWounded"],
    baseScore: 70,
  },

  {
    match: ["light", "lantern", "sphere of light"],
    tags: ["utility", "spell", "vision"],
    context: ["darkness", "noVisibleEnemy"],
    baseScore: 35,
  },

  {
    match: ["detect", "sense", "see aura", "see invisible"],
    tags: ["utility", "spell", "search"],
    context: ["hiddenEnemySuspected", "noVisibleEnemy", "magicEffectVisible"],
    baseScore: 42,
  },

  {
    match: ["fog", "mist", "darkness", "cloud"],
    tags: ["control", "spell", "defense"],
    context: ["outnumbered", "lowHp", "needEscape"],
    baseScore: 48,
  },

  {
    match: ["wall", "barrier", "thorns"],
    tags: ["control", "spell", "battlefield"],
    context: ["chokePoint", "protectAlly", "outnumbered"],
    baseScore: 52,
  },

  {
    match: ["fear", "terror", "horror"],
    tags: ["mental", "spell", "debuff"],
    context: ["visibleEnemy", "enemyMoraleWeak"],
    baseScore: 50,
  },

  {
    match: ["charm", "mesmerism", "sleep", "slumber"],
    tags: ["mental", "spell", "disable"],
    context: ["visibleEnemy", "captureGoal"],
    baseScore: 58,
  },
];

export function classifySpellForAi(spell) {
  const text = `${spell.name ?? ""} ${spell.description ?? ""} ${
    spell.effect ?? ""
  }`.toLowerCase();

  return SPELL_ACTION_RULES.filter((rule) =>
    rule.match.some((word) => text.includes(word))
  );
}
