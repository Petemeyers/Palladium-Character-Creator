import {
  applyHPToFighter,
  clampHP,
  getFighterHP,
} from "./canonicalHpAuthority.js";

export function applyCanonicalLocalHealing({
  fighter,
  amount,
  source = "healing",
  stabilize = (candidate) => candidate,
  updateStatus = true,
  authorities = {},
} = {}) {
  if (!fighter?.id) {
    return { accepted: false, reason: "stable-target-id-required", fighter, mutationCount: 0 };
  }
  const readHP = authorities.getFighterHP || getFighterHP;
  const clamp = authorities.clampHP || clampHP;
  const applyHP = authorities.applyHPToFighter || applyHPToFighter;
  const previousHP = readHP(fighter);
  const requestedAmount = Math.max(0, Number(amount) || 0);
  const nextHP = clamp(previousHP + requestedAmount, fighter);
  const candidate = nextHP > 0
    ? stabilize({ ...fighter }, source)
    : { ...fighter };
  applyHP(candidate, nextHP, { updateStatus });
  if (nextHP > 0) {
    candidate.condition = "conscious";
    candidate.remainingActions = Number(fighter.remainingActions ?? 0) || 0;
  }
  return {
    accepted: true,
    reason: "canonical-local-healing-applied",
    fighter: candidate,
    fighterId: String(fighter.id),
    source,
    requestedAmount,
    previousHP,
    nextHP,
    appliedAmount: Math.max(0, nextHP - previousHP),
    mutationCount: 1,
  };
}

export default applyCanonicalLocalHealing;
