import * as THREE from "three";

const material = (color, options = {}) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.88,
    metalness: options.metalness ?? 0,
    transparent: options.transparent === true,
    opacity: options.opacity ?? 1,
    side: options.side || THREE.FrontSide,
  });

const WOOD = () => material(0x7a4a24);
const DARK_WOOD = () => material(0x4f321e);
const LIGHT_WOOD = () => material(0xa16c3f);
const STONE = () => material(0x737373);
const IRON = () => material(0x4b5563, { metalness: 0.45, roughness: 0.58 });
const STRAW = () => material(0xc7a64b);
const CLOTH = () => material(0x8b2f2f);
const GREEN = () => material(0x2f6f3e);
const DARK_GREEN = () => material(0x174d2c);

function addBox(group, size, position, mat, name = null) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    mat
  );
  mesh.position.set(position[0], position[1], position[2]);
  if (name) mesh.name = name;
  group.add(mesh);
  return mesh;
}

function addCylinder(group, radiusTop, radiusBottom, height, segments, position, mat, rotation = null) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    mat
  );
  mesh.position.set(position[0], position[1], position[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  group.add(mesh);
  return mesh;
}

function addCone(group, radius, height, segments, position, mat) {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, segments),
    mat
  );
  mesh.position.set(position[0], position[1], position[2]);
  group.add(mesh);
  return mesh;
}

function addWheel(group, x, y, z, radius = 0.28) {
  return addCylinder(
    group,
    radius,
    radius,
    0.08,
    12,
    [x, y, z],
    DARK_WOOD(),
    [Math.PI / 2, 0, 0]
  );
}

function tree(group, {
  fruit = false,
  dead = false,
  stump = false,
} = {}) {
  if (stump) {
    addCylinder(group, 0.12, 0.17, 0.42, 9, [0, 0.21, 0], WOOD());
    return;
  }

  // Deliberately slimmer than the previous chunky editor placeholder.
  addCylinder(group, 0.045, 0.075, 1.45, 8, [0, 0.725, 0], WOOD());

  if (dead) {
    addBox(group, [0.65, 0.045, 0.045], [0.12, 1.15, 0], WOOD()).rotation.z = 0.42;
    return;
  }

  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 10, 8),
    DARK_GREEN()
  );
  crown.scale.set(1.05, 1.25, 0.95);
  crown.position.set(0, 1.42, 0);
  group.add(crown);

  if (fruit) {
    [[0.16,1.48,0.18],[-0.12,1.34,0.22],[0.08,1.62,-0.16]].forEach(([x,y,z]) => {
      const apple = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 6, 5),
        material(0xa32622)
      );
      apple.position.set(x, y, z);
      group.add(apple);
    });
  }
}

function table(group) {
  addBox(group, [0.9, 0.08, 0.6], [0, 0.58, 0], WOOD());
  for (const x of [-0.35, 0.35]) {
    for (const z of [-0.22, 0.22]) {
      addBox(group, [0.07, 0.55, 0.07], [x, 0.275, z], DARK_WOOD());
    }
  }
}

function chair(group, stool = false) {
  addBox(group, [0.38, 0.06, 0.38], [0, 0.38, 0], WOOD());
  for (const x of [-0.14, 0.14]) {
    for (const z of [-0.14, 0.14]) {
      addBox(group, [0.045, 0.36, 0.045], [x, 0.18, z], DARK_WOOD());
    }
  }
  if (!stool) {
    addBox(group, [0.38, 0.42, 0.05], [0, 0.66, -0.16], WOOD());
  }
}

function bench(group) {
  addBox(group, [0.95, 0.07, 0.34], [0, 0.38, 0], WOOD());
  addBox(group, [0.08, 0.36, 0.25], [-0.34, 0.18, 0], DARK_WOOD());
  addBox(group, [0.08, 0.36, 0.25], [0.34, 0.18, 0], DARK_WOOD());
}

function bed(group) {
  addBox(group, [1.05, 0.18, 0.58], [0, 0.28, 0], DARK_WOOD());
  addBox(group, [0.98, 0.12, 0.52], [0, 0.42, 0], material(0xb7a78f));
  addBox(group, [0.22, 0.09, 0.44], [-0.34, 0.52, 0], material(0xe0d5c2));
}

function chest(group) {
  addBox(group, [0.62, 0.38, 0.42], [0, 0.19, 0], DARK_WOOD());
  const lid = addBox(group, [0.64, 0.10, 0.44], [0, 0.43, 0], WOOD());
  lid.rotation.z = 0;
  addBox(group, [0.06, 0.18, 0.03], [0, 0.24, 0.226], IRON());
}

function barrel(group, scale = 1) {
  const body = addCylinder(group, 0.26*scale, 0.29*scale, 0.62*scale, 12, [0, 0.31*scale, 0], WOOD());
  body.scale.x = 0.94;
  for (const y of [0.12, 0.31, 0.50].map(v => v*scale)) {
    addCylinder(group, 0.278*scale, 0.278*scale, 0.035*scale, 12, [0, y, 0], IRON());
  }
}

