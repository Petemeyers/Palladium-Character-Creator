import React, { useMemo } from "react";
import { motion } from "framer-motion";

/**
 * FogEffectsLayer
 * Renders subtle animated fog drift + directional vision cone overlay.
 *
 * Props:
 *  - mapWidth, mapHeight : total SVG dimensions
 *  - playerPosition : {x, y, facing?, visionAngle?, lightingRange?}
 *  - facingAngle : direction player faces (degrees, optional if in playerPosition)
 *  - visionAngle : cone width in degrees (default 90)
 *  - visionRange : distance in pixels (default 300)
 *  - lighting : scene lighting ("Bright", "Moonlight", etc.)
 *  - enabled : boolean to enable/disable effects (default true)
 */
export default function FogEffectsLayer({
  mapWidth = 1000,
  mapHeight = 1000,
  playerPosition = { x: 0, y: 0 },
  facingAngle = null,
  visionAngle = 90,
  visionRange = null,
  lighting = "Bright Daylight",
  enabled = true,
}) {
  if (!enabled) return null;

  // ✅ Handle null playerPosition (may be passed when no player is present)
  const safePlayerPosition = playerPosition || { x: 0, y: 0, facing: 0, lightingRange: 60 };

  // Extract facing angle from playerPosition if not provided directly
  const actualFacingAngle = facingAngle !== null ? facingAngle : (safePlayerPosition.facing || 0);
  
  // Extract vision range from playerPosition if not provided directly
  // Default vision range: 60 feet * 3 pixels per foot = 180 pixels
  const actualVisionRange = visionRange !== null ? visionRange : ((safePlayerPosition.lightingRange || 60) * 3);

  const fogColor = getFogColor(lighting);
  const driftSpeed = getDriftSpeed(lighting);

  // Only show fog drift in certain lighting conditions (darkness, moonlight, torchlight)
  const showFogDrift = shouldShowFogDrift(lighting);
  
  // Vision cone is disabled - no cone rendering
  const showVisionCone = false;
  
  // Generate stable unique IDs for patterns/gradients based on component instance
  const patternId = useMemo(() => `fogPattern-${Math.random().toString(36).slice(2, 9)}`, []);

  return (
    <g pointerEvents="none" style={{ isolation: "isolate" }}>
      {/* --- Animated drifting fog overlay --- */}
      {showFogDrift && (
        <>
          <defs>
            <pattern
              id={patternId}
              patternUnits="userSpaceOnUse"
              width="200"
              height="200"
            >
              <motion.rect
                width="200"
                height="200"
                fill={fogColor.color}
                animate={{
                  opacity: [0.15, 0.25, 0.2],
                  transition: {
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  },
                }}
              />
            </pattern>
          </defs>

          <motion.rect
            x={0}
            y={0}
            width={mapWidth}
            height={mapHeight}
            fill={`url(#${patternId})`}
            opacity={fogColor.opacity}
            animate={{
              x: [0, 20, -15, 0],
              y: [0, -10, 15, 0],
              transition: {
                duration: driftSpeed,
                repeat: Infinity,
                ease: "easeInOut",
              },
            }}
            style={{ 
              pointerEvents: 'none',
              mixBlendMode: 'multiply'
            }}
          />
        </>
      )}

      {/* Vision cone removed - replaced with radial gradient around player hexes */}
    </g>
  );
}

/* ---------------- Helper Functions ---------------- */

/**
 * Get fog color and opacity based on lighting
 * @param {string} lighting - Lighting condition
 * @returns {Object} {color: string, opacity: number}
 */
function getFogColor(lighting) {
  const lightingStr = String(lighting).toLowerCase();
  
  if (lightingStr.includes("darkness") || lightingStr.includes("dark")) {
    return { color: "rgba(0,0,0,0.8)", opacity: 0.8 };
  }
  if (lightingStr.includes("moonlight") || lightingStr.includes("moon")) {
    return { color: "rgba(40,40,60,0.6)", opacity: 0.6 };
  }
  if (lightingStr.includes("torchlight") || lightingStr.includes("torch")) {
    return { color: "rgba(80,60,30,0.5)", opacity: 0.5 };
  }
  if (lightingStr.includes("fog") || lightingStr.includes("smoke")) {
    return { color: "rgba(120,120,120,0.4)", opacity: 0.4 };
  }
  
  // Default: light fog for daylight
  return { color: "rgba(100,100,100,0.3)", opacity: 0.3 };
}

/**
 * Get fog drift animation speed based on lighting
 * @param {string} lighting - Lighting condition
 * @returns {number} Duration in seconds
 */
function getDriftSpeed(lighting) {
  const lightingStr = String(lighting).toLowerCase();
  
  if (lightingStr.includes("darkness") || lightingStr.includes("dark")) {
    return 40; // Slow drift in darkness
  }
  if (lightingStr.includes("moonlight") || lightingStr.includes("moon")) {
    return 30; // Medium drift in moonlight
  }
  if (lightingStr.includes("torchlight") || lightingStr.includes("torch")) {
    return 25; // Slightly faster with torch flicker
  }
  
  return 20; // Default: moderate drift
}

/**
 * Determine if fog drift should be shown
 * @param {string} lighting - Lighting condition
 * @returns {boolean}
 */
function shouldShowFogDrift(lighting) {
  const lightingStr = String(lighting).toLowerCase();
  
  // Show fog drift in low-light conditions OR if fog is explicitly enabled
  if (lightingStr.includes("darkness") || 
      lightingStr.includes("dark") ||
      lightingStr.includes("moonlight") || 
      lightingStr.includes("moon") ||
      lightingStr.includes("torchlight") || 
      lightingStr.includes("torch") ||
      lightingStr.includes("fog") ||
      lightingStr.includes("smoke")) {
    return true;
  }
  
  // Show subtle atmospheric fog even in daylight for visual effect
  // This makes the fog system more visible during testing
  return true; // Always show fog drift when fog is enabled
}

/**
 * Build SVG path for vision cone.
 * @param {Object} pos - player position {x, y}
 * @param {number} facing - center angle in degrees (0 = east, 90 = south, 180 = west, 270 = north)
 * @param {number} angle - cone width in degrees
 * @param {number} range - cone radius in pixels
 * @returns {string} SVG path data
 */
function buildConePath(pos, facing, angle, range) {
  if (!pos || pos.x === undefined || pos.y === undefined) {
    return "";
  }

  // Convert degrees to radians
  // Note: SVG coordinates: 0° = right (east), 90° = down (south)
  // Adjust so 0° = up (north) by subtracting 90
  const facingRad = ((facing - 90) * Math.PI) / 180;
  const halfAngle = (angle / 2) * (Math.PI / 180);
  
  const startAngle = facingRad - halfAngle;
  const endAngle = facingRad + halfAngle;

  const x1 = pos.x;
  const y1 = pos.y;
  
  // Calculate cone arc endpoints
  const x2 = x1 + range * Math.cos(startAngle);
  const y2 = y1 + range * Math.sin(startAngle);
  const x3 = x1 + range * Math.cos(endAngle);
  const y3 = y1 + range * Math.sin(endAngle);

  // Build path: Move to center, line to start, arc to end, close path
  // Large arc flag: 0 if angle < 180, 1 if angle >= 180
  const largeArc = angle >= 180 ? 1 : 0;
  
  return `M ${x1},${y1} L ${x2},${y2} A ${range},${range} 0 ${largeArc},1 ${x3},${y3} Z`;
}

