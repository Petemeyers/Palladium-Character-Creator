const HUMAN_LOCATION_LABELS = Object.freeze({
  weaponArm: "weapon arm",
  shieldArm: "shield arm",
  hands: "hands",
  head: "head",
  torso: "torso",
  legs: "legs",
});

const PLATE_LOCATION_LABELS = Object.freeze({
  weaponArm: "weapon arm plate",
  shieldArm: "shield arm plate",
  hands: "gauntlet",
  head: "helmet",
  torso: "breastplate",
  legs: "leg plate",
});

export function formatHitLocationForPlayer(location, options = {}) {
  const key = String(location || "").trim();
  if (!key) return "armor";
  const isPlate = options.coverageType === "covered-by-plate" || options.armorClass === "plate";
  const label = (isPlate ? PLATE_LOCATION_LABELS : HUMAN_LOCATION_LABELS)[key];
  if (label) return label;
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .toLowerCase();
}
