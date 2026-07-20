import {
  isLongswordWeapon,
  normalizeArmorProfile,
} from "../combat/weaponArmorProfiles.js";
import { selectWeightedCandidate } from "./weightedCombatSelection.js";

export const ARMORED_TECHNIQUES = Object.freeze({
  LONGSWORD_CUT: "longsword-cut",
  LONGSWORD_THRUST: "longsword-thrust",
  HALF_SWORD_THRUST: "half-sword-thrust",
  POMMEL_OR_CROSSGUARD: "pommel-or-crossguard-strike",
  GRAPPLE: "grapple",
  DAGGER_GAP_ATTACK: "dagger-gap-attack",
  DISENGAGE: "disengage",
  PASS: "pass",
});

export const ARMORED_TECHNIQUE_BASE_WEIGHTS = Object.freeze({
  unconfirmed: Object.freeze({
    [ARMORED_TECHNIQUES.LONGSWORD_CUT]: 35,
    [ARMORED_TECHNIQUES.LONGSWORD_THRUST]: 20,
    [ARMORED_TECHNIQUES.HALF_SWORD_THRUST]: 20,
    [ARMORED_TECHNIQUES.POMMEL_OR_CROSSGUARD]: 10,
    [ARMORED_TECHNIQUES.GRAPPLE]: 15,
  }),
  oneIneffectiveCut: Object.freeze({
    [ARMORED_TECHNIQUES.LONGSWORD_CUT]: 5,
    [ARMORED_TECHNIQUES.LONGSWORD_THRUST]: 15,
    [ARMORED_TECHNIQUES.HALF_SWORD_THRUST]: 40,
    [ARMORED_TECHNIQUES.POMMEL_OR_CROSSGUARD]: 15,
    [ARMORED_TECHNIQUES.GRAPPLE]: 25,
  }),
  repeatedIneffectiveCuts: Object.freeze({
    [ARMORED_TECHNIQUES.LONGSWORD_CUT]: 0,
    [ARMORED_TECHNIQUES.LONGSWORD_THRUST]: 10,
    [ARMORED_TECHNIQUES.HALF_SWORD_THRUST]: 40,
    [ARMORED_TECHNIQUES.POMMEL_OR_CROSSGUARD]: 20,
    [ARMORED_TECHNIQUES.GRAPPLE]: 30,
  }),
});

function hasDagger(actor = {}) {
  const pools = [actor.inventory, actor.weapons, actor.equipment, actor.clinchWeapons].filter(Array.isArray);
  return pools.flat().some((item) => String(item?.name || item || "").toLowerCase().includes("dagger"));
}

function getWeightBand(memory = {}) {
  const stoppedCuts = Number(memory.ineffectiveCutContacts || 0);
  if (stoppedCuts >= 2) return "repeatedIneffectiveCuts";
  if (stoppedCuts >= 1) return "oneIneffectiveCut";
  return "unconfirmed";
}

function weightedChoice(candidates, rng) {
  const result = selectWeightedCandidate({
    candidates: candidates.map((candidate) => ({
      ...candidate,
      id: candidate.technique,
      weight: candidate.score,
      rejected: candidate.score <= 0,
    })),
    rng,
  });
  if (!result.candidate) return { selected: null, totalScore: 0, roll: null, ranges: result.cumulativeRanges || [] };
  const selected = result.candidate;
  return {
    selected: {
      ...selected,
      rngChoice: result.normalizedDraw,
      roll: result.draw,
      cumulativeRange: {
        start: result.cumulativeStart,
        end: result.cumulativeEnd,
      },
    },
    totalScore: result.totalWeight,
    roll: result.draw,
    ranges: result.cumulativeRanges.map((range) => ({
      technique: range.id,
      start: range.start,
      end: range.end,
      score: range.weight,
    })),
  };
}

