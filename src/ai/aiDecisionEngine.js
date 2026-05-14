import { getAllSpellsFromDB } from "../data/combatSpells";
import psionics from "../data/psionics.json";
import { OCCS } from "../data/occData";
import { ACTION_TYPES, ACTION_COST, makeAction } from "./aiActionRegistry";
import { SKILL_ACTION_RULES } from "./aiSkillActions";
import { classifySpellForAi } from "./aiSpellActions";
import { scoreThreatTarget } from "./aiThreatAssessment";
import { getActiveAiUnlocks, hasAiUnlock } from "./aiUnlocks";
import { scoreAiAction } from "./aiScoring";
import {
  canTargetForAction,
  isAllyOf,
} from "../utils/factionDisposition.js";

const idOf = (x) => x?.id ?? x?._id ?? x?.name;

function getPosition(actor, world) {
  return actor?.position ?? world?.positions?.[idOf(actor)] ?? null;
}

export function normalizeSkillName(skill) {
  const raw = typeof skill === "string" ? skill : skill?.name ?? skill?.skillName ?? "";
  return String(raw)
    .replace(/\s*\([^)]+\)/g, "")
    .replace(/\s*\+\d+%/g, "")
    .trim();
}

function getActorOccData(actor) {
  const occName = actor?.occ || actor?.OCC || actor?.occName || actor?.className || actor?.class;
  return OCCS[occName] ?? null;
}

export function getAllActorSkills(actor) {
  const occData = getActorOccData(actor);

  const fromActor = [
    ...(actor?.occSkills ?? []),
    ...(actor?.electiveSkills ?? []),
    ...(actor?.secondarySkills ?? []),
    ...(actor?.skills ?? []),
  ];

  const fromOcc = occData
    ? [
        ...(occData.occSkills ?? []),
        ...(occData.electiveSkills?.list ?? []),
      ]
    : [];

  return [...new Set([...fromActor, ...fromOcc].map(normalizeSkillName).filter(Boolean))];
}

function actorHasSkill(actor, skillName) {
  const clean = normalizeSkillName(skillName);
  return getAllActorSkills(actor).includes(clean);
}

function actorHasSkillMatching(actor, matcher) {
  return getAllActorSkills(actor).some((skill) => matcher(skill.toLowerCase()));
}

