export const HUMANOID_IMPACT_CLOCK = Object.freeze([
  { min: 1, max: 10, location: "head" },
  { min: 11, max: 45, location: "torso" },
  { min: 46, max: 60, location: "weaponArm" },
  { min: 61, max: 72, location: "shieldArm" },
  { min: 73, max: 88, location: "legs" },
  { min: 89, max: 100, location: "hands" },
]);

const IMPACT_CLOCKS = Object.freeze({
  humanoid: HUMANOID_IMPACT_CLOCK,
});

function clampD100(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(100, Math.max(1, Math.floor(numeric)));
}

export function rollImpactLocation({ rollD100, profile = "humanoid" } = {}) {
  const normalizedProfile = String(profile || "humanoid");
  const table = IMPACT_CLOCKS[normalizedProfile] || HUMANOID_IMPACT_CLOCK;
  const rawRoll = typeof rollD100 === "function"
    ? rollD100()
    : Math.floor(Math.random() * 100) + 1;
  const roll = clampD100(rawRoll);
  const match = table.find((entry) => roll >= entry.min && roll <= entry.max);

  return {
    roll,
    profile: IMPACT_CLOCKS[normalizedProfile] ? normalizedProfile : "humanoid",
    location: match?.location || "torso",
  };
}

export default rollImpactLocation;