export function buildArmoredTechniqueAttack(weapon = {}, selectedTechnique) {
  const base = { ...(weapon || {}) };
  const sourceWeaponName = base.originalWeaponName || base.weaponName || base.name || "Long Sword";
  const withSourceIdentity = {
    sourceWeapon: weapon,
    sourceWeaponName,
    sourceWeaponId: base.id || base.weaponId || base.key || sourceWeaponName,
    sourceWeaponProfileKey: base.profileKey || base.armorProfileKey || base.weaponProfileKey || null,
  };
  if (selectedTechnique === ARMORED_TECHNIQUES.HALF_SWORD_THRUST) {
    return {
      ...base,
      ...withSourceIdentity,
      name: "Half-Sword Thrust",
      originalWeaponName: sourceWeaponName,
      damageType: "piercing",
      attackMode: ARMORED_TECHNIQUES.HALF_SWORD_THRUST,
      selectedTechnique,
      armorTechnique: selectedTechnique,
      gapCapable: true,
      reach: 5,
      range: Math.min(Number(base.range || base.reach || 5) || 5, 5),
    };
  }
  if (selectedTechnique === ARMORED_TECHNIQUES.LONGSWORD_THRUST) {
    return {
      ...base,
      ...withSourceIdentity,
      name: base.name === "Long Sword" ? "Longsword Thrust" : `${sourceWeaponName} Thrust`,
      originalWeaponName: sourceWeaponName,
      damageType: "piercing",
      attackMode: ARMORED_TECHNIQUES.LONGSWORD_THRUST,
      selectedTechnique,
      armorTechnique: selectedTechnique,
    };
  }
  if (selectedTechnique === ARMORED_TECHNIQUES.POMMEL_OR_CROSSGUARD) {
    return {
      ...base,
      ...withSourceIdentity,
      name: "Pommel Strike",
      originalWeaponName: sourceWeaponName,
      damage: base.pommelDamage || "1d4",
      damageType: "blunt",
      attackMode: ARMORED_TECHNIQUES.POMMEL_OR_CROSSGUARD,
      selectedTechnique,
      armorTechnique: selectedTechnique,
      mayStagger: true,
      mayKnockDown: true,
      reach: 5,
      range: Math.min(Number(base.range || base.reach || 5) || 5, 5),
    };
  }
  if (selectedTechnique === ARMORED_TECHNIQUES.LONGSWORD_CUT) {
    return {
      ...base,
      ...withSourceIdentity,
      attackMode: ARMORED_TECHNIQUES.LONGSWORD_CUT,
      selectedTechnique,
      armorTechnique: selectedTechnique,
    };
  }
  return { ...base, ...withSourceIdentity, selectedTechnique, armorTechnique: selectedTechnique };
}

