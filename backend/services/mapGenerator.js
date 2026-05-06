export function generateDefaultHexMap({
  width = 40,
  height = 30,
  terrainPreset = "OPEN_GROUND",
  seed = 0,
}) {
  const hexes = [];

  // Simple rectangular axial layout:
  // q = 0..width-1, r = 0..height-1
  for (let r = 0; r < height; r += 1) {
    for (let q = 0; q < width; q += 1) {
      hexes.push({
        q,
        r,
        terrain: terrainPreset,
        elev: 0,
      });
    }
  }

  return {
    kind: "HEX",
    width,
    height,
    terrainPreset,
    seed,
    hexes,
    entities: [],
  };
}
