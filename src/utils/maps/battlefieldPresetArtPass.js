export const BATTLEFIELD_PRESET_ART_VERSION = "8c-8a.1";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalize = (value) =>
  String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");

function hash32(value) {
  const text = String(value ?? "");
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function rand01(seed, x = 0, y = 0, channel = 0) {
  let value =
    hash32(seed) ^
    Math.imul((Number(x) + 0x9e3779b9) | 0, 0x85ebca6b) ^
    Math.imul((Number(y) + 0x7f4a7c15) | 0, 0xc2b2ae35) ^
    Math.imul(Number(channel) + 1, 0x27d4eb2d);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return (value >>> 0) / 0xffffffff;
}

function signed(seed, x, y, channel = 0) {
  return rand01(seed, x, y, channel) * 2 - 1;
}

function mapSize(grid = []) {
  return {
    height: Array.isArray(grid) ? grid.length : 0,
    width: Array.isArray(grid?.[0]) ? grid[0].length : 0,
  };
}

function updateCell(cell = {}, patch = {}) {
  const elevation = Number.isFinite(Number(patch.elevation))
    ? Number(patch.elevation)
    : Number.isFinite(Number(patch.height))
      ? Number(patch.height)
      : Number.isFinite(Number(cell.elevation))
        ? Number(cell.elevation)
        : Number(cell.height) || 0;

  const terrain =
    patch.terrain ||
    patch.terrainType ||
    cell.terrain ||
    cell.terrainType ||
    "grass";

  const formationType =
    patch.formationType ||
    patch.combatTerrainType ||
    cell.formationType ||
    cell.combatTerrainType ||
    "open-ground";

  const walkable =
    patch.walkable == null
      ? patch.isWalkable == null
        ? cell.walkable !== false && cell.isWalkable !== false
        : patch.isWalkable !== false
      : patch.walkable !== false;

  return {
    ...cell,
    ...patch,
    terrain,
    terrainType: terrain,
    visualTerrain: patch.visualTerrain || terrain,
    formationType,
    combatTerrainType: patch.combatTerrainType || formationType,
    elevation,
    height: elevation,
    walkable,
    isWalkable: walkable,
    suppressGenericTerrainProp:
      patch.suppressGenericTerrainProp == null
        ? patch.presetFeature != null
          ? true
          : cell.suppressGenericTerrainProp === true
        : patch.suppressGenericTerrainProp === true,
  };
}

function setCell(grid, x, y, patch) {
  if (!grid?.[y]?.[x]) return;
  grid[y][x] = updateCell(grid[y][x], patch);
}

function propKey(type, x, y) {
  return `${type}:${Number(x)},${Number(y)}`;
}

function pushProp(props, seen, prop) {
  const x = Number(prop?.x ?? prop?.q);
  const y = Number(prop?.y ?? prop?.r);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const key = propKey(prop.type, x, y);
  if (seen.has(key)) return false;
  seen.add(key);
  props.push({
    coordinateSpace: "offset",
    q: x,
    r: y,
    x,
    y,
    rotation: 0,
    scale: 1,
    ...prop,
    q: x,
    r: y,
    x,
    y,
    coordinateSpace: "offset",
  });
  return true;
}

function existingPropKeys(props = []) {
  return new Set(
    (Array.isArray(props) ? props : []).map((prop) =>
      propKey(prop?.type, prop?.x ?? prop?.q, prop?.y ?? prop?.r)
    )
  );
}

function centralPathY(seed, x, height, amplitude = 2.4, channel = 10) {
  const mid = (height - 1) / 2;
  const wave =
    Math.sin(x * 0.18 + rand01(seed, 0, 0, channel) * Math.PI * 2) *
    amplitude;
  const broad =
    Math.sin(x * 0.065 + rand01(seed, 1, 0, channel) * Math.PI * 2) *
    amplitude *
    0.65;
  const jitter = signed(seed, x, 0, channel + 1) * 0.8;
  return clamp(Math.round(mid + wave + broad + jitter), 2, height - 3);
}

function authorMountainPass(grid, seed, props) {
  const { width, height } = mapSize(grid);
  if (!width || !height) return null;
  const seen = existingPropKeys(props);

  const centerline = Array.from({ length: width }, (_, x) =>
    centralPathY(seed, x, height, Math.max(1.5, height * 0.065), 101)
  );

  for (let x = 0; x < width; x += 1) {
    const center = centerline[x];
    const turnout =
      rand01(seed, x, center, 111) > 0.9 ||
      (x > width * 0.42 && x < width * 0.58);
    const passHalfWidth = turnout ? 2 : 1;

    for (let y = 0; y < height; y += 1) {
      const d = Math.abs(y - center);
      const side = y < center ? -1 : 1;
      const peakNoise = signed(seed, x, y, 120);
      const strataNoise = rand01(seed, x, y, 121);
      const existing = grid[y][x];

      // The combat deployment system reserves the outer three columns. Keep
      // those as readable staging shelves and let the mountain walls rise
      // after deployment instead of leaving high grass-topped spawn cliffs.
      if (x < 3 || x >= width - 3) {
        setCell(grid, x, y, {
          terrain: d <= 2 ? "road" : "grass",
          elevation: d <= 3 ? 0 : 1,
          formationType: "open-ground",
          walkable: true,
          cover: 0,
          presetFeature: "mountain-deployment-shelf",
        });
        continue;
      }

      if (d <= passHalfWidth) {
        const floorHeight =
          x > width * 0.3 && x < width * 0.7 && rand01(seed, x, y, 122) > 0.82
            ? 1
            : 0;
        setCell(grid, x, y, {
          terrain: d === 0 ? "road" : strataNoise > 0.6 ? "dirt" : "road",
          elevation: floorHeight,
          formationType: d === 0 ? "narrow-passage" : "open-ground",
          walkable: true,
          cover: 0,
          presetFeature: "mountain-pass-floor",
        });
        continue;
      }

      if (d <= passHalfWidth + 2) {
        const shoulderBand = d - passHalfWidth;
        const elevation = clamp(
          1 + shoulderBand + Math.round(Math.max(0, peakNoise)),
          1,
          4
        );
        const terrain =
          strataNoise > 0.72 ? "rock" :
          strataNoise > 0.42 ? "hill" :
          "dirt";
        setCell(grid, x, y, {
          terrain,
          elevation,
          formationType: elevation >= 3 ? "elevated-ground" : "uneven-ground",
          walkable: true,
          cover: terrain === "rock" ? 1 : 0,
          presetFeature: "mountain-shoulder",
        });

        if (
          terrain === "rock" &&
          rand01(seed, x, y, 123) > 0.94
        ) {
          pushProp(props, seen, {
            id: `mountain-boulder-${x}-${y}`,
            type: "boulder",
            name: "Pass Boulder",
            x,
            y,
            rotation: Math.floor(rand01(seed, x, y, 124) * 6) * 60,
            scale: 0.8 + rand01(seed, x, y, 125) * 0.5,
            blocksMovement: true,
            blocksLineOfSight: true,
          });
        }
        continue;
      }

      if (d <= passHalfWidth + 5) {
        const ridgeBand = d - (passHalfWidth + 2);
        const ledge =
          ridgeBand === 1 &&
          (
            Math.sin((x + side * 3) * 0.42) > 0.64 ||
            rand01(seed, x, y, 126) > 0.91
          );
        const elevation = clamp(
          3 +
            ridgeBand +
            Math.round(Math.max(0, peakNoise * 2)) +
            (strataNoise > 0.86 ? 1 : 0),
          3,
          7
        );
        const terrain =
          strataNoise > 0.76 ? "rubble" :
          "rock";
        setCell(grid, x, y, {
          terrain,
          elevation,
          formationType: ledge ? "elevated-ground" : "stone-wall",
          walkable: ledge,
          cover: 1,
          presetFeature: ledge ? "mountain-ambush-ledge" : "mountain-ridge",
        });

        if (rand01(seed, x, y, 127) > 0.955) {
          pushProp(props, seen, {
            id: `ridge-boulder-${x}-${y}`,
            type: "boulder",
            name: "Ridge Boulder",
            x,
            y,
            rotation: Math.floor(rand01(seed, x, y, 128) * 6) * 60,
            scale: 1 + rand01(seed, x, y, 129) * 0.65,
            blocksMovement: true,
            blocksLineOfSight: true,
          });
        }
        continue;
      }

      const outerRise = Math.min(3, Math.floor((d - passHalfWidth - 5) / 2));
      const elevation = clamp(
        6 + outerRise + Math.round(Math.max(0, peakNoise * 2)),
        5,
        10
      );
      const terrain =
        strataNoise > 0.72 ? "rubble" :
        strataNoise < 0.14 ? "hill" :
        "rock";
      setCell(grid, x, y, {
        terrain,
        elevation,
        formationType: "stone-wall",
        walkable: false,
        cover: 1,
        presetFeature: "mountain-crown",
      });
    }
  }

  // Sparse vegetation near the lower shoulder makes the pass read as a
  // landscape rather than two solid rock slabs.
  for (let x = 2; x < width - 2; x += 1) {
    const center = centerline[x];
    for (const y of [center - 3, center + 3]) {
      if (!grid?.[y]?.[x]) continue;
      if (
        grid[y][x].walkable !== false &&
        rand01(seed, x, y, 140) > 0.94
      ) {
        pushProp(props, seen, {
          id: `pass-tree-${x}-${y}`,
          type: "tree",
          name: "Mountain Tree",
          x,
          y,
          scale: 0.85 + rand01(seed, x, y, 141) * 0.35,
          blocksMovement: true,
          blocksLineOfSight: true,
        });
      }
    }
  }

  return {
    preset: "mountain-pass",
    version: BATTLEFIELD_PRESET_ART_VERSION,
    features: [
      "carved-pass-floor",
      "ridge-shoulders",
      "high-crowns",
      "ambush-ledges",
      "rock-strata",
    ],
  };
}

function authorRiverCrossing(grid, seed, props) {
  const { width, height } = mapSize(grid);
  if (!width || !height) return null;
  const seen = existingPropKeys(props);
  // On the common wide battlefield, run the river north/south so it
  // separates left/right deployment forces and makes the ford tactically
  // meaningful. Tall maps use the opposite orientation.
  const vertical = width >= height;
  const longSize = vertical ? height : width;
  const shortSize = vertical ? width : height;
  const crossing = Math.round(longSize * (0.48 + signed(seed, 0, 0, 201) * 0.08));

  const channelCenter = (index) =>
    centralPathY(
      `${seed}:river`,
      index,
      shortSize,
      Math.max(1.4, shortSize * 0.075),
      202
    );

  for (let i = 0; i < longSize; i += 1) {
    const center = channelCenter(i);
    const riverHalf = 1 + (rand01(seed, i, center, 203) > 0.74 ? 1 : 0);
    const fordBand = Math.abs(i - crossing) <= 1;

    for (let cross = 0; cross < shortSize; cross += 1) {
      const x = vertical ? cross : i;
      const y = vertical ? i : cross;
      const d = Math.abs(cross - center);

      if (d <= riverHalf) {
        const deep = d < riverHalf && !fordBand;
        const depthFeet = fordBand
          ? 2
          : deep
            ? 7 + Math.round(rand01(seed, x, y, 204) * 3)
            : 4;
        setCell(grid, x, y, {
          terrain: "water",
          elevation: fordBand ? -1 : deep ? -2 : -1,
          formationType: fordBand ? "narrow-passage" : "deep-water",
          walkable: fordBand,
          cover: 0,
          waterDepthFeet: depthFeet,
          waterTraversal: fordBand ? "wade" : "swim",
          waterCurrent: {
            strength: fordBand ? "light" : "moderate",
            direction: vertical ? "S" : "E",
          },
          presetFeature: fordBand ? "river-ford" : "river-channel",
        });
        continue;
      }

      if (d === riverHalf + 1) {
        setCell(grid, x, y, {
          terrain: rand01(seed, x, y, 205) > 0.48 ? "mud" : "dirt",
          elevation: 0,
          formationType: "mud",
          walkable: true,
          cover: 0,
          presetFeature: "river-bank",
        });
        continue;
      }

      if (d === riverHalf + 2 && rand01(seed, x, y, 206) > 0.78) {
        setCell(grid, x, y, {
          terrain: "forest",
          elevation: Math.max(0, Number(grid[y][x].elevation) || 0),
          formationType: "forest",
          walkable: true,
          cover: 1,
          presetFeature: "river-tree-line",
        });
        if (rand01(seed, x, y, 207) > 0.72) {
          pushProp(props, seen, {
            id: `river-tree-${x}-${y}`,
            type: "tree",
            name: "Riverbank Tree",
            x,
            y,
            scale: 0.9 + rand01(seed, x, y, 208) * 0.3,
            blocksMovement: true,
            blocksLineOfSight: true,
          });
        }
      }
    }
  }

  return {
    preset: "river-crossing",
    version: BATTLEFIELD_PRESET_ART_VERSION,
    features: [
      "meandering-channel",
      "depth-metadata",
      "shallow-ford",
      "mud-sand-banks",
      "river-tree-line",
    ],
  };
}

function authorForestRoad(grid, seed, props) {
  const { width, height } = mapSize(grid);
  if (!width || !height) return null;
  const seen = existingPropKeys(props);

  const centerline = Array.from({ length: width }, (_, x) =>
    centralPathY(seed, x, height, Math.max(1.2, height * 0.055), 301)
  );

  for (let x = 0; x < width; x += 1) {
    const center = centerline[x];
    for (let y = 0; y < height; y += 1) {
      const d = Math.abs(y - center);
      const detail = rand01(seed, x, y, 302);

      if (d === 0) {
        setCell(grid, x, y, {
          terrain: "road",
          elevation: clamp(Math.round(signed(seed, x, y, 303) * 0.45), 0, 1),
          formationType: "open-ground",
          walkable: true,
          cover: 0,
          presetFeature: "forest-road",
        });
      } else if (d === 1) {
        setCell(grid, x, y, {
          terrain: detail > 0.58 ? "dirt" : "grass",
          elevation: 0,
          formationType: "open-ground",
          walkable: true,
          cover: 0,
          presetFeature: "road-verge",
        });
      } else {
        const elevation = clamp(
          Math.round(
            Math.max(0, signed(seed, x, y, 304)) *
            (d > 4 ? 2 : 1)
          ),
          0,
          2
        );
        setCell(grid, x, y, {
          terrain: detail > 0.92 ? "rock" : "forest",
          elevation,
          formationType: detail > 0.92 ? "uneven-ground" : "forest",
          walkable: true,
          cover: 1,
          presetFeature: "forest-road-woods",
        });

        const treeChance = d <= 2 ? 0.95 : 0.86;
        if (detail > treeChance) {
          pushProp(props, seen, {
            id: `forest-road-tree-${x}-${y}`,
            type: "tree",
            name: "Roadside Tree",
            x,
            y,
            scale: 0.85 + rand01(seed, x, y, 305) * 0.45,
            rotation: Math.floor(rand01(seed, x, y, 306) * 6) * 60,
            blocksMovement: true,
            blocksLineOfSight: true,
          });
        }
      }
    }
  }

  return {
    preset: "mixed-wilderness",
    version: BATTLEFIELD_PRESET_ART_VERSION,
    features: [
      "continuous-forest-road",
      "cleared-verges",
      "dense-wood-bands",
      "roadside-trees",
    ],
  };
}

function authorRuinedVillage(grid, seed, props) {
  const { width, height } = mapSize(grid);
  if (!width || !height) return null;
  const seen = existingPropKeys(props);
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  // Crossroads gives the village an intentional plan instead of a loose strip.
  for (let x = 0; x < width; x += 1) {
    const y = clamp(
      centerY + Math.round(Math.sin(x * 0.22) * 1.2),
      1,
      height - 2
    );
    setCell(grid, x, y, {
      terrain: "road",
      elevation: 0,
      formationType: "open-ground",
      walkable: true,
      cover: 0,
      presetFeature: "village-road",
    });
  }

  for (let y = 2; y < height - 2; y += 1) {
    if (Math.abs(y - centerY) > Math.floor(height * 0.24)) continue;
    setCell(grid, centerX, y, {
      terrain: "road",
      elevation: 0,
      formationType: "open-ground",
      walkable: true,
      cover: 0,
      presetFeature: "village-crossroad",
    });
  }

  const buildingSites = [
    [-6, -4], [-2, -4], [3, -4], [7, -3],
    [-7, 3], [-3, 4], [3, 4], [7, 3],
  ];

  buildingSites.forEach(([dx, dy], index) => {
    const x = clamp(centerX + dx, 2, width - 3);
    const y = clamp(centerY + dy, 2, height - 3);

    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        if (Math.abs(ox) + Math.abs(oy) > 1) continue;
        const cx = x + ox;
        const cy = y + oy;
        if (!grid?.[cy]?.[cx]) continue;
        setCell(grid, cx, cy, {
          terrain: rand01(seed, cx, cy, 401) > 0.42 ? "rubble" : "dirt",
          elevation: rand01(seed, cx, cy, 402) > 0.82 ? 1 : 0,
          formationType: "rubble",
          walkable: true,
          cover: 1,
          presetFeature: "village-ruin-lot",
        });
      }
    }

    pushProp(props, seen, {
      id: `village-ruin-${index}`,
      type: "ruin",
      name: "Ruined Building Wall",
      x,
      y,
      rotation: Math.floor(rand01(seed, x, y, 403) * 6) * 60,
      scale: 1 + rand01(seed, x, y, 404) * 0.45,
      blocksMovement: false,
      blocksLineOfSight: true,
    });

    if (index % 3 === 0) {
      pushProp(props, seen, {
        id: `village-cart-${index}`,
        type: "cart",
        name: "Abandoned Cart",
        x: clamp(x + 1, 0, width - 1),
        y,
        rotation: Math.floor(rand01(seed, x, y, 405) * 6) * 60,
        scale: 1,
        blocksMovement: true,
        blocksLineOfSight: false,
      });
    }
  });

  return {
    preset: "ruined-village",
    version: BATTLEFIELD_PRESET_ART_VERSION,
    features: [
      "crossroads-plan",
      "ruin-lots",
      "rubble-clusters",
      "abandoned-carts",
    ],
  };
}

