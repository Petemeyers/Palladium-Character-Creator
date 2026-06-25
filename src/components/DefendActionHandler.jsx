import React, { useState } from "react";
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { getCombatPosture } from "../utils/combatPosture.js";
import { commandBlockedLog } from "../utils/combatCommandLog.js";

const getId = (combatant) =>
  String(combatant?.id || combatant?._id || combatant?.fighterId || combatant?.characterId || "");

const toNumber = (value) => {
  if (value === undefined || value === null || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const getGuardMessage = ({
  actor,
  action,
  currentTurnEntry,
  manualTurnActive,
  posture,
}) => {
  if (!manualTurnActive) return "Manual turn order is not active.";
  const actorId = getId(actor);
  const turnId = String(currentTurnEntry?.id || "");
  const actionActorId = String(action?.metadata?.actorId || actorId || "");
  if (!actorId || !turnId || actorId !== turnId || (actionActorId && actionActorId !== turnId)) {
    return "Defend can only be used by the current turn combatant.";
  }
  if (!action?.enabled) return action?.disabledReason || "Defend action is disabled.";
  if ((toNumber(currentTurnEntry?.remainingActions) ?? 0) <= 0) {
    return "No actions remaining. End Turn manually.";
  }
  if (posture?.type === "defending") return "Already defending.";
  return "";
};

const DefendActionHandler = ({
  actor = null,
  currentTurnEntry = null,
  selectedCombatAction = null,
  manualTurnActive = false,
  onDefend,
  onCommandLog,
}) => {
  const [result, setResult] = useState(null);
  const posture = getCombatPosture(currentTurnEntry || actor || {});
  const guardMessage = getGuardMessage({
    actor,
    action: selectedCombatAction,
    currentTurnEntry,
    manualTurnActive,
    posture,
  });
  const canDefend = !guardMessage && typeof onDefend === "function";

  const handleDefend = () => {
    if (!canDefend) {
      const message = commandBlockedLog({
        action: selectedCombatAction || "Defend",
        reason: guardMessage || "defend unavailable.",
      });
      onCommandLog?.(message, "warning");
      setResult({ ok: false, message });
      return;
    }
    const nextResult = onDefend({
      actorId: currentTurnEntry?.id || getId(actor),
      action: selectedCombatAction,
    });
    setResult(nextResult || { ok: false, message: "Defend did not complete." });
  };

  return (
    <Box borderWidth="1px" borderRadius="md" p={3} bg="green.50" borderColor="green.200">
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between" align="center" wrap="wrap">
          <Text fontWeight="bold">Defend</Text>
          <Badge colorScheme="green">Manual</Badge>
        </HStack>

        <HStack spacing={2} wrap="wrap">
          <Badge>Actions {selectedCombatAction?.costActions ?? 1}</Badge>
          <Badge colorScheme={posture?.type === "defending" ? "green" : "gray"}>
            Posture {posture?.label || "None"}
          </Badge>
        </HStack>

        <Text fontSize="sm" color="gray.700">
          Enter defensive posture until this combatant&apos;s next turn.
        </Text>
        <Text fontSize="xs" color="gray.600">
          Manual attack defense bonus applies while this posture is active.
        </Text>

        {guardMessage && (
          <Text fontSize="xs" color="orange.700">{guardMessage}</Text>
        )}

        <Button
          size="sm"
          colorScheme="green"
          alignSelf="start"
          onClick={handleDefend}
          isDisabled={typeof onDefend !== "function"}
        >
          Enter Defensive Posture
        </Button>

        {result?.message && (
          <Alert status={result.ok ? "success" : "warning"} borderRadius="md">
            <AlertIcon />
            <Text fontSize="sm">{result.message}</Text>
          </Alert>
        )}
      </VStack>
    </Box>
  );
};

export default DefendActionHandler;