function distanceBetween(a, b, world) {
  if (!a || !b) return Infinity;

  if (typeof world?.calculateDistance === "function") {
    try {
      const d = world.calculateDistance(a, b);
      if (Number.isFinite(Number(d))) return Number(d);
    } catch {
      // Fall through to coordinate distance.
    }
  }

  const dx = Number(a.x ?? a.q ?? 0) - Number(b.x ?? b.q ?? 0);
  const dy = Number(a.y ?? a.r ?? 0) - Number(b.y ?? b.r ?? 0);
  const dz = Number(a.z ?? 0) - Number(b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function isAlive(fighter) {
  if (!fighter) return false;
  if (fighter.isDead || fighter.dead) return false;
  return Number(fighter.currentHP ?? fighter.hp ?? fighter.HP ?? 1) > 0;
}

function getSceneContext(world) {
  return world?.sceneContext || { sceneType: "combat", relations: world?.relations || {} };
}

function getEnemies(actor, world) {
  const sceneContext = getSceneContext(world);
  return (world?.fighters ?? []).filter((f) => {
    if (idOf(f) === idOf(actor)) return false;
    if (!isAlive(f)) return false;
    return canTargetForAction(actor, f, "attack", sceneContext);
  });
}

function getAllies(actor, world) {
  const sceneContext = getSceneContext(world);
  return (world?.fighters ?? []).filter((f) => {
    if (idOf(f) === idOf(actor)) return false;
    if (!isAlive(f)) return false;
    return isAllyOf(actor, f, sceneContext);
  });
}

function canSee(actor, target, world) {
  const actorId = idOf(actor);
  const targetId = idOf(target);
  const visibilityMap = world?.visibilityByActorId ?? world?.visibleEnemiesByActorId;
  if (visibilityMap && Object.prototype.hasOwnProperty.call(visibilityMap, actorId)) {
    const visibleIds = visibilityMap[actorId] ?? [];
    return Array.isArray(visibleIds) && visibleIds.includes(targetId);
  }

  if (typeof world?.canAISeeTarget === "function") {
    try {
      const visible = world.canAISeeTarget(actor, target);
      if (typeof visible === "boolean") return visible;
    } catch {
      // Use range fallback below.
    }
  }

  const sightRange = actor?.sightRangeFt ?? actor?.sightRange ?? 60;
  return distanceBetween(getPosition(actor, world), getPosition(target, world), world) <= sightRange;
}

function getVisibleEnemies(actor, world) {
  return getEnemies(actor, world).filter((enemy) => canSee(actor, enemy, world));
}

function getCurrentPPE(actor, world) {
  if (typeof world?.getFighterPPE === "function") {
    try {
      return Number(world.getFighterPPE(actor));
    } catch {
      // Use actor fields below.
    }
  }
  return Number(actor?.currentPPE ?? actor?.ppe ?? actor?.PPE ?? 0);
}

function getCurrentISP(actor, world) {
  if (typeof world?.getFighterISP === "function") {
    try {
      return Number(world.getFighterISP(actor));
    } catch {
      // Use actor fields below.
    }
  }
  return Number(actor?.currentISP ?? actor?.isp ?? actor?.ISP ?? 0);
}

function hasEnoughPPE(actor, spell, world) {
  return getCurrentPPE(actor, world) >= Number(spell?.ppeCost ?? spell?.PPE ?? spell?.ppe ?? 0);
}

function hasEnoughISP(actor, power, world) {
  return getCurrentISP(actor, world) >= Number(power?.isp ?? power?.ISP ?? 0);
}

function estimateSpellHasDamage(spell) {
  const dmg = spell?.combatDamage ?? spell?.damage;
  return dmg && String(dmg).trim() !== "" && String(dmg).trim() !== "0";
}

function hpPercent(actor) {
  return Number(actor?.currentHP ?? actor?.hp ?? 0) /
    Math.max(1, Number(actor?.maxHP ?? actor?.maxHp ?? actor?.HP ?? 1));
}

function getActorSpellbook(actor, world) {
  if (typeof world?.getFighterSpells === "function") {
    try {
      const spells = world.getFighterSpells(actor);
      if (Array.isArray(spells)) return spells;
    } catch {
      // Fall through to actor data.
    }
  }

  const actorSpells = actor?.spellsKnown ?? actor?.spellbook ?? actor?.spells ?? actor?.magic;
  if (Array.isArray(actorSpells) && actorSpells.length) return actorSpells;

  return actor?.magicAbilities || actor?.isWizard || actor?.isMage ? getAllSpellsFromDB() : [];
}

function getActorPsionics(actor, world) {
  if (typeof world?.getFighterPsionicPowers === "function") {
    try {
      const powers = world.getFighterPsionicPowers(actor);
      if (Array.isArray(powers)) return powers;
    } catch {
      // Fall through to actor data.
    }
  }

  const known = actor?.psionicsKnown ?? actor?.psionicPowers ?? [];
  if (known.length && typeof known[0] === "object") return known;

  return psionics.filter((power) => known.includes(power.name) || actor?.isMindMage);
}

function buildAttackActions(actor, world) {
  const actions = [];
  const actorPos = getPosition(actor, world);
  const visibleEnemies = getVisibleEnemies(actor, world);

  for (const enemy of visibleEnemies) {
    const dist = distanceBetween(actorPos, getPosition(enemy, world), world);
    const meleeRange = actor?.meleeRangeFt ?? 5;
    const rangedRange = actor?.rangedRangeFt ?? actor?.weaponRangeFt ?? 60;
    const targetScore = scoreThreatTarget(actor, enemy, world);

    if (dist <= meleeRange) {
      actions.push(
        makeAction({
          type: ACTION_TYPES.MELEE_ATTACK,
          name: `Melee attack ${enemy.name}`,
          actorId: idOf(actor),
          targetId: idOf(enemy),
          cost: ACTION_COST.ATTACK,
          tags: ["combat", "damage", "melee"],
          baseScore: 50 + targetScore,
          reason: `Enemy is in melee range. Target priority: ${targetScore}.`,
        })
      );
    }

    const hasRangedOption =
      actor?.rangedWeapon ||
      actor?.equippedWeapons?.primary?.range ||
      actor?.equippedWeapons?.secondary?.range ||
      actorHasSkillMatching(actor, (skill) => skill.includes("w.p.") && (skill.includes("bow") || skill.includes("crossbow")));

    if (hasRangedOption && dist <= rangedRange) {
      actions.push(
        makeAction({
          type: ACTION_TYPES.RANGED_ATTACK,
          name: `Ranged attack ${enemy.name}`,
          actorId: idOf(actor),
          targetId: idOf(enemy),
          cost: ACTION_COST.ATTACK,
          tags: ["combat", "damage", "ranged"],
          baseScore: 45 + targetScore,
          reason: `Enemy is visible and in ranged weapon range. Target priority: ${targetScore}.`,
        })
      );
    }
  }

  return actions;
}

function buildSpellActions(actor, world) {
  const actions = [];
  const visibleEnemies = getVisibleEnemies(actor, world);
  const allies = getAllies(actor, world);
  const spells = getActorSpellbook(actor, world);

  for (const spell of spells) {
    if (!spell?.name || !hasEnoughPPE(actor, spell, world)) continue;

    const hasDamage = estimateSpellHasDamage(spell);
    const ruleMatches = classifySpellForAi(spell);

    if (hasDamage) {
      for (const enemy of visibleEnemies) {
        const targetScore = scoreThreatTarget(actor, enemy, world);
        actions.push(
          makeAction({
            type: ACTION_TYPES.CAST_SPELL,
            name: `Cast ${spell.name} on ${enemy.name}`,
            actorId: idOf(actor),
            targetId: idOf(enemy),
            cost: ACTION_COST.ATTACK,
            spell,
            tags: ["combat", "spell", "damage"],
            baseScore: 60 + targetScore,
            reason: `Damaging spell against visible enemy. Target priority: ${targetScore}.`,
          })
        );
      }
    }

    for (const rule of ruleMatches) {
      if (!spellContextMatches(rule, actor, world, visibleEnemies, allies)) continue;

      if (rule.tags.includes("healing")) {
        const woundedAllies = allies.filter((ally) => hpPercent(ally) < 0.45);
        const targets = hpPercent(actor) < 0.5 ? [actor, ...woundedAllies] : woundedAllies;

        for (const target of targets) {
          actions.push(
            makeAction({
              type: ACTION_TYPES.CAST_SPELL,
              name: `Cast ${spell.name} on ${idOf(target) === idOf(actor) ? "self" : "wounded ally"}`,
              actorId: idOf(actor),
              targetId: idOf(target),
              cost: ACTION_COST.ATTACK,
              spell,
              tags: rule.tags,
              baseScore: rule.baseScore,
              reason: "Healing spell matches a wounded target.",
            })
          );
        }

        continue;
      }

      if (rule.tags.includes("debuff") || rule.tags.includes("disable") || rule.tags.includes("mental")) {
        for (const enemy of visibleEnemies) {
          const targetScore = scoreThreatTarget(actor, enemy, world);
          actions.push(
            makeAction({
              type: ACTION_TYPES.CAST_SPELL,
              name: `Cast ${spell.name} on ${enemy.name}`,
              actorId: idOf(actor),
              targetId: idOf(enemy),
              cost: ACTION_COST.ATTACK,
              spell,
              tags: rule.tags,
              baseScore: rule.baseScore + targetScore,
              reason: `Non-damage spell can affect a visible enemy. Target priority: ${targetScore}.`,
            })
          );
        }

        continue;
      }

      actions.push(
        makeAction({
          type: ACTION_TYPES.CAST_SPELL,
          name: `Cast ${spell.name}`,
          actorId: idOf(actor),
          targetId: idOf(actor),
          cost: ACTION_COST.ATTACK,
          spell,
          tags: rule.tags,
          baseScore: rule.baseScore,
          reason: "Spell classification matches current tactical context.",
        })
      );
    }
  }

  return actions;
}

function spellContextMatches(rule, actor, world, visibleEnemies, allies) {
  const actorPos = getPosition(actor, world);
  const context = {
    selfThreatened: visibleEnemies.some(
      (enemy) => distanceBetween(actorPos, getPosition(enemy, world), world) <= 15
    ),
    lowHp: hpPercent(actor) < 0.45,
    visibleEnemy: visibleEnemies.length > 0,
    outnumbered: visibleEnemies.length > allies.length + 1,
    hasCover: Boolean(world?.coverByActorId?.[idOf(actor)] || world?.flags?.hasCover),
    woundedAllyNearby: allies.some((ally) => {
      return hpPercent(ally) < 0.5 && distanceBetween(actorPos, getPosition(ally, world), world) <= 15;
    }),
    selfWounded: hpPercent(actor) < 0.5,
    darkness: Boolean(world?.flags?.darkness || world?.environmentType === "darkness"),
    noVisibleEnemy: visibleEnemies.length === 0,
    hiddenEnemySuspected: Boolean(
      world?.flags?.suspectedAmbush ||
        world?.flags?.hiddenEnemySuspected ||
        (world?.hiddenActorIds ?? []).length
    ),
    magicEffectVisible: Boolean(world?.flags?.magicEffectVisible),
    needEscape: Boolean(world?.flags?.needEscape || actor?.moraleState?.status === "ROUTED"),
    chokePoint: Boolean(world?.flags?.chokePoint),
    protectAlly: actor?.aiGoal?.type === "PROTECT_ALLY",
    enemyMoraleWeak: Boolean(world?.flags?.enemyMoraleWeak),
    captureGoal: actor?.aiGoal?.type === "CAPTURE_TARGET",
  };

  return (rule.context ?? []).some((key) => context[key]);
}

function buildPsionicActions(actor, world) {
  const actions = [];
  const visibleEnemies = getVisibleEnemies(actor, world);
  const allies = getAllies(actor, world);
  const known = getActorPsionics(actor, world);

  for (const power of known) {
    if (!power?.name || !hasEnoughISP(actor, power, world)) continue;

    if (["ranged", "mental", "melee"].includes(power.attackType)) {
      for (const enemy of visibleEnemies) {
        actions.push(
          makeAction({
            type: ACTION_TYPES.USE_PSIONIC,
            name: `Use ${power.name} on ${enemy.name}`,
            actorId: idOf(actor),
            targetId: idOf(enemy),
            cost: ACTION_COST.ATTACK,
            psionic: power,
            tags: ["combat", "psionic", power.attackType, power.damage ? "damage" : "control"],
            baseScore: power.damage ? 58 : 48,
            reason: "Offensive psionic option.",
          })
        );
      }
    }

    if (["buff", "defense", "self"].includes(power.attackType)) {
      actions.push(
        makeAction({
          type: ACTION_TYPES.USE_PSIONIC,
          name: `Use ${power.name}`,
          actorId: idOf(actor),
          targetId: idOf(actor),
          cost: ACTION_COST.ATTACK,
          psionic: power,
          tags: ["buff", "defense", "psionic"],
          baseScore: 42,
          reason: "Self-buff or defense psionic option.",
        })
      );
    }

    if (power.attackType === "healing") {
      const woundedSelf = Number(actor.currentHP ?? 0) / Math.max(1, Number(actor.maxHP ?? actor.HP ?? 1)) < 0.5;

      if (woundedSelf) {
        actions.push(
          makeAction({
            type: ACTION_TYPES.USE_PSIONIC,
            name: `Use ${power.name} to recover`,
            actorId: idOf(actor),
            targetId: idOf(actor),
            cost: ACTION_COST.ATTACK,
            psionic: power,
            tags: ["healing", "psionic"],
            baseScore: 70,
            reason: "Actor is wounded.",
          })
        );
      }

      for (const ally of allies) {
        const hpPercent = Number(ally.currentHP ?? ally.hp ?? 0) /
          Math.max(1, Number(ally.maxHP ?? ally.maxHp ?? ally.HP ?? 1));
        if (hpPercent < 0.35) {
          actions.push(
            makeAction({
              type: ACTION_TYPES.USE_PSIONIC,
              name: `Use ${power.name} on ally`,
              actorId: idOf(actor),
              targetId: idOf(ally),
              cost: ACTION_COST.ATTACK,
              psionic: power,
              tags: ["healing", "support", "psionic"],
              baseScore: 75,
              reason: "Ally is critically wounded.",
            })
          );
        }
      }
    }

    if (["passive", "utility", "movement"].includes(power.attackType) && !visibleEnemies.length) {
      actions.push(
        makeAction({
          type: ACTION_TYPES.USE_PSIONIC,
          name: `Use ${power.name} for awareness or positioning`,
          actorId: idOf(actor),
          targetId: idOf(actor),
          cost: ACTION_COST.ATTACK,
          psionic: power,
          tags: ["utility", "search", "psionic"],
          baseScore: 30,
          reason: "No visible enemy; utility psionic may help.",
        })
      );
    }
  }

  return actions;
}

function contextMatches(rule, actor, world) {
  const visibleEnemies = getVisibleEnemies(actor, world);
  const actorPos = getPosition(actor, world);

  const context = {
    noVisibleEnemy: visibleEnemies.length === 0,
    lastKnownEnemy: Boolean(world?.lastKnownEnemyByActorId?.[idOf(actor)]),
    suspectedAmbush: Boolean(world?.flags?.suspectedAmbush),
    enteringDanger: Boolean(world?.flags?.enteringDanger),
    hasCover: Boolean(world?.coverByActorId?.[idOf(actor)] || world?.flags?.hasCover),
    notAdjacentToEnemy: !visibleEnemies.some(
      (enemy) => distanceBetween(actorPos, getPosition(enemy, world), world) <= (actor?.meleeRangeFt ?? 5)
    ),
    woundedAllyNearby: getAllies(actor, world).some((ally) => {
      const hpPercent = Number(ally.currentHP ?? ally.hp ?? 0) /
        Math.max(1, Number(ally.maxHP ?? ally.maxHp ?? ally.HP ?? 1));
      return hpPercent < 0.5 && distanceBetween(actorPos, getPosition(ally, world), world) <= 10;
    }),
    badlyWoundedAllyNearby: getAllies(actor, world).some((ally) => {
      const hpPercent = Number(ally.currentHP ?? ally.hp ?? 0) /
        Math.max(1, Number(ally.maxHP ?? ally.maxHp ?? ally.HP ?? 1));
      return hpPercent < 0.25 && distanceBetween(actorPos, getPosition(ally, world), world) <= 10;
    }),
    selfWounded: Number(actor?.currentHP ?? actor?.hp ?? 0) /
      Math.max(1, Number(actor?.maxHP ?? actor?.maxHp ?? actor?.HP ?? 1)) < 0.5,
    lockedDoorNearby: Boolean(world?.flags?.lockedDoorNearby),
    unknownMonsterVisible: Boolean(world?.flags?.unknownMonsterVisible),
    magicEffectVisible: Boolean(world?.flags?.magicEffectVisible),
    unknownSpellEffect: Boolean(world?.flags?.unknownSpellEffect),
    enemyWeaponVisible: visibleEnemies.length > 0,
    tracksNearby: Boolean(world?.flags?.tracksNearby),
    wilderness: world?.environmentType === "wilderness",
    lost: Boolean(world?.flags?.lost),
    dungeonExplore: world?.environmentType === "dungeon",
  };

  return (rule.context ?? []).some((key) => context[key]);
}

function getSkillPercent(actor, skillName) {
  const clean = normalizeSkillName(skillName);

  if (actor?.skillPercentByName?.[clean] != null) {
    return Number(actor.skillPercentByName[clean]);
  }

  const skillEntry = [
    ...(actor?.occSkills ?? []),
    ...(actor?.electiveSkills ?? []),
    ...(actor?.secondarySkills ?? []),
    ...(actor?.skills ?? []),
  ].find((skill) => normalizeSkillName(skill) === clean);
  const percentMatch = String(skillEntry?.name ?? skillEntry ?? "").match(/\+(\d+)%/);

  const iq = Number(actor?.attributes?.IQ ?? actor?.IQ ?? 10);
  const level = Number(actor?.level ?? 1);
  let base = 35 + level * 3 + (percentMatch ? Number(percentMatch[1]) : 0);

  if (clean.includes("Lore") || clean === "Research") base += Math.max(0, iq - 10) * 2;
  if (clean === "Prowl") base += Number(actor?.prowlBonus ?? 0);
  if (clean === "First Aid") base += 10;

  return Math.max(5, Math.min(98, base));
}

function buildSkillActions(actor, world) {
  const actions = [];
  const skills = getAllActorSkills(actor);

  for (const skill of skills) {
    const rule = SKILL_ACTION_RULES[skill];
    if (!rule || !actorHasSkill(actor, skill)) continue;
    if (!contextMatches(rule, actor, world)) continue;

    actions.push(
      makeAction({
        type: ACTION_TYPES.USE_SKILL,
        name: rule.actionName,
        actorId: idOf(actor),
        cost: ACTION_COST.FULL_ACTION,
        requiresRoll: true,
        rollType: rule.rollType,
        skillName: skill,
        tags: rule.tags,
        baseScore: 35,
        reason: `Skill ${skill} is relevant to current context.`,
        executePayload: {
          skillPercent: getSkillPercent(actor, skill),
          successEvent: rule.successEvent,
          failureEvent: rule.failureEvent,
        },
      })
    );
  }

  return actions;
}

function buildMovementActions(actor, world) {
  const actions = [];
  const actorPos = getPosition(actor, world);
  const visibleEnemies = getVisibleEnemies(actor, world);
  const lastKnown = world?.lastKnownEnemyByActorId?.[idOf(actor)];

  if (visibleEnemies.length) {
    const nearest = visibleEnemies
      .map((enemy) => ({
        enemy,
        distance: distanceBetween(actorPos, getPosition(enemy, world), world),
      }))
      .sort((a, b) => a.distance - b.distance)[0];

    if (nearest && nearest.distance > (actor?.meleeRangeFt ?? 5)) {
      actions.push(
        makeAction({
          type: ACTION_TYPES.MOVE_TO_TARGET,
          name: `Move toward ${nearest.enemy.name}`,
          actorId: idOf(actor),
          targetId: idOf(nearest.enemy),
          targetPos: getPosition(nearest.enemy, world),
          cost: ACTION_COST.MOVEMENT,
          tags: ["movement", "engage"],
          baseScore: 38,
          reason: "Enemy is visible but not in melee range.",
        })
      );
    }
  } else if (lastKnown) {
    actions.push(
      makeAction({
        type: ACTION_TYPES.HUNT_ENEMY,
        name: "Hunt toward last known enemy position",
        actorId: idOf(actor),
        targetPos: lastKnown.position ?? lastKnown,
        cost: ACTION_COST.MOVEMENT,
        tags: ["movement", "hunt", "search"],
        baseScore: 45,
        reason: "No visible enemy, but actor remembers last known enemy position.",
      })
    );
  } else {
    actions.push(
      makeAction({
        type: ACTION_TYPES.GUARD,
        name: "Guard and scan",
        actorId: idOf(actor),
        cost: ACTION_COST.FULL_ACTION,
        tags: ["defense", "search"],
        baseScore: 20,
        reason: "No target known.",
      })
    );
  }

  return actions;
}

function buildUnlockedActions(actor, world) {
  const actorId = idOf(actor);
  const round = world.round ?? 0;
  const activeUnlocks = getActiveAiUnlocks(world, actorId, round);
  const actions = [];
  const visibleEnemies = getVisibleEnemies(actor, world);
  const bestVisibleEnemy = visibleEnemies[0];

  if (hasAiUnlock(world, actorId, "AMBUSH_ATTACK", round) && bestVisibleEnemy) {
    actions.push(
      makeAction({
        type: ACTION_TYPES.AMBUSH_ATTACK,
        name: "Ambush attack from hiding",
        actorId,
        targetId: idOf(bestVisibleEnemy),
        cost: ACTION_COST.ATTACK,
        tags: ["combat", "damage", "stealth", "ambush"],
        baseScore: 90,
        reason: "Actor is hidden and has a temporary ambush opening.",
        executePayload: {
          unlockType: "AMBUSH_ATTACK",
        },
      })
    );
  }

  if (hasAiUnlock(world, actorId, "HUNT_REVEALED_ENEMY", round)) {
    const unlock = activeUnlocks.find((u) => u.type === "HUNT_REVEALED_ENEMY");
    const lastKnown = world?.lastKnownEnemyByActorId?.[actorId];
    const targetPos = unlock?.data?.position ?? lastKnown?.position ?? lastKnown;
    if (targetPos) {
      actions.push(
        makeAction({
          type: ACTION_TYPES.HUNT_REVEALED_ENEMY,
          name: "Hunt revealed enemy trail",
          actorId,
          targetId: unlock?.data?.targetId ?? lastKnown?.targetId ?? null,
          targetPos,
          cost: ACTION_COST.MOVEMENT,
          tags: ["movement", "hunt", "search"],
          baseScore: 70,
          reason: "A successful tracking roll revealed where to hunt next.",
          executePayload: {
            unlockType: "HUNT_REVEALED_ENEMY",
          },
        })
      );
    }
  }

  if (hasAiUnlock(world, actorId, "WARN_ALLIES", round)) {
    actions.push(
      makeAction({
        type: ACTION_TYPES.WARN_ALLIES,
        name: "Warn allies and guard",
        actorId,
        cost: ACTION_COST.FULL_ACTION,
        tags: ["defense", "support", "search"],
        baseScore: 55,
        reason: "Actor detected an ambush and can warn nearby allies.",
        executePayload: {
          unlockType: "WARN_ALLIES",
        },
      })
    );
  }

  return actions;
}

export function buildAiActionCandidates(actor, world = {}) {
  return [
    ...buildUnlockedActions(actor, world),
    ...buildAttackActions(actor, world),
    ...buildSpellActions(actor, world),
    ...buildPsionicActions(actor, world),
    ...buildSkillActions(actor, world),
    ...buildMovementActions(actor, world),
  ];
}

export function chooseAiAction(actor, world = {}) {
  const candidates = buildAiActionCandidates(actor, world);

  if (!candidates.length) {
    return makeAction({
      type: ACTION_TYPES.WAIT,
      name: "Wait",
      actorId: idOf(actor),
      cost: ACTION_COST.FULL_ACTION,
      reason: "No legal action candidates.",
    });
  }

  const scored = candidates
    .map((action) => ({
      action,
      score: scoreAiAction(action, actor, world),
    }))
    .sort((a, b) => b.score - a.score);

  return {
    ...scored[0].action,
    score: scored[0].score,
    alternatives: scored.slice(1, 4).map((x) => ({
      name: x.action.name,
      score: x.score,
      reason: x.action.reason,
    })),
  };
}

export const chooseBestAiAction = chooseAiAction;