function authorOpenField(grid, seed, props) {
  const { width, height } = mapSize(grid);
  if (!width || !height) return null;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const broad =
        Math.sin(x * 0.12) * 0.45 +
        Math.sin(y * 0.15 + 1.4) * 0.35 +
        signed(seed, x, y, 501) * 0.18;
      const elevation = broad > 0.62 ? 1 : 0;
      const detail = rand01(seed, x, y, 502);
      setCell(grid, x, y, {
        terrain: detail > 0.965 ? "dirt" : "grass",
        elevation,
        formationType: elevation > 0 ? "elevated-ground" : "open-ground",
        walkable: true,
        cover: 0,
        presetFeature: elevation ? "field-rise" : "open-field",
      });
    }
  }

  return {
    preset: "open-field",
    version: BATTLEFIELD_PRESET_ART_VERSION,
    features: ["subtle-rolling-ground", "sparse-earth-patches"],
  };
}

function authorMuddyBattlefield(grid, seed, props) {
  const { width, height } = mapSize(grid);
  if (!width || !height) return null;
  const seen = existingPropKeys(props);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const wet = rand01(seed, x, y, 601);
      const disturbance =
        Math.sin(x * 0.38 + y * 0.16) +
        signed(seed, x, y, 602) * 0.7;
      const terrain =
        wet > 0.83 ? "rubble" :
        wet > 0.28 ? "mud" :
        "grass";
      const elevation =
        disturbance > 1.12 ? 1 :
        disturbance < -1.1 ? -1 :
        0;
      setCell(grid, x, y, {
        terrain,
        elevation,
        formationType:
          terrain === "mud" ? "mud" :
          terrain === "rubble" ? "rubble" :
          "open-ground",
        walkable: true,
        cover: terrain === "rubble" ? 1 : 0,
        presetFeature: "churned-battlefield",
      });

      if (terrain === "rubble" && wet > 0.96) {
        pushProp(props, seen, {
          id: `mud-boulder-${x}-${y}`,
          type: "boulder",
          name: "Battlefield Stone",
          x,
          y,
          scale: 0.7 + rand01(seed, x, y, 603) * 0.4,
          blocksMovement: true,
          blocksLineOfSight: true,
        });
      }
    }
  }

  return {
    preset: "muddy-battlefield",
    version: BATTLEFIELD_PRESET_ART_VERSION,
    features: ["churned-mud", "shell-like-depressions", "rubble-islands"],
  };
}

