import React, { useEffect, useRef, useState } from "react";

import { Box, Text } from "@chakra-ui/react";

export default function HexArena3D({
  mapDefinition,
  fighters,
  positions,
  terrain,
  mode,
  visible = false,
}) {
  const containerRef = useRef(null);
  const arenaRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const initializationStarted = useRef(false);
  const isMountedRef = useRef(true);

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
          // Only update state if component is still mounted
          if (isMountedRef.current) {
            setIsInitialized(true);
          }
        }
      } catch (error) {
        console.error("Error initializing 3D arena:", error);
      }
    })();

    return () => {
      isMountedRef.current = false;
      // fully destroy only if leaving the page entirely
      // arenaRef.current?.dispose();
    };
  }, []);

  // Sync based on mode
  useEffect(() => {
    if (!arenaRef.current) return;

    if (mode === "MAP_EDITOR") {
      arenaRef.current.syncMapEditorState(mapDefinition);
    }

    if (mode === "COMBAT") {
      arenaRef.current.syncCombatState({
        fighters,
        positions,
        terrain,
        mapType: terrain?.mapType || "hex",
      });
    }
  }, [mapDefinition, fighters, positions, terrain, mode]);

  // Only initialize if visible
  useEffect(() => {
    if (!visible && initializationStarted.current) {
      // Pause rendering when hidden to save resources
      // The arena will resume when visible again
    }
  }, [visible]);

  return (
    <Box
      ref={containerRef}
      width="100%"
      height="100%"
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
}
