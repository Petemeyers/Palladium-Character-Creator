import React from "react";
import {
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Select,
  Text,
  VStack,
} from "@chakra-ui/react";

const TERRAIN_OPTIONS = [
  "grass",
  "dirt",
  "mud",
  "rubble",
  "forest",
  "rock",
  "sand",
  "water",
  "road",
  "hill",
];

function formatTerrain(value) {
  return String(value || "grass")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function MapMakerInspectorPanel({
  selectedHex,
  selectedHexCell,
  selectedHexHeight,
  selectedHexTerrain,
  selectedHexWallTerrain,
  selectedHexEdgeTransitions = [],
  onUpdateSelectedHex,
  selectedProp,
  onRotateProp,
  onScaleProp,
  onDeleteProp,
  onDeleteSelectedStructures,
  mapType,
  mapSummary,
}) {
  if (selectedProp) {
    return (
      <VStack align="stretch" spacing={4} p={4}>
        <Box>
          <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wide">Selected object</Text>
          <Text fontSize="lg" fontWeight="bold">{selectedProp.name || selectedProp.type || "Battlefield Object"}</Text>
          <HStack mt={2} spacing={2} wrap="wrap">
            {selectedProp.blocksMovement && <Badge colorScheme="orange">Blocks movement</Badge>}
            {selectedProp.blocksLineOfSight && <Badge colorScheme="purple">Blocks LOS</Badge>}
            {selectedProp.lightSource && <Badge colorScheme="yellow">Light source</Badge>}
            {selectedProp.localAtmosphere?.type === "smoke" && <Badge colorScheme="gray">Smoke</Badge>}
          </HStack>
        </Box>

        <Box borderTopWidth="1px" pt={3}>
          <Text fontSize="sm"><strong>Hex:</strong> {Number.isFinite(Number(selectedProp.x)) ? selectedProp.x : selectedProp.q}, {Number.isFinite(Number(selectedProp.y)) ? selectedProp.y : selectedProp.r}</Text>
          <Text fontSize="sm"><strong>Rotation:</strong> {Number(selectedProp.rotation) || 0}°</Text>
          <Text fontSize="sm"><strong>Scale:</strong> {(Number(selectedProp.scale) || 1).toFixed(2)}×</Text>
          {Number.isFinite(Number(selectedProp.cover)) && <Text fontSize="sm"><strong>Cover:</strong> {selectedProp.cover}</Text>}
          {Number.isFinite(Number(selectedProp.heightFeet)) && <Text fontSize="sm"><strong>Height:</strong> {selectedProp.heightFeet} ft</Text>}
        </Box>

        <Box borderTopWidth="1px" pt={3}>
          <Text fontSize="xs" fontWeight="bold" mb={2}>Rotate</Text>
          <HStack>
            <Button size="sm" variant="outline" onClick={() => onRotateProp?.(-60)}>−60°</Button>
            <Button size="sm" variant="outline" onClick={() => onRotateProp?.(60)}>+60°</Button>
          </HStack>
        </Box>

        <Box>
          <Text fontSize="xs" fontWeight="bold" mb={2}>Scale</Text>
          <HStack>
            <Button size="sm" variant="outline" onClick={() => onScaleProp?.(-0.1)}>−</Button>
            <Text minW="54px" textAlign="center" fontSize="sm">{(Number(selectedProp.scale) || 1).toFixed(1)}×</Text>
            <Button size="sm" variant="outline" onClick={() => onScaleProp?.(0.1)}>+</Button>
          </HStack>
        </Box>

        <Button colorScheme="red" variant="outline" onClick={onDeleteProp}>Delete Object</Button>
      </VStack>
    );
  }

  if (selectedHex) {
    return (
      <VStack align="stretch" spacing={4} p={4}>
        <Box>
          <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wide">Selected hex</Text>
          <Text fontSize="lg" fontWeight="bold">{selectedHex.q}, {selectedHex.r}</Text>
          <Text fontSize="sm" color="gray.600">{formatTerrain(selectedHexTerrain)}</Text>
        </Box>

        <FormControl>
          <FormLabel fontSize="sm">Terrain</FormLabel>
          <Select value={selectedHexTerrain} onChange={(event) => onUpdateSelectedHex?.({ terrainType: event.target.value })}>
            {TERRAIN_OPTIONS.map((terrain) => <option key={terrain} value={terrain}>{formatTerrain(terrain)}</option>)}
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel fontSize="sm">Elevation</FormLabel>
          <HStack>
            <Button size="sm" onClick={() => onUpdateSelectedHex?.({ height: Number(selectedHexHeight) - 1 })}>−</Button>
            <Input type="number" value={selectedHexHeight} onChange={(event) => onUpdateSelectedHex?.({ height: event.target.value })} />
            <Button size="sm" onClick={() => onUpdateSelectedHex?.({ height: Number(selectedHexHeight) + 1 })}>+</Button>
          </HStack>
        </FormControl>

        <Box borderTopWidth="1px" pt={3}>
          <Text fontSize="sm"><strong>Wall material:</strong> {formatTerrain(selectedHexWallTerrain)}</Text>
          <Text fontSize="sm"><strong>Walkable:</strong> {selectedHexCell?.walkable === false ? "No" : "Yes"}</Text>
          <Text fontSize="sm"><strong>Cover:</strong> {Number(selectedHexCell?.cover) || 0}</Text>
          <Text fontSize="sm"><strong>Blocks LOS:</strong> {selectedHexCell?.blocksLineOfSight ? "Yes" : "No"}</Text>
        </Box>

        {Object.keys(selectedHexCell?.walls || {}).length > 0 && (
          <Box borderTopWidth="1px" pt={3}>
            <Text fontSize="xs" fontWeight="bold" mb={2}>Structure edges</Text>
            <HStack spacing={1} wrap="wrap" mb={2}>
              {(mapType === "hex" ? ["E", "SE", "SW", "W", "NW", "NE"] : ["N", "E", "S", "W"]).map((direction) => {
                const edge = selectedHexCell?.walls?.[direction];
                return edge ? (
                  <Badge key={direction} colorScheme="purple">
                    {direction}: {edge.kind || edge.type || "wall"}
                  </Badge>
                ) : null;
              })}
            </HStack>
            <Button
              size="sm"
              colorScheme="red"
              variant="outline"
              onClick={onDeleteSelectedStructures}
            >
              Delete Selected Structure Edges
            </Button>
          </Box>
        )}

        <Box borderTopWidth="1px" pt={3}>
          <Text fontSize="xs" fontWeight="bold" mb={2}>Terrain edges</Text>
          <HStack spacing={1} wrap="wrap">
            {selectedHexEdgeTransitions.map((edge) => (
              <Badge
                key={edge?.direction?.key || edge?.direction?.index}
                colorScheme={
                  edge?.type === "cliff" || edge?.type === "wall" ? "red"
                    : edge?.type === "steep-slope" ? "orange"
                      : edge?.type === "slope" ? "green"
                        : "gray"
                }
              >
                {edge?.direction?.key || "?"}: {String(edge?.type || "flat").replace("-", " ")}
              </Badge>
            ))}
          </HStack>
          <Text fontSize="xs" color="gray.500" mt={2}>
            One height step becomes a natural slope. Two steps can become a steep slope on suitable terrain. Larger changes remain cliffs.
          </Text>
        </Box>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" spacing={4} p={4}>
      <Box>
        <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wide">Battlefield</Text>
        <Text fontSize="lg" fontWeight="bold">{mapSummary?.name || "Untitled Map"}</Text>
      </Box>
      <Box borderTopWidth="1px" pt={3}>
        <Text fontSize="sm"><strong>Size:</strong> {mapSummary?.width || 0} × {mapSummary?.height || 0}</Text>
        <Text fontSize="sm"><strong>Grid:</strong> {mapSummary?.mapType === "square" ? "Square" : "Hex"}</Text>
        <Text fontSize="sm"><strong>Lighting:</strong> {mapSummary?.lighting || "Bright Daylight"}</Text>
        <Text fontSize="sm"><strong>Fog:</strong> {mapSummary?.fog || "Clear"}</Text>
        <Text fontSize="sm"><strong>Props:</strong> {mapSummary?.propCount || 0}</Text>
      </Box>
      <Text fontSize="sm" color="gray.500">Select a hex or a 3D battlefield object to edit its exact properties here.</Text>
    </VStack>
  );
}
