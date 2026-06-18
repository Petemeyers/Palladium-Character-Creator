/**
 * Prescene battles - predefined combat setups for quick starting.
 * Each prescene defines players (friendly side) and enemies.
 * Players use arenaRoster playable characters; enemies use arenaRoster opponents.
 */

export const presceneBattles = [
  {
    id: "human-vs-arena-champion",
    name: "Human Long Bowman vs Arena Champion",
    description:
      "Single Human Long Bowman (50 arrows, Long Bow) vs Arena Champion. Classic ranged vs melee matchup.",
    players: [
      {
        arenaRosterId: "human_long_bowman",
        weaponName: "Long Bow",
        ammoCount: 50,
        name: "Human Long Bowman",
      },
    ],
    enemies: [
      {
        arenaRosterId: "arena-champion",
        name: "Arena Champion",
      },
    ],
  },
];

/**
 * Get prescene by ID
 */
export function getPresceneById(id) {
  return presceneBattles.find((p) => p.id === id) || null;
}
