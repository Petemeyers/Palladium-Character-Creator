import React, { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { formatClimbOption } from "../utils/combat/climbActionAuthority.js";
import { commandBlockedLog } from "../utils/combatCommandLog.js";

const ClimbActionHandler = ({
  actor = null,
  currentTurnEntry = null,
  selectedCombatAction = null,
  options = [],
  manualTurnActive = false,
  onClimb,
  onCommandLog,
}) => {
  const [lastResult, setLastResult] = useState(null);
  const actionsRemaining = Number(
    currentTurnEntry?.remainingActions ??
    actor?.remainingActions ??
    actor?.actionsRemaining ??
    0
  );
  const staminaRemaining = Number(
    actor?.currentStamina ??
    actor?.combatStamina?.currentStamina ??
    actor?.combatStamina?.current ??
    actor?.stamina ??
    0
  );

  const prepared = useMemo(() => (
    (Array.isArray(options) ? options : []).map((option) => {
      const enoughActions = !Number.isFinite(actionsRemaining) || actionsRemaining >= option.actionCost;
      const enoughStamina = !Number.isFinite(staminaRemaining) || staminaRemaining >= option.totalStaminaCost;
      const enabled =
        manualTurnActive &&
        option?.accepted === true &&
        option?.enabled !== false &&
        enoughActions &&
        enoughStamina;
      const disabledReason = !manualTurnActive
        ? "Climb is only executable during the current manual turn."
        : option?.enabled === false
          ? option.reason || "That obstacle cannot be climbed in one tactical action."
          : !enoughActions
            ? `Requires ${option.actionCost} action${option.actionCost === 1 ? "" : "s"}.`
            : !enoughStamina
              ? `Requires ${option.totalStaminaCost} stamina.`
              : "";
      return { ...option, uiEnabled: enabled, uiDisabledReason: disabledReason };
    })
  ), [actionsRemaining, manualTurnActive, options, staminaRemaining]);

  return (
    <Box borderWidth="1px" borderRadius="md" p={3} bg="cyan.50" borderColor="cyan.200">
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between" align="center" wrap="wrap">
          <Text fontWeight="bold">Climb</Text>
          <Badge colorScheme="cyan">Climbing</Badge>
        </HStack>

        <Text fontSize="sm" color="gray.700">
          Climb one adjacent cliff or wall edge. Ordinary Walk, Run, and Charge cannot cross these edges.
        </Text>

        {prepared.length === 0 ? (
          <Text fontSize="sm" color="gray.600">
            No adjacent cliff or wall can be climbed from this hex.
          </Text>
        ) : (
          <VStack align="stretch" spacing={2}>
            {prepared.map((option) => (
              <Box
                key={`${option.to?.x},${option.to?.y}`}
                borderWidth="1px"
                borderRadius="md"
                p={2}
                bg="white"
              >
                <VStack align="stretch" spacing={2}>
                  <Text fontSize="sm" fontWeight="semibold">
                    {formatClimbOption(option)}
                  </Text>
                  <HStack spacing={2} wrap="wrap">
                    <Badge>{option.trained ? "Trained" : "Untrained"}</Badge>
                    <Badge colorScheme={option.targetPercent >= 65 ? "green" : option.targetPercent >= 45 ? "yellow" : "red"}>
                      {option.targetPercent}% success
                    </Badge>
                    <Badge>{option.surface?.label}</Badge>
                    <Badge>{option.verticalFeet} ft</Badge>
                  </HStack>
                  {option.uiDisabledReason && (
                    <Text fontSize="xs" color="orange.700">{option.uiDisabledReason}</Text>
                  )}
                  <Button
                    size="sm"
                    colorScheme="cyan"
                    alignSelf="start"
                    isDisabled={!option.uiEnabled}
                    onClick={() => {
                      if (!option.uiEnabled || typeof onClimb !== "function") {
                        onCommandLog?.(
                          commandBlockedLog({
                            action: selectedCombatAction || "Climb",
                            reason: option.uiDisabledReason || "Climb unavailable.",
                          }),
                          "warning",
                        );
                        return;
                      }
                      const result = onClimb({ actorId: actor?.id ?? actor?._id, option });
                      setLastResult(result || null);
                    }}
                  >
                    Attempt Climb
                  </Button>
                </VStack>
              </Box>
            ))}
          </VStack>
        )}

        {lastResult?.message && (
          <Box p={2} borderRadius="md" bg={lastResult.ok ? "green.50" : "orange.50"}>
            <Text fontSize="sm">{lastResult.message}</Text>
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default ClimbActionHandler;