function shelf(group) {
  for (const y of [0.15, 0.55, 0.95]) {
    addBox(group, [0.85, 0.06, 0.28], [0, y, 0], WOOD());
  }
  addBox(group, [0.07, 1.05, 0.07], [-0.37, 0.525, 0], DARK_WOOD());
  addBox(group, [0.07, 1.05, 0.07], [0.37, 0.525, 0], DARK_WOOD());
}

function cage(group) {
  const w = 0.78;
  const h = 1.0;
  for (const x of [-w/2, w/2]) {
    for (const z of [-w/2, w/2]) {
      addBox(group, [0.045, h, 0.045], [x, h/2, z], IRON());
    }
  }
  for (let x = -0.28; x <= 0.28; x += 0.14) {
    addBox(group, [0.025, h, 0.025], [x, h/2, w/2], IRON());
  }
  addBox(group, [w+0.08, 0.06, w+0.08], [0, h, 0], IRON());
}

function hearth(group) {
  addBox(group, [0.9, 0.25, 0.58], [0, 0.125, 0], STONE());
  addBox(group, [0.70, 0.08, 0.42], [0, 0.29, 0], material(0x4a2518));
  for (const x of [-0.18, 0, 0.18]) {
    addCone(group, 0.10, 0.34, 8, [x, 0.50 + Math.abs(x)*0.2, 0], material(0xe85d1f));
  }
}

function brazier(group) {
  addCylinder(group, 0.20, 0.25, 0.12, 12, [0, 0.55, 0], IRON());
  addBox(group, [0.05, 0.5, 0.05], [0, 0.26, 0], IRON());
  addCone(group, 0.12, 0.28, 8, [0, 0.78, 0], material(0xe85d1f));
}

function cart(group, wagon = false) {
  const len = wagon ? 1.25 : 0.9;
  addBox(group, [len, 0.35, 0.65], [0, 0.55, 0], WOOD());
  addWheel(group, -len*0.28, 0.34, -0.36, wagon ? 0.32 : 0.27);
  addWheel(group, len*0.28, 0.34, -0.36, wagon ? 0.32 : 0.27);
  addWheel(group, -len*0.28, 0.34, 0.36, wagon ? 0.32 : 0.27);
  addWheel(group, len*0.28, 0.34, 0.36, wagon ? 0.32 : 0.27);
  if (wagon) {
    addBox(group, [0.06, 0.75, 0.06], [-0.5, 0.95, -0.3], WOOD());
    addBox(group, [0.06, 0.75, 0.06], [0.5, 0.95, -0.3], WOOD());
  }
}

function hay(group, stack = false) {
  if (stack) {
    addCone(group, 0.55, 0.9, 10, [0, 0.45, 0], STRAW());
  } else {
    addBox(group, [0.72, 0.42, 0.50], [0, 0.21, 0], STRAW());
  }
}

function crop(group, type) {
  const green = type === "cabbage";
  if (green) {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), GREEN());
    head.scale.set(1.15, 0.75, 1.15);
    head.position.y = 0.15;
    group.add(head);
    return;
  }
  for (let i = -2; i <= 2; i += 1) {
    const x = i * 0.12;
    addBox(group, [0.018, 0.55, 0.018], [x, 0.275, 0], GREEN());
    addCone(group, 0.045, 0.16, 6, [x, 0.60, 0], STRAW());
  }
}

function barricade(group, stakesMode = false) {
  for (let i = -2; i <= 2; i += 1) {
    const x = i * 0.22;
    const beam = addBox(group, [0.08, stakesMode ? 0.9 : 0.75, 0.08], [x, 0.40, 0], WOOD());
    beam.rotation.z = stakesMode ? -0.35 : (i % 2 ? 0.55 : -0.55);
  }
  if (!stakesMode) addBox(group, [1.15, 0.08, 0.10], [0, 0.42, 0], DARK_WOOD());
}

function ladder(group) {
  addBox(group, [0.055, 1.35, 0.055], [-0.24, 0.675, 0], WOOD());
  addBox(group, [0.055, 1.35, 0.055], [0.24, 0.675, 0], WOOD());
  for (let y = 0.15; y <= 1.2; y += 0.18) {
    addBox(group, [0.48, 0.035, 0.04], [0, y, 0], LIGHT_WOOD());
  }
}

function banner(group) {
  addBox(group, [0.04, 1.5, 0.04], [0, 0.75, 0], DARK_WOOD());
  const cloth = addBox(group, [0.5, 0.72, 0.025], [0.25, 1.14, 0], CLOTH());
  cloth.position.x = 0.25;
}

