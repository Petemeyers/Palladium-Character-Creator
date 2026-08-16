import {
  removeOrthogonalStructureRunsOwnedByCell,
} from "../utils/maps/orthogonalStructureAuthority.js";
import { applyOrthogonalHexStructureWallLine } from "../utils/maps/orthogonalStructureGenerator.js";
import {
  applyGridStructureEdgeEdit,
  deleteGridCellStructures,
} from "../utils/maps/gridStructureAuthority.js";
import { applyGridStructureWallLine } from "../utils/maps/gridStructureGenerator.js";
import {
  applyWaterEnvironmentToCell,
  getWaterEnvironmentFromCell,
} from "../utils/maps/waterTraversalAuthority.js";
import {
  createBridgeOnMap,
  deleteBridgeFromMap,
} from "../utils/maps/bridgeLayerAuthority.js";
import {
  checkpointMapEditorHistory,
  createMapEditorHistory,
  createMapEditorSnapshot,
  getMapEditorHistoryState,
  redoMapEditorHistory,
  resetMapEditorHistory,
  undoMapEditorHistory,
} from "../utils/maps/mapEditorHistoryAuthority.js";
import {
  applySquareStructureRoom,
  applySquareStructureWallLine,
  generateSquareBuilding,
} from "../utils/maps/squareStructureGenerator.js";
import { applySquareStructureEdgeEdit } from "../utils/maps/squareStructureAuthority.js";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Grid,
  GridItem,
  HStack,
  Input,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import TacticalMap from "../components/TacticalMap.jsx";
import HexArena3D from "../components/HexArena3D.jsx";
import { GRID_CONFIG } from "../data/movementRules";
import { axialToOffset, offsetToAxial } from "../utils/hexGridMath";
import { getHexesInRadius } from "../utils/mapBrush.js";
import MapMakerToolSidebar from "../components/maps/MapMakerToolSidebar.jsx";
import MapMakerInspectorPanel from "../components/maps/MapMakerInspectorPanel.jsx";
import {
  BATTLEFIELD_FOG,
  BATTLEFIELD_MAP_SOURCES,
  normalizeBattlefieldMap,
} from "../utils/maps/battlefieldMapAuthority.js";
import { saveBattlefieldMapToLibrary } from "../utils/maps/battlefieldMapLibrary.js";
import {
  createBattlefieldProp,
  getBattlefieldPropDefinition,
  getBattlefieldPropOffset,
  normalizeBattlefieldProp,
} from "../utils/maps/battlefieldPropCatalog.js";
import { launchBattlefieldTestBattle } from "../utils/maps/battlefieldTestBattle.js";
import { FOG_LABELS, LIGHTING_LABELS } from "../utils/maps/battlefieldMapUiModel.js";
import { clampMapHeight } from "../utils/mapHeightConstants.js";
import {
  MAP_EDITOR_TOOLS,
  deriveMapEditorInteractionState,
} from "../utils/maps/mapEditorInteractionAuthority.js";
import { getBattlefieldCellEdgeTransitions } from "../utils/maps/battlefieldSlopeAuthority.js";

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function createFilledGrid(width, height, terrainKey) {
  const grid = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push({ terrainType: terrainKey, terrain: terrainKey });
    }
    grid.push(row);
  }
  return grid;
}

function resizeGridKeepExisting(prevGrid, nextWidth, nextHeight, fillTerrainKey) {
  const next = [];
  for (let y = 0; y < nextHeight; y++) {
    const row = [];
    for (let x = 0; x < nextWidth; x++) {
      const existing = prevGrid?.[y]?.[x];
      row.push(existing ? { ...existing } : { terrainType: fillTerrainKey, terrain: fillTerrainKey });
    }
    next.push(row);
  }
  return next;
}

function clampHexHeight(value) {
  return clampMapHeight(value);
}

function getMapSizeFromDefinition(mapDefinition, fallbackWidth, fallbackHeight) {
  return {
    width: Number(mapDefinition?.size?.width ?? mapDefinition?.mapSize?.width ?? mapDefinition?.width ?? fallbackWidth) || fallbackWidth,
    height: Number(mapDefinition?.size?.height ?? mapDefinition?.mapSize?.height ?? mapDefinition?.height ?? fallbackHeight) || fallbackHeight,
  };
}

function gridToSavedHexes(grid) {
  if (!Array.isArray(grid)) return [];
  const hexes = [];
  grid.forEach((row, y) => {
    if (!Array.isArray(row)) return;
    row.forEach((cell, x) => {
      const axial = offsetToAxial(x, y);
      const height = Number.isFinite(cell?.height)
        ? cell.height
        : Number.isFinite(cell?.elevation)
          ? cell.elevation
          : 0;
      hexes.push({
        q: axial.q,
        r: axial.r,
        x,
        y,
        height,
        elevation: height,
        terrainType: cell?.terrainType || cell?.terrain || "OPEN_GROUND",
        terrain: cell?.terrain || cell?.terrainType || "OPEN_GROUND",
        textureId: cell?.textureId,
        wallTerrainType: cell?.wallTerrainType,
        wallTextureId: cell?.wallTextureId,
        walkable: cell?.walkable !== false,
        moveCost: Number.isFinite(cell?.moveCost) ? cell.moveCost : 1,
        cover: Number.isFinite(cell?.cover) ? cell.cover : 0,
        blocksLineOfSight: cell?.blocksLineOfSight === true,
        edgeTransitions: cell?.edgeTransitions ? { ...cell.edgeTransitions } : undefined,
      });
    });
  });
  return hexes;
}

function hexesToGrid(hexes, width, height, fallbackTerrain) {
  const grid = createFilledGrid(width, height, fallbackTerrain || "OPEN_GROUND");
  if (!Array.isArray(hexes)) return grid;
  hexes.forEach((hex) => {
    const offset = Number.isFinite(hex?.x) && Number.isFinite(hex?.y)
      ? { col: hex.x, row: hex.y }
      : axialToOffset(Number(hex?.q), Number(hex?.r));
    const x = Number(offset.col);
    const y = Number(offset.row);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) return;
    const heightValue = Number.isFinite(hex?.height)
      ? hex.height
      : Number.isFinite(hex?.elevation)
        ? hex.elevation
        : Number.isFinite(hex?.elev)
          ? hex.elev
          : 0;
    const terrain = hex?.terrainType || hex?.terrain || fallbackTerrain || "OPEN_GROUND";
    grid[y][x] = {
      ...grid[y][x],
      ...hex,
      terrain,
      terrainType: terrain,
      height: heightValue,
      elevation: heightValue,
    };
  });
  return grid;
}

function normalizeGridHeights(grid) {
  if (!Array.isArray(grid)) return [];
  return grid.map((row) => {
    if (!Array.isArray(row)) return [];
    return row.map((cell = {}) => {
      const heightValue = Number.isFinite(cell.height)
        ? cell.height
        : Number.isFinite(cell.elevation)
          ? cell.elevation
          : 0;
      return {
        ...cell,
        height: heightValue,
        elevation: heightValue,
      };
    });
  });
}

function normalizeMapProps(props, mapDefinition = {}) {
  if (!Array.isArray(props)) return [];
  return props
    .filter(Boolean)
    .map((prop, index) => {
      const normalized = normalizeBattlefieldProp(prop, { id: prop.id || `map-prop-${index}` });
      const offset = getBattlefieldPropOffset(normalized, mapDefinition);
      if (!offset) return null;
      const axial = offsetToAxial(offset.x, offset.y);
      return normalizeBattlefieldProp({
        ...normalized,
        q: axial.q,
        r: axial.r,
        x: offset.x,
        y: offset.y,
        coordinateSpace: "axial",
      });
    })
    .filter(Boolean);
}

