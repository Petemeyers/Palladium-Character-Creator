import React from "react";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
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
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import EnemyActionPreview from "./EnemyActionPreview.jsx";
import { getEncounterReadinessSummary } from "../utils/publicCombatReadiness.js";

const getEntryKey = (entry, prefix, index) =>
  `${prefix}-${entry?.id || entry?._id || entry?.name || index}`;

const getSideColor = (side) => {
  if (side === "Player") return "blue";
  if (side === "Enemy") return "red";
  return "gray";
};

const renderMissing = (missing) => {
  if (!Array.isArray(missing) || missing.length === 0) return null;
  return (
    <Text fontSize="xs" color="gray.600">
      Missing: {missing.join(", ")}
    </Text>
  );
};

const EncounterReadinessPanel = ({ combatants = [], stagedEntries = [] }) => {
  const rows = [
    ...combatants.map((combatant, index) => ({
      key: getEntryKey(combatant, "combatant", index),
      summary: getEncounterReadinessSummary(combatant),
    })),
    ...stagedEntries.map((entry, index) => ({
      key: getEntryKey(entry, "staged", index),
      summary: getEncounterReadinessSummary(entry),
    })),
  ];

  if (rows.length === 0) return null;

  return (
    <Box borderWidth="1px" borderRadius="md" p={3} bg="white">
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between" align="center" wrap="wrap">
          <Text fontWeight="bold">Encounter Readiness</Text>
          <Badge colorScheme="purple">{rows.length} combatant{rows.length === 1 ? "" : "s"}</Badge>
        </HStack>

        <Accordion allowToggle>
          <AccordionItem border="0">
            <AccordionButton px={0}>
              <Box flex="1" textAlign="left">
                <Text fontSize="sm">Readiness details</Text>
              </Box>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel px={0} pb={0}>
              <Box overflowX="auto">
                <Table size="sm" variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Side</Th>
                      <Th>Source</Th>
                      <Th>Core Fields</Th>
                      <Th>Public Details</Th>
                      <Th>Attack Preview</Th>
                      <Th>Status</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {rows.map(({ key, summary }) => (
                      <Tr key={key}>
                        <Td fontWeight="semibold">{summary.name}</Td>
                        <Td>
                          <Badge colorScheme={getSideColor(summary.side)}>{summary.side}</Badge>
                        </Td>
                        <Td>{summary.sourceLabel}</Td>
                        <Td>
                          <Wrap spacing={1}>
                            <WrapItem><Badge>HP {summary.hp}</Badge></WrapItem>
                            <WrapItem><Badge>AC/Guard {summary.acOrGuard}</Badge></WrapItem>
                            <WrapItem><Badge>Speed {summary.speed}</Badge></WrapItem>
                            <WrapItem><Badge>Size {summary.size}</Badge></WrapItem>
                            <WrapItem><Badge>Type {summary.category}</Badge></WrapItem>
                          </Wrap>
                        </Td>
                        <Td>
                          <VStack align="start" spacing={1}>
                            {summary.side === "Player" ? (
                              <>
                                {summary.publicClassName && <Text fontSize="xs">Class: {summary.publicClassName}</Text>}
                                {summary.publicSpeciesName && <Text fontSize="xs">Species: {summary.publicSpeciesName}</Text>}
                                {summary.publicBackgroundName && <Text fontSize="xs">Background: {summary.publicBackgroundName}</Text>}
                              </>
                            ) : (
                              summary.enemyCreatureType && <Text fontSize="xs">Creature Type: {summary.enemyCreatureType}</Text>
                            )}
                          </VStack>
                        </Td>
                        <Td minW="220px">
                          {summary.side === "Enemy" ? (
                            <EnemyActionPreview actions={summary.actionPreviews} />
                          ) : summary.actionPreviews.length > 0 ? (
                            <EnemyActionPreview actions={summary.actionPreviews} />
                          ) : (
                            <Text fontSize="xs" color="gray.500">Player attack summary pending</Text>
                          )}
                        </Td>
                        <Td>
                          <VStack align="start" spacing={1}>
                            <Badge colorScheme={summary.ready ? "green" : "orange"}>
                              {summary.ready ? "Ready" : "Missing Fields"}
                            </Badge>
                            {renderMissing(summary.missing)}
                          </VStack>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </VStack>
    </Box>
  );
};

export default EncounterReadinessPanel;
