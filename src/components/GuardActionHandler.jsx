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

const POSTURE_BY_ACTION = {
  block: {
    type: "blocking",
    label: "Blocking",
    button: "Enter Blocking Posture",
    already: "Already blocking.",
    note: "Manual attack damage reduction applies while this posture is active.",
  },
  evade: {
    type: "evading",
    label: "Evading",
    button: "Enter Evading Posture",
    already: "Already evading.",
    note: "Manual attack defense bonus applies while this posture is active.",
  },
};

const getGuardMessage = ({
  actor,
  action,
  currentTurnEntry,
  manualTurnActive,
  posture,
  postureConfig,
}) => {
  if (!manualTurnActive) return "Manual turn order is not active.";
  const actorId = getId(actor);
  const turnId = String(currentTurnEntry?.id || "");
  const actionActorId = String(action?.metadata?.actorId || actorId || "");
  if (!actorId || !turnId || actorId !== turnId || (actionActorId && actionActorId !== turnId)) {
    return "This action can only be used by the current turn combatant.";
  }
  if (!action?.enabled) return action?.disabledReason || "This action is disabled.";
  if ((toNumber(currentTurnEntry?.remainingActions) ?? 0) <= 0) {
    return "No actions remaining. End Turn manually.";
  }
  if (posture?.type === postureConfig.type) return postureConfig.already;
  return "";
};

const GuardActionHandler = ({
  actor = null,
  currentTurnEntry = null,
  selectedCombatAction = null,
  manualTurnActive = false,
  onApplyPosture,
  onCommandLog,
}) => {
  const [result, setResult] = useState(null);
  const actionType = selectedCombatAction?.type === "evade" ? "evade" : "block";
  const postureConfig = POSTURE_BY_ACTION[actionType];
  const posture = getCombatPosture(currentTurnEntry || actor || {});
  const guardMessage = getGuardMessage({
    actor,
    action: selectedCombatAction,
    currentTurnEntry,
    manualTurnActive,
    posture,
    postureConfig,
  });
  const canApply = !guardMessage && typeof onApplyPosture === "function";

  const handleApply = () => {
    if (!canApply) {
      const message = commandBlockedLog({
        action: selectedCombatAction || postureConfig.label,
        reason: guardMessage || `${postureConfig.label} unavailable.`,
      });
      onCommandLog?.(message, "warning");
      setResult({ ok: false, message });
      return;
    }
    const nextResult = onApplyPosture({
      actorId: currentTurnEntry?.id || getId(actor),
      action: selectedCombatAction,
      postureType: postureConfig.type,
    });
    setResult(nextResult || { ok: false, message: `${postureConfig.label} did not complete.` });
  };

  return (
    <Box borderWidth="1px" borderRadius="md" p={3} bg="green.50" borderColor="green.200">
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between" align="center" wrap="wrap">
          <Text fontWeight="bold">{selectedCombatAction?.name || postureConfig.label}</Text>
          <Badge colorScheme="green">Manual</Badge>
        </HStack>

        <HStack spacing={2} wrap="wrap">
          <Badge>Actions {selectedCombatAction?.costActions ?? 1}</Badge>
          <Badge colorScheme={posture?.type === postureConfig.type ? "green" : "gray"}>
            Posture {posture?.label || "None"}
          </Badge>
        </HStack>

        <Text fontSize="sm" color="gray.700">
          {selectedCombatAction?.previewSummary || `${postureConfig.label} posture pending.`}
        </Text>
        <Text fontSize="xs" color="gray.600">
          {postureConfig.note}
        </Text>

        {guardMessage && (
          <Text fontSize="xs" color="orange.700">{guardMessage}</Text>
        )}

        <Button
          size="sm"
          colorScheme="green"
          alignSelf="start"
          onClick={handleApply}
          isDisabled={typeof onApplyPosture !== "function"}
        >
          {postureConfig.button}
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

export default GuardActionHandler;
