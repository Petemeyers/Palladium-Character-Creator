export function getIdleFromVisualProfile(visualProfile, mentalState = null) {
  if (mentalState === "paranoid") return "idle_paranoid";
  if (mentalState === "depressed") return "idle_depressed";
  if (mentalState === "manic") return "idle_manic";
  return visualProfile?.idle || visualProfile?.presentation?.idleBase || "idle_neutral";
}

