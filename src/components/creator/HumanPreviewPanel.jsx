/* eslint-disable react/prop-types */
import React, { useEffect, useMemo } from "react";
import { buildHumanVisualProfileFromAttributes } from "../../utils/visuals/humanVisualProfile";

export default function HumanPreviewPanel({ stats, onVisualProfileChange }) {
  const visualProfile = useMemo(
    () => buildHumanVisualProfileFromAttributes(stats),
    [stats]
  );

  useEffect(() => {
    onVisualProfileChange?.(visualProfile);

    console.log("PS final:", visualProfile.armMorph.psTotal);
    console.log("Arm morph tier:", visualProfile.armMorphTier);
    console.log("Arm morph weight:", visualProfile.armMorphWeight);
    console.log("Morph target:", visualProfile.armMorph.target);
  }, [visualProfile, onVisualProfileChange]);

  return (
    <div className="human-preview-panel">
      <h3>Human Preview</h3>

      <div>
        <strong>Body:</strong> {visualProfile.body}
      </div>
      <div>
        <strong>Face:</strong> {visualProfile.face}
      </div>
      <div>
        <strong>Idle:</strong> {visualProfile.idle}
      </div>
      <div>
        <strong>Descriptors:</strong> {visualProfile.descriptors.join(", ")}
      </div>

      <div style={{ marginTop: "8px" }}>
        <strong>P.S. Final:</strong> {visualProfile.armMorph.psTotal}
      </div>
      <div>
        <strong>Arm Tier:</strong> {visualProfile.armMorphTier} ({visualProfile.armMorphLabel})
      </div>
      <div>
        <strong>Morph Target:</strong> {visualProfile.armMorph.target} ={" "}
        {visualProfile.armMorphWeight.toFixed(3)}
      </div>

      <pre style={{ fontSize: "0.8rem", whiteSpace: "pre-wrap" }}>
        {JSON.stringify(visualProfile.values, null, 2)}
      </pre>
    </div>
  );
}

