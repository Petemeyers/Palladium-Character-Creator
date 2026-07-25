import React from "react";
import PropTypes from "prop-types";
import { getCanonicalHuntingPresentation } from "../utils/combat/canonicalHuntingEncounter.js";

const label = (value) => String(value ?? "none").replaceAll("-", " ");

export default function HuntingEncounterPanel({ encounter, companionLink = null }) {
  const view = getCanonicalHuntingPresentation({ encounter, companionLink });
  if (!view.visible) return null;

  return (
    <section className="rounded border border-amber-800/50 bg-stone-950/75 p-2 text-xs text-stone-200" aria-label={view.ariaLabel}>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <span>Hunt: {label(view.phase)}</span>
        <span>Quarry: {label(view.quarryStatus)}</span>
        <span>Awareness: {label(view.quarryAwareness)}</span>
        <span>Tracks: {label(view.trackConfidence)}</span>
        {view.windDirection !== "unknown" && <span>Wind: {label(view.windDirection)}</span>}
        {view.companionCommand !== "none" && <span>Companion: {label(view.companionCommand)}</span>}
        {view.pursuitStatus !== "none" && <span>Pursuit: {label(view.pursuitStatus)}</span>}
        {view.outcome && <span>Outcome: {label(view.outcome)}</span>}
      </div>
    </section>
  );
}

HuntingEncounterPanel.propTypes = {
  encounter: PropTypes.object,
  companionLink: PropTypes.object,
};
