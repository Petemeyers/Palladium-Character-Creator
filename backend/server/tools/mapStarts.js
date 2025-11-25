/**
 * Map Start Locations
 * Provides starting locations for map generation
 */

const START_LOCATIONS = [
  { name: "Town Square", description: "A bustling town center", coordinates: { x: 0, y: 0 } },
  { name: "Forest Edge", description: "Where civilization meets wilderness", coordinates: { x: 10, y: 5 } },
  { name: "Mountain Pass", description: "A narrow passage through the mountains", coordinates: { x: -5, y: 15 } },
  { name: "River Crossing", description: "A bridge over a flowing river", coordinates: { x: 8, y: -8 } },
  { name: "Ancient Ruins", description: "Remnants of a forgotten civilization", coordinates: { x: -10, y: -10 } },
];

/**
 * List all available start locations
 * @returns {Array} Array of start location objects
 */
export function listStarts() {
  return START_LOCATIONS;
}

/**
 * Get a random start location
 * @returns {Object} Random start location
 */
export function randomStart() {
  const index = Math.floor(Math.random() * START_LOCATIONS.length);
  return START_LOCATIONS[index];
}

export default { listStarts, randomStart };

