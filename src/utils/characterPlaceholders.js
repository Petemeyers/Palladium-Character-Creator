import * as THREE from "three";
import {
  worldVectorFromEntity,
  HEX_RADIUS,
  HEX_TILE_THICKNESS,
} from "./hexGridMath.js";

export function createCharacterIcon(character = {}) {
  const {
    q = 0,
    r = 0,
    height = 0,
    name = "Unit",
    alignment = "neutral",
  } = character;

  const group = new THREE.Group();

  const geometry = new THREE.CircleGeometry(0.5, 16);
  const material = new THREE.MeshBasicMaterial({
    color: alignment === "evil" ? "#AA0000" : "#00AAFF",
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const token = new THREE.Mesh(geometry, material);
  token.rotation.x = -Math.PI / 2;
  token.userData = {
    ...character,
    type: "character",
  };
  group.add(token);

  const label = makeTextSprite(name || "Unknown");
  label.position.y = 0.7;
  group.add(label);

  const pos = worldVectorFromEntity(
    { q, r, height },
    HEX_RADIUS,
    HEX_TILE_THICKNESS
  );
  group.position.copy(pos);

  group.userData = { ...character, type: "characterGroup" };
  return group;
}

function makeTextSprite(text) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to obtain 2D context for character label.");
  }
  ctx.font = "Bold 22px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "white";
  ctx.strokeStyle = "black";
  ctx.lineWidth = 4;
  ctx.strokeText(text, 4, 4);
  ctx.fillText(text, 4, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(1.6, 0.5, 1);
  return sprite;
}

export function updateCharacterBillboards(characters = [], camera) {
  if (!camera) return;
  characters.forEach((icon) => {
    const dx = camera.position.x - icon.position.x;
    const dz = camera.position.z - icon.position.z;
    icon.rotation.y = Math.atan2(dx, dz);
    icon.children.forEach((child) => {
      if (child.isSprite) {
        child.lookAt(camera.position);
      }
    });
  });
}
