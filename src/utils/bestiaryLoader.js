// ==========================================
// Bestiary Loader
// ==========================================
// Loads creature data from bestiary.json,
// expands dice (e.g. "7d8" -> rolled HP),
// and normalizes structure for Combat Engine.
// ==========================================

import bestiary from "../data/bestiary.json" assert { type: "json" };
import { getAllBestiaryEntries } from "./bestiaryUtils.js";

// ---- Utility Dice Roller ----
function rollDice(formula) {
  if (typeof formula === "number") return formula;
  const match = /^(\d+)d(\d+)([+\-]\d+)?$/.exec(formula.trim());
  if (!match) return Number(formula) || 0;

  const count = parseInt(match[1]);
  const sides = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3]) : 0;
  let total = 0;
  for (let i = 0; i < count; i++)
    total += Math.floor(Math.random() * sides) + 1;
  return total + modifier;
}

// ---- Normalize Creature Object ----
export function loadCreature(idOrName) {
  const entry = getAllBestiaryEntries(bestiary).find(
    (m) =>
      m.id?.toLowerCase() === idOrName.toLowerCase() ||
      m.name?.toLowerCase() === idOrName.toLowerCase()
  );

  if (!entry) throw new Error(`Creature not found: ${idOrName}`);

  const hp = rollDice(entry.HP || entry.hp || "3d6");
  const normalized = {
    id: entry.id || idOrName,
    name: entry.name || idOrName,
    category: entry.category || "unknown",
    AR: entry.AR ?? 10,
    HP: hp,
    currentHP: hp,
    bonuses: entry.bonuses || {},
    attacks: entry.attacks || [],
    abilities: entry.abilities || [],
    spd: entry.spd ?? 10,
    description: entry.description || "",
    alignment: entry.alignment || ["unaligned"],
    lifeSpan: entry.lifeSpan || "unknown",
    actions: 3,
    alive: true,
  };

  return normalized;
}

// ---- Multi-Loader for Parties or Encounters ----
export function loadCreatures(ids) {
  if (!Array.isArray(ids)) throw new Error("loadCreatures expects an array");
  return ids.map((id) => loadCreature(id));
}

// ---- Expose dice roller for other modules ----
export { rollDice };
