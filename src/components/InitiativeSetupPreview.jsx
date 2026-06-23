import React from "react";
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
import { buildPublicInitiativePreviewRows } from "../utils/publicInitiativePreview.js";

const getSideColor = (side) => {
  if (side === "player") return "blue";
  if (side === "enemy") return "red";
  return "gray";
};

const InitiativeSetupPreview = ({ combatants = [], stagedEntries = [] }) => {
  const entries = [
    ...(Array.isArray(combatants) ? combatants : []),
    ...(Array.isArray(stagedEntries) ? stagedEntries : []),
  ];
  const rows = buildPublicInitiativePreviewRows(entries);

  if (rows.length === 0) return null;

  return (
    <Box borderWidth="1px" borderRadius="md" p={3} bg="white">
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between" align="center" wrap="wrap">
          <Text fontWeight="bold">Initiative Setup Preview</Text>
          <Badge colorScheme="purple">{rows.length} combatant{rows.length === 1 ? "" : "s"}</Badge>
        </HStack>

        <Box overflowX="auto">
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Side</Th>
                <Th>Initiative Bonus</Th>
                <Th>Source</Th>
                <Th>Roll Preview</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td fontWeight="semibold">{row.name}</Td>
                  <Td>
                    <Badge colorScheme={getSideColor(row.side)}>
                      {row.side === "player" ? "Player" : row.side === "enemy" ? "Enemy" : "Unknown"}
                    </Badge>
                  </Td>
                  <Td>
                    <VStack align="start" spacing={0}>
                      <Text fontSize="sm">{row.initiativeBonusLabel}</Text>
                      {row.dexteritySource && (
                        <Text fontSize="xs" color="gray.500">
                          {row.dexteritySource}
                        </Text>
                      )}
                    </VStack>
                  </Td>
                  <Td>{row.sourceLabel}</Td>
                  <Td>{row.rollPreviewLabel}</Td>
                  <Td>
                    <VStack align="start" spacing={1}>
                      <Badge colorScheme={row.status === "ready" ? "green" : "orange"}>
                        {row.status === "ready" ? "Ready" : "Missing Fields"}
                      </Badge>
                      {row.missingFields.length > 0 && (
                        <Text fontSize="xs" color="gray.600">
                          Missing: {row.missingFields.join(", ")}
                        </Text>
                      )}
                    </VStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </VStack>
    </Box>
  );
};

export default InitiativeSetupPreview;
