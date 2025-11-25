// ==========================================
// ProtectionCircle.jsx
// ==========================================
//
// React + SVG component for visualizing
// magic and holy protection circles on 2D tactical maps.
//
// Works with both hex and square grid maps.
// Uses framer-motion for animations.
//
// ==========================================

import React from "react";
import { motion } from "framer-motion";
import { Tooltip } from "@chakra-ui/react";
import { GRID_CONFIG } from "../data/movementRules.js";

/**
 * ProtectionCircle Component
 * Renders a glowing, animated circle overlay on the tactical map
 * 
 * @param {Object} props
 * @param {string} props.id - Unique circle ID
 * @param {Object} props.position - Position {x, y} in grid cells
 * @param {number} props.radiusCells - Radius in grid cells
 * @param {string} props.color - Circle color (hex or rgb)
 * @param {number} props.opacity - Fill opacity (0-1)
 * @param {number} props.strokeOpacity - Stroke opacity (0-1)
 * @param {string} props.name - Circle name for tooltip
 * @param {number} props.bonus - Horror save bonus
 * @param {number} props.remaining - Rounds remaining
 * @param {string} props.mapType - "hex" or "square"
 * @param {Function} props.getCellPixelPosition - Function to get cell pixel position
 */
export default function ProtectionCircle({
  id,
  position,
  radiusCells,
  color = "#b9f2ff",
  opacity = 0.25,
  strokeOpacity = 0.6,
  name = "Protection Circle",
  bonus = 0,
  remaining = 0,
  mapType = "hex",
  getCellPixelPosition,
}) {
  if (!position || radiusCells <= 0 || remaining <= 0) return null;
  
  // Get pixel position of the circle's grid cell
  const cellPixelPos = getCellPixelPosition(position.x, position.y);
  if (!cellPixelPos) return null;
  
  // Calculate center coordinates based on map type
  const size = GRID_CONFIG.HEX_SIZE;
  let centerX, centerY;
  
  if (mapType === "square") {
    const squareCellSize = size * 2;
    centerX = cellPixelPos.x + squareCellSize / 2;
    centerY = cellPixelPos.y + squareCellSize / 2;
  } else {
    // Hex: cellPixelPos is top-left of bounding box
    const hexWidth = size * 2;
    const hexHeight = size * Math.sqrt(3);
    centerX = cellPixelPos.x + hexWidth / 2;
    centerY = cellPixelPos.y + hexHeight / 2;
  }
  
  // Calculate radius in pixels
  // Each grid cell represents 5 feet, so radiusCells cells = radiusCells * 5 feet
  // Convert to pixels: each cell is approximately size * 2 pixels wide
  const cellSizePixels = mapType === "square" ? size * 2 : size * 2;
  const radiusPixels = radiusCells * cellSizePixels;
  
  // Create pulsing animation
  const pulseVariants = {
    pulse: {
      opacity: [opacity, opacity * 1.3, opacity],
      scale: [1, 1.05, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
    fade: {
      opacity: [opacity, 0],
      scale: [1, 0.8],
      transition: {
        duration: 1,
        ease: "easeOut",
      },
    },
  };
  
  // Use pulse animation if circle is active, fade if expiring
  const animationVariant = remaining > 0 ? "pulse" : "fade";
  
  // Create gradient ID for glow effect
  const gradientId = `circle-gradient-${id}`;
  const shadowId = `circle-shadow-${id}`;
  
  return (
    <g>
      {/* Define gradient for glow effect */}
      <defs>
        <radialGradient id={gradientId}>
          <stop offset="0%" stopColor={color} stopOpacity={opacity * 1.5} />
          <stop offset="50%" stopColor={color} stopOpacity={opacity} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
        
        {/* Glow filter */}
        <filter id={shadowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dx="0" dy="0" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.5" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      {/* Outer glow circle */}
      <motion.circle
        cx={centerX}
        cy={centerY}
        r={radiusPixels * 1.1}
        fill={`url(#${gradientId})`}
        stroke={color}
        strokeWidth="2"
        strokeOpacity={strokeOpacity * 0.5}
        filter={`url(#${shadowId})`}
        variants={pulseVariants}
        animate={animationVariant}
        style={{ pointerEvents: "none" }}
      />
      
      {/* Main circle */}
      <Tooltip
        label={`${name} (+${bonus} vs Horror, ${remaining} rounds remaining)`}
        placement="top"
        hasArrow
        bg="blackAlpha.800"
        color="white"
      >
        <motion.circle
          cx={centerX}
          cy={centerY}
          r={radiusPixels}
          fill={color}
          fillOpacity={opacity}
          stroke={color}
          strokeWidth="2"
          strokeOpacity={strokeOpacity}
          strokeDasharray={remaining > 0 ? "4,4" : "none"}
          variants={pulseVariants}
          animate={animationVariant}
          style={{ 
            pointerEvents: "none",
            mixBlendMode: "screen",
          }}
        />
      </Tooltip>
      
      {/* Inner highlight */}
      <motion.circle
        cx={centerX}
        cy={centerY}
        r={radiusPixels * 0.3}
        fill={color}
        fillOpacity={opacity * 0.8}
        variants={pulseVariants}
        animate={animationVariant}
        style={{ pointerEvents: "none" }}
      />
    </g>
  );
}

/**
 * ProtectionCircleHUD Component
 * Displays active protection circles in a UI overlay
 */
export function ProtectionCircleHUD({ circles = [] }) {
  if (!circles || circles.length === 0) return null;
  
  return (
    <div
      style={{
        position: "absolute",
        bottom: "16px",
        right: "16px",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        padding: "12px",
        borderRadius: "8px",
        color: "white",
        fontSize: "14px",
        zIndex: 1000,
        minWidth: "200px",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "8px", fontSize: "16px" }}>
        🕯️ Active Circles
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {circles.map((circle) => (
          <div
            key={circle.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "4px 0",
              borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            <span style={{ fontSize: "12px" }}>{circle.name}</span>
            <span style={{ fontSize: "11px", opacity: 0.8 }}>
              {Math.max(0, circle.remaining)} rounds
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

