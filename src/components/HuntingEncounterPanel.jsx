import React from "react";
import PropTypes from "prop-types";
import { getCanonicalHuntingPresentation } from "../utils/combat/canonicalHuntingEncounter.js";
import { getCanonicalCarcassProcessingPresentation } from "../utils/combat/canonicalCarcassProcessing.js";
import { getCanonicalFoodProcessingPresentation } from "../utils/combat/canonicalFoodProcessing.js";

const label = (value) => String(value ?? "none").replaceAll("-", " ");

export default function HuntingEncounterPanel({
  encounter,
  companionLink = null,
  carcass = null,
  foods = [],
  heatSources = [],
  foodProcessingContexts = [],
}) {
  const view = getCanonicalHuntingPresentation({ encounter, companionLink });
  const processing = getCanonicalCarcassProcessingPresentation({ carcass });
  const foodProcessing = getCanonicalFoodProcessingPresentation({
    foods,
    heatSources,
    contexts: foodProcessingContexts,
  });
  if (!view.visible && !processing.visible && !foodProcessing.visible) return null;

  return (
    <section className="rounded border border-amber-800/50 bg-stone-950/75 p-2 text-xs text-stone-200" aria-label={view.ariaLabel || "Post-hunt carcass processing"}>
      {view.visible && (
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
      )}
      {processing.visible && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 border-t border-amber-900/40 pt-1">
          <span>Carcass: {label(processing.species)}</span>
          <span>Recovery: {label(processing.recoveryState)}</span>
          <span>Condition: {label(processing.condition)}</span>
          <span>Claim: {label(processing.claimant)}</span>
          <span>Field dressing: {label(processing.fieldDressingState)}</span>
          <span>Remaining: {processing.remainingResources.length}</span>
          <span>Transfer: {processing.totalTransferWeight} lb</span>
          {processing.capacityWarning && <span>Capacity limited</span>}
          <span>Embedded projectiles: {processing.embeddedProjectileCount}</span>
          <span>Freshness: {label(processing.freshnessState)}</span>
          <span>Processing: {label(processing.processingOutcome)}</span>
        </div>
      )}
      {foodProcessing.visible && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 border-t border-orange-900/40 pt-1">
          <span>Food batches: {foodProcessing.foodCount}</span>
          <span>Portions: {foodProcessing.portions}</span>
          <span>Freshness: {foodProcessing.freshnessStates.map(label).join(", ") || "none"}</span>
          <span>Fire: {label(foodProcessing.heatSourceState)}</span>
          <span>Heat: {label(foodProcessing.heatClass)}</span>
          <span>Fuel: {label(foodProcessing.fuelState)}</span>
          {foodProcessing.selectedRecipe && <span>Recipe: {label(foodProcessing.selectedRecipe)}</span>}
          <span>Food processing: {label(foodProcessing.processingState)}</span>
        </div>
      )}
    </section>
  );
}

HuntingEncounterPanel.propTypes = {
  encounter: PropTypes.object,
  companionLink: PropTypes.object,
  carcass: PropTypes.object,
  foods: PropTypes.arrayOf(PropTypes.object),
  heatSources: PropTypes.arrayOf(PropTypes.object),
  foodProcessingContexts: PropTypes.arrayOf(PropTypes.object),
};
