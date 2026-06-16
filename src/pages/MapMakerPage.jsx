import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Divider,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Select,
  Text,
  Textarea,
  VStack,
  useToast,
} from "@chakra-ui/react";
import TacticalMap from "../components/TacticalMap.jsx";
import HexArena3D from "../components/HexArena3D.jsx";
import { TERRAIN_TYPES, LIGHTING_CONDITIONS } from "../utils/terrainSystem";
import { GRID_CONFIG } from "../data/movementRules";
import { axialToOffset, offsetToAxial } from "../utils/hexGridMath";
import { getHexesInRadius } from "../utils/mapBrush.js";
import {
  MAP_MIN_HEIGHT,
  MAP_MAX_HEIGHT,
  clampMapHeight,
} from "../utils/mapHeightConstants.js";

const STORAGE_KEY = "mapMaker.savedMaps.v1";
const MAP_BUILDER_TERRAIN_OPTIONS = [
  { key: "grass", label: "Grass" },
  { key: "forest", label: "Forest" },
  { key: "water", label: "Water" },
  { key: "rock", label: "Rock / Stone" },
  { key: "sand", label: "Sand / Dirt" },
  { key: "road", label: "Road" },
];
const MAP_BUILDER_3D_BRUSH_MODES = [
  { key: "top-terrain", label: "Top Terrain Paint" },
  { key: "wall-terrain", label: "Wall Paint" },
  { key: "height-raise", label: "Height Raise" },
  { key: "height-lower", label: "Height Lower" },
];
const MAP_BUILDER_PROP_PALETTE = [
  {
    type: "tree",
    name: "Tree",
    modelUrl: null,
    rotation: 0,
    scale: 1,
    blocksMovement: true,
    blocksLineOfSight: true,
  },
  {
    type: "boulder",
    name: "Boulder",
    modelUrl: null,
    rotation: 0,
    scale: 1,
    blocksMovement: true,
    blocksLineOfSight: true,
  },
  {
    type: "crate",
    name: "Crate",
    modelUrl: null,
    rotation: 0,
    scale: 1,
    blocksMovement: true,
    blocksLineOfSight: false,
  },
];

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

