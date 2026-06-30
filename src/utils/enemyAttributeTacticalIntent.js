const DEFAULT_ATTRIBUTE = 10;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const firstFinite = (...values) => {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
};

const getAttribute = (actor, name) => {
  const lower = name.toLowerCase();
  const upperFirst = `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
  return firstFinite(
    actor?.originalActorMetadata?.attributes?.[lower],
    actor?.originalActorMetadata?.attributes?.[upperFirst],
    actor?.attributes?.[lower],
    actor?.attributes?.[upperFirst],
    actor?.stats?.[lower],
    actor?.stats?.[upperFirst],
    actor?.[lower],
    actor?.[upperFirst],
  ) ?? DEFAULT_ATTRIBUTE;
};

export const scoreToMod = (value) => Math.floor((Number(value ?? DEFAULT_ATTRIBUTE) - 10) / 2);

const hasTag = (actor, tag) => (
  (actor?.tags || []).some((entry) => String(entry).toLowerCase() === tag) ||
  String(actor?.aiRole || "").toLowerCase() === tag
);

const isWounded = (actor, movementContext) => {
  if (movementContext?.wounded !== undefined) return Boolean(movementContext.wounded);
  const hp = firstFinite(actor?.currentHP, actor?.HP, actor?.hp);
  const maxHp = firstFinite(actor?.maxHP, actor?.maxHp, actor?.derivedStats?.maxHp);
  return Number.isFinite(hp) && Number.isFinite(maxHp) && maxHp > 0 && hp <= maxHp * 0.5;
};

export function decideEnemyTacticalIntent({
  actor = {},
  target = null,
  distanceFt = Infinity,
  meleeRangeFt = 5,
  allies = [],
  enemies = [],
  battlefield = {},
  movementContext = {},
} = {}) {
  const hasAttackOption = movementContext.hasAttackOption !== false;
  const inAttackRange = movementContext.inAttackRange === true ||
    (Number.isFinite(Number(distanceFt)) && Number(distanceFt) <= Number(meleeRangeFt || 5));
  if (inAttackRange && hasAttackOption) {
    return {
      intent: "attack",
      confidence: 1,
      advanceScore: 0,
      holdScore: 0,
      flankScore: 0,
      reasons: ["target already in attack range"],
    };
  }

  const resolveMod = scoreToMod(getAttribute(actor, "resolve"));
  const disciplineMod = scoreToMod(getAttribute(actor, "discipline"));
  const mobilityMod = scoreToMod(getAttribute(actor, "mobility"));
  const awarenessMod = scoreToMod(getAttribute(actor, "awareness"));
  const cunningMod = scoreToMod(getAttribute(actor, "cunning"));
  const presenceMod = scoreToMod(getAttribute(actor, "presence"));
  const vigorMod = scoreToMod(getAttribute(actor, "vigor"));
  const enduranceMod = scoreToMod(getAttribute(actor, "endurance"));
  const mightMod = scoreToMod(getAttribute(actor, "might"));

  const wounded = isWounded(actor, movementContext);
  const allyCount = (allies || []).filter(Boolean).length + 1;
  const enemyCount = (enemies || []).filter(Boolean).length;
  const outnumbered = movementContext.outnumbered === true || enemyCount > allyCount;
  const dangerousApproach = movementContext.dangerousApproach === true ||
    battlefield.dangerousApproach === true;
  const defensiveContext = movementContext.defensive === true ||
    ["defensive", "guard"].includes(String(actor?.aiRole || "").toLowerCase());
  const pressured = movementContext.pressured === true || battlefield.pressured === true;
  const allyEngaged = movementContext.allyEngaged === true || battlefield.allyEngaged === true;
  const brute = hasTag(actor, "brute") || hasTag(actor, "mythic") || hasTag(actor, "giant");

  const allySupportBonus = allyCount > enemyCount && enemyCount > 0 ? 1 : 0;
  const woundedPenalty = wounded ? 2 : 0;
  const outnumberedPenalty = outnumbered ? 2 : 0;
  const dangerousApproachPenalty = dangerousApproach ? 2 : 0;
  const defensiveContextBonus = defensiveContext ? 2 : 0;
  const pressuredPenalty = pressured ? 2 : 0;
  const allyEngagementBonus = allyEngaged ? 2 : 0;

  const advanceScore = resolveMod + mobilityMod + vigorMod + presenceMod +
    Math.max(0, enduranceMod) + (brute ? mightMod : Math.max(0, mightMod - 2)) +
    allySupportBonus - woundedPenalty - outnumberedPenalty - dangerousApproachPenalty;
  const holdScore = disciplineMod + awarenessMod + cunningMod + defensiveContextBonus +
    woundedPenalty + outnumberedPenalty - pressuredPenalty;
  const flankScore = cunningMod + mobilityMod + awarenessMod + allyEngagementBonus;

  let intent;
  const reasons = [];
  if (resolveMod <= -2 && wounded && outnumbered) {
    intent = "hesitate";
    reasons.push("low Resolve while wounded and outnumbered");
  } else if (flankScore >= advanceScore && flankScore >= holdScore + 1) {
    intent = "flank";
    reasons.push("Cunning and Mobility favor a flanking approach");
  } else if (advanceScore >= holdScore + 2) {
    intent = "advance";
    reasons.push(brute
      ? "Might, Presence, and Resolve favor pressing forward"
      : "Resolve and Mobility favor a steady advance");
  } else if (advanceScore >= holdScore) {
    intent = "cautious_advance";
    reasons.push("advance and caution are closely balanced");
  } else {
    intent = "hold";
    reasons.push(defensiveContext
      ? "Discipline favors the defensive posture"
      : "Awareness and caution outweigh advance pressure");
  }

  if (wounded && !reasons.some((reason) => reason.includes("wounded"))) reasons.push("wounded");
  if (outnumbered && !reasons.some((reason) => reason.includes("outnumbered"))) reasons.push("outnumbered");
  if (dangerousApproach) reasons.push("approach appears dangerous");
  if (target?.name) reasons.push(`facing ${target.name}`);

  const chosenScore = intent === "flank" ? flankScore : intent === "advance" || intent === "cautious_advance"
    ? advanceScore
    : holdScore;
  const alternatives = [advanceScore, holdScore, flankScore].filter((score) => score !== chosenScore);
  const margin = alternatives.length ? chosenScore - Math.max(...alternatives) : 0;

  return {
    intent,
    confidence: Number(clamp(0.55 + margin * 0.08, 0.1, 1).toFixed(2)),
    advanceScore,
    holdScore,
    flankScore,
    reasons,
  };
}

export function decideEnemyTacticalIntentSafely(input, onError) {
  try {
    return decideEnemyTacticalIntent(input);
  } catch (error) {
    onError?.(error);
    return {
      intent: "advance",
      confidence: 0,
      advanceScore: 0,
      holdScore: 0,
      flankScore: 0,
      reasons: ["intent fallback"],
    };
  }
}

export default decideEnemyTacticalIntent;
