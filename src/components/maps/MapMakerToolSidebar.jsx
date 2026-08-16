import React, { useEffect, useState } from "react";
import { Stack,
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Select,
  Textarea,
  SimpleGrid,
  Switch,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
} from "@chakra-ui/react";
import BattlefieldMapManagerPanel from "./BattlefieldMapManagerPanel.jsx";
import BattlefieldPropPalettePanel from "./BattlefieldPropPalettePanel.jsx";
import { FOG_LABELS, LIGHTING_LABELS } from "../../utils/maps/battlefieldMapUiModel.js";
import { MAP_EDITOR_TOOL_ORDER, MAP_EDITOR_TOOLS } from "../../utils/maps/mapEditorInteractionAuthority.js";

const TERRAIN_SWATCHES = Object.freeze([
  { key: "grass", label: "Grass", color: "#62b947" },
  { key: "dirt", label: "Dirt", color: "#9a6a3a" },
  { key: "mud", label: "Mud", color: "#6f4d32" },
  { key: "rubble", label: "Rubble", color: "#686868" },
  { key: "forest", label: "Forest", color: "#2f7d45" },
  { key: "rock", label: "Rock", color: "#737373" },
  { key: "sand", label: "Sand", color: "#d8b866" },
  { key: "water", label: "Water", color: "#1597d3" },
  { key: "road", label: "Road", color: "#8a6a45" },
  { key: "hill", label: "Hill", color: "#71834d" },
]);

const BRUSH_SIZES = [0, 1, 2, 3, 5];

function SectionHint({ children }) {
  return <Text fontSize="xs" color="gray.500" lineHeight="1.4">{children}</Text>;
}

