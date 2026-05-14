/**
 * Central weapon strike vs armor / natural AR (Palladium-style).
 * Used by engine workers (CJS) and may be imported from Vite (CombatPage, equipmentManager).
 *
 * @param {Object} opts
 * @param {Object} opts.defender
 * @param {number} opts.attackTotal d20 + all strike bonuses (same value historically passed as "attackRoll")
 * @param {number} opts.damage
 * @param {string} [opts.slot="chest"] hit location / armor slot key under defender.equipped
 * @param {boolean} [opts.isCrit=false]
 * @param {boolean} [opts.isFumble=false]
 */
function resolveWeaponImpactVsArmor({
  defender,
  attackTotal,
  damage,
  slot = "chest",
  isCrit = false,
  isFumble = false,
}) {
  const dmg = Math.max(0, Number(damage) || 0);
  const total = Number(attackTotal);

  if (isFumble) {
    const s = typeof slot === "string" && slot ? slot : "chest";
    return {
      outcome: "miss",
      damageToHP: 0,
      damageToArmor: 0,
      armorBroken: false,
      armor: null,
      slot: s,
    };
  }

  const equipped = defender?.equipped || {};
  const useSlot = typeof slot === "string" && slot ? slot : "chest";
  const armor =
    equipped?.[useSlot] ||
    equipped?.armor ||
    equipped?.chest ||
    defender?.equippedArmorItem ||
    null;

  const armorAR = Number(armor?.armorRating ?? armor?.AR ?? armor?.ar ?? armor?.defense ?? 0) || 0;

  let armorSDC = Number(armor?.currentSDC);
  if (!Number.isFinite(armorSDC)) {
    armorSDC = Number(armor?.sdc ?? 0) || 0;
  }

  const hasArmor = !!(armor && armorAR > 0 && armorSDC > 0);

  if (!hasArmor) {
    const naturalAR = Number(
      defender?.naturalAR ??
        defender?.baseAR ??
        defender?.nakedAR ??
        defender?.AR ??
        defender?.ar ??
        10
    );

    if (isCrit || total >= naturalAR) {
      return {
        outcome: "hp",
        damageToHP: dmg,
        damageToArmor: 0,
        armorBroken: false,
        armor: null,
        slot: useSlot,
      };
    }

    return {
      outcome: "miss",
      damageToHP: 0,
      damageToArmor: 0,
      armorBroken: false,
      armor: null,
      slot: useSlot,
    };
  }

  if (isCrit || total >= armorAR) {
    return {
      outcome: "hp",
      damageToHP: dmg,
      damageToArmor: 0,
      armorBroken: false,
      armor,
      slot: useSlot,
    };
  }

  const nextSDC = Math.max(0, armorSDC - dmg);

  return {
    outcome: "armor",
    damageToHP: 0,
    damageToArmor: dmg,
    armorBroken: nextSDC <= 0,
    prevArmorSDC: armorSDC,
    nextArmorSDC: nextSDC,
    armor,
    slot: useSlot,
  };
}

const SLOT_PRIORITY = ["chest", "torso", "arms", "legs", "head", "cloak", "shield"];

function pickPrimaryArmorSlot(defender, preferredSlot) {
  if (typeof preferredSlot === "string" && preferredSlot) return preferredSlot;
  const eq = defender?.equipped || {};
  for (const s of SLOT_PRIORITY) {
    const a = eq[s];
    const ar = Number(a?.armorRating ?? a?.AR ?? a?.ar ?? a?.defense ?? 0) || 0;
    let sd = Number(a?.currentSDC);
    if (!Number.isFinite(sd)) sd = Number(a?.sdc ?? 0) || 0;
    if (a && ar > 0 && sd > 0) return s;
  }
  for (const s of Object.keys(eq)) {
    const a = eq[s];
    const ar = Number(a?.armorRating ?? a?.AR ?? a?.ar ?? a?.defense ?? 0) || 0;
    let sd = Number(a?.currentSDC);
    if (!Number.isFinite(sd)) sd = Number(a?.sdc ?? 0) || 0;
    if (a && ar > 0 && sd > 0) return s;
  }
  return "chest";
}

/** True if the strike connects (armor soak or HP), i.e. not a clean miss — used for projectile path / stray logic. */
function strikeConnectsVsTarget({
  defender,
  attackTotal,
  d20,
  slot = "chest",
  ruleset = null,
  critOn = 20,
  alwaysMissOn = 1,
}) {
  const isFumble = ruleset?.isFumble ? !!ruleset.isFumble(d20) : d20 === Number(alwaysMissOn);
  if (isFumble) return { connects: false, isCrit: false, isFumble: true };

  const isCrit = ruleset?.isCrit ? !!ruleset.isCrit(d20) : d20 >= Number(critOn);
  const useSlot = pickPrimaryArmorSlot(defender, slot);
  const impact = resolveWeaponImpactVsArmor({
    defender,
    attackTotal,
    damage: 0,
    slot: useSlot,
    isCrit,
    isFumble: false,
  });
  return {
    connects: impact.outcome !== "miss",
    isCrit,
    isFumble: false,
    outcome: impact.outcome,
    slot: useSlot,
  };
}

module.exports = {
  resolveWeaponImpactVsArmor,
  pickPrimaryArmorSlot,
  strikeConnectsVsTarget,
};
