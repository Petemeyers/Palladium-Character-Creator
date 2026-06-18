export const weapons = [
  { name: "Dagger", damage: "1d4", type: "weapon", category: "one-handed", weight: 1, price: 10, reach: 1, range: 20, rateOfFire: 1, ammunition: null, strengthRequired: 5, notes: "Suitable in close quarters." },
  { name: "Knife", damage: "1d4", type: "weapon", category: "one-handed", weight: 1, price: 6, reach: 1, range: 15, rateOfFire: 1, ammunition: null, strengthRequired: 4, notes: "Small utility blade." },
  { name: "Arming Sword", damage: "1d8", type: "weapon", category: "one-handed", weight: 3, price: 45, reach: 3, range: null, rateOfFire: null, ammunition: null, strengthRequired: 8, notes: "Common knightly sidearm." },
  { name: "Long Sword", damage: "1d8", type: "weapon", category: "one-handed", weight: 4, price: 60, reach: 3, range: null, rateOfFire: null, ammunition: null, strengthRequired: 9, notes: "Balanced battlefield sword." },
  { name: "Mace", damage: "1d8", type: "weapon", category: "one-handed", weight: 5, price: 35, reach: 2, range: null, rateOfFire: null, ammunition: null, strengthRequired: 10, notes: "Effective against armor." },
  { name: "Hand Axe", damage: "1d6", type: "weapon", category: "one-handed", weight: 3, price: 20, reach: 2, range: 20, rateOfFire: 1, ammunition: null, strengthRequired: 8, notes: "Can be thrown." },
  { name: "Spear", damage: "1d8", type: "weapon", category: "two-handed", weight: 5, price: 18, reach: 6, range: 30, rateOfFire: 1, ammunition: null, strengthRequired: 8, notes: "Controls distance." },
  { name: "Pike", damage: "1d10", type: "weapon", category: "two-handed", weight: 12, price: 35, reach: 10, range: null, rateOfFire: null, ammunition: null, strengthRequired: 11, notes: "Long formation weapon." },
  { name: "Halberd", damage: "1d10", type: "weapon", category: "two-handed", weight: 9, price: 45, reach: 8, range: null, rateOfFire: null, ammunition: null, strengthRequired: 11, notes: "Hooking and chopping polearm." },
  { name: "Longbow", damage: "1d8", type: "weapon", category: "ranged", weight: 3, price: 75, reach: null, range: 150, rateOfFire: 1, ammunition: "Arrow", strengthRequired: 12, notes: "Powerful trained bow." },
  { name: "Crossbow", damage: "1d10", type: "weapon", category: "ranged", weight: 7, price: 90, reach: null, range: 120, rateOfFire: 1, ammunition: "Bolt", strengthRequired: 8, notes: "Strong ranged weapon with slower reload." },
  { name: "Unarmed", damage: "1d3", type: "weapon", category: "natural", weight: 0, price: 0, reach: 1, range: null, rateOfFire: null, ammunition: null, strengthRequired: 0, notes: "Punches, kicks, and grappling pressure." },
];

export const arenaWhip = {
  name: "Arena Whip",
  damage: "1d6",
  type: "weapon",
  category: "one-handed",
  weight: 3,
  price: 30,
  reach: 10,
  range: null,
  rateOfFire: null,
  ammunition: null,
  strengthRequired: 7,
  notes: "A long control weapon for disarming and distance pressure.",
};

export const getWeaponByName = (name) => weapons.find((weapon) => weapon.name === name);
export const getWeaponsByCategory = (category) => weapons.filter((weapon) => weapon.category === category);
export const getRangedWeapons = () => weapons.filter((weapon) => Number(weapon.range) > 0);

export default weapons;