function well(group) {
  addCylinder(group, 0.48, 0.48, 0.45, 16, [0, 0.225, 0], STONE());
  addCylinder(group, 0.31, 0.31, 0.47, 16, [0, 0.235, 0], material(0x1e293b));
  addBox(group, [0.05, 0.9, 0.05], [-0.42, 0.65, 0], WOOD());
  addBox(group, [0.05, 0.9, 0.05], [0.42, 0.65, 0], WOOD());
  addBox(group, [0.9, 0.05, 0.05], [0, 1.08, 0], WOOD());
}

function rowboat(group, raftMode = false) {
  if (raftMode) {
    for (let z = -0.35; z <= 0.35; z += 0.14) {
      addCylinder(group, 0.07, 0.07, 1.25, 8, [0, 0.09, z], WOOD(), [0,0,Math.PI/2]);
    }
    return;
  }
  const hull = addBox(group, [1.4, 0.28, 0.62], [0, 0.18, 0], DARK_WOOD());
  hull.scale.set(1, 1, 0.75);
  addBox(group, [0.72, 0.05, 0.58], [-0.25, 0.38, 0], WOOD());
  addBox(group, [0.72, 0.05, 0.58], [0.25, 0.38, 0], WOOD());
}

function marketStall(group) {
  addBox(group, [1.1, 0.12, 0.65], [0, 0.5, 0], WOOD());
  for (const x of [-0.45, 0.45]) {
    addBox(group, [0.06, 1.15, 0.06], [x, 0.575, -0.25], DARK_WOOD());
  }
  addBox(group, [1.25, 0.07, 0.85], [0, 1.18, 0], CLOTH());
}

export function createBattlefieldPropFallbackMesh(prop = {}) {
  const group = new THREE.Group();
  const type = String(prop?.type || "crate").toLowerCase();

  switch (type) {
    case "tree":
      tree(group);
      break;
    case "apple-tree":
      tree(group, { fruit: true });
      break;
    case "stump":
      tree(group, { stump: true });
      break;
    case "fallen-log": {
      const log = addCylinder(group, 0.12, 0.16, 1.2, 8, [0, 0.18, 0], WOOD(), [0,0,Math.PI/2]);
      log.rotation.z = Math.PI / 2;
      break;
    }
    case "boulder": {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.42, 0),
        STONE()
      );
      rock.position.y = 0.42;
      rock.scale.set(1.15, 0.8, 0.95);
      group.add(rock);
      break;
    }
    case "table":
      table(group);
      break;
    case "chair":
      chair(group, false);
      break;
    case "stool":
      chair(group, true);
      break;
    case "bench":
      bench(group);
      break;
    case "bed":
      bed(group);
      break;
    case "chest":
      chest(group);
      break;
    case "barrel":
      barrel(group, 1);
      break;
    case "keg":
      barrel(group, 0.78);
      break;
    case "shelf":
    case "cupboard":
    case "weapon-rack":
      shelf(group);
      break;
    case "hearth":
      hearth(group);
      break;
    case "brazier":
    case "campfire":
      brazier(group);
      break;
    case "cage":
      cage(group);
      break;
    case "cart":
      cart(group, false);
      break;
    case "wagon":
      cart(group, true);
      break;
    case "hay-bale":
      hay(group, false);
      break;
    case "haystack":
      hay(group, true);
      break;
    case "wheat":
    case "barley":
    case "cabbage":
      crop(group, type);
      break;
    case "barricade":
    case "mantlet":
      barricade(group, false);
      break;
    case "stakes":
      barricade(group, true);
      break;
    case "ladder":
      ladder(group);
      break;
    case "banner":
      banner(group);
      break;
    case "well":
      well(group);
      break;
    case "rowboat":
      rowboat(group, false);
      break;
    case "raft":
      rowboat(group, true);
      break;
    case "market-stall":
      marketStall(group);
      break;
    case "grain-sack":
      addBox(group, [0.42, 0.55, 0.30], [0, 0.275, 0], material(0x9b8a6a));
      break;
    case "basket":
      addCylinder(group, 0.22, 0.18, 0.32, 10, [0, 0.16, 0], material(0x9a6f3f));
      break;
    case "bar-counter":
      addBox(group, [1.1, 0.85, 0.45], [0, 0.425, 0], DARK_WOOD());
      break;
    case "altar":
      addBox(group, [0.95, 0.70, 0.55], [0, 0.35, 0], STONE());
      break;
    case "candle-stand":
      addBox(group, [0.07, 0.85, 0.07], [0, 0.425, 0], IRON());
      addCone(group, 0.05, 0.14, 6, [0, 0.97, 0], material(0xf59e0b));
      break;
    case "crate":
    case "ammo-crate":
    default:
      addBox(group, [0.75, 0.75, 0.75], [0, 0.375, 0], LIGHT_WOOD());
      addBox(group, [0.78, 0.05, 0.08], [0, 0.38, 0.39], DARK_WOOD());
      break;
  }

  group.traverse((child) => {
    child.castShadow = true;
    child.receiveShadow = true;
  });

  return group;
}

export default createBattlefieldPropFallbackMesh;
