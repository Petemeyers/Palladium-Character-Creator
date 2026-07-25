import { getCombatAppearanceTokens } from "../../theme/combatAppearanceTokens.js";
import { BODY_VISUAL_STATES, getCombatantTokenVisualState } from "../combatantTokenVisualState.js";

const text = (value) => String(value ?? "").trim().toLowerCase();
const idOf = (fighter) => String(fighter?.id ?? fighter?._id ?? fighter?.fighterId ?? fighter?.characterId ?? "");
const freezeRing = (ring) => Object.freeze(ring);

function resolveAllegiance(fighter = {}, factionRelationship = null) {
  const side = text(fighter.team ?? fighter.side ?? fighter.battleSide ?? fighter.teamId ?? fighter.armyId);
  if (["party", "player", "players"].includes(side)) return "party";
  if (["ally", "allied", "friendly"].includes(side)) return "ally";
  if (["enemy", "enemies", "hostile"].includes(side)) return "enemy";
  if (["neutral", "civilian", "noncombatant"].includes(side)) return "neutral";
  if (fighter.isEnemy === true) return "enemy";
  if (fighter.isEnemy === false) return "party";
  const relationship = text(factionRelationship ?? fighter.factionRelationship ?? fighter.relationshipToLocalSide);
  if (["ally", "allied", "friendly"].includes(relationship)) return "ally";
  if (["enemy", "hostile", "opposed"].includes(relationship)) return "enemy";
  return "neutral";
}

function resolveSurrender(fighter, surrenderRecord, generationId) {
  const recordMatches = surrenderRecord
    && String(surrenderRecord.offeredById ?? "") === idOf(fighter)
    && (generationId == null || String(surrenderRecord.generationId) === String(generationId));
  const recordStatus = recordMatches ? text(surrenderRecord.status) : "";
  const recordResponse = recordMatches ? text(surrenderRecord.response) : "";
  const unresolved = ["offered", "response-pending", "accepted", "victor-decision-pending"].includes(recordStatus);
  const actorState = fighter.surrenderState || {};
  const combatState = text(fighter.combatState);
  const revoked = combatState === "cowering" || actorState.victorDecision === "revokeSurrenderAcceptance" || recordResponse === "refused";
  return {
    pending: Boolean(recordMatches && unresolved && recordStatus === "response-pending" && !revoked),
    captured: fighter.isCaptured === true || combatState === "captured" || text(fighter.prisonerState?.status) === "prisoner",
    surrendered: !revoked && (fighter.isSurrendered === true || ["surrendered", "yielded", "released"].includes(combatState)),
  };
}

function resolveMorale(fighter, visualState) {
  const values = [fighter.state?.moraleState, fighter.moraleState?.status, fighter.moraleState, fighter.status, visualState.moraleState].map(text);
  return {
    routed: values.some((value) => ["routed", "panicked", "panic", "broken", "fled"].includes(value)),
    removed: values.some((value) => ["broken", "fled"].includes(value)) || fighter.hasFled === true || fighter.state?.hasFledBattle === true,
  };
}

function resolveGrapple(fighter, grappleStateOverride) {
  const state = grappleStateOverride || fighter.grappleState || {};
  const stateKey = text(state.state);
  const position = text(state.positionState ?? fighter.positionState ?? fighter.posture);
  return {
    grappled: Boolean(state.opponent ?? state.opponentId) && !["", "neutral", "released", "ended"].includes(stateKey),
    prone: fighter.isProne === true || fighter.prone === true || fighter.collapsed === true || ["ground", "grounded", "prone", "collapsed"].includes(position),
  };
}

