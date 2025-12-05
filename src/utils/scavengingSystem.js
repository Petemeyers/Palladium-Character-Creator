/**
 * Scavenging System
 * 
 * Handles scavenger behavior for creatures (hawks, vultures, etc.)
 * that seek out and consume corpses on the battlefield.
 */

import { getSizeCategory, SIZE_CATEGORIES } from "./sizeStrengthModifiers.js";

/**
 * Basic list of scavenging species. You can later move this to speciesBehavior.json.
 */
const DEFAULT_SCAVENGERS = ["hawk", "vulture", "crow", "raven", "hyena", "wolf"];

/**
 * Check if a creature is a scavenger
 * @param {Object} creature - Creature object
 * @returns {boolean} True if creature is a scavenger
 */
export function isScavenger(creature) {
  if (!creature) return false;
  const name = (creature.species || creature.race || creature.name || "").toLowerCase();
  return DEFAULT_SCAVENGERS.some((tag) => name.includes(tag));
}

/**
 * Check if a fighter is a corpse (dead)
 * @param {Object} fighter - Fighter object
 * @returns {boolean} True if fighter is dead/corpse
 */
export function isCorpse(fighter) {
  if (!fighter) return false;
  return (
    fighter.isDead ||
    fighter.hp <= 0 ||
    fighter.status === "DEAD" ||
    fighter.status === "corpse"
  );
}

/**
 * Find nearest corpse within maxHexes using positions map.
 * positions[fighter.id] should have hex coords and hexDistanceTo() or distanceTo().
 */
export function findNearbyCorpse(scavenger, fighters, positions, maxHexes = 10) {
  if (!scavenger || !fighters || !positions) return null;
  const myPos = positions[scavenger.id];
  if (!myPos) return null;

  let best = null;
  let bestDist = Infinity;

  for (const f of fighters) {
    if (!isCorpse(f) || f.scavenged) continue;
    const pos = positions[f.id];
    if (!pos) continue;

    const dist =
      typeof myPos.hexDistanceTo === "function"
        ? myPos.hexDistanceTo(pos)
        : typeof myPos.distanceTo === "function"
        ? myPos.distanceTo(pos)
        : null;

    if (dist == null) continue;
    if (dist <= maxHexes && dist < bestDist) {
      best = f;
      bestDist = dist;
    }
  }

  return best;
}

/**
 * Create a simple meat "ration" item from a corpse and add it to the scavenger's inventory.
 * This is pure "loot body of meat" logic; actually EATING it is handled elsewhere.
 */
export function scavengeCorpse(scavenger, corpse, log = () => {}) {
  if (!scavenger || !corpse) return;

  const sizeCat = getSizeCategory(corpse);
  let baseRations = 2;

  switch (sizeCat) {
    case SIZE_CATEGORIES.TINY:
      baseRations = 1;
      break;
    case SIZE_CATEGORIES.SMALL:
      baseRations = 2;
      break;
    case SIZE_CATEGORIES.MEDIUM:
      baseRations = 4;
      break;
    case SIZE_CATEGORIES.LARGE:
    case SIZE_CATEGORIES.HUGE:
    case SIZE_CATEGORIES.GIANT:
      baseRations = 6;
      break;
    default:
      baseRations = 2;
  }

  const item = {
    id: `meat-${corpse.id}-${Date.now()}`,
    name: `${corpse.name || "Corpse"} Meat`,
    type: "ration",      // important for the eating system
    category: "food",
    quantity: baseRations,
    source: "scavenged",
  };

  scavenger.inventory = scavenger.inventory || [];
  scavenger.inventory.push(item);

  corpse.scavenged = true;

  log(
    `🦅 ${scavenger.name} scavenges ${corpse.name || "a corpse"} and tears off some meat.`
  );

  return item;
}

export default {
  isScavenger,
  isCorpse,
  findNearbyCorpse,
  scavengeCorpse,
};

