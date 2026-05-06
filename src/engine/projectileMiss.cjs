const WORLD_UP = { x: 0, y: 1, z: 0 };
const EPSILON = 0.0001;

function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(v, n) {
  return { x: v.x * n, y: v.y * n, z: v.z * n };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function lengthSq(v) {
  return dot(v, v);
}

function normalize(v, fallback = { x: 0, y: 0, z: 1 }) {
  const lenSq = lengthSq(v);
  if (lenSq < EPSILON) return { ...fallback };
  const inv = 1 / Math.sqrt(lenSq);
  return scale(v, inv);
}

function toShotPoint(pos = {}) {
  return {
    x: safeNum(pos.x ?? pos.q ?? pos.col, 0),
    y: safeNum(pos.altitudeWorld ?? pos.yWorld ?? pos.heightWorld, safeNum(pos.altitudeFeet ?? pos.altitude, 0) / 5),
    z: safeNum(pos.y ?? pos.r ?? pos.row, 0),
  };
}

function fromShotPoint(point) {
  return {
    x: point.x,
    y: point.z,
    altitudeFeet: point.y * 5,
  };
}

function buildShotBasis(origin, targetPos) {
  const forward = normalize(sub(targetPos, origin));
  let right = normalize(cross(WORLD_UP, forward), { x: 1, y: 0, z: 0 });

  if (lengthSq(right) < EPSILON) {
    right = { x: 1, y: 0, z: 0 };
  }

  const up = normalize(cross(forward, right), WORLD_UP);
  return { forward, right, up };
}

function buildMissImpactPoint({
  origin,
  targetPos,
  missMargin,
  clock,
  ringSpacing = 0.35,
  baseOvershoot = 0.4,
  overshootStep = 0.15,
}) {
  const shotOrigin = toShotPoint(origin);
  const shotTarget = toShotPoint(targetPos);
  const { forward, right, up } = buildShotBasis(shotOrigin, shotTarget);
  const angleDeg = (safeNum(clock, 12) % 12) * 30;
  const angleRad = (angleDeg * Math.PI) / 180;

  const offsetDir = normalize(add(scale(up, Math.cos(angleRad)), scale(right, Math.sin(angleRad))));
  const radius = Math.max(0, safeNum(missMargin, 0)) * safeNum(ringSpacing, 0.35);
  const overshoot = safeNum(baseOvershoot, 0.4) + Math.max(0, safeNum(missMargin, 0)) * safeNum(overshootStep, 0.15);

  return fromShotPoint(add(add(shotTarget, scale(offsetDir, radius)), scale(forward, overshoot)));
}

function getCollisionRadius(fighter = {}) {
  const footprintFeet = safeNum(fighter?.footprint?.feet ?? fighter?.sizeFeet ?? fighter?.diameterFeet, 5);
  const radiusFromFeet = Math.max(0.25, footprintFeet / 10);
  return safeNum(fighter?.collisionRadius ?? fighter?.footprint?.collisionRadius, radiusFromFeet);
}

function closestPointOnSegment(origin, end, point) {
  const segment = sub(end, origin);
  const lenSq = lengthSq(segment);
  if (lenSq < EPSILON) return { t: 0, point: origin, distanceSq: lengthSq(sub(point, origin)) };
  const t = Math.max(0, Math.min(1, dot(sub(point, origin), segment) / lenSq));
  const closest = add(origin, scale(segment, t));
  return { t, point: closest, distanceSq: lengthSq(sub(point, closest)) };
}

function getStrayChance(missMargin) {
  const margin = Math.max(0, Math.floor(safeNum(missMargin, 0)));
  if (margin === 1) return 0.3;
  if (margin === 2) return 0.2;
  if (margin === 3) return 0.1;
  if (margin === 4) return 0.05;
  return 0;
}

function findStrayCandidate({
  origin,
  impactPoint,
  primaryTargetId,
  attackerId,
  fighters = [],
  positions = {},
  missMargin,
}) {
  const chance = getStrayChance(missMargin);
  if (chance <= 0) return null;

  const shotOrigin = toShotPoint(origin);
  const shotImpact = toShotPoint(impactPoint);
  let best = null;

  for (const fighter of fighters || []) {
    const id = fighter?.id ?? fighter?._id;
    if (!id || id === primaryTargetId || id === attackerId) continue;
    const pos = positions[id];
    if (!pos) continue;

    const center = toShotPoint(pos);
    const radius = getCollisionRadius(fighter);
    const hit = closestPointOnSegment(shotOrigin, shotImpact, center);
    if (hit.t <= 0 || hit.t >= 1 || hit.distanceSq > radius * radius) continue;
    if (!best || hit.t < best.t) {
      best = {
        targetId: id,
        t: hit.t,
        hitPoint: fromShotPoint(hit.point),
        chance,
      };
    }
  }

  return best;
}

function rollClock(rngState, rollInt) {
  if (rngState && typeof rollInt === "function") {
    const out = rollInt(rngState, 12);
    return { clock: out.value, rngState: out.nextRngState };
  }
  return { clock: 1 + Math.floor(Math.random() * 12), rngState };
}

function rollChance(rngState, rollInt) {
  if (rngState && typeof rollInt === "function") {
    const out = rollInt(rngState, 100);
    return { value: out.value / 100, rngState: out.nextRngState };
  }
  return { value: Math.random(), rngState };
}

module.exports = {
  buildMissImpactPoint,
  findStrayCandidate,
  getStrayChance,
  rollChance,
  rollClock,
  toShotPoint,
};
