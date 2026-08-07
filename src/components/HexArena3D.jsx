import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";

import { Box, Text } from "@chakra-ui/react";
import PropTypes from "prop-types";
import { initHexArena } from "../utils/three/HexArena.js";

const HexArena3D = forwardRef(function HexArena3D(
  {
    mapDefinition,
    fighters,
    positions,
    renderPositions,
    projectiles,
    embeddedArrows,
    impactReactions,
    dangerHexes,
    weaponAnimationCues = [],
    formationLinks = [],
    activeFighterId,
    selectedFighterId,
    targetFighterId,
    surrenderRecordsByFighterId,
    combatGenerationId,
    activeTurnGenerationId,
    terrain,
    mode,
    movementMode,
    validMoves,
    selectedMovementFighter,
    onHexHover,
    onHexSelect,
    editorProps,
    selectedEditorPropId,
    onEditorPropGrab,
    onEditorPropHover,
    onEditorPropDrop,
    editorBrushMode,
    onEditorBrushStart,
    onEditorBrushPaint,
    onEditorBrushEnd,
    visible = false,
  },
  ref
) {
  const containerRef = useRef(null);
  const arenaRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const initializationStarted = useRef(false);
  const isMountedRef = useRef(true);
  const playedWeaponAnimationCueIdsRef = useRef(new Set());

  // Ã¢Å“â€¦ Expose a tiny API to parent (CombatPage)
  useImperativeHandle(ref, () => ({
    syncMapEditorState: (terrainDef, changedCells = null) => {
      arenaRef.current?.syncMapEditorState?.(terrainDef, changedCells);
    },
    rebuildEditor: (terrainDef) => {
      arenaRef.current?.syncMapEditorState?.(terrainDef);
    },
    setTimeScale: (value) => {
      arenaRef.current?.setTimeScale?.(value);
    },
    setMapInteractionState: (value) => {
      arenaRef.current?.setMapInteractionState?.(value);
    },
    syncEditorProps: (props, options = {}) => {
      arenaRef.current?.syncEditorProps?.(props, options);
    },
    setEditorBrushInteractionState: (value) => {
      arenaRef.current?.setEditorBrushInteractionState?.(value);
    },
    playWeaponAnimationCue: (cue) => {
      arenaRef.current?.playWeaponInteractionAnimation?.(cue);
    },
  }));

  // Create arena ONCE
  useEffect(() => {
    if (!containerRef.current || initializationStarted.current) return;
    initializationStarted.current = true;
    isMountedRef.current = true;

    try {
      arenaRef.current = initHexArena(containerRef.current);

      if (!arenaRef.current) {
        console.error("Failed to initialize 3D arena");
      } else {
        if (isMountedRef.current) setIsInitialized(true);
      }
    } catch (error) {
      console.error("Error initializing 3D arena:", error);
    }

    return () => {
      isMountedRef.current = false;
      // arenaRef.current?.dfocusose();
    };
  }, []);

  // Sync based on mode (fallback full-sync if parent isn't pushing diffs)
  useEffect(() => {
    if (!arenaRef.current) return;

    if (mode === "MAP_EDITOR") {
      arenaRef.current.syncMapEditorState(mapDefinition);
      arenaRef.current.syncEditorProps?.(editorProps || [], {
        selectedPropId: selectedEditorPropId,
      });
    }

    if (mode === "COMBAT") {
      arenaRef.current.syncCombatState({
        fighters,
        positions,
        renderPositions,
        projectiles,
        embeddedArrows,
        impactReactions,
        dangerHexes,
        weaponAnimationCues,
        formationLinks,
        activeFighterId,
        selectedFighterId,
        targetFighterId,
        surrenderRecordsByFighterId,
        combatGenerationId,
        activeTurnGenerationId,
        terrain,
        mapType: terrain?.mapType || "hex",
      });
    }
  }, [mapDefinition, editorProps, selectedEditorPropId, fighters, positions, renderPositions, projectiles, embeddedArrows, impactReactions, dangerHexes, weaponAnimationCues, formationLinks, activeFighterId, selectedFighterId, targetFighterId, surrenderRecordsByFighterId, combatGenerationId, activeTurnGenerationId, terrain, mode]);

  useEffect(() => {
    if (!arenaRef.current || !Array.isArray(weaponAnimationCues)) return;
    arenaRef.current.syncWeaponAnimationCues?.(weaponAnimationCues);
    weaponAnimationCues.forEach((cue) => {
      if (!cue?.id || playedWeaponAnimationCueIdsRef.current.has(cue.id)) return;
      playedWeaponAnimationCueIdsRef.current.add(cue.id);
      arenaRef.current.playWeaponInteractionAnimation?.(cue);
    });
    if (playedWeaponAnimationCueIdsRef.current.size > 64) {
      const activeIds = new Set(weaponAnimationCues.map((cue) => cue?.id).filter(Boolean));
      playedWeaponAnimationCueIdsRef.current = activeIds;
    }
  }, [weaponAnimationCues]);

  useEffect(() => {
    if (!arenaRef.current?.setMapInteractionState) return;
    arenaRef.current.setMapInteractionState({
      movementMode,
      validMoves,
      selectedMovementFighter,
      onHexHover,
      onHexSelect,
    });
  }, [isInitialized, movementMode, validMoves, selectedMovementFighter, onHexHover, onHexSelect]);

  useEffect(() => {
    if (!arenaRef.current?.setEditorPropInteractionState) return;
    arenaRef.current.setEditorPropInteractionState({
      onPropGrab: onEditorPropGrab,
      onPropHover: onEditorPropHover,
      onPropDrop: onEditorPropDrop,
    });
  }, [isInitialized, onEditorPropGrab, onEditorPropHover, onEditorPropDrop]);

  useEffect(() => {
    if (!arenaRef.current?.setEditorBrushInteractionState) return;
    arenaRef.current.setEditorBrushInteractionState({
      mode: editorBrushMode,
      onBrushStart: onEditorBrushStart,
      onBrushPaint: onEditorBrushPaint,
      onBrushEnd: onEditorBrushEnd,
    });
  }, [isInitialized, editorBrushMode, onEditorBrushStart, onEditorBrushPaint, onEditorBrushEnd]);

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
  embeddedArrows: PropTypes.array,
  impactReactions: PropTypes.object,
  dangerHexes: PropTypes.array,
  weaponAnimationCues: PropTypes.array,
  formationLinks: PropTypes.array,
  activeFighterId: PropTypes.string,
  selectedFighterId: PropTypes.string,
  targetFighterId: PropTypes.string,
  surrenderRecordsByFighterId: PropTypes.object,
  combatGenerationId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  activeTurnGenerationId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  terrain: PropTypes.object,
  mode: PropTypes.string,
  movementMode: PropTypes.object,
  validMoves: PropTypes.array,
  selectedMovementFighter: PropTypes.string,
  onHexHover: PropTypes.func,
  onHexSelect: PropTypes.func,
  editorProps: PropTypes.array,
  selectedEditorPropId: PropTypes.string,
  onEditorPropGrab: PropTypes.func,
  onEditorPropHover: PropTypes.func,
  onEditorPropDrop: PropTypes.func,
  editorBrushMode: PropTypes.string,
  onEditorBrushStart: PropTypes.func,
  onEditorBrushPaint: PropTypes.func,
  onEditorBrushEnd: PropTypes.func,
  visible: PropTypes.bool,
};

HexArena3D.defaultProps = {
  visible: false,
};

export default HexArena3D;