export default function MapMakerPage() {
  const toast = useToast();
  const arena3DRef = useRef(null);
  const editorHistoryRef = useRef(createMapEditorHistory({ limit: 100 }));
  const [editorHistoryRevision, setEditorHistoryRevision] = useState(0);

  const [viewMode, setViewMode] = useState("2d"); // "2d" | "3d" | "split"
  const [activeEditorTool, setActiveEditorTool] = useState(MAP_EDITOR_TOOLS.TERRAIN);
  const [structureGeneratorConfig, setStructureGeneratorConfig] = useState({
    mode: "edge",
    kind: "wall",
    material: "wood",
    heightFeet: 10,
    doorOpen: false,
    precisionWindowStyle: "open",
    buildingTemplate: "tavern",
    buildingSeed: "building-1",
    buildingWealth: "common",
    buildingWindowStyle: "auto",
    furnish: true,
    assetUrl: "",
    bridgeMaterial: "wood",
    bridgeWidthFeet: 8,
    bridgeDeckRiseFeet: 0.75,
    bridgeRailings: true,
    bridgeSupports: true,
    bridgeSupportSpacingCells: 3,
    bridgeSeed: "bridge-1",
  });
  const [editorBrushMode, setEditorBrushMode] = useState("terrain");
  const [editorHeightStep, setEditorHeightStep] = useState(1);
  const [editorFlattenHeight, setEditorFlattenHeight] = useState(0);
  const [selectedTerrainType, setSelectedTerrainType] = useState("grass");
  const [waterPaintConfig, setWaterPaintConfig] = useState({
    waterDepthFeet: 3,
    waterCurrentStrength: "none",
    waterCurrentDirection: "E",
    waterBottomTerrain: "mud",
    waterTemperatureF: 55,
  });
  const [selectedWallTerrainType, setSelectedWallTerrainType] = useState("grass");
  const [editor3DBrushMode, setEditor3DBrushMode] = useState("top-terrain");
  const [brushRadius, setBrushRadius] = useState(0);
  const [selectedHex, setSelectedHex] = useState(null);
  const [selectedPropType, setSelectedPropType] = useState("tree");
  const [selectedPropId, setSelectedPropId] = useState(null);
  const [draggingPropId, setDraggingPropId] = useState(null);
  const [hoverHex, setHoverHex] = useState(null);
  const [grabbedObject, setGrabbedObject] = useState(null);
  const [mapProps, setMapProps] = useState([]);
  const painted3DBrushHexesRef = useRef(new Set());

  // Incremental 3D sync queue (same strategy as CombatPage)
  const pending3DChangesRef = useRef([]);
  const rafFlushRef = useRef(null);
  const mapDefinitionRef = useRef(null);

  const [mapName, setMapName] = useState("Untitled Map");
  const [mapType, setMapType] = useState("hex"); // "hex" | "square"
  const [baseTerrain, setBaseTerrain] = useState("OPEN_GROUND"); // TerrainSystem key
  const [lighting, setLighting] = useState("BRIGHT_DAYLIGHT"); // LightingSystem key
  const [environmentalFog, setEnvironmentalFog] = useState(BATTLEFIELD_FOG.CLEAR);
  const [fogOfWarEnabled, setFogOfWarEnabled] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [libraryRevision, setLibraryRevision] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(() => (typeof window !== "undefined" ? Math.max(520, window.innerHeight - 190) : 700));
  const [gridWidth, setGridWidth] = useState(GRID_CONFIG?.GRID_WIDTH ?? 40);
  const [gridHeight, setGridHeight] = useState(GRID_CONFIG?.GRID_HEIGHT ?? 30);

  const [mapDefinition, setMapDefinition] = useState(() => {
    const width = GRID_CONFIG?.GRID_WIDTH ?? 40;
    const height = GRID_CONFIG?.GRID_HEIGHT ?? 30;
    return {
      description: "Map Maker",
      mapType: "hex",
      terrain: "OPEN_GROUND",
      lighting: "BRIGHT_DAYLIGHT",
      environment: {
        lighting: "BRIGHT_DAYLIGHT",
        environmentalFog: { type: BATTLEFIELD_FOG.CLEAR },
        fogOfWar: { enabled: false, teamScoped: true, rememberExplored: true, rememberLastKnownEnemies: true },
      },
      grid: createFilledGrid(width, height, "OPEN_GROUND"),
      mapSize: { width, height },
    };
  });

  useEffect(() => {
    mapDefinitionRef.current = mapDefinition;
  }, [mapDefinition]);

  const createCurrentEditorSnapshot = useCallback((label = "edit") =>
    createMapEditorSnapshot({
      mapDefinition: mapDefinitionRef.current || mapDefinition,
      mapProps,
      selectedHex,
      selectedPropId,
      label,
    }), [mapDefinition, mapProps, selectedHex, selectedPropId]);

  const checkpointEditorHistory = useCallback((label = "edit") => {
    const changed = checkpointMapEditorHistory(
      editorHistoryRef.current,
      createCurrentEditorSnapshot(label)
    );
    if (changed) setEditorHistoryRevision((value) => value + 1);
    return changed;
  }, [createCurrentEditorSnapshot]);

  const restoreEditorSnapshot = useCallback((snapshot) => {
    if (!snapshot?.mapDefinition) return false;
    pending3DChangesRef.current = [];
    if (rafFlushRef.current) {
      cancelAnimationFrame(rafFlushRef.current);
      rafFlushRef.current = null;
    }
    const nextDefinition = snapshot.mapDefinition;
    const nextProps = Array.isArray(snapshot.mapProps) ? snapshot.mapProps : [];
    mapDefinitionRef.current = nextDefinition;
    setMapDefinition(nextDefinition);
    setMapProps(nextProps);
    setSelectedHex(snapshot.selectedHex || null);
    setSelectedPropId(snapshot.selectedPropId || null);
    setDraggingPropId(null);
    setHoverHex(null);
    setGrabbedObject(null);
    setIsDirty(true);
    requestAnimationFrame(() => {
      arena3DRef.current?.syncMapEditorState?.(nextDefinition, null);
    });
    return true;
  }, []);

  const undoEditor = useCallback(() => {
    const result = undoMapEditorHistory(
      editorHistoryRef.current,
      createCurrentEditorSnapshot("current")
    );
    if (!result.accepted) return false;
    restoreEditorSnapshot(result.snapshot);
    setEditorHistoryRevision((value) => value + 1);
    toast({
      title: "Undo",
      description: result.label || "Map edit",
      status: "info",
      duration: 1000,
      isClosable: true,
    });
    return true;
  }, [createCurrentEditorSnapshot, restoreEditorSnapshot, toast]);

  const redoEditor = useCallback(() => {
    const result = redoMapEditorHistory(
      editorHistoryRef.current,
      createCurrentEditorSnapshot("current")
    );
    if (!result.accepted) return false;
    restoreEditorSnapshot(result.snapshot);
    setEditorHistoryRevision((value) => value + 1);
    toast({
      title: "Redo",
      description: result.label || "Map edit",
      status: "info",
      duration: 1000,
      isClosable: true,
    });
    return true;
  }, [createCurrentEditorSnapshot, restoreEditorSnapshot, toast]);

  const resetEditorHistory = useCallback(() => {
    resetMapEditorHistory(editorHistoryRef.current);
    setEditorHistoryRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    const updateViewportHeight = () => setViewportHeight(Math.max(520, window.innerHeight - 190));
    window.addEventListener("resize", updateViewportHeight);
    return () => window.removeEventListener("resize", updateViewportHeight);
  }, []);


  useEffect(() => {
    setMapDefinition((prev) => ({
      ...(prev || {}),
      props: mapProps,
    }));
  }, [mapProps]);

  // Keep GRID_CONFIG in sync so TacticalMap renders the right dimensions.
  useEffect(() => {
    GRID_CONFIG.GRID_WIDTH = Number(gridWidth) || GRID_CONFIG.GRID_WIDTH;
    GRID_CONFIG.GRID_HEIGHT = Number(gridHeight) || GRID_CONFIG.GRID_HEIGHT;
  }, [gridWidth, gridHeight]);

  // Keep mapDefinition's top-level fields in sync with UI controls.
  useEffect(() => {
    setMapDefinition((prev) => ({
      ...(prev || {}),
      mapType,
      terrain: baseTerrain,
      lighting,
      description: mapName,
      name: mapName,
      mapSize: { width: gridWidth, height: gridHeight },
      size: { width: Number(gridWidth) || 40, height: Number(gridHeight) || 30 },
      environment: {
        ...(prev?.environment || {}),
        lighting,
        environmentalFog: {
          ...(prev?.environment?.environmentalFog || {}),
          type: environmentalFog,
        },
        fogOfWar: {
          ...(prev?.environment?.fogOfWar || {}),
          enabled: fogOfWarEnabled,
          teamScoped: prev?.environment?.fogOfWar?.teamScoped !== false,
          rememberExplored: prev?.environment?.fogOfWar?.rememberExplored !== false,
          rememberLastKnownEnemies: prev?.environment?.fogOfWar?.rememberLastKnownEnemies !== false,
        },
      },
      environmentalFog: { type: environmentalFog },
      fogOfWarEnabled,
    }));
  }, [mapName, mapType, baseTerrain, lighting, environmentalFog, fogOfWarEnabled, gridWidth, gridHeight]);

  useEffect(() => {
    if (editorBrushMode === "raise") setEditor3DBrushMode("height-raise");
    else if (editorBrushMode === "lower") setEditor3DBrushMode("height-lower");
    else if (editorBrushMode === "flatten") setEditor3DBrushMode("height-flatten");
    else if (["height-raise", "height-lower", "height-flatten"].includes(editor3DBrushMode)) setEditor3DBrushMode("top-terrain");
  }, [editorBrushMode, editor3DBrushMode]);

  const editorInteraction = useMemo(
    () => deriveMapEditorInteractionState({
      activeTool: activeEditorTool,
      editorBrushMode,
      editor3DBrushMode,
    }),
    [activeEditorTool, editorBrushMode, editor3DBrushMode]
  );

  const handleActiveEditorToolChange = useCallback((nextTool) => {
    setActiveEditorTool(nextTool);
    if (nextTool === MAP_EDITOR_TOOLS.HEIGHT) {
      setEditorBrushMode((current) => ["raise", "lower", "flatten"].includes(current) ? current : "raise");
      setEditor3DBrushMode((current) => ["height-raise", "height-lower", "height-flatten"].includes(current) ? current : "height-raise");
    } else if (nextTool === MAP_EDITOR_TOOLS.TERRAIN) {
      setEditorBrushMode((current) => ["terrain", "bucket"].includes(current) ? current : "terrain");
      setEditor3DBrushMode((current) => ["top-terrain", "wall-terrain"].includes(current) ? current : "top-terrain");
    } else if (nextTool === MAP_EDITOR_TOOLS.STRUCTURE) {
      setEditorBrushMode("select");
      setEditor3DBrushMode("disabled");
    }
    painted3DBrushHexesRef.current.clear();
    setDraggingPropId(null);
    setHoverHex(null);
    setGrabbedObject(null);
  }, []);

  const queue3DCellChange = useCallback((col, row, cell) => {
    pending3DChangesRef.current.push({ col, row, cell });
    if (rafFlushRef.current) return;

    rafFlushRef.current = requestAnimationFrame(() => {
      const changes = pending3DChangesRef.current;
      pending3DChangesRef.current = [];
      rafFlushRef.current = null;

      const latest = mapDefinitionRef.current;
      if (changes.length && latest && arena3DRef.current?.syncMapEditorState) {
        arena3DRef.current.syncMapEditorState(latest, changes);
      }
    });
  }, []);

  const queue3DCellChanges = useCallback((changes) => {
    if (!Array.isArray(changes) || changes.length === 0) return;
    changes.forEach((c) => {
      pending3DChangesRef.current.push({ col: c.x, row: c.y, cell: c.cell });
    });
    if (rafFlushRef.current) return;
    rafFlushRef.current = requestAnimationFrame(() => {
      const queued = pending3DChangesRef.current;
      pending3DChangesRef.current = [];
      rafFlushRef.current = null;

      const latest = mapDefinitionRef.current;
      if (queued.length && latest && arena3DRef.current?.syncMapEditorState) {
        arena3DRef.current.syncMapEditorState(latest, queued);
      }
    });
  }, []);

  const handleMapCellEdit = useCallback(
    (x, y, cell) => {
      const nextCell = {
        ...(mapDefinition?.grid?.[y]?.[x] || {}),
        ...cell,
      };
      setMapDefinition((prev) => {
        const updated = { ...(prev || {}) };
        if (!updated.grid) updated.grid = [];
        if (!updated.grid[y]) updated.grid[y] = [];
        updated.grid[y][x] = nextCell;
        return updated;
      });
      queue3DCellChange(x, y, nextCell);
      setIsDirty(true);
    },
    [mapDefinition, queue3DCellChange]
  );

  const handleMapCellsEdit = useCallback(
    (changes) => {
      if (!Array.isArray(changes) || changes.length === 0) return;
      const mergedChanges = changes.map((c) => ({
        ...c,
        cell: {
          ...(mapDefinition?.grid?.[c.y]?.[c.x] || {}),
          ...c.cell,
        },
      }));
      setMapDefinition((prev) => {
        const updated = { ...(prev || {}) };
        const nextGrid = Array.isArray(updated.grid)
          ? updated.grid.map((row) => (Array.isArray(row) ? [...row] : []))
          : [];
        mergedChanges.forEach((c) => {
          if (!nextGrid[c.y]) nextGrid[c.y] = [];
          nextGrid[c.y][c.x] = c.cell;
        });
        updated.grid = nextGrid;
        return updated;
      });
      queue3DCellChanges(mergedChanges);
      setIsDirty(true);
    },
    [mapDefinition, queue3DCellChanges]
  );

  const handleSelectedHexChange = useCallback((hex) => {
    if (!hex) {
      setSelectedHex(null);
      return;
    }

    const q = Number.isFinite(hex.x) ? hex.x : (Number.isFinite(hex.q) ? hex.q : null);
    const r = Number.isFinite(hex.y) ? hex.y : (Number.isFinite(hex.r) ? hex.r : null);
    if (!Number.isFinite(q) || !Number.isFinite(r)) return;
    setSelectedHex({ q, r, x: q, y: r });
    setSelectedPropId(null);
  }, []);

  const selectedHexCell = useMemo(() => {
    if (!selectedHex) return null;
    return mapDefinition?.grid?.[selectedHex.r]?.[selectedHex.q] || null;
  }, [mapDefinition, selectedHex]);

  const selectedHexHeight = useMemo(() => {
    if (!selectedHexCell) return 0;
    if (Number.isFinite(selectedHexCell.height)) return selectedHexCell.height;
    if (Number.isFinite(selectedHexCell.elevation)) return selectedHexCell.elevation;
    return 0;
  }, [selectedHexCell]);

  const selectedHexTerrain = selectedHexCell?.terrainType || selectedHexCell?.terrain || selectedTerrainType || "grass";

  const selectedWaterEnvironment = useMemo(
    () => selectedHexCell
      ? getWaterEnvironmentFromCell(selectedHexCell)
      : null,
    [selectedHexCell]
  );

  const applySelectedSquareStructureEdge = useCallback(({ direction, edge = null, remove = false } = {}) => {
    if (!selectedHex) {
      toast({
        title: "Select a cell first",
        status: "info",
        duration: 1800,
        isClosable: true,
      });
      return { accepted: false, reason: "structure-cell-not-selected" };
    }

    const result = applyGridStructureEdgeEdit({
      grid: mapDefinition?.grid || [],
      mapType,
      x: selectedHex.q,
      y: selectedHex.r,
      direction,
      edge,
      remove,
    });

    if (!result.accepted) {
      toast({
        title: "Structure edit rejected",
        description: result.reason,
        status: "warning",
        duration: 2200,
        isClosable: true,
      });
      return result;
    }

    checkpointEditorHistory(remove ? "remove structure edge" : "edit structure edge");
    setMapDefinition((current) => ({
      ...(current || {}),
      grid: result.grid,
      structureVersion: 1,
    }));
    queue3DCellChanges(result.changes);
    setIsDirty(true);
    return result;
  }, [
    mapDefinition?.grid,
    mapType,
    queue3DCellChanges,
    selectedHex,
    toast,
  ]);
  const selectedHexWallTerrain = selectedHexCell?.wallTerrainType || "automatic";

  const handleSquareStructureDragEnd = useCallback(({ start, end } = {}) => {
    if (
      activeEditorTool !== MAP_EDITOR_TOOLS.STRUCTURE ||
      !start ||
      !end
    ) {
      return { accepted: false, reason: "structure-drag-unavailable" };
    }

    const config = structureGeneratorConfig || {};
    if (!["bridge", "wall-line"].includes(config.mode) && mapType !== "square") {
      toast({
        title: "Square structure tool",
        description: "Room and premade-building generation use square maps. Precision walls, wall lines, and bridges work on hex or square maps.",
        status: "info",
        duration: 2200,
        isClosable: true,
      });
      return { accepted: false, reason: "square-map-required" };
    }

    if (config.mode === "bridge") {
      const bridgeResult = createBridgeOnMap({
        mapDefinition,
        start,
        end,
        material: config.bridgeMaterial || "wood",
        widthFeet: Number(config.bridgeWidthFeet) || 8,
        deckRiseFeet: Number(config.bridgeDeckRiseFeet) || 0,
        railings: config.bridgeRailings !== false,
        supports: config.bridgeSupports !== false,
        supportSpacingCells: Number(config.bridgeSupportSpacingCells) || 3,
        seed: config.bridgeSeed || "bridge-1",
        name: "Bridge",
      });
      if (!bridgeResult.accepted) {
        toast({
          title: "Bridge generation rejected",
          description: bridgeResult.reason || "Unable to generate bridge.",
          status: "warning",
          duration: 2200,
          isClosable: true,
        });
        return bridgeResult;
      }

      checkpointEditorHistory("create bridge");
      mapDefinitionRef.current = bridgeResult.mapDefinition;
      setMapDefinition(bridgeResult.mapDefinition);
      queue3DCellChanges(bridgeResult.changes || []);
      setSelectedHex({
        q: Number(end.x ?? end.q),
        r: Number(end.y ?? end.r),
        x: Number(end.x ?? end.q),
        y: Number(end.y ?? end.r),
      });
      setIsDirty(true);
      toast({
        title: "Bridge created",
        description: bridgeResult.bridge.material + " · " + bridgeResult.bridge.path.length + " cells · min clearance " + bridgeResult.minimumClearanceFeet.toFixed(1) + " ft",
        status: "success",
        duration: 1800,
        isClosable: true,
      });
      return bridgeResult;
    }
    const wallEdge = {
      kind: "wall",
      material: config.material || "wood",
      heightFeet: Number(config.heightFeet) || 10,
      visual: {
        assetUrl: config.assetUrl || null,
        useProceduralFallback: true,
      },
    };

    let result = null;
    if (config.mode === "room") {
      result = applySquareStructureRoom({
        grid: mapDefinition?.grid || [],
        start,
        end,
        edge: wallEdge,
      });
    } else if (config.mode === "wall-line") {
      result = mapType === "hex"
        ? applyOrthogonalHexStructureWallLine({
            grid: mapDefinition?.grid || [],
            structures: mapDefinition?.structures || {},
            startCell: start,
            endCell: end,
            edge: wallEdge,
            cornerMode: config.wallCornerMode || "horizontal-first",
            step: config.wallLatticeStep || 1,
          })
        : applyGridStructureWallLine({
            grid: mapDefinition?.grid || [],
            mapType,
            start,
            end,
            edge: wallEdge,
            side: config.wallLineSide || "left",
          });
    } else if (config.mode === "building") {
      result = generateSquareBuilding({
        grid: mapDefinition?.grid || [],
        start,
        end,
        seed: config.buildingSeed || "building-1",
        template: config.buildingTemplate || "tavern",
        material: config.material || "wood",
        heightFeet: Number(config.heightFeet) || 10,
        wealth: config.buildingWealth || "common",
        windowStyle: config.buildingWindowStyle || "auto",
        furnish: config.furnish !== false,
        assetUrl: config.assetUrl || null,
      });
    } else {
      return { accepted: false, reason: "precision-edge-mode" };
    }

    if (!result?.accepted) {
      toast({
        title: "Structure generation rejected",
        description: result?.reason || "Unable to generate structure.",
        status: "warning",
        duration: 2200,
        isClosable: true,
      });
      return result;
    }

    checkpointEditorHistory(
      config.mode === "building"
        ? "generate building"
        : config.mode === "room"
          ? "create room"
          : "create wall line"
    );
    const nextDefinition = {
      ...(mapDefinition || {}),
      grid: result.grid,
      structures: result.structures ?? mapDefinition?.structures ?? {},
      structureVersion: 3,
    };
    mapDefinitionRef.current = nextDefinition;
    setMapDefinition(nextDefinition);
    queue3DCellChanges(result.changes || []);
    setSelectedHex({
      q: Number(end.x ?? end.q),
      r: Number(end.y ?? end.r),
      x: Number(end.x ?? end.q),
      y: Number(end.y ?? end.r),
    });

    if (Array.isArray(result.propSuggestions) && result.propSuggestions.length > 0) {
      setMapProps((current) => normalizeMapProps(
        [...current, ...result.propSuggestions],
        nextDefinition
      ));
    }

    setIsDirty(true);
    toast({
      title:
        config.mode === "building"
          ? "Building generated"
          : config.mode === "room"
            ? "Room created"
            : "Wall line created",
      description:
        config.mode === "building"
          ? `${result.template} · seed ${result.seed} · ${result.appliedEdges || 0} structural edges`
          : `${result.appliedEdges || 0} structural edges`,
      status: "success",
      duration: 1800,
      isClosable: true,
    });
    return result;
  }, [
    activeEditorTool,
    mapDefinition,
    mapType,
    queue3DCellChanges,
    structureGeneratorConfig,
    toast,
  ]);

  const deleteBridgeById = useCallback((bridgeId) => {
    const result = deleteBridgeFromMap(mapDefinition, bridgeId);
    if (!result.accepted) return false;
    checkpointEditorHistory("delete bridge");
    mapDefinitionRef.current = result.mapDefinition;
    setMapDefinition(result.mapDefinition);
    queue3DCellChanges(result.changes || []);
    setIsDirty(true);
    return true;
  }, [checkpointEditorHistory, mapDefinition, queue3DCellChanges]);

  const selectedHexEdgeTransitions = useMemo(() => {
    if (!selectedHex) return [];
    return getBattlefieldCellEdgeTransitions(mapDefinition, {
      x: selectedHex.q,
      y: selectedHex.r,
    }).filter(Boolean);
  }, [mapDefinition, selectedHex]);

  const updateSelectedHexCell = useCallback(
    (patch) => {
      if (!selectedHex) return;

      const q = selectedHex.q;
      const r = selectedHex.r;
      const prevCell = mapDefinition?.grid?.[r]?.[q] || {};
      const requestedHeight = Object.prototype.hasOwnProperty.call(patch, "height")
        ? Number(patch.height)
        : null;
      const nextHeight =
        Object.prototype.hasOwnProperty.call(patch, "height")
          ? clampHexHeight(patch.height)
          : clampHexHeight(
              Number.isFinite(prevCell.height)
                ? prevCell.height
                : Number.isFinite(prevCell.elevation)
                  ? prevCell.elevation
                  : 0
            );
      if (requestedHeight !== null && Number.isFinite(requestedHeight) && requestedHeight !== nextHeight) {
        console.log(`map height clamped: requested=${requestedHeight} clamped=${nextHeight}`);
      }
      const nextTerrain = patch.terrainType || prevCell.terrainType || prevCell.terrain || selectedTerrainType || "grass";
      const nextCell = {
        ...prevCell,
        ...patch,
        terrain: nextTerrain,
        terrainType: nextTerrain,
        elevation: nextHeight,
        height: nextHeight,
      };
      if (Object.prototype.hasOwnProperty.call(patch, "wallTerrainType")) {
        nextCell.wallTerrainType = patch.wallTerrainType || undefined;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "wallTextureId")) {
        nextCell.wallTextureId = patch.wallTextureId || undefined;
      }

      checkpointEditorHistory("edit selected cell");
      setMapDefinition((prev) => {
        const updated = { ...(prev || {}) };
        const nextGrid = Array.isArray(updated.grid)
          ? updated.grid.map((row) => (Array.isArray(row) ? [...row] : []))
          : [];
        if (!nextGrid[r]) nextGrid[r] = [];
        nextGrid[r][q] = nextCell;
        updated.grid = nextGrid;
        return updated;
      });

      queue3DCellChange(q, r, nextCell);
      setIsDirty(true);
    },
    [mapDefinition, queue3DCellChange, selectedHex, selectedTerrainType]
  );

  const applySelectedWaterEnvironment = useCallback(
    (patch = waterPaintConfig) => {
      if (!selectedHex || !selectedHexCell) {
        return { accepted: false, reason: "water-cell-not-selected" };
      }

      const terrainKey = String(
        selectedHexCell.terrainType ||
        selectedHexCell.terrain ||
        ""
      ).toLowerCase();

      if (terrainKey !== "water") {
        toast({
          title: "Select a water cell",
          description: "Water environment settings apply to water terrain.",
          status: "info",
          duration: 1800,
          isClosable: true,
        });
        return { accepted: false, reason: "selected-cell-not-water" };
      }

      const nextCell = applyWaterEnvironmentToCell(
        selectedHexCell,
        patch
      );

      updateSelectedHexCell(nextCell);
      return {
        accepted: true,
        cell: nextCell,
      };
    },
    [
      selectedHex,
      selectedHexCell,
      toast,
      updateSelectedHexCell,
      waterPaintConfig,
    ]
  );

  const apply3DBrushToHex = useCallback(
    (hex) => {
      if (!hex) return false;
      const centerX = Number.isFinite(hex.x) ? hex.x : hex.q;
      const centerY = Number.isFinite(hex.y) ? hex.y : hex.r;
      if (!Number.isInteger(centerX) || !Number.isInteger(centerY) || centerX < 0 || centerY < 0 || centerX >= Number(gridWidth) || centerY >= Number(gridHeight)) {
        return false;
      }
      const affectedHexes = getHexesInRadius(centerX, centerY, brushRadius, {
        width: Number(gridWidth),
        height: Number(gridHeight),
      }).filter((item) => !painted3DBrushHexesRef.current.has(`${item.x},${item.y}`));
      if (!affectedHexes.length) return false;

      let changed = false;
      let changedCount = 0;
      setSelectedHex({ q: centerX, r: centerY });
      setMapDefinition((prev) => {
        const updated = { ...(prev || {}) };
        const nextGrid = Array.isArray(updated.grid)
          ? updated.grid.map((row) => (Array.isArray(row) ? [...row] : []))
          : [];
        const changes = [];

        affectedHexes.forEach((affected) => {
          const x = affected.x;
          const y = affected.y;
          const prevCell = nextGrid?.[y]?.[x] || {};
          const currentHeight = Number.isFinite(prevCell.height)
            ? prevCell.height
            : Number.isFinite(prevCell.elevation)
              ? prevCell.elevation
              : 0;
          let nextCell = { ...prevCell };

          if (editor3DBrushMode === "top-terrain") {
            if (
              nextCell.terrain === selectedTerrainType &&
              nextCell.terrainType === selectedTerrainType &&
              selectedTerrainType !== "water"
            ) return;
            nextCell = {
              ...nextCell,
              terrain: selectedTerrainType,
              terrainType: selectedTerrainType,
            };
            if (selectedTerrainType === "water") {
              nextCell = applyWaterEnvironmentToCell(
                nextCell,
                waterPaintConfig
              );
            }
          } else if (editor3DBrushMode === "wall-terrain") {
            if (nextCell.wallTerrainType === selectedWallTerrainType) return;
            nextCell = {
              ...nextCell,
              wallTerrainType: selectedWallTerrainType,
            };
          } else if (["height-raise", "height-lower", "height-flatten"].includes(editor3DBrushMode)) {
            const step = Number(editorHeightStep) || 1;
            const nextHeight = editor3DBrushMode === "height-flatten"
              ? clampHexHeight(editorFlattenHeight)
              : clampHexHeight(currentHeight + (editor3DBrushMode === "height-raise" ? step : -step));
            if (nextHeight === currentHeight) return;
            nextCell = {
              ...nextCell,
              height: nextHeight,
              elevation: nextHeight,
            };
          } else {
            return;
          }

          if (!nextGrid[y]) nextGrid[y] = [];
          nextGrid[y][x] = nextCell;
          painted3DBrushHexesRef.current.add(`${x},${y}`);
          changes.push({ x, y, cell: nextCell });
        });

        if (!changes.length) return prev;
        updated.grid = nextGrid;
        queue3DCellChanges(changes);
        changedCount = changes.length;
        changed = true;
        return updated;
      });
      if (changedCount > 0) {
        setIsDirty(true);
      }
      return changed;
    },
    [
      brushRadius,
      editor3DBrushMode,
      editorFlattenHeight,
      editorHeightStep,
      gridHeight,
      gridWidth,
      queue3DCellChanges,
      selectedTerrainType,
      selectedWallTerrainType,
      waterPaintConfig,
    ]
  );

  const begin3DBrushStroke = useCallback(
    (hex) => {
      checkpointEditorHistory("3D brush stroke");
      painted3DBrushHexesRef.current.clear();
      return apply3DBrushToHex(hex);
    },
    [apply3DBrushToHex, brushRadius, checkpointEditorHistory, editor3DBrushMode]
  );

  const update3DBrushStroke = useCallback(
    (hex) => apply3DBrushToHex(hex),
    [apply3DBrushToHex]
  );

  const end3DBrushStroke = useCallback(() => {
    painted3DBrushHexesRef.current.clear();
  }, []);

  const isHexInBounds = useCallback(
    (hex) => {
      if (!hex) return false;
      const width = Number(gridWidth) || 0;
      const height = Number(gridHeight) || 0;
      const offset = Number.isFinite(hex.x) && Number.isFinite(hex.y)
        ? { col: hex.x, row: hex.y }
        : axialToOffset(Number(hex.q), Number(hex.r));
      const col = Number(offset.col);
      const row = Number(offset.row);
      return Number.isInteger(col) && Number.isInteger(row) && col >= 0 && row >= 0 && col < width && row < height;
    },
    [gridHeight, gridWidth]
  );

  const hasBlockingPropAtHex = useCallback(
    (hex, ignoredPropId = null) => {
      if (!hex) return false;
      return mapProps.some((prop) => (
        prop.id !== ignoredPropId &&
        prop.blocksMovement &&
        prop.q === hex.q &&
        prop.r === hex.r
      ));
    },
    [mapProps]
  );

  const handlePlaceSelectedProp = useCallback(() => {
    if (!selectedHex || !isHexInBounds(selectedHex)) return;
    const definition = getBattlefieldPropDefinition(selectedPropType);
    const axialHex = offsetToAxial(selectedHex.q, selectedHex.r);
    if (definition.blocksMovement && hasBlockingPropAtHex(axialHex)) {
      toast({
        title: "Hex already blocked",
        description: "Move the existing blocking prop before placing another blocking object there.",
        status: "warning",
        duration: 1800,
        isClosable: true,
      });
      return;
    }

    const id = `map-prop-${Date.now()}`;
    const nextProp = createBattlefieldProp(selectedPropType, {
      q: axialHex.q,
      r: axialHex.r,
      x: selectedHex.q,
      y: selectedHex.r,
      coordinateSpace: "axial",
    }, { id });
    checkpointEditorHistory("place prop");
    setMapProps((prev) => [...prev, nextProp]);
    setSelectedPropId(id);
    setIsDirty(true);
  }, [hasBlockingPropAtHex, isHexInBounds, selectedHex, selectedPropType, toast]);

  const beginPropGrab = useCallback(({ grabbedObject: nextGrabbedObject, prop }) => {
    setSelectedPropId(prop?.id || nextGrabbedObject?.id || null);
    setDraggingPropId(prop?.id || nextGrabbedObject?.id || null);
    setGrabbedObject(nextGrabbedObject || null);
  }, []);

  const updatePropGrabHover = useCallback(({ hoverHex: nextHoverHex, grabbedObject: nextGrabbedObject }) => {
    setHoverHex(nextHoverHex || null);
    setGrabbedObject(nextGrabbedObject || null);
  }, []);

  const completePropDrop = useCallback(
    ({ prop, dropHex }) => {
      if (!prop?.id || !dropHex || !isHexInBounds(dropHex)) {
        setDraggingPropId(null);
        setHoverHex(null);
        setGrabbedObject(null);
        return false;
      }

      if (prop.blocksMovement && hasBlockingPropAtHex(dropHex, prop.id)) {
        setDraggingPropId(null);
        setHoverHex(null);
        setGrabbedObject(null);
        return false;
      }

      const offset = axialToOffset(dropHex.q, dropHex.r);
      checkpointEditorHistory("move prop");
      setMapProps((prev) => prev.map((item) => (
        item.id === prop.id
          ? { ...item, q: dropHex.q, r: dropHex.r, x: offset.col, y: offset.row, coordinateSpace: "axial" }
          : item
      )));
      setSelectedPropId(prop.id);
      setDraggingPropId(null);
      setHoverHex(null);
      setGrabbedObject(null);
      setIsDirty(true);
      return true;
    },
    [hasBlockingPropAtHex, isHexInBounds]
  );


  const [importExportJson, setImportExportJson] = useState("");

  const buildExportMap = useCallback(() => {
    const size = getMapSizeFromDefinition(
      mapDefinition,
      Number(gridWidth) || 40,
      Number(gridHeight) || 30,
    );
    const grid = normalizeGridHeights(
      Array.isArray(mapDefinition?.grid)
        ? mapDefinition.grid
        : createFilledGrid(size.width, size.height, baseTerrain),
    );
    const mapForPropNormalization = {
      ...(mapDefinition || {}),
      width: size.width,
      height: size.height,
      size,
      mapSize: { width: size.width, height: size.height },
      grid,
    };
    const props = normalizeMapProps(mapProps, mapForPropNormalization);
    const existingEnvironment = mapDefinition?.environment || {};
    const existingFogOfWar = existingEnvironment.fogOfWar || mapDefinition?.fogOfWar || {};
    const existingEnvironmentalFog =
      existingEnvironment.environmentalFog || mapDefinition?.environmentalFog || {};
    const source = mapDefinition?.source || BATTLEFIELD_MAP_SOURCES.SAVED;

    return normalizeBattlefieldMap(
      {
        ...(mapDefinition || {}),
        id: mapDefinition?.id || `battlefield-${Date.now()}`,
        name: mapName || mapDefinition?.name || mapDefinition?.description || "Untitled Map",
        description: mapName || mapDefinition?.description || "Untitled Map",
        source,
        version: Number(mapDefinition?.version) || 1,
        mapType: mapType || mapDefinition?.mapType || "hex",
        baseTerrain: baseTerrain || mapDefinition?.baseTerrain || mapDefinition?.terrain || "grass",
        terrain: baseTerrain || mapDefinition?.terrain || "grass",
        lighting,
        size,
        mapSize: { width: size.width, height: size.height },
        width: size.width,
        height: size.height,
        grid,
        hexes: gridToSavedHexes(grid),
        props,
        spawnZones: Array.isArray(mapDefinition?.spawnZones) ? mapDefinition.spawnZones : [],
        environment: {
          ...existingEnvironment,
          lighting,
          environmentalFog: {
            ...existingEnvironmentalFog,
            type: environmentalFog,
          },
          fogOfWar: {
            ...existingFogOfWar,
            enabled: fogOfWarEnabled,
            teamScoped: existingFogOfWar.teamScoped !== false,
            rememberExplored: existingFogOfWar.rememberExplored !== false,
            rememberLastKnownEnemies: existingFogOfWar.rememberLastKnownEnemies !== false,
          },
        },
        environmentalFog: {
          ...existingEnvironmentalFog,
          type: environmentalFog,
        },
        fogOfWarEnabled,
        theme: mapDefinition?.theme || {
          id: mapDefinition?.themeId || "map_builder_default",
          defaultTextureId: mapDefinition?.defaultTextureId || null,
        },
        cameraDefaults: mapDefinition?.cameraDefaults || null,
      },
      { source },
    );
  }, [
    baseTerrain,
    environmentalFog,
    fogOfWarEnabled,
    gridHeight,
    gridWidth,
    lighting,
    mapDefinition,
    mapName,
    mapProps,
    mapType,
  ]);

  const validateImportedMap = useCallback((parsed) => {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, reason: "root is not an object" };
    }
    const hasGrid = Array.isArray(parsed.grid);
    const hasHexes = Array.isArray(parsed.hexes);
    if (!hasGrid && !hasHexes) {
      return { ok: false, reason: "missing grid or hexes" };
    }
    const size = getMapSizeFromDefinition(
      parsed,
      GRID_CONFIG.GRID_WIDTH,
      GRID_CONFIG.GRID_HEIGHT,
    );
    if (
      !Number.isFinite(size.width) ||
      !Number.isFinite(size.height) ||
      size.width <= 0 ||
      size.height <= 0
    ) {
      return { ok: false, reason: "invalid map size" };
    }
    if (hasGrid && !parsed.grid.every((row) => Array.isArray(row))) {
      return { ok: false, reason: "grid rows must be arrays" };
    }
    return { ok: true, size };
  }, []);

  const clearTransientEditorState = useCallback((nextSize) => {
    setSelectedPropId(null);
    setDraggingPropId(null);
    setHoverHex(null);
    setGrabbedObject(null);
    setSelectedHex((prev) => {
      if (!prev) return null;
      const q = Number(prev.q);
      const r = Number(prev.r);
      return (
        Number.isInteger(q) &&
        Number.isInteger(r) &&
        q >= 0 &&
        r >= 0 &&
        q < nextSize.width &&
        r < nextSize.height
      )
        ? prev
        : null;
    });
  }, []);

  const handleResizeGrid = useCallback(() => {
    const nextW = Math.max(5, Math.min(200, Number(gridWidth) || 40));
    const nextH = Math.max(5, Math.min(200, Number(gridHeight) || 30));
    setGridWidth(nextW);
    setGridHeight(nextH);

    setMapDefinition((prev) => {
      const updated = { ...(prev || {}) };
      updated.grid = resizeGridKeepExisting(updated.grid, nextW, nextH, baseTerrain);
      updated.mapSize = { width: nextW, height: nextH };
      updated.width = nextW;
      updated.height = nextH;
      return updated;
    });

    // Fraidere full rebuild in 3D for safety on resize
    if (arena3DRef.current?.rebuildEditor) {
      arena3DRef.current.rebuildEditor({
        ...mapDefinitionRef.current,
        grid: resizeGridKeepExisting(mapDefinitionRef.current?.grid, nextW, nextH, baseTerrain),
        mapSize: { width: nextW, height: nextH },
      });
    }

    setIsDirty(true);
    toast({ title: "Grid resized", status: "success", duration: 1200, isClosable: true });
  }, [baseTerrain, gridHeight, gridWidth, toast]);

  const handleExport = useCallback(() => {
    const exportMap = buildExportMap();
    const json = JSON.stringify(exportMap, null, 2);
    setImportExportJson(json);
    toast({ title: "Map exported", description: "JSON placed in the text box.", status: "info", duration: 1600, isClosable: true });
  }, [buildExportMap, toast]);

  const handleImport = useCallback(() => {
    resetEditorHistory();
    const parsed = safeJsonParse(importExportJson, null);
    const validation = validateImportedMap(parsed);
    if (!validation.ok) {
      toast({ title: "Invalid map JSON", description: validation.reason, status: "error", duration: 2200, isClosable: true });
      return;
    }

    const width = validation.size.width;
    const height = validation.size.height;
    const nextGrid = normalizeGridHeights(
      Array.isArray(parsed.grid)
        ? parsed.grid
        : hexesToGrid(parsed.hexes, width, height, parsed.terrain || "OPEN_GROUND")
    );
    const nextProps = normalizeMapProps(parsed.props, parsed);
    const nextName = parsed.name || parsed.description || "Imported Map";
    const lightingValue =
      typeof parsed.lighting === "string"
        ? parsed.lighting
        : parsed.lighting?.preset || "BRIGHT_DAYLIGHT";
    const nextDefinition = {
      ...parsed,
      id: parsed.id || `map-${Date.now()}`,
      name: nextName,
      description: nextName,
      version: Number(parsed.version) || 1,
      mapType: parsed.mapType || "hex",
      terrain: parsed.terrain || parsed.theme?.defaultTerrain || "OPEN_GROUND",
      lighting: lightingValue,
      size: { width, height },
      mapSize: { width, height },
      width,
      height,
      grid: nextGrid,
      hexes: Array.isArray(parsed.hexes) ? parsed.hexes : gridToSavedHexes(nextGrid),
      props: nextProps,
      spawnZones: Array.isArray(parsed.spawnZones) ? parsed.spawnZones : [],
    };

    setMapDefinition(nextDefinition);
    setMapProps(nextProps);
    clearTransientEditorState({ width, height });
    setMapName(nextName);
    setMapType(parsed.mapType || "hex");
    setBaseTerrain(nextDefinition.terrain || "OPEN_GROUND");
    setLighting(lightingValue);
    setEnvironmentalFog(parsed.environment?.environmentalFog?.type || parsed.environmentalFog?.type || BATTLEFIELD_FOG.CLEAR);
    setFogOfWarEnabled(parsed.environment?.fogOfWar?.enabled === true || parsed.fogOfWarEnabled === true);
    setGridWidth(width);
    setGridHeight(height);

    setIsDirty(true);
    toast({ title: "Map imported", description: `${nextProps.length} props restored.`, status: "success", duration: 1800, isClosable: true });
  }, [clearTransientEditorState, importExportJson, toast, validateImportedMap]);


  const handleOpenBattlefieldMap = useCallback((incomingMap) => {
    resetEditorHistory();
    if (!incomingMap) return;
    const normalized = normalizeBattlefieldMap(incomingMap);
    const width = normalized.width || normalized.mapSize?.width || 40;
    const height = normalized.height || normalized.mapSize?.height || 30;
    const editorProps = normalizeMapProps(normalized.props, normalized);
    const editorDefinition = {
      ...normalized,
      props: editorProps,
      grid: normalizeGridHeights(normalized.grid),
    };

    setMapDefinition(editorDefinition);
    setMapProps(editorProps);
    setMapName(normalized.name || "Untitled Map");
    setMapType(normalized.mapType || "hex");
    setBaseTerrain(normalized.baseTerrain || normalized.terrain || "grass");
    setLighting(normalized.environment?.lighting || normalized.lighting || "BRIGHT_DAYLIGHT");
    setEnvironmentalFog(normalized.environment?.environmentalFog?.type || BATTLEFIELD_FOG.CLEAR);
    setFogOfWarEnabled(normalized.environment?.fogOfWar?.enabled === true);
    setGridWidth(width);
    setGridHeight(height);
    setSelectedTerrainType(normalized.baseTerrain || "grass");
    clearTransientEditorState({ width, height });
    setIsDirty(normalized.source === BATTLEFIELD_MAP_SOURCES.GENERATED || normalized.source === BATTLEFIELD_MAP_SOURCES.IMPORTED);
  }, [clearTransientEditorState]);

  const handleNewMap = useCallback(() => {
    resetEditorHistory();
    const width = 40;
    const height = 30;
    const blank = normalizeBattlefieldMap({
      id: `battlefield-${Date.now()}`,
      name: "Untitled Map",
      source: BATTLEFIELD_MAP_SOURCES.SAVED,
      mapType: "hex",
      baseTerrain: "grass",
      terrain: "grass",
      width,
      height,
      mapSize: { width, height },
      grid: createFilledGrid(width, height, "grass"),
      props: [],
      environment: {
        lighting: "BRIGHT_DAYLIGHT",
        environmentalFog: { type: BATTLEFIELD_FOG.CLEAR },
        fogOfWar: { enabled: false, teamScoped: true, rememberExplored: true, rememberLastKnownEnemies: true },
      },
    });
    handleOpenBattlefieldMap(blank);
    setIsDirty(true);
  }, [handleOpenBattlefieldMap]);

  const handleSaveToLibrary = useCallback(() => {
    const current = buildExportMap();
    const saved = {
      ...current,
      name: mapName || current.name,
    };
    const result = saveBattlefieldMapToLibrary(saved);
    if (result?.entry?.mapDefinition) {
      const editorProps = normalizeMapProps(result.entry.mapDefinition.props, result.entry.mapDefinition);
      setMapDefinition({ ...result.entry.mapDefinition, props: editorProps });
      setMapProps(editorProps);
      setMapName(result.entry.mapDefinition.name || mapName || "Untitled Map");
    }
    setLibraryRevision((value) => value + 1);
    setIsDirty(false);
    toast({ title: "Battlefield saved", description: "Added to the battlefield map library.", status: "success", duration: 1500, isClosable: true });
  }, [buildExportMap, mapName, toast]);

  const handleTestBattle = useCallback(() => {
    launchBattlefieldTestBattle(buildExportMap());
  }, [buildExportMap]);

  const selectedProp = useMemo(
    () => mapProps.find((prop) => String(prop.id) === String(selectedPropId)) || null,
    [mapProps, selectedPropId],
  );

  const updateSelectedProp = useCallback((patch) => {
    if (!selectedPropId) return;
    checkpointEditorHistory("edit prop");
    setMapProps((prev) => prev.map((prop) => (
      String(prop.id) === String(selectedPropId)
        ? normalizeBattlefieldProp({ ...prop, ...patch, id: prop.id })
        : prop
    )));
    setIsDirty(true);
  }, [checkpointEditorHistory, selectedPropId]);

  const rotateSelectedProp = useCallback((delta) => {
    if (!selectedProp) return;
    const next = ((Number(selectedProp.rotation) || 0) + Number(delta || 0)) % 360;
    updateSelectedProp({ rotation: next < 0 ? next + 360 : next });
  }, [selectedProp, updateSelectedProp]);

  const scaleSelectedProp = useCallback((delta) => {
    if (!selectedProp) return;
    const next = Math.max(0.25, Math.min(4, (Number(selectedProp.scale) || 1) + Number(delta || 0)));
    updateSelectedProp({ scale: Number(next.toFixed(2)) });
  }, [selectedProp, updateSelectedProp]);

  const deleteSelectedProp = useCallback(() => {
    if (!selectedPropId) return;
    checkpointEditorHistory("delete prop");
    setMapProps((prev) => prev.filter((prop) => String(prop.id) !== String(selectedPropId)));
    setSelectedPropId(null);
    setIsDirty(true);
  }, [checkpointEditorHistory, selectedPropId]);

  const deleteSelectedSquareStructures = useCallback(() => {
    if (!selectedHex) return false;

    const edgeResult = deleteGridCellStructures({
      grid: mapDefinition?.grid || [],
      mapType,
      x: selectedHex.q,
      y: selectedHex.r,
    });
    const orthogonalResult = removeOrthogonalStructureRunsOwnedByCell({
      grid: edgeResult.accepted ? edgeResult.grid : (mapDefinition?.grid || []),
      structures: mapDefinition?.structures || {},
      x: selectedHex.q,
      y: selectedHex.r,
    });
    if (!edgeResult.accepted && !orthogonalResult.accepted) return false;

    const nextGrid = orthogonalResult.accepted
      ? orthogonalResult.grid
      : edgeResult.grid;
    const nextStructures = orthogonalResult.accepted
      ? orthogonalResult.structures
      : (mapDefinition?.structures || {});
    const changes = [
      ...(edgeResult.accepted ? (edgeResult.changes || []) : []),
      ...(orthogonalResult.accepted ? (orthogonalResult.changes || []) : []),
    ];
    const byCell = new Map();
    changes.forEach((change) => byCell.set(change.x + "," + change.y, change));

    checkpointEditorHistory("delete selected structure edges/runs");
    setMapDefinition((current) => ({
      ...(current || {}),
      grid: nextGrid,
      structures: nextStructures,
      structureVersion: 3,
    }));
    queue3DCellChanges([...byCell.values()]);
    setIsDirty(true);
    return true;
  }, [
    checkpointEditorHistory,
    mapDefinition?.grid,
    mapDefinition?.structures,
    mapType,
    queue3DCellChanges,
    selectedHex,
  ]);

  const deleteSelectedEditorItem = useCallback(() => {
    if (selectedPropId) {
      deleteSelectedProp();
      return true;
    }
    if (activeEditorTool === MAP_EDITOR_TOOLS.STRUCTURE) {
      return deleteSelectedSquareStructures();
    }
    return false;
  }, [
    activeEditorTool,
    deleteSelectedProp,
    deleteSelectedSquareStructures,
    selectedPropId,
  ]);

  const mapSummary = useMemo(() => ({
    name: mapName,
    width: Number(gridWidth) || 0,
    height: Number(gridHeight) || 0,
    mapType,
    lighting: LIGHTING_LABELS[lighting] || lighting,
    fog: FOG_LABELS[environmentalFog] || environmentalFog,
    propCount: mapProps.length,
  }), [environmentalFog, gridHeight, gridWidth, lighting, mapName, mapProps.length, mapType]);

  const editorHistoryState = useMemo(
    () => getMapEditorHistoryState(editorHistoryRef.current),
    [editorHistoryRevision]
  );

  useEffect(() => {
    const handleEditorKeyDown = (event) => {
      const target = event.target;
      const tag = String(target?.tagName || "").toLowerCase();
      if (
        target?.isContentEditable ||
        tag === "input" ||
        tag === "textarea" ||
        tag === "select"
      ) {
        return;
      }

      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && String(event.key).toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redoEditor();
        else undoEditor();
        return;
      }
      if (modifier && String(event.key).toLowerCase() === "y") {
        event.preventDefault();
        redoEditor();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (deleteSelectedEditorItem()) event.preventDefault();
      }
    };
    window.addEventListener("keydown", handleEditorKeyDown);
    return () => window.removeEventListener("keydown", handleEditorKeyDown);
  }, [deleteSelectedEditorItem, redoEditor, undoEditor]);

  const mapNameChange = useCallback((value) => { setMapName(value); setIsDirty(true); }, []);
  const mapTypeChange = useCallback((value) => { setMapType(value); setIsDirty(true); }, []);
  const lightingChange = useCallback((value) => { setLighting(value); setIsDirty(true); }, []);
  const fogChange = useCallback((value) => { setEnvironmentalFog(value); setIsDirty(true); }, []);
  const fogOfWarChange = useCallback((value) => { setFogOfWarEnabled(Boolean(value)); setIsDirty(true); }, []);
  const terrainChange = useCallback((value) => { setSelectedTerrainType(value); setIsDirty(true); }, []);
  const wallTerrainChange = useCallback((value) => { setSelectedWallTerrainType(value); setIsDirty(true); }, []);

  const render2DViewport = () => (
    <Box height="100%" minH="0" borderRadius="lg" overflow="hidden" bg="white" borderWidth="1px">
      <TacticalMap
        combatants={[]}
        positions={{}}
        currentTurn={null}
        highlightMovement={false}
        flashingCombatants={null}
        movementMode={{ active: false, isRunning: false }}
        onMoveSelect={() => {}}
        onSelectedCombatantChange={() => {}}
        onHoveredCellChange={() => {}}
        onSelectedHexChange={handleSelectedHexChange}
        terrain={mapDefinition}
        mapType={mapType}
        mode="MAP_EDITOR"
        mapDefinition={mapDefinition}
        selectedTerrainType={selectedTerrainType}
        brushRadius={brushRadius}
        editorBrushMode={editorInteraction.twoDBrushMode}
        editorHeightStep={editorHeightStep}
        editorFlattenHeight={editorFlattenHeight}
        waterPaintConfig={waterPaintConfig}
        structureDragMode={
          activeEditorTool === MAP_EDITOR_TOOLS.STRUCTURE
            ? structureGeneratorConfig.mode
            : "edge"
        }
        onStructureDragEnd={handleSquareStructureDragEnd}
        onEditorMutationBegin={checkpointEditorHistory}
        onSelectedTerrainTypeChange={terrainChange}
        onMapCellEdit={editorInteraction.brushEnabled ? handleMapCellEdit : null}
        onMapCellsEdit={editorInteraction.brushEnabled ? handleMapCellsEdit : null}
        showEditorOverlay={false}
        showMapControls
        autoFit
        mapHeight={viewportHeight}
      />
    </Box>
  );

  const render3DViewport = () => (
    <Box height="100%" minH="0" borderRadius="lg" overflow="hidden" bg="black" borderWidth="1px">
      <HexArena3D
        ref={arena3DRef}
        mapDefinition={mapDefinition}
        fighters={[]}
        positions={{}}
        terrain={mapDefinition}
        mode="MAP_EDITOR"
        visible={true}
        editorProps={mapProps}
        selectedEditorPropId={selectedPropId}
        onHexSelect={handleSelectedHexChange}
        onEditorPropGrab={editorInteraction.propInteractionEnabled ? beginPropGrab : null}
        onEditorPropHover={editorInteraction.propInteractionEnabled ? updatePropGrabHover : null}
        onEditorPropDrop={editorInteraction.propInteractionEnabled ? completePropDrop : null}
        editorBrushMode={editorInteraction.threeDBrushMode}
        onEditorBrushStart={editorInteraction.brushEnabled ? begin3DBrushStroke : null}
        onEditorBrushPaint={editorInteraction.brushEnabled ? update3DBrushStroke : null}
        onEditorBrushEnd={editorInteraction.brushEnabled ? end3DBrushStroke : null}
      />
    </Box>
  );

  return (
    <Box bg="gray.50" height="calc(100vh - 58px)" minH="680px" overflow="hidden">
      <Box
        height="64px"
        px={4}
        bg="white"
        borderBottomWidth="1px"
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={3}
      >
        <HStack spacing={3} minW={0}>
          <Box minW="120px">
            <Text fontSize="md" fontWeight="800" lineHeight="1.1">Map Maker</Text>
            <Text fontSize="10px" color="gray.500">Battlefield editor</Text>
          </Box>
          <Input
            size="sm"
            maxW="320px"
            value={mapName}
            onChange={(event) => mapNameChange(event.target.value)}
            fontWeight="semibold"
            aria-label="Map name"
          />
          {isDirty && <Badge colorScheme="orange">Unsaved</Badge>}
        </HStack>

        <HStack spacing={2} flexShrink={0}>
          <Button size="sm" variant="outline" onClick={handleNewMap}>New</Button>
          <Button
            size="sm"
            variant="outline"
            onClick={undoEditor}
            isDisabled={!editorHistoryState.canUndo}
            aria-label="Undo map edit"
            title={editorHistoryState.nextUndoLabel ? "Undo: " + editorHistoryState.nextUndoLabel : "Undo"}
          >Undo</Button>
          <Button
            size="sm"
            variant="outline"
            onClick={redoEditor}
            isDisabled={!editorHistoryState.canRedo}
            aria-label="Redo map edit"
            title={editorHistoryState.nextRedoLabel ? "Redo: " + editorHistoryState.nextRedoLabel : "Redo"}
          >Redo</Button>
          <Button
            size="sm"
            variant="outline"
            colorScheme="red"
            onClick={deleteSelectedEditorItem}
            isDisabled={
              !selectedPropId &&
              !(
                activeEditorTool === MAP_EDITOR_TOOLS.STRUCTURE &&
                selectedHex &&
                Object.keys(selectedHexCell?.walls || {}).length > 0
              )
            }
            aria-label="Delete selected map object"
          >Delete Selected</Button>
          <Button size="sm" colorScheme="blue" onClick={handleSaveToLibrary}>Save</Button>
          <Button size="sm" colorScheme="green" onClick={handleTestBattle}>Test Battle</Button>
          <ButtonGroup size="sm" isAttached variant="outline" ml={2}>
            <Button colorScheme={viewMode === "2d" ? "blue" : "gray"} variant={viewMode === "2d" ? "solid" : "outline"} onClick={() => setViewMode("2d")}>2D</Button>
            <Button colorScheme={viewMode === "3d" ? "blue" : "gray"} variant={viewMode === "3d" ? "solid" : "outline"} onClick={() => setViewMode("3d")}>3D</Button>
            <Button colorScheme={viewMode === "split" ? "blue" : "gray"} variant={viewMode === "split" ? "solid" : "outline"} onClick={() => setViewMode("split")}>Split</Button>
          </ButtonGroup>
        </HStack>
      </Box>

      <Grid
        templateColumns={{ base: "1fr", xl: "340px minmax(0, 1fr) 290px", "2xl": "360px minmax(0, 1fr) 310px" }}
        height="calc(100% - 64px)"
        minH="0"
      >
        <GridItem display={{ base: "none", xl: "block" }} minW="0" minH="0">
          <MapMakerToolSidebar
            mapName={mapName}
            mapType={mapType}
            gridWidth={gridWidth}
            gridHeight={gridHeight}
            onMapNameChange={mapNameChange}
            onMapTypeChange={mapTypeChange}
            onGridWidthChange={(value) => { setGridWidth(value); setIsDirty(true); }}
            onGridHeightChange={(value) => { setGridHeight(value); setIsDirty(true); }}
            onResizeGrid={handleResizeGrid}
            selectedTerrainType={selectedTerrainType}
            onSelectedTerrainTypeChange={terrainChange}
            selectedWallTerrainType={selectedWallTerrainType}
            onSelectedWallTerrainTypeChange={wallTerrainChange}
            brushRadius={brushRadius}
            onBrushRadiusChange={setBrushRadius}
            editorBrushMode={editorBrushMode}
            onEditorBrushModeChange={setEditorBrushMode}
            editorHeightStep={editorHeightStep}
            onEditorHeightStepChange={setEditorHeightStep}
            editorFlattenHeight={editorFlattenHeight}
            onEditorFlattenHeightChange={(value) => setEditorFlattenHeight(clampHexHeight(value))}
            selectedHexHeight={selectedHexHeight}
            selectedHex={selectedHex}
            selectedHexCell={selectedHexCell}
            selectedWaterEnvironment={selectedWaterEnvironment}
            waterPaintConfig={waterPaintConfig}
            onWaterPaintConfigChange={setWaterPaintConfig}
            onApplySelectedWaterEnvironment={applySelectedWaterEnvironment}
            onApplyStructureEdge={applySelectedSquareStructureEdge}
            structureGeneratorConfig={structureGeneratorConfig}
            onStructureGeneratorConfigChange={setStructureGeneratorConfig}
            bridges={mapDefinition?.structures?.bridges || []}
            onDeleteBridge={deleteBridgeById}
            editor3DBrushMode={editor3DBrushMode}
            onEditor3DBrushModeChange={setEditor3DBrushMode}
            selectedPropType={selectedPropType}
            onSelectedPropTypeChange={setSelectedPropType}
            onPlaceProp={handlePlaceSelectedProp}
            canPlaceProp={Boolean(selectedHex)}
            lighting={lighting}
            environmentalFog={environmentalFog}
            fogOfWarEnabled={fogOfWarEnabled}
            onLightingChange={lightingChange}
            onEnvironmentalFogChange={fogChange}
            onFogOfWarEnabledChange={fogOfWarChange}
            getCurrentMap={buildExportMap}
            onOpenMap={handleOpenBattlefieldMap}
            importExportJson={importExportJson}
            onImportExportJsonChange={setImportExportJson}
            onExport={handleExport}
            onImport={handleImport}
            libraryRevision={libraryRevision}
            activeTool={activeEditorTool}
            onActiveToolChange={handleActiveEditorToolChange}
          />
        </GridItem>

        <GridItem minW="0" minH="0" p={2} overflow="hidden">
          <VStack align="stretch" spacing={2} height="100%">
            <HStack
              minH="36px"
              px={3}
              py={1}
              bg="white"
              borderWidth="1px"
              borderRadius="md"
              justify="space-between"
              flexShrink={0}
            >
              <HStack spacing={2} wrap="wrap">
                <Badge>{Number(gridWidth) || 0} × {Number(gridHeight) || 0}</Badge>
                <Badge colorScheme="blue">{activeEditorTool === MAP_EDITOR_TOOLS.HEIGHT ? "Height Tool" : activeEditorTool === MAP_EDITOR_TOOLS.STRUCTURE ? "Structure Tool" : activeEditorTool === MAP_EDITOR_TOOLS.PROPS ? "Prop Tool" : activeEditorTool === MAP_EDITOR_TOOLS.TERRAIN ? "Terrain Tool" : "Select Mode"}</Badge>
                <Badge>{mapType === "square" ? "Square" : "Hex"}</Badge>
                <Badge colorScheme="yellow">{LIGHTING_LABELS[lighting] || lighting}</Badge>
                {environmentalFog !== BATTLEFIELD_FOG.CLEAR && <Badge colorScheme="gray">{FOG_LABELS[environmentalFog] || environmentalFog}</Badge>}
                {fogOfWarEnabled && <Badge colorScheme="purple">Fog of War</Badge>}
              </HStack>
              <Text fontSize="xs" color="gray.500">
                {selectedHex ? `Hex ${selectedHex.q}, ${selectedHex.r}` : `${mapProps.length} props`}
              </Text>
            </HStack>

            <Box flex="1" minH="0" overflow="hidden">
              {/*
                Milestone 8C-8C.2 R5.2.1 — keep both viewports mounted.
                View-mode changes alter layout/visibility only; HexArena3D is not
                destroyed and recreated when switching 2D / 3D / Split.
              */}
              <Grid
                templateColumns={viewMode === "split" ? "minmax(0, 1fr) minmax(0, 1fr)" : "minmax(0, 1fr)"}
                gap={viewMode === "split" ? 2 : 0}
                height="100%"
                minH="0"
              >
                <GridItem
                  minW="0"
                  minH="0"
                  gridColumn="1"
                  gridRow="1"
                  display={viewMode === "3d" ? "none" : "block"}
                >
                  {render2DViewport()}
                </GridItem>
                <GridItem
                  minW="0"
                  minH="0"
                  gridColumn={viewMode === "split" ? "2" : "1"}
                  gridRow="1"
                  display={viewMode === "2d" ? "none" : "block"}
                >
                  {render3DViewport()}
                </GridItem>
              </Grid>
            </Box>
          </VStack>
        </GridItem>

        <GridItem display={{ base: "none", xl: "block" }} minW="0" minH="0" bg="white" borderLeftWidth="1px" overflowY="auto">
          <MapMakerInspectorPanel
            selectedHex={selectedHex}
            selectedHexCell={selectedHexCell}
            selectedHexHeight={selectedHexHeight}
            selectedHexTerrain={selectedHexTerrain}
            selectedHexWallTerrain={selectedHexWallTerrain}
            selectedHexEdgeTransitions={selectedHexEdgeTransitions}
            onUpdateSelectedHex={updateSelectedHexCell}
            selectedProp={selectedProp}
            onRotateProp={rotateSelectedProp}
            onScaleProp={scaleSelectedProp}
            onDeleteProp={deleteSelectedProp}
            onDeleteSelectedStructures={deleteSelectedSquareStructures}
            mapType={mapType}
            mapSummary={mapSummary}
          />
        </GridItem>
      </Grid>
    </Box>
  );

}


