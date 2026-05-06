/**
 * Prescene battles - predefined combat setups for quick starting.
 * Each prescene defines players (friendly side) and enemies.
 * Players use bestiary playable characters; enemies use bestiary monsters.
 */

export const presceneBattles = [
  {
    id: "elf-vs-minotaur",
    name: "Elf Long Bowman vs Minotaur",
    description:
      "Single Elf Long Bowman (50 arrows, Long Bow) vs Minotaur. Classic ranged vs melee matchup.",
    players: [
      {
        bestiaryId: "elf_long_bowman",
        weaponName: "Long Bow",
        ammoCount: 50,
        name: "Elf Long Bowman",
      },
    ],
    enemies: [
      {
        bestiaryId: "minotaur",
        name: "Minotaur",
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
