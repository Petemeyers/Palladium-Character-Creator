import * as THREE from "three";
import {
  worldVectorFromEntity,
  HEX_RADIUS,
  HEX_TILE_THICKNESS,
} from "./hexGridMath.js";

export class SpottedAlertSystem {
  constructor(scene) {
    this.scene = scene;
    this.activeAlerts = new Map();
  }

  showAlert(enemy) {
    if (this.activeAlerts.has(enemy.id)) return;
    const ringGeo = new THREE.RingGeometry(0.35, 0.55, 32);
    const material = new THREE.MeshBasicMaterial({
      color: "#ff3333",
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, material);
    ring.rotation.x = -Math.PI / 2;
    const basePos = worldVectorFromEntity(
      enemy,
      HEX_RADIUS,
      HEX_TILE_THICKNESS
    );
    const position = basePos.clone();
    position.y += 0.1;
    ring.position.set(position);
    this.scene.add(ring);
    this.activeAlerts.set(enemy.id, ring);
    this.animatePulse(enemy.id);
  }

  animatePulse(id) {
    const ring = this.activeAlerts.get(id);
    if (!ring) return;
    let scale = 1;
    const step = () => {
      if (!this.activeAlerts.has(id)) return;
      scale += 0.06;
      ring.scale.set(scale, scale, scale);
      ring.material.opacity *= 0.93;
      if (ring.material.opacity <= 0.05) {
        this.scene.remove(ring);
        ring.geometry.dispose();
        ring.material.dispose();
        this.activeAlerts.delete(id);
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  dispose() {
    this.activeAlerts.forEach((ring) => {
      this.scene.remove(ring);
      ring.geometry?.dispose?.();
      ring.material?.dispose?.();
    });
    this.activeAlerts.clear();
  }
}
