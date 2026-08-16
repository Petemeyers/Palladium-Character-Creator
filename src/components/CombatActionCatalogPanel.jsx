import React, { useMemo } from "react";
import {
  Badge,
  Box,
  Button,
  HStack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from "@chakra-ui/react";
import { buildCombatActionCatalog } from "../utils/combatActionCatalog.js";

const typeColor = (type) => {
  if (type === "attack") return "red";
  if (type === "move" || type === "run" || type === "charge" || type === "climb") return "blue";
  if (type === "defend" || type === "block" || type === "evade") return "green";
  if (type === "recover") return "teal";
  if (type === "use-item") return "orange";
  if (type === "use-skill") return "purple";
  return "gray";
};

const CombatActionCatalogPanel = ({
  actor,
  targets = [],
  currentTurnEntry = null,
  selectedTarget = null,
  equippedWeapons = [],
  inventory = [],
  compatibilityActions = [],
  selectedCombatAction = null,
  disabledReason = "",
  onSelectCombatAction,
}) => {
  const actions = useMemo(() => {
    const built = buildCombatActionCatalog({
    actor,
    targets,
    currentTurnEntry,
    selectedTarget,
    equippedWeapons,
    inventory,
    compatibilityActions,
    }).filter((action) => action.playerVisible !== false);
    if (!disabledReason) return built;
    return built.map((action) => ({
      ...action,
      enabled: false,
      disabledReason,
    }));
  }, [
    actor,
    targets,
    currentTurnEntry,
    selectedTarget,
    equippedWeapons,
    inventory,
    compatibilityActions,
    disabledReason,
  ]);

  if (!actor) return null;
  const selectedId = selectedCombatAction?.id || "";

  return (
    <Box borderWidth="1px" borderRadius="md" p={3} bg="white">
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between" align="center" wrap="wrap">
          <Box>
            <Text fontWeight="bold">Combat Action Catalog</Text>
            <Text fontSize="xs" color="gray.600">
              Command list for {actor.name || "current combatant"}.
            </Text>
            {disabledReason && (
              <Text fontSize="xs" color="orange.700">
                {disabledReason}
              </Text>
            )}
          </Box>
          <Badge colorScheme="purple">{actions.length} action{actions.length === 1 ? "" : "s"}</Badge>
        </HStack>

        {actions.length === 0 ? (
          <Text fontSize="xs" color="gray.600">No catalog actions available.</Text>
        ) : (
          <Box overflowX="auto">
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th>Action</Th>
                  <Th>Type</Th>
                  <Th>Cost</Th>
                  <Th>Status</Th>
                  <Th>Preview</Th>
                  <Th>Select</Th>
                </Tr>
              </Thead>
              <Tbody>
                {actions.map((action) => {
                  const isSelected = action.id === selectedId;
                  return (
                  <Tr key={action.id} bg={isSelected ? "purple.50" : undefined}>
                    <Td>
                      <VStack align="start" spacing={0}>
                        <Text fontSize="sm" fontWeight="semibold">{action.name}</Text>
                        <Text fontSize="xs" color="gray.500">{action.source}</Text>
                        {isSelected && <Badge colorScheme="purple">Selected</Badge>}
                      </VStack>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Badge colorScheme={typeColor(action.type)}>{action.type}</Badge>
                        <Text fontSize="xs" color="gray.500">{action.category}</Text>
                      </VStack>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={0}>
                        <Text fontSize="xs">Actions {action.costActions}</Text>
                        <Text fontSize="xs">Stamina {action.costStamina}</Text>
                      </VStack>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Badge colorScheme={action.enabled ? "green" : "orange"}>
                          {action.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                        {action.disabledReason && (
                          <Text fontSize="xs" color="gray.600">{action.disabledReason}</Text>
                        )}
                      </VStack>
                    </Td>
                    <Td minW="220px">
                      <Text fontSize="xs" color="gray.700">
                        {action.previewSummary || "Preview pending."}
                      </Text>
                    </Td>
                    <Td>
                      <Button
                        size="xs"
                        colorScheme={isSelected ? "purple" : "gray"}
                        variant={isSelected ? "solid" : "outline"}
                        onClick={() => {
                          if (!action.enabled || typeof onSelectCombatAction !== "function") return;
                          onSelectCombatAction(action);
                        }}
                        isDisabled={!action.enabled}
                        title={action.disabledReason || `Select ${action.name}`}
                      >
                        Select
                      </Button>
                    </Td>
                  </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default CombatActionCatalogPanel;
