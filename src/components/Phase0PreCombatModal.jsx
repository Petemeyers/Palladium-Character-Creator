import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  Text,
  Select,
  FormControl,
  FormLabel,
  Badge,
  Box,
  Divider,
  Textarea,
} from "@chakra-ui/react";
import { TERRAIN_TYPES, LIGHTING_CONDITIONS } from "../utils/terrainSystem";
import { generateMapFromDescription } from "../utils/mapSceneGenerator";
import { openMapEditor, closeMapEditor, isEditorActive } from "../utils/three/HexArena";
import { getMapPreset, GRID_CONFIG } from "../data/movementRules";
import SceneBattlefieldMapSelector from "./maps/SceneBattlefieldMapSelector.jsx";
import {
  BATTLEFIELD_FOG,
  normalizeBattlefieldMap,
} from "../utils/maps/battlefieldMapAuthority.js";

export default function Phase0PreCombatModal({
  isOpen,
  onClose,
  onComplete,
  players,
  preCombatSystem,
}) {
  const [terrain, setTerrain] = useState("OPEN_GROUND");
  const [lighting, setLighting] = useState("BRIGHT_DAYLIGHT");
  const [sceneDescription, setSceneDescription] = useState("");
  const [mapType, setMapType] = useState("hex"); // "hex" for wilderness, "square" for dungeons
  const [useAIGeneration, setUseAIGeneration] = useState(false);
  const [generatedScene, setGeneratedScene] = useState(null);
  const [showEditorConfirm, setShowEditorConfirm] = useState(false);
  const [editorActive, setEditorActive] = useState(false);
  const [selectedBattlefieldMap, setSelectedBattlefieldMap] = useState(null);
  const [environmentalFog, setEnvironmentalFog] = useState(BATTLEFIELD_FOG.CLEAR);
  const [fogOfWarEnabled, setFogOfWarEnabled] = useState(false);
  const editorCheckIntervalRef = useRef(null);
  
  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (editorCheckIntervalRef.current) {
        clearInterval(editorCheckIntervalRef.current);
      }
    };
  }, []);
  
  const [environment, setEnvironment] = useState({
    lighting: "BRIGHT_DAYLIGHT",
    terrain: "OPEN_GROUND",
    visibility: "clear",
  });

  const handleTerrainChange = (newTerrain) => {
    setTerrain(newTerrain);
    setEnvironment(prev => ({
      ...prev,
      terrain: newTerrain,
    }));
    
    // Ã¢Å“â€¦ Auto-suggest square map for urban/interior terrains
    // But don't fraidere it - allow user to manually override
    if (["URBAN", "CAVE_INTERIOR"].includes(newTerrain) && mapType === "hex") {
      // Only auto-switch if user hasn't manually selected square
      // This is a suggestion, user can change it back if they want
      setMapType("square");
    } else if (!["URBAN", "CAVE_INTERIOR"].includes(newTerrain) && mapType === "square") {
      // Auto-switch back to hex for wilderness terrains (unless user manually selected square)
      // Actually, let's not auto-switch back - preserve user preference
      // setMapType("hex");
    }
  };

  const handleLightingChange = (newLighting) => {
    setLighting(newLighting);
    setEnvironment(prev => ({
      ...prev,
      lighting: newLighting,
    }));
  };

  const handleBattlefieldMapChange = (map) => {
    if (!map) {
      setSelectedBattlefieldMap(null);
      return true;
    }

    const normalized = normalizeBattlefieldMap(map);
    setSelectedBattlefieldMap(normalized);
    setMapType(normalized.mapType || "hex");

    const nextLighting =
      normalized.environment?.lighting ||
      normalized.lighting ||
      "BRIGHT_DAYLIGHT";
    const nextFog =
      normalized.environment?.environmentalFog?.type ||
      normalized.environmentalFog?.type ||
      BATTLEFIELD_FOG.CLEAR;
    const nextFogOfWar =
      normalized.environment?.fogOfWar?.enabled === true ||
      normalized.fogOfWar?.enabled === true ||
      normalized.fogOfWarEnabled === true;

    setLighting(nextLighting);
    setEnvironmentalFog(nextFog);
    setFogOfWarEnabled(nextFogOfWar);
    setEnvironment((prev) => ({
      ...prev,
      lighting: nextLighting,
      terrain: normalized.terrain || normalized.baseTerrain || prev.terrain,
      environmentalFog: nextFog,
      fogOfWarEnabled: nextFogOfWar,
    }));

    return true;
  };

  const handleGenerateFromDescription = () => {
    if (!sceneDescription.trim()) {
      return;
    }
    // Ã¢Å“â€¦ Always use current mapType selection when generating
    const generated = generateMapFromDescription(sceneDescription, mapType);
    setGeneratedScene(generated);
    setTerrain(generated.baseTerrain);
    setLighting(generated.lighting);
    setUseAIGeneration(true);
    
    // Ã¢Å“â€¦ Auto-switch mapType if AI suggests urban/interior terrain
    // But only if user hasn't manually selected a different mapType recently
    // (This preserves user preference while allowing AI to suggest)
    if (["URBAN", "CAVE_INTERIOR"].includes(generated.baseTerrain) && mapType === "hex") {
      // Suggest square for urban/interior, but don't fraidere it
      // User can manually change back to hex if desired
      console.log("Ã°Å¸â€™Â¡ AI detected urban/interior terrain - consider switching to Square map");
    }
  };

  const handleSceneSetup = () => {
    // A canonical Map Maker battlefield takes precedence over the legacy
    // terrain-description generator. This preserves exact cells, elevation,
    // props, lighting, environmental fog, and Fog of War into Combat.
    if (selectedBattlefieldMap) {
      const battlefieldMap = normalizeBattlefieldMap({
        ...selectedBattlefieldMap,
        lighting,
        environmentalFog,
        fogOfWarEnabled,
        environment: {
          ...(selectedBattlefieldMap.environment || {}),
          lighting,
          environmentalFog: {
            ...(selectedBattlefieldMap.environment?.environmentalFog || {}),
            type: environmentalFog,
          },
          fogOfWar: {
            ...(selectedBattlefieldMap.environment?.fogOfWar || {}),
            enabled: fogOfWarEnabled,
          },
        },
      });

      GRID_CONFIG.GRID_WIDTH = battlefieldMap.width;
      GRID_CONFIG.GRID_HEIGHT = battlefieldMap.height;

      const compatibilityTerrainData =
        TERRAIN_TYPES[battlefieldMap.terrain] ||
        TERRAIN_TYPES[battlefieldMap.baseTerrain] ||
        TERRAIN_TYPES.OPEN_GROUND;
      const lightingData =
        LIGHTING_CONDITIONS[battlefieldMap.environment?.lighting] ||
        LIGHTING_CONDITIONS[lighting] ||
        LIGHTING_CONDITIONS.BRIGHT_DAYLIGHT;
      const fogRangeCap =
        battlefieldMap.environment?.environmentalFog?.maximumVisualRangeFeet;
      const baseVisibilityRange = Number(
        battlefieldMap.visibilityRange ??
        battlefieldMap.environment?.visibilityRange ??
        60
      );
      const visibilityRange = Math.max(
        5,
        Number.isFinite(Number(fogRangeCap))
          ? Math.min(baseVisibilityRange, Number(fogRangeCap))
          : baseVisibilityRange
      );

      const combatEnvironment = {
        ...battlefieldMap,
        terrainData: battlefieldMap.terrainData || compatibilityTerrainData,
        lightingData,
        visibilityRange,
        battlefieldMapId: battlefieldMap.id,
        source: battlefieldMap.source || "saved",
      };

      onComplete({
        battlefieldMap,
        environment: combatEnvironment,
        readyForPrecombat: true,
        source: "battlefield-map",
      });
      onClose();
      return;
    }

    // Ã¢Å“â€¦ Debug: Log current state values
    console.log('[Phase0PreCombatModal] handleSceneSetup called - Current mapType state:', mapType);
    
    // Ã¢Å“â€¦ Apply map size preset based on terrain and map type
    const preset = getMapPreset(terrain, mapType);
    GRID_CONFIG.GRID_WIDTH = preset.width;
    GRID_CONFIG.GRID_HEIGHT = preset.height;
    console.log('[Phase0PreCombatModal] Applied map preset:', preset, `(${preset.width}x${preset.height} hexes)`, 'for terrain:', terrain, 'mapType:', mapType);
    
    // Ã¢Å“â€¦ Always generate a map grid, even for manual selections
    // This ensures terrain features (trees, boulders, water, etc.) are always populated
    let generated = null;
    
    // If AI generation is requested with a description, use that
    if (useAIGeneration && sceneDescription.trim() && generatedScene) {
      generated = generatedScene;
    } else {
      // Automatically generate terrain features based on terrain selection
      // Create a description that will trigger auto-population of features
      // Use keywords that detectBaseTerrain will recognize
      const terrainName = TERRAIN_TYPES[terrain]?.name || terrain;
      let autoDescription = `${terrainName} scene`;
      
      // Enhance description with keywords for better detection
      // This ensures detectBaseTerrain() recognizes the terrain type
      if (terrain === "DENSE_FOREST") {
        autoDescription = "dense forest scene";
      } else if (terrain === "LIGHT_FOREST") {
        autoDescription = "forest scene";
      } else if (terrain === "ROCKY_TERRAIN") {
        autoDescription = "rocky terrain scene";
      } else if (terrain === "SWAMP_MARSH") {
        autoDescription = "swamp marsh scene";
      } else if (terrain === "CAVE_INTERIOR") {
        autoDescription = "cave interior scene";
      } else if (terrain === "URBAN") {
        autoDescription = "urban city scene";
      }
      // For other terrains, use the name as-is (detectBaseTerrain will handle it
      
      console.log('[Phase0PreCombatModal] Auto-generating map for terrain:', terrainName, 'description:', autoDescription);
      generated = generateMapFromDescription(autoDescription, mapType);
      
      // Override lighting with manual selection (if not already set by AI)
      if (!generated.lighting || !useAIGeneration) {
        generated.lighting = lighting;
      }
      
      // Ensure baseTerrain matches the selected terrain (in case detection was off)
      if (generated.baseTerrain !== terrain) {
        console.log('[Phase0PreCombatModal] Terrain mismatch - adjusting from', generated.baseTerrain, 'to', terrain);
        generated.baseTerrain = terrain;
        generated.terrain = TERRAIN_TYPES[terrain];
      }
    }
    
    // Extract final values from generated scene
    const finalTerrain = generated.baseTerrain || terrain;
    const finalLighting = generated.lighting || lighting;
    const finalTerrainData = TERRAIN_TYPES[finalTerrain];
    const finalLightingData = LIGHTING_CONDITIONS[finalLighting];
    const sceneGrid = generated.grid;
    let finalMapType = mapType; // Ã¢Å“â€¦ Start with user's manual selection
    
    // Ã¢Å“â€¦ Use AI-generated mapType if available, otherwise use manual selection
    if (generated.mapType) {
      finalMapType = generated.mapType;
    }
    
    // Ã¢Å“â€¦ Debug: Verify finalMapType
    console.log('[Phase0PreCombatModal] finalMapType set to:', finalMapType);
    
    // Ã¢Å“â€¦ Calculate visibility range for fog of war based on terrain and lighting
    const baseVision = 60; // default visible radius in feet (typical human vision)
    const terrainVisibilityModifier = finalTerrainData?.visibilityModifier || 1.0;
    const lightingVisibilityBonus = finalLightingData?.visibilityBonus || 0;
    
    // Apply terrain visibility modifier and lighting bonus
    // visibilityBonus is negative (penalty), so we add it to reduce range
    // Formula: baseRange * terrainModifier * (1 + lightingBonus/100)
    const visibilityRange = Math.max(5, Math.floor(
      baseVision * 
      terrainVisibilityModifier * 
      (1 + lightingVisibilityBonus / 100)
    ));
    
    // Ã¢Å“â€¦ Debug: Log what we're passing
    if (process.env.NODE_ENV === 'development') {
      console.log('[Phase0PreCombatModal] Final mapType:', finalMapType, '| state mapType:', mapType);
      console.log('[Phase0PreCombatModal] Environment object:', {
        terrain: finalTerrain,
        lighting: finalLighting,
        mapType: finalMapType,
        terrainData: finalTerrainData?.name,
        lightingData: finalLightingData?.name,
      });
    }
    
    onComplete({
      environment: {
        terrain: finalTerrain,
        lighting: finalLighting,
        description: sceneDescription || `Generated ${finalTerrain} scene`,
        mapType: finalMapType, // Ã¢Å“â€¦ Use final mapType (manual selection or AI suggestion)
        terrainData: finalTerrainData,
        lightingData: finalLightingData,
        mapSize: preset, // Ã¢Å“â€¦ Include map size preset info
        density: generated?.density || finalTerrainData.density || 0.5,
        grid: sceneGrid, // Ã¢Å“â€¦ Grid with features (always populated now!)
        features: generated?.features || [],
        visibilityRange, // Ã¢Å“â€¦ Pass computed visibility range for fog of war
      },
      readyForPrecombat: true,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Ã°Å¸Å’Â² Phase 0: Scene Setup</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <SceneBattlefieldMapSelector
              selectedMap={selectedBattlefieldMap}
              onMapChange={handleBattlefieldMapChange}
              lighting={lighting}
              onLightingChange={handleLightingChange}
              environmentalFog={environmentalFog}
              onEnvironmentalFogChange={setEnvironmentalFog}
              fogOfWarEnabled={fogOfWarEnabled}
              onFogOfWarChange={setFogOfWarEnabled}
            />

            {selectedBattlefieldMap && (
              <Box p={3} bg="teal.50" borderRadius="md" borderWidth="1px" borderColor="teal.200">
                <Text fontSize="sm" fontWeight="bold">
                  Authored battlefield selected: {selectedBattlefieldMap.name}
                </Text>
                <Text fontSize="xs" color="gray.700" mt={1}>
                  Setup Scene will preserve this map's exact terrain, elevation, props, and battlefield environment.
                  The legacy terrain generator below will not replace it.
                </Text>
              </Box>
            )}

            {/* Map Type Selection */}
            <Box>
              <HStack justify="space-between" align="center" mb={2}>
                <Text fontWeight="bold">
                  Ã°Å¸â€”ÂºÃ¯Â¸Â Map Type
                </Text>
                <Button
                  size="sm"
                  colorScheme={editorActive ? "green" : "purple"}
                  variant={editorActive ? "solid" : "outline"}
                  onClick={() => {
                    if (editorActive) {
                      // Show confirm dialog to close editor
                      setShowEditorConfirm(true);
                    } else {
                      // Open editor
                      openMapEditor();
                      setEditorActive(true);
                      // Check editor state periodically
                      if (editorCheckIntervalRef.current) {
                        clearInterval(editorCheckIntervalRef.current);
                      }
                      editorCheckIntervalRef.current = setInterval(() => {
                        if (!isEditorActive()) {
                          setEditorActive(false);
                          if (editorCheckIntervalRef.current) {
                            clearInterval(editorCheckIntervalRef.current);
                            editorCheckIntervalRef.current = null;
                          }
                        }
                      }, 500);
                    }
                  }}
                >
                  {editorActive ? "Ã¢Å“â€¢ Close Editor" : "Ã°Å¸Å½Â¨ Open 3D Map Editor"}
                </Button>
              </HStack>
              <FormControl>
                <FormLabel fontSize="sm">Battle Map Style</FormLabel>
                <Select 
                  value={mapType} 
                  onChange={(e) => {
                    const newMapType = e.target.value;
                    console.log('[Phase0PreCombatModal] Map type changed to:', newMapType);
                    setMapType(newMapType);
                  }}
                >
                  <option value="hex">Ã°Å¸Å’Â² Hex Map - Wilderness/Outdoors (Recommended for forests, fields, swamps)</option>
                  <option value="square">Ã°Å¸ÂÂ° Square Map - Dungeons/Castles (Recommended for corridors, rooms, tight spaces)</option>
                </Select>
              </FormControl>
              {mapType === "hex" && (
                <Box mt={2} p={2} bg="green.50" borderRadius="md">
                  <Text fontSize="xs">
                    Ã¢Â¬Â¡ Hexagonal grid - better for organic wilderness terrain
                  </Text>
                </Box>
              )}
              {mapType === "square" && (
                <Box mt={2} p={2} bg="gray.50" borderRadius="md">
                  <Text fontSize="xs">
                    Ã¢Â¬â€º Square grid - standard for dungeon corridors and rooms
                  </Text>
                </Box>
              )}
              {/* Map Size Display */}
              <Box mt={2} p={2} bg="purple.50" borderRadius="md" borderWidth="1px" borderColor="purple.200">
                <Text fontSize="sm" fontWeight="semibold" mb={1}>
                  Ã°Å¸â€œÂ Map Size
                </Text>
                {(() => {
                  const preset = getMapPreset(terrain, mapType);
                  const widthFeet = preset.width * GRID_CONFIG.CELL_SIZE;
                  const heightFeet = preset.height * GRID_CONFIG.CELL_SIZE;
                  return (
                    <Text fontSize="xs">
                      <strong>{preset.width} Ãƒâ€” {preset.height} hexes</strong> ({widthFeet} ft Ãƒâ€” {heightFeet} ft)
                      <br />
                      {preset.width === 20 && preset.height === 15 && "Small indoor / dungeon room"}
                      {preset.width === 30 && preset.height === 20 && "Standard outdoor encounter"}
                      {preset.width === 40 && preset.height === 30 && "Large outdoor set-piece battle"}
                    </Text>
                  );
                })()}
              </Box>
            </Box>

            {/* Terrain Selection */}
            <Box>
              <Text fontWeight="bold" mb={2}>
                Battle Terrain
              </Text>
              <FormControl>
                <FormLabel fontSize="sm">Terrain Type</FormLabel>
                <Select value={terrain} onChange={(e) => handleTerrainChange(e.target.value)}>
                  {Object.entries(TERRAIN_TYPES).map(([key, data]) => (
                    <option key={key} value={key}>
                      {data.name} - {data.description}
                    </option>
                  ))}
                </Select>
              </FormControl>
              {TERRAIN_TYPES[terrain] && (
                <Box mt={2} p={2} bg="blue.50" borderRadius="md">
                  <Text fontSize="sm">
                    <strong>Effects:</strong> Movement {TERRAIN_TYPES[terrain].movementModifier * 100}%,
                    Visibility {TERRAIN_TYPES[terrain].visibilityModifier * 100}%,
                    Cover Bonus: +{TERRAIN_TYPES[terrain].cover} guardRating
                  </Text>
                </Box>
              )}
            </Box>

            {/* Lighting Selection */}
            <Box>
              <Text fontWeight="bold" mb={2}>
                Lighting Conditions
              </Text>
              <FormControl>
                <FormLabel fontSize="sm">Lighting</FormLabel>
                <Select value={lighting} onChange={(e) => handleLightingChange(e.target.value)}>
                  {Object.entries(LIGHTING_CONDITIONS).map(([key, data]) => (
                    <option key={key} value={key}>
                      {data.name}
                    </option>
                  ))}
                </Select>
              </FormControl>
              {LIGHTING_CONDITIONS[lighting] && (
                <Box mt={2} p={2} bg="yellow.50" borderRadius="md">
                  <Text fontSize="sm">
                    <strong>Effects:</strong> Vision {LIGHTING_CONDITIONS[lighting].visibilityBonus || 0}%,
                    Prowl {LIGHTING_CONDITIONS[lighting].prowlModifier >= 0 ? '+' : ''}{LIGHTING_CONDITIONS[lighting].prowlModifier}%
                  </Text>
                </Box>
              )}
            </Box>

            {/* Scene Description with AI Generation */}
            <Box>
              <Text fontWeight="bold" mb={2}>
                Ã°Å¸Å½Â¨ Scene Description (AI Generation Available)
              </Text>
              <VStack spacing={2} align="stretch">
                <Textarea
                  placeholder="Describe the battle scene (e.g., 'A narrow forest trail leading to a ruined tower near a cliff and small pond')"
                  value={sceneDescription}
                  onChange={(e) => setSceneDescription(e.target.value)}
                  size="sm"
                  rows={4}
                />
                <HStack>
                  <Button 
                    size="sm" 
                    colorScheme="purple" 
                    onClick={handleGenerateFromDescription}
                    isDisabled={!sceneDescription.trim()}
                  >
                    Ã°Å¸Â§Â  Generate Map from Description
                  </Button>
                  {generatedScene && (
                    <Badge colorScheme="green">Ã¢Å“â€œ Scene Generated</Badge>
                  )}
                  <Box flex={1} />
                  {useAIGeneration && (
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => {
                        setUseAIGeneration(false);
                        setGeneratedScene(null);
                      }}
                    >
                      Use Manual Selection
                    </Button>
                  )}
                </HStack>
                {generatedScene && (
                  <Box p={2} bg="purple.50" borderRadius="md">
                    <Text fontSize="xs" fontWeight="bold">Generated Scene:</Text>
                    <Text fontSize="xs">
                      <strong>Terrain:</strong> {TERRAIN_TYPES[generatedScene.baseTerrain]?.name || generatedScene.baseTerrain}
                      {" | "}
                      <strong>Lighting:</strong> {generatedScene.lighting}
                      {" | "}
                      <strong>Map:</strong> {generatedScene.mapType === "square" ? "Ã¢Â¬â€º Square" : "Ã¢Â¬Â¡ Hex"}
                      {" | "}
                      <strong>Features:</strong> {generatedScene.features.length > 0 
                        ? generatedScene.features.map(f => f.type).join(", ") 
                        : "None"}
                    </Text>
                    {generatedScene.mapType && (
                      <Text fontSize="xs" mt={1}>
                        <strong>Map Type:</strong> {generatedScene.mapType === "square" ? "Square Grid (Urban/Interior)" : "Hex Grid (Wilderness)"}
                      </Text>
                    )}
                  </Box>
                )}
                {useAIGeneration && (
                  <Box p={2} bg="blue.50" borderRadius="md">
                    <Text fontSize="xs">
                      Ã°Å¸â€™Â¡ AI generation will override manual terrain/lighting selection above.
                    </Text>
                  </Box>
                )}
              </VStack>
            </Box>
          </VStack>
        </ModalBody>

        {/* Editor Close Confirmation Modal */}
        <Modal isOpen={showEditorConfirm} onClose={() => setShowEditorConfirm(false)} size="md" isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Close Map Editor?</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={4} align="stretch">
                <Text>
                  Are you sure you want to close the 3D Map Editor?
                </Text>
                <Box p={3} bg="blue.50" borderRadius="md">
                  <Text fontSize="sm" fontWeight="bold" mb={2}>Note:</Text>
                  <Text fontSize="sm">
                    All changes (map settings, props, alignment) are automatically saved to browser storage and will be restored when you reopen the editor.
                  </Text>
                </Box>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <HStack spacing={3}>
                <Button
                  colorScheme="gray"
                  variant="outline"
                  onClick={() => setShowEditorConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  colorScheme="red"
                  onClick={() => {
                    closeMapEditor();
                    setEditorActive(false);
                    setShowEditorConfirm(false);
                    if (editorCheckIntervalRef.current) {
                      clearInterval(editorCheckIntervalRef.current);
                      editorCheckIntervalRef.current = null;
                    }
                  }}
                >
                  Close Editor
                </Button>
              </HStack>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="green" onClick={handleSceneSetup}>
            Setup Scene
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
