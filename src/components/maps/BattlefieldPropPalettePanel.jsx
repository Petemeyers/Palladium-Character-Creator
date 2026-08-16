import React, { useMemo } from "react";
import { Box, Button, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import { BATTLEFIELD_PROP_CATALOG, BATTLEFIELD_PROP_CATEGORIES } from "../../utils/maps/battlefieldPropCatalog.js";

const CATEGORY_LABELS = Object.freeze({
  [BATTLEFIELD_PROP_CATEGORIES.NATURAL]: "Natural",
  [BATTLEFIELD_PROP_CATEGORIES.STRUCTURE]: "Structures",
  [BATTLEFIELD_PROP_CATEGORIES.FURNISHING]: "Battlefield Objects",
  [BATTLEFIELD_PROP_CATEGORIES.LIGHT]: "Light Sources",
  [BATTLEFIELD_PROP_CATEGORIES.ATMOSPHERE]: "Atmosphere",
});

export default function BattlefieldPropPalettePanel({ selectedType = "tree", onSelect, onPlace, canPlace = false }) {
  const groups = useMemo(() => {
    const grouped = new Map();
    Object.values(BATTLEFIELD_PROP_CATALOG).forEach((definition) => {
      const category = definition.category || BATTLEFIELD_PROP_CATEGORIES.FURNISHING;
      const list = grouped.get(category) || [];
      list.push(definition);
      grouped.set(category, list);
    });
    return Array.from(grouped.entries());
  }, []);

  return (
    <VStack align="stretch" spacing={3}>
      {groups.map(([category, definitions]) => (
        <Box key={category}>
          <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={1}>{CATEGORY_LABELS[category] || category}</Text>
          <SimpleGrid columns={2} spacing={2}>
            {definitions.map((definition) => {
              const active = definition.type === selectedType;
              const detail = definition.lightSource
                ? `${definition.lightSource.radiusFeet}ft light`
                : definition.localAtmosphere?.type === "smoke"
                  ? `${definition.localAtmosphere.radiusFeet}ft smoke`
                  : definition.blocksLineOfSight
                    ? "Blocks LOS"
                    : definition.blocksMovement
                      ? "Blocks movement"
                      : "Open";
              return (
                <Button
                  key={definition.type}
                  size="sm"
                  height="auto"
                  py={2}
                  variant={active ? "solid" : "outline"}
                  colorScheme={active ? "purple" : "gray"}
                  onClick={() => onSelect?.(definition.type)}
                  whiteSpace="normal"
                >
                  <Box textAlign="left" width="100%">
                    <Text fontSize="xs" fontWeight="bold">{definition.label}</Text>
                    <Text fontSize="10px" opacity={0.75}>{detail}</Text>
                  </Box>
                </Button>
              );
            })}
          </SimpleGrid>
        </Box>
      ))}
      <Button size="sm" colorScheme="purple" onClick={onPlace} isDisabled={!canPlace}>Place Selected Prop</Button>
    </VStack>
  );
}
