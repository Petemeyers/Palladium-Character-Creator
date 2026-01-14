/**
 * Lighting presets for 3D combat arena scenes
 * Each preset defines sun, ambient, hemisphere, and environment settings
 */

export const LIGHTING_PRESETS = {
  DAYLIGHT: {
    label: "Daylight",
    sun: {
      intensity: 3.5,
      color: 0xfff2d6, // warm sunlight
      position: [50, 80, 30], // angled sun
      castShadow: true,
      shadow: {
        mapSize: 4096,
        bias: -0.0008,
        camera: {
          near: 10,
          far: 200,
          left: -80,
          right: 80,
          top: 80,
          bottom: -80,
        },
      },
    },
    ambient: {
      intensity: 0.45,
      color: 0xdde7f0, // cool sky fill
    },
    hemisphere: {
      skyColor: 0xcfe8ff,
      groundColor: 0x6b5a44,
      intensity: 0.6,
    },
    environment: {
      exposure: 1.0,
      toneMapping: "ACES",
    },
  },
  
  // Additional presets for future use
  DUSK: {
    label: "Dusk",
    sun: {
      intensity: 2.0,
      color: 0xffa366, // orange sunset
      position: [30, 40, -20], // low, angled
      castShadow: true,
      shadow: {
        mapSize: 4096,
        bias: -0.0008,
        camera: {
          near: 10,
          far: 200,
          left: -80,
          right: 80,
          top: 80,
          bottom: -80,
        },
      },
    },
    ambient: {
      intensity: 0.3,
      color: 0xffd4a3, // warm ambient
    },
    hemisphere: {
      skyColor: 0xffb380,
      groundColor: 0x4a3a2a,
      intensity: 0.5,
    },
    environment: {
      exposure: 0.8,
      toneMapping: "ACES",
    },
  },
  
  OVERCAST: {
    label: "Overcast",
    sun: {
      intensity: 1.5,
      color: 0xffffff, // neutral white
      position: [50, 80, 30],
      castShadow: true,
      shadow: {
        mapSize: 2048,
        bias: -0.0008,
        camera: {
          near: 10,
          far: 200,
          left: -80,
          right: 80,
          top: 80,
          bottom: -80,
        },
      },
    },
    ambient: {
      intensity: 0.6,
      color: 0xcccccc, // gray ambient
    },
    hemisphere: {
      skyColor: 0xaaaaaa,
      groundColor: 0x555555,
      intensity: 0.7,
    },
    environment: {
      exposure: 0.9,
      toneMapping: "ACES",
    },
  },
  
  TORCHLIGHT: {
    label: "Torchlight",
    sun: {
      intensity: 0.0, // no sun
      color: 0xffffff,
      position: [0, 0, 0],
      castShadow: false,
      shadow: {
        mapSize: 2048,
        bias: -0.0008,
        camera: {
          near: 10,
          far: 200,
          left: -80,
          right: 80,
          top: 80,
          bottom: -80,
        },
      },
    },
    ambient: {
      intensity: 0.1,
      color: 0x331100, // very dark
    },
    hemisphere: {
      skyColor: 0x000000,
      groundColor: 0x1a0f00,
      intensity: 0.2,
    },
    environment: {
      exposure: 0.5,
      toneMapping: "ACES",
    },
  },
  
  MOONLIGHT: {
    label: "Moonlight",
    sun: {
      intensity: 1.0,
      color: 0xaaccff, // cool blue-white
      position: [50, 80, 30],
      castShadow: true,
      shadow: {
        mapSize: 4096,
        bias: -0.0008,
        camera: {
          near: 10,
          far: 200,
          left: -80,
          right: 80,
          top: 80,
          bottom: -80,
        },
      },
    },
    ambient: {
      intensity: 0.2,
      color: 0x334455, // dark blue-gray
    },
    hemisphere: {
      skyColor: 0x223344,
      groundColor: 0x112233,
      intensity: 0.3,
    },
    environment: {
      exposure: 0.6,
      toneMapping: "ACES",
    },
  },
};

/**
 * Get a lighting preset by key
 * @param {string} key - Preset key (e.g., "DAYLIGHT")
 * @returns {Object|null} Lighting preset or null if not found
 */
export function getLightingPreset(key) {
  return LIGHTING_PRESETS[key] || LIGHTING_PRESETS.DAYLIGHT;
}

/**
 * Get all available lighting preset keys
 * @returns {Array<string>} Array of preset keys
 */
export function getLightingPresetKeys() {
  return Object.keys(LIGHTING_PRESETS);
}

