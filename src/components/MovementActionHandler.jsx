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
  getMovementTargetingButtonState,
  getMovementCommandPreview,
} from "../utils/combatMovementCommand.js";
import { commandBlockedLog } from "../utils/combatCommandLog.js";

const MovementActionHandler = ({
  actor = null,
  currentTurnEntry = null,
  selectedCombatAction = null,
  selectedTarget = null,
  manualTurnActive = true,
  executionAvailable = false,
  movementActive = false,
  movementResult = null,
  onExecute,
  onCommandLog,
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
    manualTurnActive,
    executionAvailable,
  });
  const buttonState = getMovementTargetingButtonState({
    actor,
    action: selectedCombatAction,
    currentTurnEntry,
    selectedTarget,
    manualTurnActive,
    executionAvailable,
  });
  const currentMode = movementResult?.status === "moved"
    ? "moved"
    : movementActive
      ? "choosing destination"
      : "inactive";
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
          <Badge>Mode {currentMode}</Badge>
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
        {movementActive && (
          <Text fontSize="xs" color="blue.700">
            Select a destination hex on the map.
          </Text>
        )}
        {movementResult?.message && (
          <Text fontSize="xs" color={movementResult.ok === false ? "orange.700" : "green.700"}>
            {movementResult.message}
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
            if (!canExecute) {
              onCommandLog?.(
                commandBlockedLog({
                  action: selectedCombatAction || preview.actionName,
                  reason: guard.reason || "movement targeting unavailable.",
                }),
                "warning"
              );
              return;
            }
            onExecute({ action: selectedCombatAction, preview });
          }}
          isDisabled={typeof onExecute !== "function"}
        >
          {buttonState.label}
        </Button>
      </VStack>
    </Box>
  );
};

export default MovementActionHandler;
