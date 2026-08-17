import {
  BATTLEFIELD_FOG,
  BATTLEFIELD_LIGHTING,
  normalizeBattlefieldMap,
} from "../maps/battlefieldMapAuthority.js";

const LIGHTING_3D_PROFILES = Object.freeze({
  [BATTLEFIELD_LIGHTING.BRIGHT_DAYLIGHT]: Object.freeze({
    background: "#87ceeb",
    hemisphereSky: "#a7d8ff",
    hemisphereGround: "#8b7355",
    hemisphereIntensity: 0.72,
    ambientColor: "#ffffff",
    ambientIntensity: 0.34,
    sunColor: "#fff4e6",
    sunIntensity: 1.18,
    fillColor: "#dbeafe",
    fillIntensity: 0.28,
    exposure: 1,
  }),
  [BATTLEFIELD_LIGHTING.DAYLIGHT]: Object.freeze({
    background: "#91b8cf",
    hemisphereSky: "#a7cbe0",
    hemisphereGround: "#81705c",
    hemisphereIntensity: 0.62,
    ambientColor: "#f8fafc",
    ambientIntensity: 0.3,
    sunColor: "#fff0d2",
    sunIntensity: 0.95,
    fillColor: "#dbeafe",
    fillIntensity: 0.24,
    exposure: 0.92,
  }),
  [BATTLEFIELD_LIGHTING.DUSK]: Object.freeze({
    background: "#6b7280",
    hemisphereSky: "#64748b",
    hemisphereGround: "#5b4636",
    hemisphereIntensity: 0.42,
    ambientColor: "#cbd5e1",
    ambientIntensity: 0.2,
    sunColor: "#f59e7b",
    sunIntensity: 0.5,
    fillColor: "#93c5fd",
    fillIntensity: 0.12,
    exposure: 0.7,
  }),
  [BATTLEFIELD_LIGHTING.MOONLIGHT]: Object.freeze({
    background: "#172033",
    hemisphereSky: "#334155",
    hemisphereGround: "#171717",
    hemisphereIntensity: 0.3,
    ambientColor: "#94a3b8",
    ambientIntensity: 0.12,
    sunColor: "#b9d4ff",
    sunIntensity: 0.24,
    fillColor: "#64748b",
    fillIntensity: 0.08,
    exposure: 0.46,
  }),
  [BATTLEFIELD_LIGHTING.TORCHLIGHT]: Object.freeze({
    background: "#1c1712",
    hemisphereSky: "#34271d",
    hemisphereGround: "#15120f",
    hemisphereIntensity: 0.2,
    ambientColor: "#f3c38b",
    ambientIntensity: 0.14,
    sunColor: "#ffb45c",
    sunIntensity: 0.22,
    fillColor: "#7c4a2b",
    fillIntensity: 0.08,
    exposure: 0.5,
  }),
  [BATTLEFIELD_LIGHTING.DARKNESS]: Object.freeze({
    background: "#070b12",
    hemisphereSky: "#101827",
    hemisphereGround: "#050608",
    hemisphereIntensity: 0.08,
    ambientColor: "#64748b",
    ambientIntensity: 0.045,
    sunColor: "#8aa4c8",
    sunIntensity: 0.04,
    fillColor: "#475569",
    fillIntensity: 0.025,
    exposure: 0.22,
  }),
});

const FOG_3D_PROFILES = Object.freeze({
  [BATTLEFIELD_FOG.CLEAR]: Object.freeze({ enabled: false, color: "#b9c9d4", near: 120, far: 500 }),
  [BATTLEFIELD_FOG.MIST]: Object.freeze({ enabled: true, color: "#b9c2c7", near: 26, far: 150 }),
  [BATTLEFIELD_FOG.FOG]: Object.freeze({ enabled: true, color: "#a7afb3", near: 12, far: 78 }),
  [BATTLEFIELD_FOG.DENSE_FOG]: Object.freeze({ enabled: true, color: "#969da1", near: 5, far: 38 }),
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

/**
 * Pure Three.js presentation recipe. Combat visibility remains authoritative in
 * battlefieldVisibilityAuthority; this only tells HexArena how the same
 * environment should look.
 */
export function resolveBattlefieldEnvironment3D(battlefield = {}) {
  const map = normalizeBattlefieldMap(battlefield?.battlefieldMap || battlefield || {});
  const lightingKey = map.environment?.lighting || BATTLEFIELD_LIGHTING.BRIGHT_DAYLIGHT;
  const lighting = LIGHTING_3D_PROFILES[lightingKey] || LIGHTING_3D_PROFILES[BATTLEFIELD_LIGHTING.BRIGHT_DAYLIGHT];
  const fogType = map.environment?.environmentalFog?.type || BATTLEFIELD_FOG.CLEAR;
  const fogBase = FOG_3D_PROFILES[fogType] || FOG_3D_PROFILES[BATTLEFIELD_FOG.CLEAR];
  const density = clamp(map.environment?.environmentalFog?.density ?? 0, 0, 1);
  const fogScale = fogBase.enabled ? (1.15 - density * 0.45) : 1;
  const fog = {
    ...fogBase,
    type: fogType,
    density,
    near: Math.max(1, Math.round(fogBase.near * fogScale)),
    far: Math.max(8, Math.round(fogBase.far * fogScale)),
  };

  return {
    lightingKey,
    fogType,
    background: lighting.background,
    exposure: lighting.exposure,
    hemisphere: {
      skyColor: lighting.hemisphereSky,
      groundColor: lighting.hemisphereGround,
      intensity: lighting.hemisphereIntensity,
    },
    ambient: {
      color: lighting.ambientColor,
      intensity: lighting.ambientIntensity,
    },
    sun: {
      color: lighting.sunColor,
      intensity: lighting.sunIntensity,
    },
    fill: {
      color: lighting.fillColor,
      intensity: lighting.fillIntensity,
    },
    fog,
  };
}

export function getBattlefieldEnvironment3DSignature(battlefield = {}) {
  const recipe = resolveBattlefieldEnvironment3D(battlefield);
  return JSON.stringify({
    lightingKey: recipe.lightingKey,
    fogType: recipe.fogType,
    fogDensity: recipe.fog.density,
  });
}

export default resolveBattlefieldEnvironment3D;
