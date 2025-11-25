export class AIVisibilitySystem {
  constructor(scene, visionSystem) {
    this.scene = scene;
    this.visionSystem = visionSystem;
  }

  computeVisibility(activeChar, allCharacters, allTiles, obstacles = []) {
    const visibleTiles = this.visionSystem.getVisibleTiles(
      activeChar,
      allTiles,
      obstacles
    );
    const visibleKeys = new Set(visibleTiles.map((t) => `${t.q},${t.r}`));
    return allCharacters
      .filter((ch) => ch.id !== activeChar.id)
      .filter((ch) => visibleKeys.has(`${ch.q},${ch.r}`))
      .map((ch) => ch.id);
  }

  updateSceneVisibility(allCharacters = [], visibleIDs = []) {
    const visibleSet = new Set(visibleIDs);
    allCharacters.forEach((char) => {
      const root = char._iconGroup || char._mesh;
      if (!root) return;
      const fullyVisible = visibleSet.has(char.id) || char.alignment !== "evil";
      this.setVisibility(root, fullyVisible ? 1 : 0.15);
      if (char._arrow) {
        this.setVisibility(char._arrow, fullyVisible ? 1 : 0.15);
      }
    });
  }

  setVisibility(object3D, targetOpacity) {
    object3D.traverse?.((child) => {
      if (child.material && typeof child.material.opacity === "number") {
        const current = child.material.opacity ?? targetOpacity;
        child.material.opacity = current + (targetOpacity - current) * 0.2;
        child.material.transparent = true;
      }
    });
  }
}
