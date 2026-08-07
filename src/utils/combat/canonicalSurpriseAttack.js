const professionText = (actor = {}) => String(actor.profession || actor.PROFESSION || "").toLowerCase();

export function resolveCanonicalSurpriseAttack({ actor = {}, eligible = false, alreadyUsed = false } = {}) {
  if (!eligible) return Object.freeze({ allowed: false, attackBonus: 0, damageMultiplier: 1, flatDamageBonus: 0, reason: "target-alert" });
  if (alreadyUsed) return Object.freeze({ allowed: false, attackBonus: 0, damageMultiplier: 1, flatDamageBonus: 0, reason: "already-used" });
  const trainedBackstabber = ["thief", "assassin", "ranger"].some((name) => professionText(actor).includes(name));
  return Object.freeze({
    allowed: true,
    attackBonus: trainedBackstabber ? 4 : 2,
    damageMultiplier: 2,
    flatDamageBonus: 0,
    reason: trainedBackstabber ? "trained-backstab" : "surprise",
  });
}

export default resolveCanonicalSurpriseAttack;
