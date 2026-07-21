export function createCanonicalUnarmedAttack(attack = {}, fighter = {}) {
  const damage = fighter?.unarmedDamage || "1d3";
  return {
    ...attack,
    name: "Unarmed Attack",
    damage,
    damageDice: damage,
    damageType: "blunt",
    count: Number(attack?.count ?? 1),
    type: "melee",
    attackType: "melee",
    weaponType: "melee",
    category: "melee",
    range: 5,
    rangeFeet: 5,
    reachFeet: 5,
    isRanged: false,
    isMelee: true,
    isNaturalAttack: true,
    isFallbackUnarmed: true,
    sourceWeapon: null,
    sourceWeaponSnapshot: null,
    sourceWeaponId: "Unarmed Attack",
    sourceWeaponName: "Unarmed Attack",
    originalWeaponName: "Unarmed Attack",
    armoredActionPlan: null,
    selectedTechnique: null,
    armorTechnique: null,
    attackMode: "unarmed",
  };
}

export default createCanonicalUnarmedAttack;
