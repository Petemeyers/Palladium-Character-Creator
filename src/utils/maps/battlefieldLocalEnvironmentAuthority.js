import { normalizeBattlefieldMap } from "./battlefieldMapAuthority.js";
import { getBattlefieldPropDefinition, getBattlefieldPropOffset, normalizeBattlefieldProp } from "./battlefieldPropCatalog.js";

const CELL_SIZE_FEET = 5;
const toFinite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function oddRToCube(x, y) {
  const q = x - (y - (y & 1)) / 2;
  const r = y;
  return { x: q, z: r, y: -q - r };
}

function distanceHexes(a, b) {
  const ac = oddRToCube(Number(a.x), Number(a.y));
  const bc = oddRToCube(Number(b.x), Number(b.y));
  return Math.max(Math.abs(ac.x - bc.x), Math.abs(ac.y - bc.y), Math.abs(ac.z - bc.z));
}

function getProps(map) {
  return Array.isArray(map?.props) ? map.props : [];
}

export function resolveBattlefieldLocalEnvironmentAtCell({ battlefield, position } = {}) {
  if (!position) return { illumination: 0, lightRadiusFeet: 0, lightSources: [], smokeOcclusion: 0, smokeSources: [] };
  const rawMap = battlefield?.battlefieldMap || battlefield || {};
  const map = rawMap?.schemaVersion && Array.isArray(rawMap?.grid) ? rawMap : normalizeBattlefieldMap(rawMap);
  let illumination = 0;
  let lightRadiusFeet = 0;
  let smokeOcclusion = 0;
  const lightSources = [];
  const smokeSources = [];

  for (const rawProp of getProps(map)) {
    const prop = normalizeBattlefieldProp(rawProp);
    const propPos = getBattlefieldPropOffset(prop, map);
    if (!propPos) continue;
    const distanceFeet = distanceHexes(position, propPos) * CELL_SIZE_FEET;
    const definition = getBattlefieldPropDefinition(prop.type);
    const light = prop.lightSource || definition.lightSource;
    if (light) {
      const radiusFeet = Math.max(5, toFinite(light.radiusFeet, 30) * Math.max(0.1, toFinite(prop.scale, 1)));
      if (distanceFeet <= radiusFeet) {
        const falloff = Math.max(0, 1 - distanceFeet / radiusFeet);
        const strength = Math.max(0, toFinite(light.intensity, 0.6)) * falloff;
        illumination = Math.max(illumination, strength);
        lightRadiusFeet = Math.max(lightRadiusFeet, radiusFeet);
        lightSources.push({ propId: prop.id, type: prop.type, x: propPos.x, y: propPos.y, distanceFeet, radiusFeet, strength, color: light.color || "#ffd28a" });
      }
    }

    const atmosphere = prop.localAtmosphere || definition.localAtmosphere;
    if (atmosphere?.type === "smoke") {
      const radiusFeet = Math.max(5, toFinite(atmosphere.radiusFeet, 15) * Math.max(0.1, toFinite(prop.scale, 1)));
      if (distanceFeet <= radiusFeet) {
        const falloff = Math.max(0.15, 1 - distanceFeet / Math.max(radiusFeet, 1));
        const occlusion = Math.max(0, toFinite(atmosphere.occlusion, 0.5)) * falloff;
        smokeOcclusion += occlusion;
        smokeSources.push({ propId: prop.id, type: prop.type, x: propPos.x, y: propPos.y, distanceFeet, radiusFeet, occlusion });
      }
    }
  }

  return {
    illumination: Math.min(1, illumination),
    lightRadiusFeet,
    lightSources,
    smokeOcclusion: Math.min(2, smokeOcclusion),
    smokeSources,
  };
}

export function resolveBattlefieldLocalVisualRange({ battlefield, observerPosition, targetPosition = null, baseRangeFeet = 5 } = {}) {
  const observerEnvironment = resolveBattlefieldLocalEnvironmentAtCell({ battlefield, position: observerPosition });
  const targetEnvironment = targetPosition ? resolveBattlefieldLocalEnvironmentAtCell({ battlefield, position: targetPosition }) : null;
  let rangeFeet = Math.max(5, toFinite(baseRangeFeet, 5));
  if (observerEnvironment.illumination > 0) rangeFeet = Math.max(rangeFeet, observerEnvironment.lightRadiusFeet);
  if (targetEnvironment?.illumination > 0) rangeFeet = Math.max(rangeFeet, Math.min(60, targetEnvironment.lightRadiusFeet + 15));
  return { rangeFeet: Math.floor(rangeFeet), observerEnvironment, targetEnvironment };
}

export function resolveBattlefieldSmokeAlongTrace({ battlefield, trace = [] } = {}) {
  let occlusion = 0;
  const cells = [];
  for (const point of Array.isArray(trace) ? trace.slice(1, -1) : []) {
    const local = resolveBattlefieldLocalEnvironmentAtCell({ battlefield, position: point });
    if (local.smokeOcclusion <= 0) continue;
    occlusion += local.smokeOcclusion;
    cells.push({ x: point.x, y: point.y, occlusion: local.smokeOcclusion, sources: local.smokeSources });
    if (occlusion >= 1) break;
  }
  return { blocked: occlusion >= 1, occlusion, cells };
}

export default resolveBattlefieldLocalEnvironmentAtCell;
