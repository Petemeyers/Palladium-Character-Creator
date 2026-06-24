import React from "react";
import {
  Badge,
  Box,
  Button,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  canExecuteMovementCommand,
  getMovementCommandPreview,
} from "../utils/combatMovementCommand.js";

const MovementActionHandler = ({
  actor = null,
  currentTurnEntry = null,
  selectedCombatAction = null,
  selectedTarget = null,
  executionAvailable = false,
  onExecute,
}) => {
  const preview = getMovementCommandPreview({
    actor,
    action: selectedCombatAction,
    selectedTarget,
  });
  const guard = canExecuteMovementCommand({
    actor,
    action: selectedCombatAction,
    currentTurnEntry,
    selectedTarget,
    executionAvailable,
  });
  const buttonLabel =
    preview.movementMode === "run"
      ? "Execute Run"
      : preview.movementMode === "charge"
        ? "Execute Charge"
        : "Execute Move";
  const canExecute = guard.ok && typeof onExecute === "function";

  return (
    <Box borderWidth="1px" borderRadius="md" p={3} bg="blue.50" borderColor="blue.200">
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between" align="center" wrap="wrap">
          <Text fontWeight="bold">{preview.actionName}</Text>
          <Badge colorScheme="blue">{preview.modeLabel}</Badge>
        </HStack>

        <HStack spacing={2} wrap="wrap">
          <Badge>Actor {preview.actorName}</Badge>
          <Badge>Actions {preview.actionCost}</Badge>
          <Badge>Stamina {preview.staminaCost}</Badge>
          {preview.targetName && <Badge>Target {preview.targetName}</Badge>}
          {preview.distanceFeet !== null && <Badge>Distance {preview.distanceFeet} ft</Badge>}
        </HStack>

        <Text fontSize="sm" color="gray.700">
          {preview.previewSummary}
        </Text>
        {preview.movementMode === "charge" && (
          <Text fontSize="xs" color="gray.600">
            Charge attack follow-through pending.
          </Text>
        )}

        {!guard.ok && (
          <Text fontSize="xs" color="orange.700">{guard.reason}</Text>
        )}

        <Button
          size="sm"
          colorScheme="blue"
          alignSelf="start"
          onClick={() => {
            if (canExecute) onExecute({ action: selectedCombatAction, preview });
          }}
          isDisabled={!canExecute}
        >
          {buttonLabel}
        </Button>
      </VStack>
    </Box>
  );
};

export default MovementActionHandler;
