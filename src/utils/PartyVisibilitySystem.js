export class PartyVisibilitySystem {
  constructor(visionSystem) {
    this.visionSystem = visionSystem;
  }

  getCombinedVisibleTiles(partyMembers = [], allTiles = [], obstacles = []) {
    const keyToTile = new Map(
      allTiles.map((tile) => [`${tile.q},${tile.r}`, tile])
    );
    const visibleKeys = new Set();
    partyMembers.forEach((member) => {
      const memberTiles = this.visionSystem.getVisibleTiles(
        member,
        allTiles,
        obstacles
      );
      memberTiles.forEach((tile) => visibleKeys.add(`${tile.q},${tile.r}`));
    });
    return Array.from(visibleKeys)
      .map((key) => keyToTile.get(key))
      .filter(Boolean);
  }

  getCombinedVisibleEnemies(
    partyMembers = [],
    enemies = [],
    allTiles = [],
    obstacles = []
  ) {
    const tiles = this.getCombinedVisibleTiles(
      partyMembers,
      allTiles,
      obstacles
    );
    const visibleKeys = new Set(tiles.map((tile) => `${tile.q},${tile.r}`));
    return enemies.filter((enemy) => visibleKeys.has(`${enemy.q},${enemy.r}`));
  }
}
