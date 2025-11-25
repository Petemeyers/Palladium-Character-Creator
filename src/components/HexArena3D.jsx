import React, { useEffect, useRef } from "react";

import { Box, Text } from "@chakra-ui/react";

export default function HexArena3D({
  mapDefinition,
  fighters,
  positions,
  terrain,
  mode,
}) {
  const containerRef = useRef(null);
  const arenaRef = useRef(null);
  const initialized = useRef(false);

  // Create arena ONCE
  useEffect(() => {
    if (!containerRef.current || initialized.current) return;

    (async () => {
      const mod = await import("../utils/three/HexArena.js");
      arenaRef.current = mod.initHexArena(containerRef.current);
      initialized.current = true;

      if (!arenaRef.current) {
        console.error("Failed to initialize 3D arena");
      }
    })();

    return () => {
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

  return (
    <Box
      ref={containerRef}
      width="100%"
      height="100%"
      position="relative"
      bg="black"
    >
      {!initialized.current && (
        <Text color="white" position="absolute" top="50%" left="50%">
          Loading 3D Arena...
        </Text>
      )}
    </Box>
  );
}