export function getCombatIconAppearance({
  fighter = {}, activeFighterId = null, selectedFighterId = null, targetFighterId = null,
  surrenderRecord = null, grappleState = null, factionRelationship = null, colorMode = "light",
  generationId = null, activeGenerationId = generationId,
} = {}) {
  const tokens = getCombatAppearanceTokens(colorMode);
  const visualState = getCombatantTokenVisualState(fighter);
  const allegianceKey = resolveAllegiance(fighter, factionRelationship);
  const explicitColor = fighter.visual?.tokenColor ?? fighter.visual?.iconColor ?? fighter.tokenColor ?? fighter.iconColor ?? fighter.color ?? null;
  const allegiance = Object.freeze({
    key: allegianceKey,
    baseColor: explicitColor || tokens[allegianceKey],
    innerColor: explicitColor || tokens[`${allegianceKey}Inner`],
  });
  const surrender = resolveSurrender(fighter, surrenderRecord, generationId);
  const morale = resolveMorale(fighter, visualState);
  const grapple = resolveGrapple(fighter, grappleState);
  const carrierLink = fighter.carrierLink || fighter.mountedState?.carrierLink || null;
  const mounted = ["mounted", "flying-mounted"].includes(carrierLink?.relationshipType)
    && !["released", "broken"].includes(text(carrierLink.state));
  const mountedFlight = carrierLink?.relationshipType === "flying-mounted"
    ? carrierLink.mountedFlightState || null
    : null;
  const id = idOf(fighter);
  const dead = visualState.bodyState === BODY_VISUAL_STATES.DEAD;
  const unconscious = visualState.bodyState === BODY_VISUAL_STATES.UNCONSCIOUS;
  const inactive = dead || unconscious || surrender.captured || surrender.surrendered || morale.removed;
  const generationMatches = generationId == null || activeGenerationId == null || String(generationId) === String(activeGenerationId);
  const active = Boolean(id && id === String(activeFighterId ?? "") && generationMatches && !inactive);
  const selected = Boolean(id && id === String(selectedFighterId ?? "") && !dead && !unconscious);
  const targeted = Boolean(id && id === String(targetFighterId ?? "") && !dead);

  const conditions = [
    dead && { key: "dead", color: tokens.dead, marker: "×", label: "Dead", priority: 1 },
    unconscious && { key: "unconscious", color: tokens.unconscious, marker: "✦", label: "Unconscious", priority: 2 },
    surrender.captured && { key: "captured", color: tokens.captured, marker: "▣", label: "Captured", priority: 3 },
    surrender.surrendered && { key: "surrendered", color: tokens.surrendered, marker: "✋", label: text(fighter.combatState) === "released" ? "Disarmed and released" : "Surrendered or yielded", priority: 4 },
    surrender.pending && { key: "surrender-pending", color: tokens.surrenderPending, marker: "?", label: "Surrender response pending", priority: 5, style: "dashed" },
    morale.routed && { key: "routed", color: tokens.routed, marker: "↗", label: "Routed or panicked", priority: 6, style: "dashed" },
    grapple.grappled && { key: "grappled", color: tokens.grappled, marker: "∞", label: "Grappled", priority: 7 },
    grapple.prone && { key: "prone", color: tokens.prone, marker: "▼", label: "Grounded or prone", priority: 8 },
  ].filter(Boolean);
  const interaction = [
    active && { key: "active", color: tokens.active, width: 3, style: "glow", priority: 9 },
    selected && { key: "selected", color: tokens.selected, width: 2, style: "dashed", priority: 10 },
    targeted && { key: "target", color: tokens.target, width: 2, style: "reticle", priority: 10.5 },
  ].filter(Boolean);
  const primaryCondition = conditions[0] || null;
  const primaryConditionRing = primaryCondition
    ? freezeRing({ key: primaryCondition.key, color: primaryCondition.color, width: 3, style: primaryCondition.style || "solid", priority: primaryCondition.priority, layer: 0 })
    : null;
  const primaryInteraction = interaction.find((ring) => ring.key === "target")
    || interaction.find((ring) => ring.key === "active")
    || interaction.find((ring) => ring.key === "selected")
    || null;
  const rings = Object.freeze([primaryConditionRing, primaryInteraction && freezeRing(primaryInteraction)].filter(Boolean));
  const primary = conditions[0] || (active ? { key: "active", color: tokens.active, marker: null, label: "Active turn", priority: 9 }
    : selected ? { key: "selected", color: tokens.selected, marker: null, label: "Selected", priority: 10 }
      : { key: `allegiance-${allegianceKey}`, color: allegiance.baseColor, marker: null, label: `${allegianceKey} fighter`, priority: 11 });
  const healthMarker = visualState.bodyState === BODY_VISUAL_STATES.CRITICAL ? { marker: "!", label: "Critical HP" }
    : visualState.bodyState === BODY_VISUAL_STATES.BLOODIED ? { marker: "◆", label: "Bloodied" }
      : visualState.bodyState === BODY_VISUAL_STATES.WOUNDED ? { marker: "•", label: "Wounded" } : null;
  const mountedRole = mounted
    ? String(carrierLink.passengerId) === id
      ? (mountedFlight ? "Airborne mounted rider" : "Mounted rider")
      : String(carrierLink.carrierId) === id
        ? (mountedFlight ? "Flying mount carrying rider" : "Mount carrying rider")
        : (mountedFlight ? "Mounted-flight relationship" : "Mounted relationship")
    : null;
  const mountedFlightLabel = mountedFlight
    ? `Altitude ${Number(fighter.flightState?.altitudeFeet ?? fighter.position?.altitudeFeet ?? fighter.altitudeFeet ?? fighter.altitude ?? 0)} feet; attachment ${mountedFlight.attachmentState || "unknown"}; control ${mountedFlight.controlState || "unknown"}`
    : null;
  const labels = [...conditions.map((condition) => condition.label), ...(healthMarker ? [healthMarker.label] : []), ...(mountedRole ? [mountedRole] : []), ...(mountedFlightLabel ? [mountedFlightLabel] : []), ...(active ? ["Active turn"] : []), ...(selected ? ["Selected"] : []), ...(targeted ? ["Targeted"] : [])];
  if (!labels.length) labels.push(`${allegianceKey} fighter`);
  const status = Object.freeze({ key: primary.key, color: primary.color, marker: primary.marker, label: primary.label });
  const opacity = dead ? 0.28 : unconscious ? 0.45 : surrender.captured ? 0.7 : surrender.surrendered ? 0.78 : 0.9;

  return Object.freeze({
    allegiance, status, active, selected, targeted, opacity, scale: selected ? 1.18 : 1,
    rings, accessibleLabel: `${fighter.name || "Fighter"}: ${labels.join("; ")}`, priorityReason: primary.key,
    colorMode, bodyState: visualState.bodyState, armorState: visualState.armorState, moraleState: visualState.moraleState,
    secondaryMarkers: Object.freeze(healthMarker ? [Object.freeze(healthMarker)] : []),
    baseColor: dead ? tokens.dead : allegiance.baseColor, innerColor: allegiance.innerColor,
    segmentColor: allegiance.innerColor, centerStrokeColor: allegiance.innerColor,
    borderColor: primary.color, borderWidth: 2,
    glow: active ? `0 0 12px ${tokens.active}` : "none", statusMarker: primary.marker, statusLabel: labels.join("; "),
    activeTurnIndicator: active, selectedIndicator: selected, targetedIndicator: targeted,
    activeColor: tokens.active, selectionColor: tokens.selected, targetColor: tokens.target,
    pendingSurrender: surrender.pending,
    externalRelationship: mounted
      ? Object.freeze({ key: mountedFlight ? "flying-mounted" : "mounted", marker: "R", label: mountedFlightLabel ? `${mountedRole}; ${mountedFlightLabel}` : mountedRole })
      : null,
  });
}

export default getCombatIconAppearance;
