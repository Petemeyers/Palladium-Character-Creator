import {
  getActorMeleeCandidates,
  isAttackUsableInClinch,
} from "./meleeEngagementContext.js";

const flatten = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
};

const isWeapon = (item = {}) => {
  const label = `${item?.name || ""} ${item?.type || ""} ${item?.category || ""}`.toLowerCase();
  return Boolean(item?.name) && !/armor|shield|ammunition|arrow|bolt/.test(label);
};

const uniqueNames = (items) => [...new Set(items.filter(isWeapon).map((item) => item.name).filter(Boolean))];

export function getCombatWeaponAvailability(actor = {}) {
  const equipped = uniqueNames([
    ...flatten(actor.equistaminadWeapons),
    ...flatten(actor.equippedWeapons),
  ]);
  const inventory = uniqueNames(flatten(actor.inventory)).filter((name) => !equipped.includes(name));
  const clinch = uniqueNames(getActorMeleeCandidates(actor).filter(isAttackUsableInClinch));
  if (!clinch.includes("Unarmed Attack")) clinch.push("Unarmed Attack");
  return { equipped, inventory, clinch };
}

export function formatCombatWeaponAvailability(actor = {}) {
  const availability = getCombatWeaponAvailability(actor);
  return `${actor.name || "Combatant"} weapons available: equipped=${availability.equipped.join(", ") || "none"} inventory=${availability.inventory.join(", ") || "none"} clinch=${availability.clinch.join(", ")}`;
}

export default getCombatWeaponAvailability;
