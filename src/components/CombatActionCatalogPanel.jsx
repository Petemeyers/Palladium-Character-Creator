import React, { useMemo } from "react";
import {
  Badge,
  Box,
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
  if (type === "move" || type === "run" || type === "charge") return "blue";
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
}) => {
  const actions = useMemo(() => buildCombatActionCatalog({
    actor,
    targets,
    currentTurnEntry,
    selectedTarget,
    equippedWeapons,
    inventory,
    compatibilityActions,
  }), [
    actor,
    targets,
    currentTurnEntry,
    selectedTarget,
    equippedWeapons,
    inventory,
    compatibilityActions,
  ]);

  if (!actor) return null;

  return (
    <Box borderWidth="1px" borderRadius="md" p={3} bg="white">
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between" align="center" wrap="wrap">
          <Box>
            <Text fontWeight="bold">Combat Action Catalog</Text>
            <Text fontSize="xs" color="gray.600">
              Display-only command list for {actor.name || "current combatant"}.
            </Text>
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
                </Tr>
              </Thead>
              <Tbody>
                {actions.map((action) => (
                  <Tr key={action.id}>
                    <Td>
                      <VStack align="start" spacing={0}>
                        <Text fontSize="sm" fontWeight="semibold">{action.name}</Text>
                        <Text fontSize="xs" color="gray.500">{action.source}</Text>
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
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default CombatActionCatalogPanel;
