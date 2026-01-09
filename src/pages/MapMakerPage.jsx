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

const STORAGE_KEY = "mapMaker.savedMaps.v1";

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

export default function MapMakerPage() {
  const toast = useToast();
  const arena3DRef = useRef(null);

  const [show3DView, setShow3DView] = useState(true);
  const [selectedTerrainType, setSelectedTerrainType] = useState("grass");

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
      setMapDefinition((prev) => {
        const updated = { ...(prev || {}) };
        if (!updated.grid) updated.grid = [];
        if (!updated.grid[y]) updated.grid[y] = [];
        updated.grid[y][x] = cell;
        return updated;
      });
      queue3DCellChange(x, y, cell);
    },
    [queue3DCellChange]
  );

  const handleMapCellsEdit = useCallback(
    (changes) => {
      if (!Array.isArray(changes) || changes.length === 0) return;
      setMapDefinition((prev) => {
        const updated = { ...(prev || {}) };
        const nextGrid = Array.isArray(updated.grid)
          ? updated.grid.map((row) => (Array.isArray(row) ? [...row] : []))
          : [];
        changes.forEach((c) => {
          if (!nextGrid[c.y]) nextGrid[c.y] = [];
          nextGrid[c.y][c.x] = c.cell;
        });
        updated.grid = nextGrid;
        return updated;
      });
      queue3DCellChanges(changes);
    },
    [queue3DCellChanges]
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

  const handleSave = useCallback(() => {
    const id = `${Date.now()}`;
    const entry = {
      id,
      name: mapName || "Untitled Map",
      savedAt: new Date().toISOString(),
      mapDefinition,
    };
    const next = [entry, ...savedMaps];
    persistSavedMaps(next);
    setSelectedSavedId(id);
    toast({ title: "Map saved", status: "success", duration: 1600, isClosable: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapName, mapDefinition, persistSavedMaps, toast]);

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
    toast({ title: "Map loaded", status: "info", duration: 1400, isClosable: true });
  }, [savedMaps, selectedSavedId, toast]);

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
    const json = JSON.stringify(mapDefinition, null, 2);
    setImportExportJson(json);
    toast({ title: "Export ready", description: "JSON placed in the text box.", status: "info", duration: 1600, isClosable: true });
  }, [mapDefinition, toast]);

  const handleImport = useCallback(() => {
    const parsed = safeJsonParse(importExportJson, null);
    if (!parsed || typeof parsed !== "object") {
      toast({ title: "Import failed", description: "Invalid JSON.", status: "error", duration: 2000, isClosable: true });
      return;
    }

    setMapDefinition(parsed);
    setMapName(parsed.description || "Imported Map");
    setMapType(parsed.mapType || "hex");
    setBaseTerrain(parsed.terrain || "OPEN_GROUND");
    setLighting(parsed.lighting || "BRIGHT_DAYLIGHT");

    const width = parsed.mapSize?.width ?? parsed.width ?? GRID_CONFIG.GRID_WIDTH;
    const height = parsed.mapSize?.height ?? parsed.height ?? GRID_CONFIG.GRID_HEIGHT;
    setGridWidth(width);
    setGridHeight(height);

    toast({ title: "Map imported", status: "success", duration: 1600, isClosable: true });
  }, [importExportJson, toast]);

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
                <Button size="sm" variant="outline" onClick={handleExport}>Export JSON</Button>
                <Button size="sm" colorScheme="green" variant="outline" onClick={handleImport} isDisabled={!importExportJson.trim()}>
                  Import JSON
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
                  onSelectedHexChange={() => {}}
                  terrain={mapDefinition}
                  mapType={mapType}
                  mode="MAP_EDITOR"
                  mapDefinition={mapDefinition}
                  selectedTerrainType={selectedTerrainType}
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


