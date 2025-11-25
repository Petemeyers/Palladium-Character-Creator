/**
 * Shared hex selection utilities for both 2D and 3D maps
 * Provides consistent selection, information display, and distance calculation
 */

import { calculateDistance } from "../data/movementRules.js";
import { getEngagementRange as getDistanceEngagementRange } from "../utils/distanceCombatSystem.js";
import { offsetToAxial, axialToOffset } from "./hexGridMath.js";

/**
 * Get hex information for display (terrain, coordinates, combatants, etc.)
 * @param {Object} hexData - Hex data from 2D or 3D map
 * @param {Object} context - Context with positions, combatants, terrain, etc.
 * @returns {Object} Hex information object
 */
export function getHexInfo(hexData, context = {}) {
  const { positions = {}, combatants = [], terrain = null } = context;
  
  // Extract coordinates (handle both 2D offset and 3D axial formats)
  let col, row, q, r;
  if (hexData.q !== undefined && hexData.r !== undefined) {
    // 3D axial coordinates
    q = hexData.q;
    r = hexData.r;
    const offset = axialToOffset(q, r);
    col = offset.col;
    row = offset.row;
  } else if (hexData.col !== undefined && hexData.row !== undefined) {
    // 2D offset coordinates
    col = hexData.col;
    row = hexData.row;
    const axial = offsetToAxial(col, row);
    q = axial.q;
    r = axial.r;
  } else if (hexData.x !== undefined && hexData.y !== undefined) {
    // Legacy 2D format
    col = hexData.x;
    row = hexData.y;
    const axial = offsetToAxial(col, row);
    q = axial.q;
    r = axial.r;
  } else {
    return null;
  }

  // Find combatants at this position
  const combatantsAtHex = combatants.filter((c) => {
    const pos = positions[c._id || c.id];
    if (!pos) return false;
    
    // Handle both offset and axial position formats
    if (pos.x !== undefined && pos.y !== undefined) {
      return pos.x === col && pos.y === row;
    } else if (pos.q !== undefined && pos.r !== undefined) {
      return pos.q === q && pos.r === r;
    }
    return false;
  });

  // Get terrain info
  const terrainType = hexData.terrain || terrain?.baseTerrain || "Open Ground";
  const cover = hexData.cover || 0;

  return {
    col,
    row,
    q,
    r,
    terrainType,
    cover,
    combatants: combatantsAtHex,
    height: hexData.height || 0,
  };
}

/**
 * Calculate distance between two hexes
 * @param {Object} hex1 - First hex (with q/r or col/row)
 * @param {Object} hex2 - Second hex (with q/r or col/row)
 * @returns {number} Distance in hexes
 */
export function getHexDistance(hex1, hex2) {
  let q1, r1, q2, r2;

  // Convert hex1 to axial
  if (hex1.q !== undefined && hex1.r !== undefined) {
    q1 = hex1.q;
    r1 = hex1.r;
  } else if (hex1.col !== undefined && hex1.row !== undefined) {
    const axial = offsetToAxial(hex1.col, hex1.row);
    q1 = axial.q;
    r1 = axial.r;
  } else if (hex1.x !== undefined && hex1.y !== undefined) {
    const axial = offsetToAxial(hex1.x, hex1.y);
    q1 = axial.q;
    r1 = axial.r;
  } else {
    return Infinity;
  }

  // Convert hex2 to axial
  if (hex2.q !== undefined && hex2.r !== undefined) {
    q2 = hex2.q;
    r2 = hex2.r;
  } else if (hex2.col !== undefined && hex2.row !== undefined) {
    const axial = offsetToAxial(hex2.col, hex2.row);
    q2 = axial.q;
    r2 = axial.r;
  } else if (hex2.x !== undefined && hex2.y !== undefined) {
    const axial = offsetToAxial(hex2.x, hex2.y);
    q2 = axial.q;
    r2 = axial.r;
  } else {
    return Infinity;
  }

  // Calculate axial hex distance
  const dq = q1 - q2;
  const dr = r1 - r2;
  const ds = -(q1 + r1) - (-(q2 + r2));
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

/**
 * Calculate distance in feet between two hexes
 * @param {Object} hex1 - First hex
 * @param {Object} hex2 - Second hex
 * @param {number} feetPerHex - Feet per hex (default 5)
 * @returns {number} Distance in feet
 */
export function getHexDistanceFeet(hex1, hex2, feetPerHex = 5) {
  const hexDist = getHexDistance(hex1, hex2);
  return hexDist * feetPerHex;
}

/**
 * Get engagement range information for a distance
 * @param {Object} fromHex - Starting hex
 * @param {Object} toHex - Target hex
 * @param {number} feetPerHex - Feet per hex (default 5)
 * @returns {Object} Engagement range info
 */
export function getEngagementRange(fromHex, toHex, feetPerHex = 5) {
  const distanceFeet = getHexDistanceFeet(fromHex, toHex, feetPerHex);
  return getDistanceEngagementRange(distanceFeet);
}

/**
 * Format hex information for display
 * @param {Object} hexInfo - Hex info from getHexInfo
 * @param {Object} fromHex - Optional: hex to calculate distance from
 * @param {number} feetPerHex - Feet per hex (default 5)
 * @returns {string} Formatted information string
 */
export function formatHexInfo(hexInfo, fromHex = null, feetPerHex = 5) {
  if (!hexInfo) return "";

  const parts = [];
  
  // Coordinates
  parts.push(`Hex: (${hexInfo.col}, ${hexInfo.row})`);
  if (hexInfo.q !== undefined && hexInfo.r !== undefined) {
    parts.push(`Axial: (${hexInfo.q}, ${hexInfo.r})`);
  }

  // Terrain
  parts.push(`Terrain: ${hexInfo.terrainType}`);
  if (hexInfo.cover > 0) {
    parts.push(`Cover: ${Math.round(hexInfo.cover * 100)}%`);
  }

  // Combatants
  if (hexInfo.combatants.length > 0) {
    const names = hexInfo.combatants.map((c) => c.name || c._id || c.id).join(", ");
    parts.push(`Combatants: ${names}`);
  }

  // Distance (if fromHex provided)
  if (fromHex) {
    const distanceFeet = getHexDistanceFeet(fromHex, hexInfo, feetPerHex);
    const engagement = getEngagementRange(fromHex, hexInfo, feetPerHex);
    parts.push(`Distance: ${Math.round(distanceFeet)}ft (${engagement.name})`);
  }

  return parts.join(" | ");
}