export function selectArmoredCombatTechnique({
  attacker,
  defender,
  weapon,
  distance = 5,
  tacticalMemory = {},
  rng,
} = {}) {
  const armor = normalizeArmorProfile(defender);
  const rejectedCandidates = [];
  const reasons = [];
  const closeEnough = Number(distance) <= 6;
  const weaponSupports = isLongswordWeapon(weapon) || isLongswordWeapon(attacker?.selectedAttack);

  if (armor?.armorClass !== "plate" || armor?.rigidCoverage !== true) {
    return {
      selectedTechnique: null,
      selectedWeapon: weapon,
      score: 0,
      candidates: [],
      rejectedCandidates: [{ technique: "armored-technique", reason: "defender-not-rigid-plate" }],
      reasons: ["defender-not-rigid-plate"],
    };
  }
  if (!closeEnough) {
    return {
      selectedTechnique: null,
      selectedWeapon: weapon,
      score: 0,
      candidates: [],
      rejectedCandidates: [{ technique: "armored-technique", reason: "not-close-combat-range" }],
      reasons: ["not-close-combat-range"],
    };
  }
  if (!weaponSupports) {
    return {
      selectedTechnique: null,
      selectedWeapon: weapon,
      score: 0,
      candidates: [],
      rejectedCandidates: [{ technique: "armored-technique", reason: "weapon-does-not-support-armored-techniques" }],
      reasons: ["weapon-does-not-support-armored-techniques"],
    };
  }

  const band = getWeightBand(tacticalMemory);
  const base = ARMORED_TECHNIQUE_BASE_WEIGHTS[band];
  const targetVulnerable = Boolean(
    defender?.condition === "prone" ||
    defender?.condition === "stunned" ||
    defender?.statusEffects?.includes?.("OFF_BALANCE") ||
    defender?.statusEffects?.includes?.("STAGGERED") ||
    defender?.fatigueState?.status === "exhausted"
  );
  const dagger = hasDagger(attacker);
  const stoppedCuts = Number(tacticalMemory.ineffectiveCutContacts || 0);
  const failedGaps = Number(tacticalMemory.failedGapAttempts || 0);
  const successfulGaps = Number(tacticalMemory.successfulGapHits || 0);
  const lastTechnique = tacticalMemory.lastTechnique;
  const repeatCount = Number(tacticalMemory.repeatTechniqueCount || tacticalMemory.consecutiveTechniqueSelections || 0);

  const candidates = Object.entries(base).map(([technique, score]) => {
    const reasonsForCandidate = [];
    let adjusted = score;
    if (technique === ARMORED_TECHNIQUES.HALF_SWORD_THRUST && stoppedCuts > 0) {
      adjusted += 10;
      reasonsForCandidate.push("known-solid-plate");
    }
    if (technique === ARMORED_TECHNIQUES.HALF_SWORD_THRUST && failedGaps > 0) {
      adjusted = Math.max(15, adjusted - failedGaps * 6);
      reasonsForCandidate.push("failed-gap-adaptation");
    }
    if (technique === ARMORED_TECHNIQUES.HALF_SWORD_THRUST && successfulGaps > 0) {
      adjusted += 10;
      reasonsForCandidate.push("gap-success-confidence");
    }
    if (technique === ARMORED_TECHNIQUES.LONGSWORD_THRUST && failedGaps > 0) {
      adjusted = Math.max(5, adjusted - failedGaps * 2);
      reasonsForCandidate.push("failed-gap-thrust-adjustment");
    }
    if (technique === ARMORED_TECHNIQUES.POMMEL_OR_CROSSGUARD && failedGaps > 0) {
      adjusted += Math.min(15, failedGaps * 3);
      reasonsForCandidate.push("failed-gap-pommel-pressure");
    }
    if (technique === ARMORED_TECHNIQUES.POMMEL_OR_CROSSGUARD && targetVulnerable) {
      adjusted += 8;
      reasonsForCandidate.push("target-vulnerable");
    }
    if (technique === ARMORED_TECHNIQUES.GRAPPLE) {
      if (dagger) {
        adjusted += 6;
        reasonsForCandidate.push("dagger-available");
      }
      if (targetVulnerable) {
        adjusted += 8;
        reasonsForCandidate.push("target-vulnerable");
      }
      if (failedGaps > 0) {
        adjusted += Math.min(25, failedGaps * 5);
        reasonsForCandidate.push("failed-gap-clinch-pressure");
      }
    }
    if (technique === ARMORED_TECHNIQUES.LONGSWORD_CUT && stoppedCuts >= 2) {
      adjusted = 0;
      reasonsForCandidate.push("repeated-solid-plate-stops");
    }
    if (technique === lastTechnique && repeatCount >= 3 && successfulGaps <= 0) {
      adjusted = Math.max(0, adjusted - 12);
      reasonsForCandidate.push("repeat-technique-penalty");
    }
    if (adjusted <= 0) rejectedCandidates.push({ technique, reason: reasonsForCandidate[0] || "zero-score" });
    return { technique, score: Math.max(0, adjusted), baseScore: score, reasons: reasonsForCandidate };
  });

  const weighted = weightedChoice(candidates, rng);
  const selected = weighted.selected;
  if (!selected) reasons.push("no-legal-armored-technique");
  return {
    selectedTechnique: selected?.technique || null,
    selectedWeapon: selected?.technique ? buildArmoredTechniqueAttack(weapon, selected.technique) : weapon,
    score: selected?.score || 0,
    candidates,
    rejectedCandidates,
    reasons,
    rngChoice: selected?.rngChoice,
    totalScore: weighted.totalScore,
    deterministicRoll: weighted.roll,
    cumulativeRanges: weighted.ranges,
    selectedRange: selected?.cumulativeRange,
    memoryBand: band,
  };
}