export default function MapMakerToolSidebar({
  mapName,
  mapType,
  gridWidth,
  gridHeight,
  onMapNameChange,
  onMapTypeChange,
  onGridWidthChange,
  onGridHeightChange,
  onResizeGrid,
  selectedTerrainType,
  onSelectedTerrainTypeChange,
  selectedWallTerrainType,
  onSelectedWallTerrainTypeChange,
  brushRadius,
  onBrushRadiusChange,
  editorBrushMode,
  onEditorBrushModeChange,
  editorHeightStep,
  onEditorHeightStepChange,
  editorFlattenHeight,
  onEditorFlattenHeightChange,
  selectedHexHeight,
  selectedHex,
  selectedHexCell,
  selectedWaterEnvironment,
  waterPaintConfig,
  onWaterPaintConfigChange,
  onApplySelectedWaterEnvironment,
  onApplyStructureEdge,
  structureGeneratorConfig,
  onStructureGeneratorConfigChange,
  bridges = [],
  onDeleteBridge,
  editor3DBrushMode,
  onEditor3DBrushModeChange,
  selectedPropType,
  onSelectedPropTypeChange,
  onPlaceProp,
  canPlaceProp,
  lighting,
  environmentalFog,
  fogOfWarEnabled,
  onLightingChange,
  onEnvironmentalFogChange,
  onFogOfWarEnabledChange,
  getCurrentMap,
  onOpenMap,
  importExportJson,
  onImportExportJsonChange,
  onExport,
  onImport,
  libraryRevision = 0,
  activeTool = MAP_EDITOR_TOOLS.TERRAIN,
  onActiveToolChange,
}) {
  const [structureDrawMode, setStructureDrawMode] = useState(
    structureGeneratorConfig?.mode || "edge"
  );
  const [buildingTemplate, setBuildingTemplate] = useState(
    structureGeneratorConfig?.buildingTemplate || "tavern"
  );
  const [buildingSeed, setBuildingSeed] = useState(
    structureGeneratorConfig?.buildingSeed || "building-1"
  );
  const [buildingWealth, setBuildingWealth] = useState(
    structureGeneratorConfig?.buildingWealth || "common"
  );
  const [buildingWindowStyle, setBuildingWindowStyle] = useState(
    structureGeneratorConfig?.buildingWindowStyle || "auto"
  );
  const [structureWindowStyle, setStructureWindowStyle] = useState(
    structureGeneratorConfig?.precisionWindowStyle || "open"
  );
  const [structureAssetUrl, setStructureAssetUrl] = useState(
    structureGeneratorConfig?.assetUrl || ""
  );
  const [furnishGeneratedBuilding, setFurnishGeneratedBuilding] = useState(
    structureGeneratorConfig?.furnish !== false
  );
  const [bridgeMaterial, setBridgeMaterial] = useState(
    structureGeneratorConfig?.bridgeMaterial || "wood"
  );
  const [bridgeWidthFeet, setBridgeWidthFeet] = useState(
    structureGeneratorConfig?.bridgeWidthFeet || 8
  );
  const [bridgeDeckRiseFeet, setBridgeDeckRiseFeet] = useState(
    structureGeneratorConfig?.bridgeDeckRiseFeet ?? 0.75
  );
  const [bridgeRailings, setBridgeRailings] = useState(
    structureGeneratorConfig?.bridgeRailings !== false
  );
  const [bridgeSupports, setBridgeSupports] = useState(
    structureGeneratorConfig?.bridgeSupports !== false
  );
  const [bridgeSupportSpacingCells, setBridgeSupportSpacingCells] = useState(
    structureGeneratorConfig?.bridgeSupportSpacingCells || 3
  );
  const [bridgeSeed, setBridgeSeed] = useState(
    structureGeneratorConfig?.bridgeSeed || "bridge-1"
  );
  const [wallLineSide, setWallLineSide] = useState(
    structureGeneratorConfig?.wallLineSide || "left"
  );
  const [wallCornerMode, setWallCornerMode] = useState(
    structureGeneratorConfig?.wallCornerMode || "horizontal-first"
  );
  const [wallLatticeStep, setWallLatticeStep] = useState(
    structureGeneratorConfig?.wallLatticeStep || 1
  );
  const [structureKind, setStructureKind] = useState("wall");
  const [structureMaterial, setStructureMaterial] = useState("stone");
  const [structureHeightFeet, setStructureHeightFeet] = useState(10);
  const [structureDoorOpen, setStructureDoorOpen] = useState(false);

  useEffect(() => {
    onStructureGeneratorConfigChange?.({
      mode: structureDrawMode,
      kind: structureKind,
      material: structureMaterial,
      heightFeet: Number(structureHeightFeet) || 10,
      doorOpen: structureDoorOpen,
      precisionWindowStyle: structureWindowStyle,
      buildingTemplate,
      buildingSeed,
      buildingWealth,
      buildingWindowStyle,
      furnish: furnishGeneratedBuilding,
      assetUrl: structureAssetUrl.trim(),
      wallLineSide,
      wallCornerMode,
      wallLatticeStep,
      bridgeMaterial,
      bridgeWidthFeet: Number(bridgeWidthFeet) || 8,
      bridgeDeckRiseFeet: Number(bridgeDeckRiseFeet) || 0,
      bridgeRailings,
      bridgeSupports,
      bridgeSupportSpacingCells: Number(bridgeSupportSpacingCells) || 3,
      bridgeSeed,
    });
  }, [
    buildingSeed,
    buildingTemplate,
    buildingWealth,
    buildingWindowStyle,
    bridgeDeckRiseFeet,
    bridgeMaterial,
    bridgeRailings,
    bridgeSeed,
    bridgeSupportSpacingCells,
    bridgeSupports,
    bridgeWidthFeet,
    furnishGeneratedBuilding,
    onStructureGeneratorConfigChange,
    structureAssetUrl,
    structureDoorOpen,
    structureDrawMode,
    structureHeightFeet,
    structureKind,
    structureMaterial,
    wallLineSide,
    wallCornerMode,
    wallLatticeStep,
    structureWindowStyle,
  ]);

  const [flattenHeightDraft, setFlattenHeightDraft] = useState(() => {
    const numeric = Number(editorFlattenHeight);
    return Number.isFinite(numeric) ? String(numeric) : "0";
  });

  useEffect(() => {
    const numeric = Number(editorFlattenHeight);
    if (Number.isFinite(numeric)) {
      setFlattenHeightDraft(String(numeric));
    }
  }, [editorFlattenHeight]);

  const commitFlattenHeightDraft = (rawValue = flattenHeightDraft) => {
    const text = String(rawValue ?? "").trim();

    // These are legitimate intermediate editing states, but not values that
    // should be sent into canonical map-height state.
    if (
      text === "" ||
      text === "-" ||
      text === "+" ||
      text === "." ||
      text === "-." ||
      text === "+."
    ) {
      return false;
    }

    const numeric = Number(text);
    if (!Number.isFinite(numeric)) return false;

    onEditorFlattenHeightChange?.(numeric);
    return true;
  };

  const selectedStructureWalls = selectedHexCell?.walls || {};
  const structureDirections = mapType === "hex"
    ? ["E", "SE", "SW", "W", "NW", "NE"]
    : ["N", "E", "S", "W"];
  const effectiveStructureKind =
    mapType === "hex" && !["wall", "gate", "palisade", "fence"].includes(structureKind)
      ? "wall"
      : structureKind;

  const buildStructureEdge = () => ({
    kind: effectiveStructureKind,
    material: structureMaterial,
    heightFeet: Number(structureHeightFeet) || 10,
    open: ["door", "gate"].includes(effectiveStructureKind) ? structureDoorOpen : false,
    windowStyle: effectiveStructureKind === "window" ? structureWindowStyle : null,
    visual: {
      assetUrl: structureAssetUrl.trim() || null,
      windowStyle: effectiveStructureKind === "window" ? structureWindowStyle : null,
      glass:
        effectiveStructureKind === "window" &&
        ["leaded", "stained"].includes(structureWindowStyle),
      shutters:
        effectiveStructureKind === "window" &&
        structureWindowStyle === "shuttered",
      useProceduralFallback: true,
    },
  });

  const applyStructure = (direction) =>
    onApplyStructureEdge?.({
      direction,
      edge: buildStructureEdge(),
      remove: false,
    });

  const removeStructure = (direction) =>
    onApplyStructureEdge?.({
      direction,
      remove: true,
    });

  return (
    <Box height="100%" overflow="hidden" bg="white" borderRightWidth="1px">
      <Tabs
        variant="soft-rounded"
        colorScheme="blue"
        size="sm"
        height="100%"
        display="flex"
        flexDirection="column"
        index={Math.max(0, MAP_EDITOR_TOOL_ORDER.indexOf(activeTool))}
        onChange={(index) => onActiveToolChange?.(MAP_EDITOR_TOOL_ORDER[index] || MAP_EDITOR_TOOLS.TERRAIN)}
      >
        <Box px={3} pt={3} pb={2} borderBottomWidth="1px">
          <TabList flexWrap="wrap" gap={1}>
            <Tab px={3}>Terrain</Tab>
            <Tab px={3}>Height</Tab>
            <Tab px={3}>Structure</Tab>
            <Tab px={3}>Props</Tab>
            <Tab px={3}>Environment</Tab>
            <Tab px={3}>Maps</Tab>
          </TabList>
        </Box>
        <TabPanels flex="1" overflowY="auto">
          <TabPanel p={3}>
            <VStack align="stretch" spacing={4}>
              <Box>
                <Text fontWeight="bold" fontSize="sm" mb={2}>Paint Terrain</Text>
                <HStack spacing={2} mb={3}>
                  <Button
                    size="sm"
                    flex="1"
                    variant={editorBrushMode === "terrain" ? "solid" : "outline"}
                    colorScheme={editorBrushMode === "terrain" ? "blue" : "gray"}
                    onClick={() => onEditorBrushModeChange?.("terrain")}
                  >
                    Paint
                  </Button>
                  <Button
                    size="sm"
                    flex="1"
                    variant={editorBrushMode === "bucket" ? "solid" : "outline"}
                    colorScheme={editorBrushMode === "bucket" ? "blue" : "gray"}
                    onClick={() => onEditorBrushModeChange?.("bucket")}
                  >
                    Fill
                  </Button>
                </HStack>
                <HStack spacing={2} mb={3}>
                  <Button
                    size="xs"
                    variant={editor3DBrushMode !== "wall-terrain" ? "solid" : "outline"}
                    colorScheme={editor3DBrushMode !== "wall-terrain" ? "teal" : "gray"}
                    onClick={() => { onEditorBrushModeChange?.("terrain"); onEditor3DBrushModeChange?.("top-terrain"); }}
                  >
                    3D Surface
                  </Button>
                  <Button
                    size="xs"
                    variant={editor3DBrushMode === "wall-terrain" ? "solid" : "outline"}
                    colorScheme={editor3DBrushMode === "wall-terrain" ? "teal" : "gray"}
                    onClick={() => { onEditorBrushModeChange?.("terrain"); onEditor3DBrushModeChange?.("wall-terrain"); }}
                  >
                    3D Walls
                  </Button>
                </HStack>
                <Text fontSize="xs" fontWeight="semibold" mb={2}>Brush radius</Text>
                <HStack spacing={1} mb={4}>
                  {BRUSH_SIZES.map((radius) => (
                    <Button
                      key={radius}
                      size="xs"
                      minW="34px"
                      variant={brushRadius === radius ? "solid" : "outline"}
                      colorScheme={brushRadius === radius ? "blue" : "gray"}
                      onClick={() => onBrushRadiusChange?.(radius)}
                    >
                      {radius}
                    </Button>
                  ))}
                </HStack>
                <SimpleGrid columns={2} spacing={2}>
                  {TERRAIN_SWATCHES.map((terrain) => {
                    const active = selectedTerrainType === terrain.key;
                    return (
                      <Button
                        key={terrain.key}
                        height="42px"
                        justifyContent="flex-start"
                        variant={active ? "solid" : "outline"}
                        colorScheme={active ? "blue" : "gray"}
                        onClick={() => onSelectedTerrainTypeChange?.(terrain.key)}
                        px={2}
                      >
                        <Box
                          w="16px"
                          h="16px"
                          borderRadius="sm"
                          bg={terrain.color}
                          borderWidth="1px"
                          borderColor="blackAlpha.300"
                          mr={2}
                          flex="0 0 auto"
                        />
                        <Text fontSize="xs">{terrain.label}</Text>
                      </Button>
                    );
                  })}
                </SimpleGrid>
              </Box>

              <Box borderTopWidth="1px" pt={3}>
                <FormControl>
                  <FormLabel fontSize="xs">Wall / cliff material</FormLabel>
                  <Select size="sm" value={selectedWallTerrainType} onChange={(event) => onSelectedWallTerrainTypeChange?.(event.target.value)}>
                    {TERRAIN_SWATCHES.map((terrain) => (
                      <option key={terrain.key} value={terrain.key}>{terrain.label}</option>
                    ))}
                  </Select>
                </FormControl>
                <SectionHint>Wall material is used by the 3D terrain column sides and cliff faces.</SectionHint>


              <Box borderTopWidth="1px" pt={3}>
                <Text fontWeight="bold" fontSize="sm" mb={1}>Water Environment</Text>
                <SectionHint>
                  These values become the defaults when Water is painted. Select an existing water cell and apply them to edit that cell.
                </SectionHint>

                <SimpleGrid columns={2} spacing={2} mt={3}>
                  <FormControl>
                    <FormLabel fontSize="xs">Depth (ft)</FormLabel>
                    <Input
                      size="sm"
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={waterPaintConfig?.waterDepthFeet ?? 3}
                      onChange={(event) => onWaterPaintConfigChange?.({
                        ...(waterPaintConfig || {}),
                        waterDepthFeet: Math.max(0, Number(event.target.value) || 0),
                      })}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="xs">Water temp (F)</FormLabel>
                    <Input
                      size="sm"
                      type="number"
                      min={28}
                      max={120}
                      step={1}
                      value={waterPaintConfig?.waterTemperatureF ?? 55}
                      onChange={(event) => onWaterPaintConfigChange?.({
                        ...(waterPaintConfig || {}),
                        waterTemperatureF: Number(event.target.value) || 55,
                      })}
                    />
                  </FormControl>
                </SimpleGrid>

                <FormControl mt={2}>
                  <FormLabel fontSize="xs">Current</FormLabel>
                  <Select
                    size="sm"
                    value={waterPaintConfig?.waterCurrentStrength || "none"}
                    onChange={(event) => onWaterPaintConfigChange?.({
                      ...(waterPaintConfig || {}),
                      waterCurrentStrength: event.target.value,
                    })}
                  >
                    <option value="none">None / Still Water</option>
                    <option value="light">Light</option>
                    <option value="moderate">Moderate</option>
                    <option value="strong">Strong</option>
                    <option value="rapid">Rapid</option>
                    <option value="torrent">Torrent</option>
                  </Select>
                </FormControl>

                <SimpleGrid columns={2} spacing={2} mt={2}>
                  <FormControl>
                    <FormLabel fontSize="xs">Flow direction</FormLabel>
                    <Select
                      size="sm"
                      value={waterPaintConfig?.waterCurrentDirection || "E"}
                      onChange={(event) => onWaterPaintConfigChange?.({
                        ...(waterPaintConfig || {}),
                        waterCurrentDirection: event.target.value,
                      })}
                    >
                      {["N", "NE", "E", "SE", "S", "SW", "W", "NW"].map((direction) => (
                        <option key={direction} value={direction}>{direction}</option>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="xs">Bottom</FormLabel>
                    <Select
                      size="sm"
                      value={waterPaintConfig?.waterBottomTerrain || "mud"}
                      onChange={(event) => onWaterPaintConfigChange?.({
                        ...(waterPaintConfig || {}),
                        waterBottomTerrain: event.target.value,
                      })}
                    >
                      <option value="rock">Rock</option>
                      <option value="gravel">Gravel</option>
                      <option value="sand">Sand</option>
                      <option value="mud">Mud</option>
                      <option value="rubble">Rubble</option>
                    </Select>
                  </FormControl>
                </SimpleGrid>

                <Button
                  size="sm"
                  width="100%"
                  mt={3}
                  colorScheme="cyan"
                  variant="outline"
                  isDisabled={
                    !selectedHex ||
                    String(selectedHexCell?.terrainType || selectedHexCell?.terrain || "").toLowerCase() !== "water"
                  }
                  onClick={() => onApplySelectedWaterEnvironment?.(waterPaintConfig)}
                >
                  Apply to Selected Water Cell
                </Button>

                {selectedWaterEnvironment?.isWater && (
                  <Box mt={2} p={2} borderWidth="1px" borderRadius="md" bg="cyan.50">
                    <Text fontSize="xs" fontWeight="semibold">
                      Selected: {Number(selectedWaterEnvironment.depthFeet || 0).toFixed(1)} ft · {selectedWaterEnvironment.depthBand}
                    </Text>
                    <SectionHint>
                      Current {selectedWaterEnvironment.current?.strength || "none"} {selectedWaterEnvironment.current?.direction || ""} · bottom {selectedWaterEnvironment.bottomTerrain || "unknown"}
                    </SectionHint>
                  </Box>
                )}

                <SectionHint>
                  Temperature is authored now for the later wetness/hypothermia phase; 8D1 does not apply thermal injury.
                </SectionHint>
              </Box>              </Box>
            </VStack>
          </TabPanel>

          <TabPanel p={3}>
            <VStack align="stretch" spacing={4}>
              <Box>
                <Text fontWeight="bold" fontSize="sm" mb={2}>Elevation Brush</Text>
                <HStack spacing={2}>
                  <Button
                    size="sm"
                    flex="1"
                    variant={editorBrushMode === "raise" ? "solid" : "outline"}
                    colorScheme={editorBrushMode === "raise" ? "green" : "gray"}
                    onClick={() => onEditorBrushModeChange?.("raise")}
                  >
                    Raise
                  </Button>
                  <Button
                    size="sm"
                    flex="1"
                    variant={editorBrushMode === "lower" ? "solid" : "outline"}
                    colorScheme={editorBrushMode === "lower" ? "orange" : "gray"}
                    onClick={() => onEditorBrushModeChange?.("lower")}
                  >
                    Lower
                  </Button>
                  <Button
                    size="sm"
                    flex="1"
                    variant={editorBrushMode === "flatten" ? "solid" : "outline"}
                    colorScheme={editorBrushMode === "flatten" ? "cyan" : "gray"}
                    onClick={() => onEditorBrushModeChange?.("flatten")}
                  >
                    Flatten
                  </Button>
                </HStack>
              </Box>

              {editorBrushMode === "flatten" ? (
                <Box>
                  <Text fontSize="xs" fontWeight="semibold" mb={2}>Flatten to height</Text>
                  <HStack spacing={2}>
                    <Input
                      size="sm"
                      type="number"
                      step="1"
                      value={flattenHeightDraft}
                      onChange={(event) => {
                        const next = event.target.value;
                        setFlattenHeightDraft(next);

                        // Commit complete signed numeric values immediately,
                        // while allowing "-" to remain visible long enough to
                        // type a negative elevation such as -2.
                        if (/^[+-]?\d+(?:\.\d+)?$/.test(next.trim())) {
                          commitFlattenHeightDraft(next);
                        }
                      }}
                      onBlur={() => {
                        if (!commitFlattenHeightDraft()) {
                          const numeric = Number(editorFlattenHeight);
                          setFlattenHeightDraft(
                            Number.isFinite(numeric) ? String(numeric) : "0"
                          );
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          commitFlattenHeightDraft();
                          event.currentTarget.blur();
                        }
                        if (event.key === "Escape") {
                          const numeric = Number(editorFlattenHeight);
                          setFlattenHeightDraft(
                            Number.isFinite(numeric) ? String(numeric) : "0"
                          );
                          event.currentTarget.blur();
                        }
                      }}
                      aria-label="Flatten target height"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const selected = Number(selectedHexHeight);
                        const next = Number.isFinite(selected) ? selected : 0;
                        setFlattenHeightDraft(String(next));
                        onEditorFlattenHeightChange?.(next);
                      }}
                      isDisabled={!Number.isFinite(Number(selectedHexHeight))}
                      title="Use the currently selected hex elevation"
                    >
                      Use Selected
                    </Button>
                  </HStack>
                  <SectionHint>Painted hexes are set to this exact signed elevation. Negative values lower terrain; brush radius applies normally.</SectionHint>
                </Box>
              ) : (
                <Box>
                  <Text fontSize="xs" fontWeight="semibold" mb={2}>Height step</Text>
                  <HStack spacing={2}>
                    {[1, 2, 5].map((step) => (
                      <Button
                        key={step}
                        size="sm"
                        variant={Number(editorHeightStep) === step ? "solid" : "outline"}
                        colorScheme={Number(editorHeightStep) === step ? "green" : "gray"}
                        onClick={() => onEditorHeightStepChange?.(step)}
                      >
                        {step}
                      </Button>
                    ))}
                  </HStack>
                </Box>
              )}

              <Box>
                <Text fontSize="xs" fontWeight="semibold" mb={2}>Brush radius</Text>
                <HStack spacing={1}>
                  {BRUSH_SIZES.map((radius) => (
                    <Button
                      key={radius}
                      size="xs"
                      minW="34px"
                      variant={brushRadius === radius ? "solid" : "outline"}
                      colorScheme={brushRadius === radius ? "green" : "gray"}
                      onClick={() => onBrushRadiusChange?.(radius)}
                    >
                      {radius}
                    </Button>
                  ))}
                </HStack>
              </Box>

              <SectionHint>Use the right-side inspector for exact height values on a selected hex.</SectionHint>
            </VStack>
          </TabPanel>

                    <TabPanel p={3}>
            <VStack align="stretch" spacing={4}>
              <Box>
                <Text fontWeight="bold" fontSize="sm" mb={1}>Fast Structure Authoring</Text>
                <SectionHint>
                  Structure is grid-agnostic: precision walls, wall lines, gates, and bridges work on both grids. Square maps also support rooms and premade indoor buildings.
                </SectionHint>
              </Box>

              <Button
                size="sm"
                colorScheme={structureDrawMode === "bridge" ? "cyan" : "gray"}
                variant={structureDrawMode === "bridge" ? "solid" : "outline"}
                onClick={() => setStructureDrawMode("bridge")}
              >
                Bridge / Over-Under — drag
              </Button>

              {mapType !== "square" && !["edge", "wall-line", "bridge"].includes(structureDrawMode) ? (
                <Box borderWidth="1px" borderRadius="md" p={3} bg="orange.50">
                  <Text fontSize="sm" fontWeight="semibold">Square map required for this generator</Text>
                  <SectionHint>Switch to Precision Edge, Wall Line, or Bridge to author structures on a hex map.</SectionHint>
                </Box>
              ) : (
                <>
                  <FormControl>
                    <FormLabel fontSize="xs">Build method</FormLabel>
                    <Select
                      size="sm"
                      value={structureDrawMode}
                      onChange={(event) => setStructureDrawMode(event.target.value)}
                    >
                      <option value="edge">Precision Edge</option>
                      <option value="room" disabled={mapType !== "square"}>Room Rectangle — drag</option>
                      <option value="wall-line">{mapType === "hex" ? "Orthogonal Wall / Box — drag" : "Wall Line — drag"}</option>
                      <option value="building" disabled={mapType !== "square"}>Premade Building — drag</option>
                      <option value="bridge">Bridge — drag</option>
                    </Select>
                  </FormControl>

                  {structureDrawMode !== "edge" && (
                    <Box borderWidth="1px" borderRadius="md" p={3} bg="blue.50">
                      <Text fontSize="sm" fontWeight="semibold">Drag in the 2D map</Text>
                      <SectionHint>
                        Click a starting cell, drag to the opposite corner/location, and release. Split view is ideal because the 3D result updates immediately.
                      </SectionHint>
                    </Box>
                  )}

                  {structureDrawMode === "wall-line" && mapType === "hex" && (
                    <FormControl>
                      <FormLabel fontSize="xs">Construction snap</FormLabel>
                      <Select size="sm" value={wallLatticeStep} onChange={(event) => setWallLatticeStep(Number(event.target.value))}>
                        <option value={1}>Standard</option>
                        <option value={0.5}>Half-step</option>
                      </Select>
                      <SectionHint>Single drag and release: an aligned drag makes one straight wall; a diagonal drag treats the two cells as opposite corners and creates a closed rectangular wall box.</SectionHint>
                    </FormControl>
                  )}

                  {structureDrawMode === "bridge" && (
                    <VStack align="stretch" spacing={3} borderWidth="1px" borderRadius="md" p={3} bg="cyan.50">
                      <Text fontSize="sm" fontWeight="bold">Bridge settings</Text>
                      <SectionHint>
                        The deck becomes a vertical traversal layer above the existing terrain/water cell. The lower layer is preserved for future underpass/swimming navigation.
                      </SectionHint>
                      <FormControl>
                        <FormLabel fontSize="xs">Bridge material</FormLabel>
                        <Select size="sm" value={bridgeMaterial} onChange={(event) => setBridgeMaterial(event.target.value)}>
                          <option value="wood">Wood</option>
                          <option value="stone">Stone</option>
                        </Select>
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="xs">Deck width (ft)</FormLabel>
                        <Input size="sm" type="number" min={3} max={30} step={1} value={bridgeWidthFeet} onChange={(event) => setBridgeWidthFeet(event.target.value)} />
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="xs">Deck rise above highest crossed terrain (ft)</FormLabel>
                        <Input size="sm" type="number" min={0} max={12} step={0.25} value={bridgeDeckRiseFeet} onChange={(event) => setBridgeDeckRiseFeet(event.target.value)} />
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="xs">Bridge seed</FormLabel>
                        <Input size="sm" value={bridgeSeed} onChange={(event) => setBridgeSeed(event.target.value)} />
                      </FormControl>
                      <FormControl display="flex" alignItems="center">
                        <Switch mr={2} isChecked={bridgeRailings} onChange={(event) => setBridgeRailings(event.target.checked)} />
                        <FormLabel mb="0" fontSize="sm">Railings</FormLabel>
                      </FormControl>
                      <FormControl display="flex" alignItems="center">
                        <Switch mr={2} isChecked={bridgeSupports} onChange={(event) => setBridgeSupports(event.target.checked)} />
                        <FormLabel mb="0" fontSize="sm">Supports / piers</FormLabel>
                      </FormControl>
                      {bridgeSupports && (
                        <FormControl>
                          <FormLabel fontSize="xs">Support spacing (cells)</FormLabel>
                          <Input size="sm" type="number" min={1} max={8} step={1} value={bridgeSupportSpacingCells} onChange={(event) => setBridgeSupportSpacingCells(event.target.value)} />
                        </FormControl>
                      )}
                    </VStack>
                  )}

                  {structureDrawMode === "building" && (
                    <>
                      <FormControl>
                        <FormLabel fontSize="xs">Building template</FormLabel>
                        <Select
                          size="sm"
                          value={buildingTemplate}
                          onChange={(event) => setBuildingTemplate(event.target.value)}
                        >
                          <option value="tavern">Tavern / Inn</option>
                          <option value="cottage">Cottage</option>
                          <option value="farmhouse">Farmhouse</option>
                          <option value="barracks">Barracks</option>
                          <option value="chapel">Chapel</option>
                          <option value="dungeon-chamber">Dungeon Chamber</option>
                          <option value="storehouse">Storehouse</option>
                        </Select>
                      </FormControl>

                      <FormControl>
                        <FormLabel fontSize="xs">Generation seed</FormLabel>
                        <Input
                          size="sm"
                          value={buildingSeed}
                          onChange={(event) => setBuildingSeed(event.target.value)}
                          placeholder="building-1"
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel fontSize="xs">Building wealth</FormLabel>
                        <Select
                          size="sm"
                          value={buildingWealth}
                          onChange={(event) => setBuildingWealth(event.target.value)}
                        >
                          <option value="poor">Poor / Simple</option>
                          <option value="common">Common</option>
                          <option value="wealthy">Wealthy</option>
                        </Select>
                      </FormControl>

                      <FormControl>
                        <FormLabel fontSize="xs">Window treatment</FormLabel>
                        <Select
                          size="sm"
                          value={buildingWindowStyle}
                          onChange={(event) => setBuildingWindowStyle(event.target.value)}
                        >
                          <option value="auto">Auto by building / wealth</option>
                          <option value="shuttered">Shuttered opening</option>
                          <option value="open">Open / unglazed</option>
                          <option value="leaded">Small leaded glass</option>
                          <option value="stained">Stained / decorative glass</option>
                        </Select>
                      </FormControl>

                      <FormControl display="flex" alignItems="center">
                        <Switch
                          mr={2}
                          isChecked={furnishGeneratedBuilding}
                          onChange={(event) => setFurnishGeneratedBuilding(event.target.checked)}
                        />
                        <FormLabel mb="0" fontSize="sm">Auto-furnish from prop sockets</FormLabel>
                      </FormControl>
                    </>
                  )}

                  <FormControl>
                    <FormLabel fontSize="xs">Wall material</FormLabel>
                    <Select
                      size="sm"
                      value={structureMaterial}
                      onChange={(event) => setStructureMaterial(event.target.value)}
                    >
                      <option value="stone">Stone</option>
                      <option value="dungeon-stone">Dungeon Stone</option>
                      <option value="wood">Wood</option>
                      <option value="plaster">Plaster</option>
                      <option value="brick">Brick</option>
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="xs">Wall height (ft)</FormLabel>
                    <Input
                      size="sm"
                      type="number"
                      min={3}
                      max={60}
                      step={1}
                      value={structureHeightFeet}
                      onChange={(event) => setStructureHeightFeet(event.target.value)}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="xs">GLB / Tripo asset URL (optional)</FormLabel>
                    <Input
                      size="sm"
                      value={structureAssetUrl}
                      onChange={(event) => setStructureAssetUrl(event.target.value)}
                      placeholder="/assets/models/structures/stone_wall_5ft.glb"
                    />
                    <SectionHint>
                      Canonical collision and LOS stay data-driven. If the asset cannot load, the procedural wall remains.
                    </SectionHint>
                  </FormControl>

                  {structureDrawMode === "edge" && (
                    <>
                      {!selectedHex ? (
                        <Box borderWidth="1px" borderRadius="md" p={3}>
                          <Text fontSize="sm">Select a {mapType === "hex" ? "hex" : "square"} in 2D or 3D for precision edge editing.</Text>
                        </Box>
                      ) : (
                        <>
                          <Box borderWidth="1px" borderRadius="md" p={3} bg="gray.50">
                            <Text fontSize="sm" fontWeight="semibold">
                              {mapType === "hex" ? "Hex" : "Square"} {selectedHex.q}, {selectedHex.r}
                            </Text>
                            <SectionHint>
                              Neighboring opposite edges remain mirrored automatically.
                            </SectionHint>
                          </Box>

                          <FormControl>
                            <FormLabel fontSize="xs">Structure type</FormLabel>
                            <Select
                              size="sm"
                              value={effectiveStructureKind}
                              onChange={(event) => setStructureKind(event.target.value)}
                            >
                              {mapType === "hex" ? (
                                <>
                                  <option value="wall">Wall</option>
                                  <option value="gate">Gate</option>
                                  <option value="palisade">Palisade</option>
                                  <option value="fence">Fence</option>
                                </>
                              ) : (
                                <>
                                  <option value="wall">Wall</option>
                                  <option value="door">Door</option>
                                  <option value="window">Window</option>
                                  <option value="archway">Curved Archway</option>
                                </>
                              )}
                            </Select>
                          </FormControl>

                          {["door", "gate"].includes(effectiveStructureKind) && (
                            <FormControl display="flex" alignItems="center">
                              <Switch
                                mr={2}
                                isChecked={structureDoorOpen}
                                onChange={(event) => setStructureDoorOpen(event.target.checked)}
                              />
                              <FormLabel mb="0" fontSize="sm">Door starts open</FormLabel>
                            </FormControl>
                          )}

                          {effectiveStructureKind === "window" && (
                            <FormControl>
                              <FormLabel fontSize="xs">Window treatment</FormLabel>
                              <Select
                                size="sm"
                                value={structureWindowStyle}
                                onChange={(event) => setStructureWindowStyle(event.target.value)}
                              >
                                <option value="open">Open / unglazed</option>
                                <option value="shuttered">Shuttered opening</option>
                                <option value="leaded">Small leaded glass</option>
                                <option value="stained">Stained / decorative glass</option>
                              </Select>
                            </FormControl>
                          )}

                          <Box>
                            <Text fontSize="xs" fontWeight="semibold" mb={2}>Apply to edge</Text>
                            <SimpleGrid columns={2} spacing={2}>
                              {structureDirections.map((direction) => {
                                const existing = selectedStructureWalls?.[direction] || null;
                                const label = existing?.kind
                                  ? `${direction} · ${existing.kind}`
                                  : `${direction} · open`;
                                return (
                                  <Box key={direction} borderWidth="1px" borderRadius="md" p={2}>
                                    <Button
                                      size="sm"
                                      width="100%"
                                      colorScheme={existing ? "purple" : "gray"}
                                      variant={existing ? "solid" : "outline"}
                                      onClick={() => applyStructure(direction)}
                                    >
                                      {label}
                                    </Button>
                                    <Button
                                      size="xs"
                                      width="100%"
                                      mt={1}
                                      variant="ghost"
                                      colorScheme="red"
                                      isDisabled={!existing}
                                      onClick={() => removeStructure(direction)}
                                    >
                                      Remove
                                    </Button>
                                  </Box>
                                );
                              })}
                            </SimpleGrid>
                          </Box>
                        </>
                      )}
                    </>
                  )}

                  <SectionHint>
                    Curved archways now use real curved procedural openings. Window glass is optional rather than assumed.
                  </SectionHint>

                  {Array.isArray(bridges) && bridges.length > 0 && (
                    <Box borderWidth="1px" borderRadius="md" p={3}>
                      <Text fontSize="xs" fontWeight="bold" mb={2}>Existing bridges</Text>
                      <VStack align="stretch" spacing={2}>
                        {bridges.map((bridge) => (
                          <HStack key={bridge.id} justify="space-between">
                            <Box minW={0}>
                              <Text fontSize="sm" fontWeight="semibold" noOfLines={1}>{bridge.name || "Bridge"}</Text>
                              <SectionHint>{bridge.material} · {bridge.path?.length || 0} cells · deck {Number(bridge.deckElevationFeet || 0).toFixed(1)} ft</SectionHint>
                            </Box>
                            <Button size="xs" colorScheme="red" variant="outline" onClick={() => onDeleteBridge?.(bridge.id)}>Delete</Button>
                          </HStack>
                        ))}
                      </VStack>
                    </Box>
                  )}
                </>
              )}
            </VStack>
          </TabPanel>

          <TabPanel p={3}>
            <BattlefieldPropPalettePanel
              selectedType={selectedPropType}
              onSelect={onSelectedPropTypeChange}
              onPlace={onPlaceProp}
              canPlace={canPlaceProp}
            />
          </TabPanel>

          <TabPanel p={3}>
            <VStack align="stretch" spacing={4}>
              <FormControl>
                <FormLabel fontSize="sm">Lighting</FormLabel>
                <Select size="sm" value={lighting} onChange={(event) => onLightingChange?.(event.target.value)}>
                  {Object.entries(LIGHTING_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Environmental fog</FormLabel>
                <Select size="sm" value={environmentalFog} onChange={(event) => onEnvironmentalFogChange?.(event.target.value)}>
                  {Object.entries(FOG_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </Select>
              </FormControl>
              <FormControl display="flex" alignItems="center">
                <Switch mr={2} isChecked={fogOfWarEnabled} onChange={(event) => onFogOfWarEnabledChange?.(event.target.checked)} />
                <FormLabel mb="0" fontSize="sm">Fog of War default</FormLabel>
              </FormControl>
              <SectionHint>Environmental fog limits physical visibility. Fog of War controls what the player's side has discovered.</SectionHint>
            </VStack>
          </TabPanel>

          <TabPanel p={3}>
            <VStack align="stretch" spacing={4}>
              <Box borderBottomWidth="1px" pb={3}>
                <Text fontWeight="bold" fontSize="sm" mb={3}>Map Settings</Text>
                <FormControl mb={3}>
                  <FormLabel fontSize="xs">Map name</FormLabel>
                  <Input size="sm" value={mapName} onChange={(event) => onMapNameChange?.(event.target.value)} />
                </FormControl>
                <FormControl mb={3}>
                  <FormLabel fontSize="xs">Grid type</FormLabel>
                  <Select size="sm" value={mapType} onChange={(event) => onMapTypeChange?.(event.target.value)}>
                    <option value="hex">Hex</option>
                    <option value="square">Square</option>
                  </Select>
                </FormControl>
                <FormLabel fontSize="xs">Grid size</FormLabel>
                <HStack>
                  <Input size="sm" type="number" min={5} max={200} value={gridWidth} onChange={(event) => onGridWidthChange?.(event.target.value)} />
                  <Text fontSize="sm">×</Text>
                  <Input size="sm" type="number" min={5} max={200} value={gridHeight} onChange={(event) => onGridHeightChange?.(event.target.value)} />
                  <Button size="sm" onClick={onResizeGrid}>Apply</Button>
                </HStack>
              </Box>

              <BattlefieldMapManagerPanel
                compact
                getCurrentMap={getCurrentMap}
                onOpenMap={onOpenMap}
                refreshToken={libraryRevision}
              />

              <Box borderTopWidth="1px" pt={3}>
                <Text fontWeight="semibold" fontSize="sm" mb={2}>Import / Export JSON</Text>
                <HStack mb={2}>
                  <Button size="xs" variant="outline" onClick={onExport}>Export</Button>
                  <Button size="xs" variant="outline" colorScheme="green" onClick={onImport} isDisabled={!String(importExportJson || "").trim()}>Import</Button>
                </HStack>
                <Textarea
                  minH="140px"
                  fontFamily="mono"
                  fontSize="xs"
                  value={importExportJson}
                  onChange={(event) => onImportExportJsonChange?.(event.target.value)}
                  placeholder="Paste exported battlefield JSON here."
                />
              </Box>
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}
