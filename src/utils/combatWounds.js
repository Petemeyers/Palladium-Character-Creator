const toNumber = (value) => {
  if (value === undefined || value === null || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const rollD20 = () => Math.floor(Math.random() * 20) + 1;

export function rollWoundLocation({ rollLocation } = {}) {
  const rolled = typeof rollLocation === "function" ? rollLocation() : rollD20();
  const roll = toNumber(rolled);

  if (roll === 1) return { roll, location: "Head" };
  if (roll === 2) return { roll, location: "Face" };
  if (roll === 3) return { roll, location: "Neck" };
  if (roll >= 4 && roll <= 7) return { roll, location: "Torso" };
  if (roll >= 8 && roll <= 10) return { roll, location: "Right Arm" };
  if (roll >= 11 && roll <= 13) return { roll, location: "Left Arm" };
  if (roll === 14) return { roll, location: "Right Hand" };
  if (roll === 15) return { roll, location: "Left Hand" };
  if (roll >= 16 && roll <= 17) return { roll, location: "Right Leg" };
  if (roll >= 18 && roll <= 19) return { roll, location: "Left Leg" };
  if (roll === 20) return { roll, location: "Foot" };

  return { roll, location: "Unknown" };
}

export function getWoundSeverity({ finalDamage } = {}) {
  const damage = toNumber(finalDamage);
  if (damage === null) return "Unknown / No wound";
  if (damage <= 0) return "Absorbed / No wound";
  if (damage <= 3) return "Glancing wound";
  if (damage <= 7) return "Minor wound";
  if (damage <= 12) return "Serious wound";
  return "Critical wound";
}

export function previewWound({
  attack,
  target,
  rawDamage,
  armorReduction,
  finalDamage,
  rollLocation,
} = {}) {
  const severity = getWoundSeverity({ finalDamage, rawDamage, armorReduction });
  const finalDamageNumber = toNumber(finalDamage);
  const location = finalDamageNumber !== null && finalDamageNumber > 0
    ? rollWoundLocation({ rollLocation })
    : { roll: null, location: "None" };

  return {
    attackName: attack?.name,
    targetName: target?.name,
    rawDamage: toNumber(rawDamage),
    armorReduction: toNumber(armorReduction),
    finalDamage: finalDamageNumber,
    location: location.location,
    locationRoll: location.roll,
    severity,
    note: finalDamageNumber !== null && finalDamageNumber <= 0 ? "Armor absorbed the blow. No wound." : "",
  };
}

export default {
  getWoundSeverity,
  previewWound,
  rollWoundLocation,
};
