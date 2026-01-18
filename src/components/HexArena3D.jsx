import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";

import { Box, Text } from "@chakra-ui/react";
import PropTypes from "prop-types";

const HexArena3D = forwardRef(function HexArena3D(
  {
    mapDefinition,
    fighters,
    positions,
    renderPositions,
    projectiles,
    dangerHexes,
    terrain,
    mode,
    visible = false,
  },
  ref
) {
  const containerRef = useRef(null);
  const arenaRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const initializationStarted = useRef(false);
  const isMountedRef = useRef(true);

  // ✅ Expose a tiny API to parent (CombatPage)
  useImperativeHandle(ref, () => ({
    syncMapEditorState: (terrainDef, changedCells = null) => {
      arenaRef.current?.syncMapEditorState?.(terrainDef, changedCells);
    },
    rebuildEditor: (terrainDef) => {
      arenaRef.current?.syncMapEditorState?.(terrainDef);
    },
  }));

  // Create arena ONCE
  useEffect(() => {
    if (!containerRef.current || initializationStarted.current) return;
    initializationStarted.current = true;
    isMountedRef.current = true;

    (async () => {
      try {
        const mod = await import("../utils/three/HexArena.js");
        arenaRef.current = mod.initHexArena(containerRef.current);

        if (!arenaRef.current) {
          console.error("Failed to initialize 3D arena");
        } else {
          if (isMountedRef.current) setIsInitialized(true);
        }
      } catch (error) {
        console.error("Error initializing 3D arena:", error);
      }
    })();

    return () => {
      isMountedRef.current = false;
      // arenaRef.current?.dispose();
    };
  }, []);

  // Sync based on mode (fallback full-sync if parent isn't pushing diffs)
  useEffect(() => {
    if (!arenaRef.current) return;

    if (mode === "MAP_EDITOR") {
      arenaRef.current.syncMapEditorState(mapDefinition);
    }

    if (mode === "COMBAT") {
      arenaRef.current.syncCombatState({
        fighters,
        positions,
        renderPositions,
        projectiles,
        dangerHexes,
        terrain,
        mapType: terrain?.mapType || "hex",
      });
    }
  }, [mapDefinition, fighters, positions, renderPositions, projectiles, dangerHexes, terrain, mode]);

  return (
    <Box
      ref={containerRef}
      width="100%"
      height="100%"
      minWidth="400px"
      minHeight="300px"
      position="relative"
      bg="black"
      display={visible ? "block" : "none"}
    >
      <Text
        color="white"
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        opacity={isInitialized ? 0 : 1}
        pointerEvents="none"
        transition="opacity 0.3s"
        zIndex={1}
      >
        Loading 3D Arena...
      </Text>
    </Box>
  );
});

HexArena3D.propTypes = {
  mapDefinition: PropTypes.any,
  fighters: PropTypes.array,
  positions: PropTypes.object,
  renderPositions: PropTypes.object,
  projectiles: PropTypes.array,
  dangerHexes: PropTypes.array,
  terrain: PropTypes.object,
  mode: PropTypes.string,
  visible: PropTypes.bool,
};

HexArena3D.defaultProps = {
  visible: false,
};

export default HexArena3D;
