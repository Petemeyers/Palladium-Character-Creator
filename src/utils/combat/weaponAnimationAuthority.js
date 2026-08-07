const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const CUE_PROFILES = Object.freeze({
  "point-displacement": Object.freeze({ animation: "weapon_displace", contact: "weapon", arc: "lateral", camera: "exchange" }),
  "guard-bind": Object.freeze({ animation: "weapon_bind", contact: "weapon", arc: "locked", camera: "exchange" }),
  "weapon-control": Object.freeze({ animation: "weapon_control", contact: "weapon", arc: "short", camera: "exchange" }),
  "hook-draw": Object.freeze({ animation: "weapon_hook", contact: "limb-or-guard", arc: "hook", camera: "exchange" }),
  "shaft-impact": Object.freeze({ animation: "weapon_shaft_impact", contact: "shaft", arc: "chop", camera: "impact" }),
  "impact-pulse": Object.freeze({ animation: "weapon_heavy_impact", contact: "armor-or-guard", arc: "impact", camera: "impact" }),
  "close-thrust": Object.freeze({ animation: "weapon_close_thrust", contact: "body-line", arc: "thrust", camera: "exchange" }),
  "shield-impact": Object.freeze({ animation: "shield_impact", contact: "shield", arc: "impact", camera: "impact" }),
  "shield-break": Object.freeze({ animation: "shield_break", contact: "shield", arc: "impact", camera: "impact" }),
  "formation-disruption": Object.freeze({ animation: "formation_stagger", contact: "formation", arc: "none", camera: "wide" }),
});

export const buildWeaponAnimationCue = (event = {}) => {
  const type = normalizeText(event?.type).replaceAll("_", "-");
  if (!type || !event?.actorId) return null;
  const profile = CUE_PROFILES[type] || CUE_PROFILES["weapon-control"];
  return Object.freeze({
    id: event.id || `${type}:${event.actorId}:${event.targetId || "none"}:${Date.now()}`,
    type,
    actorId: event.actorId,
    targetId: event.targetId || null,
    animation: event.animation || profile.animation,
    contact: event.contact || profile.contact,
    arc: event.arc || profile.arc,
    cameraHint: event.cameraHint || profile.camera,
    label: event.label || type,
    severity: event.severity || "normal",
    durationMs: Math.max(250, Number(event.durationMs) || 900),
    createdAt: Number(event.createdAt) || Date.now(),
    from: event.from || null,
    to: event.to || null,
    metadata: event.metadata || null,
  });
};

export const dedupeWeaponAnimationCues = (cues = [], limit = 16) => {
  const map = new Map();
  (Array.isArray(cues) ? cues : []).forEach((cue) => {
    const normalized = buildWeaponAnimationCue(cue);
    if (normalized) map.set(normalized.id, normalized);
  });
  return [...map.values()].slice(-Math.max(1, limit));
};