function authorHilltopDefense(grid, seed, props) {
  const { width, height } = mapSize(grid);
  if (!width || !height) return null;
  const seen = existingPropKeys(props);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const maxR = Math.max(1, Math.min(width, height) * 0.48);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = (x - cx) / maxR;
      const dy = (y - cy) / maxR;
      const radial = Math.sqrt(dx * dx + dy * dy);
      const irregular =
        signed(seed, x, y, 701) * 0.07 +
        Math.sin(x * 0.22 + y * 0.12) * 0.035;
      const shaped = radial + irregular;
      const elevation =
        shaped < 0.18 ? 6 :
        shaped < 0.32 ? 5 :
        shaped < 0.48 ? 4 :
        shaped < 0.64 ? 3 :
        shaped < 0.78 ? 2 :
        shaped < 0.92 ? 1 :
        0;

      const detail = rand01(seed, x, y, 702);
      const terrain =
        elevation >= 5 && detail > 0.62 ? "rock" :
        elevation >= 3 ? "hill" :
        detail > 0.9 ? "dirt" :
        "grass";

      setCell(grid, x, y, {
        terrain,
        elevation,
        formationType:
          elevation >= 2 ? "elevated-ground" : "open-ground",
        walkable: true,
        cover: terrain === "rock" ? 1 : 0,
        presetFeature:
          elevation >= 5 ? "hilltop-crown" :
          elevation >= 2 ? "hilltop-slope" :
          "hilltop-approach",
      });

      if (
        elevation >= 4 &&
        terrain === "rock" &&
        detail > 0.94
      ) {
        pushProp(props, seen, {
          id: `hilltop-boulder-${x}-${y}`,
          type: "boulder",
          name: "Hilltop Boulder",
          x,
          y,
          scale: 0.75 + rand01(seed, x, y, 703) * 0.45,
          blocksMovement: true,
          blocksLineOfSight: true,
        });
      }
    }
  }

  // One deliberate approach lane from the west keeps the hill tactically
  // readable instead of making every ascent equivalent.
  const approachY = Math.round(cy + signed(seed, 0, 0, 704) * 2);
  for (let x = 0; x <= Math.round(cx); x += 1) {
    const y = clamp(
      approachY + Math.round(Math.sin(x * 0.28) * 1.2),
      0,
      height - 1
    );
    if (!grid?.[y]?.[x]) continue;
    setCell(grid, x, y, {
      ...grid[y][x],
      terrain: "road",
      walkable: true,
      cover: 0,
      presetFeature: "hilltop-approach-road",
    });
  }

  return {
    preset: "hilltop-defense",
    version: BATTLEFIELD_PRESET_ART_VERSION,
    features: [
      "multi-band-hill",
      "high-crown",
      "asymmetric-approach",
      "rock-outcrops",
    ],
  };
}

export function applyBattlefieldPresetArtPass({
  presetKey,
  grid,
  props = [],
  seed = "battlefield",
} = {}) {
  if (!Array.isArray(grid) || grid.length === 0) return null;
  const key = normalize(presetKey);

  switch (key) {
    case "mountain-pass":
      return authorMountainPass(grid, seed, props);
    case "river-crossing":
      return authorRiverCrossing(grid, seed, props);
    case "mixed-wilderness":
      return authorForestRoad(grid, seed, props);
    case "ruined-village":
      return authorRuinedVillage(grid, seed, props);
    case "open-field":
      return authorOpenField(grid, seed, props);
    case "muddy-battlefield":
      return authorMuddyBattlefield(grid, seed, props);
    case "hilltop-defense":
      return authorHilltopDefense(grid, seed, props);
    default:
      return null;
  }
}

export default applyBattlefieldPresetArtPass;
