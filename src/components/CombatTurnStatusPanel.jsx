import React from "react";
import {
  Badge,
  Box,
  Button,
  HStack,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import { buildCombatTurnStatus } from "../utils/combatTurnStatus.js";

const teamColor = (teamLabel) => {
  if (teamLabel === "Player") return "blue";
  if (teamLabel === "Enemy") return "red";
  return "gray";
};

const postureColor = (postureLabel) => {
  if (postureLabel === "Defending") return "green";
  if (postureLabel === "Blocking") return "teal";
  if (postureLabel === "Evading") return "purple";
  return "gray";
};

const CombatTurnStatusPanel = ({
  commandTurn = {},
  activeActor = null,
  selectedCombatAction = null,
  endTurnUnavailableReason = "",
  onEndTurn,
}) => {
  const status = buildCombatTurnStatus({
    commandTurn,
    activeActor,
    selectedCombatAction,
    endTurnUnavailableReason,
  });
  const canClickEndTurn = status.endTurnAvailable && typeof onEndTurn === "function";

  return (
    <Box borderWidth="1px" borderColor="purple.200" borderRadius="md" p={3} bg="white">
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between" align="start" wrap="wrap">
          <Box>
            <Text fontWeight="bold">Current Turn</Text>
            <Text fontSize="sm" color="gray.700">{status.currentTurnName}</Text>
          </Box>
          <HStack spacing={2} wrap="wrap">
            <Badge colorScheme={teamColor(status.teamLabel)}>{status.teamLabel}</Badge>
            <Badge colorScheme="purple">{status.sourceLabel}</Badge>
          </HStack>
        </HStack>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
          <Box>
            <Text fontSize="xs" color="gray.500" fontWeight="semibold">Actions</Text>
            <Text fontSize="sm">
              {status.actionsRemaining} / {status.maxActions}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="gray.500" fontWeight="semibold">Posture</Text>
            <Badge colorScheme={postureColor(status.postureLabel)}>{status.postureLabel}</Badge>
          </Box>
          <Box>
            <Text fontSize="xs" color="gray.500" fontWeight="semibold">Next Step</Text>
            <Text fontSize="sm" color={status.warning ? "orange.700" : "gray.700"}>
              {status.nextStepMessage}
            </Text>
          </Box>
        </SimpleGrid>

        {status.showEndTurnButton && (
          <HStack justify="space-between" align="center" wrap="wrap" spacing={3}>
            <Text fontSize="xs" color={status.endTurnAvailable ? "gray.600" : "orange.700"}>
              {status.endTurnDisabledReason || "Ends this fighter's turn and advances initiative."}
            </Text>
            <Button
              size="sm"
              colorScheme="purple"
              onClick={() => {
                if (canClickEndTurn) onEndTurn();
              }}
              isDisabled={!canClickEndTurn}
            >
              {status.endTurnButtonLabel}
            </Button>
          </HStack>
        )}
      </VStack>
    </Box>
  );
};

export default CombatTurnStatusPanel;