function normalizeMapProps(props) {
  if (!Array.isArray(props)) return [];
  return props
    .filter((prop) => prop && Number.isFinite(Number(prop.q)) && Number.isFinite(Number(prop.r)))
    .map((prop) => ({
      id: prop.id || `map-prop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: prop.type || "crate",
      name: prop.name || prop.type || "Prop",
      modelUrl: prop.modelUrl || null,
      q: Number(prop.q),
      r: Number(prop.r),
      rotation: Number(prop.rotation) || 0,
      scale: Number(prop.scale) || 1,
      blocksMovement: prop.blocksMovement !== false,
      blocksLineOfSight: prop.blocksLineOfSight === true,
    }));
}

export default function MapMakerPage() {
  const toast = useToast();
  const arena3DRef = useRef(null);

  const [show3DView, setShow3DView] = useState(true);
  const [selectedTerrainType, setSelectedTerrainType] = useState("grass");
  const [selectedWallTerrainType, setSelectedWallTerrainType] = useState("grass");
  const [editor3DBrushMode, setEditor3DBrushMode] = useState("top-terrain");
  const [brushRadius, setBrushRadius] = useState(0);
  const [selectedHex, setSelectedHex] = useState(null);
  const [selectedPropType, setSelectedPropType] = useState(MAP_BUILDER_PROP_PALETTE[0].type);
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
      grid: createFilledGrid(width, height, "OPEN_GROUND"),
      mapSize: { width, height },
    };
  });

  useEffect(() => {
    mapDefinitionRef.current = mapDefinition;
  }, [mapDefinition]);

  useEffect(() => {
    console.log(`🖌️ map brush radius: ${brushRadius}`);
  }, [brushRadius]);

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
      mapSize: { width: gridWidth, height: gridHeight },
    }));
  }, [mapName, mapType, baseTerrain, lighting, gridWidth, gridHeight]);

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
    },
    [mapDefinition, queue3DCellChanges]
  );

  const handleSelectedHexChange = useCallback((hex) => {
    if (!hex) {
      setSelectedHex(null);
      return;
    }

    const q = Number.isFinite(hex.q) ? hex.q : hex.x;
    const r = Number.isFinite(hex.r) ? hex.r : hex.y;
    setSelectedHex({ q, r });
    console.log(`🧱 map builder selected hex: (${q},${r})`);
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
  const selectedHexTexture = selectedHexCell?.textureId || "none";
  const selectedHexWallTerrain = selectedHexCell?.wallTerrainType || "automatic";

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
        console.log(`⛰️ map height clamped: requested=${requestedHeight} clamped=${nextHeight}`);
      }
      const nextTerrain = patch.terrainType || prevCell.terrainType || prevCell.terrain || selectedTerrainType || "grass";
      const nextCell = {
        ...prevCell,
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
      console.log(`⛰️ map height updated: (${q},${r}) height=${nextHeight}`);
      console.log(
        `🧱 map builder updated hex: (${q},${r}) height=${nextHeight} terrain=${nextTerrain} texture=${nextCell.textureId || "none"}`
      );
    },
    [mapDefinition, queue3DCellChange, selectedHex, selectedTerrainType]
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
            if (nextCell.terrain === selectedTerrainType && nextCell.terrainType === selectedTerrainType) return;
            nextCell = {
              ...nextCell,
              terrain: selectedTerrainType,
              terrainType: selectedTerrainType,
            };
          } else if (editor3DBrushMode === "wall-terrain") {
            if (nextCell.wallTerrainType === selectedWallTerrainType) return;
            nextCell = {
              ...nextCell,
              wallTerrainType: selectedWallTerrainType,
            };
          } else if (editor3DBrushMode === "height-raise" || editor3DBrushMode === "height-lower") {
            const delta = editor3DBrushMode === "height-raise" ? 1 : -1;
            const nextHeight = clampHexHeight(currentHeight + delta);
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
        if (editor3DBrushMode === "top-terrain") {
          console.log(`🖌️ terrain brush painted: center=(${centerX},${centerY}) radius=${brushRadius} count=${changedCount}`);
        } else if (editor3DBrushMode === "wall-terrain") {
          console.log(`🧱 wall brush painted: center=(${centerX},${centerY}) radius=${brushRadius} count=${changedCount}`);
        } else if (editor3DBrushMode === "height-raise" || editor3DBrushMode === "height-lower") {
          console.log(`⛰️ height brush painted: center=(${centerX},${centerY}) radius=${brushRadius} count=${changedCount}`);
        }
      }
      return changed;
    },
    [
      brushRadius,
      editor3DBrushMode,
      gridHeight,
      gridWidth,
      queue3DCellChanges,
      selectedTerrainType,
      selectedWallTerrainType,
    ]
  );

  const begin3DBrushStroke = useCallback(
    (hex) => {
      painted3DBrushHexesRef.current.clear();
      console.log(`🖌️ map brush radius: ${brushRadius}`);
      console.log(`🖌️ 3D brush started: mode=${editor3DBrushMode}`);
      return apply3DBrushToHex(hex);
    },
    [apply3DBrushToHex, brushRadius, editor3DBrushMode]
  );

  const update3DBrushStroke = useCallback(
    (hex) => apply3DBrushToHex(hex),
    [apply3DBrushToHex]
  );

  const end3DBrushStroke = useCallback(() => {
    painted3DBrushHexesRef.current.clear();
    console.log("🖌️ 3D brush ended");
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
    const template = MAP_BUILDER_PROP_PALETTE.find((prop) => prop.type === selectedPropType) || MAP_BUILDER_PROP_PALETTE[0];
    const axialHex = offsetToAxial(selectedHex.q, selectedHex.r);
    if (template.blocksMovement && hasBlockingPropAtHex(axialHex)) {
      toast({
        title: "Hex already blocked",
        description: "Move the existing blocking prop before placing another one there.",
        status: "warning",
        duration: 1800,
        isClosable: true,
      });
      return;
    }

    const id = `map-prop-${Date.now()}`;
    const nextProp = {
      id,
      type: template.type,
      name: template.name,
      modelUrl: template.modelUrl,
      q: axialHex.q,
      r: axialHex.r,
      rotation: template.rotation,
      scale: template.scale,
      blocksMovement: template.blocksMovement,
      blocksLineOfSight: template.blocksLineOfSight,
    };
    setMapProps((prev) => [...prev, nextProp]);
    setSelectedPropId(id);
  }, [hasBlockingPropAtHex, isHexInBounds, selectedHex, selectedPropType, toast]);

  const beginPropGrab = useCallback(({ grabbedObject: nextGrabbedObject, prop }) => {
    setSelectedPropId(prop?.id || nextGrabbedObject?.id || null);
    setDraggingPropId(prop?.id || nextGrabbedObject?.id || null);
    setGrabbedObject(nextGrabbedObject || null);
    console.log(`🧩 map prop grabbed: ${prop?.name || "Prop"}`);
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

      setMapProps((prev) => prev.map((item) => (
        item.id === prop.id
          ? { ...item, q: dropHex.q, r: dropHex.r }
          : item
      )));
      setSelectedPropId(prop.id);
      setDraggingPropId(null);
      setHoverHex(null);
      setGrabbedObject(null);
      console.log(`🧩 map prop dropped: ${prop.name || "Prop"} at (${dropHex.q},${dropHex.r})`);
      return true;
    },
    [hasBlockingPropAtHex, isHexInBounds]
  );

  const heightTiles = useMemo(() => {
    const out = [];
    const grid = mapDefinition?.grid;
    if (!Array.isArray(grid)) return out;
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      if (!Array.isArray(row)) continue;
      for (let x = 0; x < row.length; x++) {
        const cell = row[x] || {};
        const elev = Number.isFinite(cell.elevation)
          ? cell.elevation
          : Number.isFinite(cell.height)
          ? cell.height
          : 0;
        if (elev !== 0) {
          out.push({ x, y, elevation: elev, terrainType: cell.terrainType || cell.terrain });
        }
      }
    }
    return out.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  }, [mapDefinition]);

  const savedMaps = useMemo(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = safeJsonParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  }, []);
  const [selectedSavedId, setSelectedSavedId] = useState("");
  const [importExportJson, setImportExportJson] = useState("");

  const persistSavedMaps = useCallback((maps) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(maps));
  }, []);

  const buildExportMap = useCallback(() => {
    const size = getMapSizeFromDefinition(mapDefinition, Number(gridWidth) || 40, Number(gridHeight) || 30);
    const props = normalizeMapProps(mapProps);
    const grid = normalizeGridHeights(
      Array.isArray(mapDefinition?.grid) ? mapDefinition.grid : createFilledGrid(size.width, size.height, baseTerrain)
    );
    return {
      id: mapDefinition?.id || `map-${Date.now()}`,
      name: mapName || mapDefinition?.name || mapDefinition?.description || "Untitled Map",
      version: Number(mapDefinition?.version) || 1,
      description: mapName || mapDefinition?.description || "Untitled Map",
      mapType: mapType || mapDefinition?.mapType || "hex",
      terrain: baseTerrain || mapDefinition?.terrain || "OPEN_GROUND",
      lighting: mapDefinition?.lighting || lighting,
      size,
      mapSize: { width: size.width, height: size.height },
      width: size.width,
      height: size.height,
      grid,
      hexes: gridToSavedHexes(grid),
      props,
      spawnZones: Array.isArray(mapDefinition?.spawnZones) ? mapDefinition.spawnZones : [],
      theme: mapDefinition?.theme || {
        id: mapDefinition?.themeId || "map_builder_default",
        defaultTextureId: mapDefinition?.defaultTextureId || null,
      },
      cameraDefaults: mapDefinition?.cameraDefaults || null,
    };
  }, [baseTerrain, gridHeight, gridWidth, lighting, mapDefinition, mapName, mapProps, mapType]);

  const validateImportedMap = useCallback((parsed) => {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, reason: "root is not an object" };
    }
    const hasGrid = Array.isArray(parsed.grid);
    const hasHexes = Array.isArray(parsed.hexes);
    if (!hasGrid && !hasHexes) {
      return { ok: false, reason: "missing grid or hexes" };
    }
    const size = getMapSizeFromDefinition(parsed, GRID_CONFIG.GRID_WIDTH, GRID_CONFIG.GRID_HEIGHT);
    if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) {
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

  const handleSave = useCallback(() => {
    const id = `${Date.now()}`;
    const exportMap = buildExportMap();
    const entry = {
      id,
      name: mapName || "Untitled Map",
      savedAt: new Date().toISOString(),
      mapDefinition: exportMap,
    };
    const next = [entry, ...savedMaps];
    persistSavedMaps(next);
    setSelectedSavedId(id);
    toast({ title: "Map saved", status: "success", duration: 1600, isClosable: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildExportMap, mapName, persistSavedMaps, toast]);

  const handleLoad = useCallback(() => {
    const entry = savedMaps.find((m) => m.id === selectedSavedId);
    if (!entry?.mapDefinition) return;

    const def = entry.mapDefinition;
    setMapName(entry.name || def.description || "Loaded Map");
    setMapType(def.mapType || "hex");
    setBaseTerrain(def.terrain || "OPEN_GROUND");
    setLighting(def.lighting || "BRIGHT_DAYLIGHT");

    const width = def.mapSize?.width ?? def.width ?? GRID_CONFIG.GRID_WIDTH;
    const height = def.mapSize?.height ?? def.height ?? GRID_CONFIG.GRID_HEIGHT;
    setGridWidth(width);
    setGridHeight(height);

    setMapDefinition(def);
    setMapProps(normalizeMapProps(def.props));
    clearTransientEditorState({ width, height });
    toast({ title: "Map loaded", status: "info", duration: 1400, isClosable: true });
  }, [clearTransientEditorState, savedMaps, selectedSavedId, toast]);

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

    // Force full rebuild in 3D for safety on resize
    if (arena3DRef.current?.rebuildEditor) {
      arena3DRef.current.rebuildEditor({
        ...mapDefinitionRef.current,
        grid: resizeGridKeepExisting(mapDefinitionRef.current?.grid, nextW, nextH, baseTerrain),
        mapSize: { width: nextW, height: nextH },
      });
    }

    toast({ title: "Grid resized", status: "success", duration: 1200, isClosable: true });
  }, [baseTerrain, gridHeight, gridWidth, toast]);

  const handleExport = useCallback(() => {
    const exportMap = buildExportMap();
    const json = JSON.stringify(exportMap, null, 2);
    setImportExportJson(json);
    console.log(`🗺️ map builder exported: ${exportMap.name} props=${exportMap.props.length}`);
    toast({ title: "Map exported", description: "JSON placed in the text box.", status: "info", duration: 1600, isClosable: true });
  }, [buildExportMap, toast]);

  const handleImport = useCallback(() => {
    const parsed = safeJsonParse(importExportJson, null);
    const validation = validateImportedMap(parsed);
    if (!validation.ok) {
      console.warn(`🚫 map builder import failed: ${validation.reason}`);
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
    const nextProps = normalizeMapProps(parsed.props);
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
    setGridWidth(width);
    setGridHeight(height);

    console.log(`🗺️ map builder imported: ${nextName} props=${nextProps.length}`);
    toast({ title: "Map imported", description: `${nextProps.length} props restored.`, status: "success", duration: 1800, isClosable: true });
  }, [clearTransientEditorState, importExportJson, toast, validateImportedMap]);

  return (
    <Box p={4}>
      <VStack align="stretch" spacing={4}>
        <HStack justify="space-between" wrap="wrap">
          <VStack align="start" spacing={0}>
            <Text fontSize="xl" fontWeight="bold">🗺️ Map Maker</Text>
            <Text fontSize="sm" color="gray.600">Same editor pipeline as Combat Arena (2D paint + optional 3D preview).</Text>
          </VStack>
          <HStack>
            <Button size="sm" colorScheme={show3DView ? "purple" : "gray"} variant={show3DView ? "solid" : "outline"} onClick={() => setShow3DView((v) => !v)}>
              {show3DView ? "🎮 Hide 3D" : "🎮 Show 3D"}
            </Button>
            <Button size="sm" colorScheme="blue" onClick={handleSave}>💾 Save</Button>
          </HStack>
        </HStack>

        <Divider />

        <HStack align="start" spacing={4} wrap="wrap">
          <Box flex="1" minW="320px">
            <VStack align="stretch" spacing={3}>
              <FormControl>
                <FormLabel fontSize="sm">Map Name</FormLabel>
                <Input value={mapName} onChange={(e) => setMapName(e.target.value)} />
              </FormControl>

              <HStack spacing={3} wrap="wrap">
                <FormControl>
                  <FormLabel fontSize="sm">Grid</FormLabel>
                  <HStack>
                    <Input type="number" value={gridWidth} onChange={(e) => setGridWidth(e.target.value)} />
                    <Text>×</Text>
                    <Input type="number" value={gridHeight} onChange={(e) => setGridHeight(e.target.value)} />
                    <Button size="sm" onClick={handleResizeGrid}>Apply</Button>
                  </HStack>
                </FormControl>
              </HStack>

              <HStack spacing={3} wrap="wrap">
                <FormControl>
                  <FormLabel fontSize="sm">Map Type</FormLabel>
                  <Select value={mapType} onChange={(e) => setMapType(e.target.value)}>
                    <option value="hex">⬡ Hex</option>
                    <option value="square">⬛ Square</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Base Terrain</FormLabel>
                  <Select value={baseTerrain} onChange={(e) => setBaseTerrain(e.target.value)}>
                    {Object.entries(TERRAIN_TYPES).map(([key, data]) => (
                      <option key={key} value={key}>{data.name}</option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Lighting</FormLabel>
                  <Select value={lighting} onChange={(e) => setLighting(e.target.value)}>
                    {Object.entries(LIGHTING_CONDITIONS).map(([key, data]) => (
                      <option key={key} value={key}>{data.name}</option>
                    ))}
                  </Select>
                </FormControl>
              </HStack>

              <Divider />

              <Box borderWidth="1px" borderRadius="md" p={3} bg="gray.50">
                <VStack align="stretch" spacing={3}>
                  <Text fontSize="sm" fontWeight="bold">
                    {selectedHex
                      ? `Selected hex: ${selectedHex.q}, ${selectedHex.r}`
                      : "No hex selected"}
                  </Text>
                  {selectedHex && (
                    <>
                      <HStack spacing={3} align="end" wrap="wrap">
                        <FormControl>
                          <FormLabel fontSize="sm">Height</FormLabel>
                          <HStack>
                            <Button
                              size="sm"
                              onClick={() => updateSelectedHexCell({ height: selectedHexHeight - 1 })}
                              isDisabled={selectedHexHeight <= MAP_MIN_HEIGHT}
                            >
                              -
                            </Button>
                            <Input
                              type="number"
                              min={MAP_MIN_HEIGHT}
                              max={MAP_MAX_HEIGHT}
                              value={selectedHexHeight}
                              onChange={(e) => updateSelectedHexCell({ height: e.target.value })}
                            />
                            <Button
                              size="sm"
                              onClick={() => updateSelectedHexCell({ height: selectedHexHeight + 1 })}
                              isDisabled={selectedHexHeight >= MAP_MAX_HEIGHT}
                            >
                              +
                            </Button>
                          </HStack>
                        </FormControl>
                      </HStack>

                      <FormControl>
                        <FormLabel fontSize="sm">Terrain</FormLabel>
                        <Select
                          value={selectedHexTerrain}
                          onChange={(e) => updateSelectedHexCell({ terrainType: e.target.value })}
                        >
                          {MAP_BUILDER_TERRAIN_OPTIONS.map((terrain) => (
                            <option key={terrain.key} value={terrain.key}>
                              {terrain.label}
                            </option>
                          ))}
                        </Select>
                      </FormControl>

                      <Text fontSize="xs" color="gray.600">
                        Texture/style: {selectedHexTexture === "none" ? "terrain material" : selectedHexTexture}
                      </Text>
                      <Text fontSize="xs" color="gray.600">
                        Wall texture: {selectedHexWallTerrain}
                      </Text>
                    </>
                  )}
                </VStack>
              </Box>

              <Divider />

              <Box borderWidth="1px" borderRadius="md" p={3} bg="gray.50">
                <VStack align="stretch" spacing={3}>
                  <Text fontSize="sm" fontWeight="bold">3D Brush</Text>
                  <FormControl>
                    <FormLabel fontSize="sm">Brush Mode</FormLabel>
                    <Select value={editor3DBrushMode} onChange={(e) => setEditor3DBrushMode(e.target.value)}>
                      {MAP_BUILDER_3D_BRUSH_MODES.map((mode) => (
                        <option key={mode.key} value={mode.key}>
                          {mode.label}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">Brush Radius</FormLabel>
                    <Select value={brushRadius} onChange={(e) => setBrushRadius(Number(e.target.value) || 0)}>
                      {[0, 1, 2, 3].map((radius) => (
                        <option key={radius} value={radius}>
                          {radius}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">Top Terrain</FormLabel>
                    <Select value={selectedTerrainType} onChange={(e) => setSelectedTerrainType(e.target.value)}>
                      {MAP_BUILDER_TERRAIN_OPTIONS.map((terrain) => (
                        <option key={terrain.key} value={terrain.key}>
                          {terrain.label}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">Wall Terrain</FormLabel>
                    <Select value={selectedWallTerrainType} onChange={(e) => setSelectedWallTerrainType(e.target.value)}>
                      {MAP_BUILDER_TERRAIN_OPTIONS.map((terrain) => (
                        <option key={terrain.key} value={terrain.key}>
                          {terrain.label}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <Text fontSize="xs" color="gray.600">
                    Radius {brushRadius} paints {brushRadius === 0 ? "one hex" : "a hex area"}.
                  </Text>
                </VStack>
              </Box>

              <Divider />

              <Box borderWidth="1px" borderRadius="md" p={3} bg="gray.50">
                <VStack align="stretch" spacing={3}>
                  <Text fontSize="sm" fontWeight="bold">Props</Text>
                  <FormControl>
                    <FormLabel fontSize="sm">Prop Palette</FormLabel>
                    <Select value={selectedPropType} onChange={(e) => setSelectedPropType(e.target.value)}>
                      {MAP_BUILDER_PROP_PALETTE.map((prop) => (
                        <option key={prop.type} value={prop.type}>
                          {prop.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    size="sm"
                    colorScheme="purple"
                    onClick={handlePlaceSelectedProp}
                    isDisabled={!selectedHex}
                  >
                    Place Prop
                  </Button>
                  <Text fontSize="xs" color="gray.600">
                    {selectedPropId
                      ? `Selected prop: ${mapProps.find((prop) => prop.id === selectedPropId)?.name || selectedPropId}`
                      : "No prop selected"}
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    {draggingPropId
                      ? `Dragging over: ${hoverHex ? `${hoverHex.q}, ${hoverHex.r}` : "outside map"}`
                      : `Placed props: ${mapProps.length}`}
                  </Text>
                </VStack>
              </Box>

              <Divider />

              <FormControl>
                <FormLabel fontSize="sm">Saved Maps</FormLabel>
                <HStack>
                  <Select value={selectedSavedId} onChange={(e) => setSelectedSavedId(e.target.value)} placeholder="Select saved map">
                    {savedMaps.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({new Date(m.savedAt).toLocaleString()})</option>
                    ))}
                  </Select>
                  <Button size="sm" onClick={handleLoad} isDisabled={!selectedSavedId}>Load</Button>
                </HStack>
              </FormControl>

              <Divider />

              <Box>
                <HStack justify="space-between" align="center" mb={2}>
                  <Text fontSize="sm" fontWeight="bold">⛰️ Height Tiles</Text>
                  <Text fontSize="xs" color="gray.600">
                    {heightTiles.length} non-flat
                  </Text>
                </HStack>
                <Box
                  borderWidth="1px"
                  borderRadius="md"
                  p={2}
                  maxH="160px"
                  overflowY="auto"
                  fontFamily="mono"
                  fontSize="xs"
                  bg="gray.50"
                >
                  {heightTiles.length === 0 ? (
                    <Text fontSize="xs" color="gray.600" fontFamily="system-ui">
                      No raised/lowered tiles yet.
                    </Text>
                  ) : (
                    heightTiles.map((t) => (
                      <Box key={`${t.x},${t.y}`}>
                        ({t.x},{t.y}) elev={t.elevation}{t.terrainType ? ` terrain=${t.terrainType}` : ""}
                      </Box>
                    ))
                  )}
                </Box>
              </Box>

              <Divider />

              <HStack>
                <Button size="sm" variant="outline" onClick={handleExport}>Export Map JSON</Button>
                <Button size="sm" colorScheme="green" variant="outline" onClick={handleImport} isDisabled={!importExportJson.trim()}>
                  Import Map JSON
                </Button>
              </HStack>
              <Textarea
                value={importExportJson}
                onChange={(e) => setImportExportJson(e.target.value)}
                rows={8}
                placeholder="Paste exported map JSON here to import."
                fontFamily="mono"
                fontSize="sm"
              />
            </VStack>
          </Box>

          <Box flex="2" minW="520px">
            <VStack align="stretch" spacing={3}>
              <Box borderWidth="1px" borderRadius="md" overflow="hidden">
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
                  onSelectedTerrainTypeChange={setSelectedTerrainType}
                  onMapCellEdit={handleMapCellEdit}
                  onMapCellsEdit={handleMapCellsEdit}
                  mapHeight={800}
                />
              </Box>

              {show3DView && (
                <Box borderWidth="1px" borderRadius="md" overflow="hidden" height="520px">
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
                    onEditorPropGrab={beginPropGrab}
                    onEditorPropHover={updatePropGrabHover}
                    onEditorPropDrop={completePropDrop}
                    editorBrushMode={editor3DBrushMode}
                    onEditorBrushStart={begin3DBrushStroke}
                    onEditorBrushPaint={update3DBrushStroke}
                    onEditorBrushEnd={end3DBrushStroke}
                  />
                </Box>
              )}
            </VStack>
          </Box>
        </HStack>
      </VStack>
    </Box>
  );
}


