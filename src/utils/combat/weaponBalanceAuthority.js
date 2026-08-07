import { getCanonicalWeaponTraitProfile } from "./canonicalWeaponTraits.js";

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

export const WEAPON_MATCHUP_TARGETS = Object.freeze({
  "two-handed-spear-vs-arming-sword": Object.freeze({ min: 0.82, max: 0.91, favoredSide: "left" }),
  "two-handed-spear-vs-sword-and-shield": Object.freeze({ min: 0.60, max: 0.74, favoredSide: "left" }),
  "pike-vs-arming-sword": Object.freeze({ min: 0.80, max: 0.91, favoredSide: "left" }),
  "halberd-vs-arming-sword": Object.freeze({ min: 0.72, max: 0.89, favoredSide: "left" }),
  "greatsword-vs-two-handed-spear": Object.freeze({ min: 0.34, max: 0.50, favoredSide: "left" }),
  "half-sword-longsword-vs-two-handed-spear": Object.freeze({ min: 0.34, max: 0.50, favoredSide: "left" }),
});

const actorHasShield = (actor = {}) => Boolean(
  actor?.equippedShield ||
  actor?.equipped?.shield ||
  actor?.heldItems?.shield ||
  (actor?.equipmentSelection?.shield && normalizeText(actor.equipmentSelection.shield) !== "none"),
);

export const getWeaponEntryBalanceAdjustment = ({
  mover,
  moverWeapon,
  controllerWeapon,
  entryTechnique,
} = {}) => {
  const moverTraits = getCanonicalWeaponTraitProfile(moverWeapon || {});
  const controllerTraits = getCanonicalWeaponTraitProfile(controllerWeapon || {});
  const techniqueId = normalizeText(entryTechnique?.id || entryTechnique);
  let adjustment = 0;
  const reasons = [];

  if (controllerTraits.isPolearm) {
    if (techniqueId === "half-sword-entry" && (moverTraits.isLongsword || moverTraits.isGreatsword)) {
      adjustment += 3;
      reasons.push("half-sword-entry-calibration");
    }
    if (techniqueId === "shield-cover-and-enter" && actorHasShield(mover)) {
      adjustment += 1;
      reasons.push("shield-covered-entry-calibration");
    }
    if (moverTraits.isGreatsword && techniqueId === "beat-and-enter") {
      adjustment += 1;
      reasons.push("greatsword-beat-entry-calibration");
    }
  }

  return { adjustment, reasons };
};

export const getSpecializedWeaponBalanceAdjustment = ({ actionId } = {}) => {
  const id = normalizeText(actionId);
  if (id === "polearm-beat-entry") return { attack: 1, control: 1, reasons: ["greatsword-anti-polearm-tuning"] };
  if (id === "half-sword-entry") return { attack: 0, control: 1, reasons: ["half-sword-control-tuning"] };
  if (id === "shield-bind-and-strike") return { attack: 0, control: 1, reasons: ["shield-bind-tuning"] };
  return { attack: 0, control: 0, reasons: [] };
};

export const evaluateWeaponCalibrationTargets = (results = {}) => Object.entries(results).map(([key, value]) => {
  const target = WEAPON_MATCHUP_TARGETS[key] || null;
  const rate = Number(value?.leftWinRate ?? value?.favoredWinRate ?? value?.winRate ?? value);
  if (!target || !Number.isFinite(rate)) return { key, rate: Number.isFinite(rate) ? rate : null, target, status: "untracked" };
  return {
    key,
    rate,
    target,
    status: rate < target.min ? "below-target" : rate > target.max ? "above-target" : "within-target",
  };
});
