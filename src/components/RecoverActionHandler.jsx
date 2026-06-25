import React, { useMemo, useState } from "react";
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
import { applyStaminaRecovery, getRecoveryAmount } from "../utils/combatRecovery.js";
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
  recoveryPreview,
}) => {
  if (!manualTurnActive) return "Manual turn order is not active.";
  const actorId = getId(actor);
  const turnId = String(currentTurnEntry?.id || "");
  const actionActorId = String(action?.metadata?.actorId || actorId || "");
  if (!actorId || !turnId || actorId !== turnId || (actionActorId && actionActorId !== turnId)) {
    return "Recover can only be used by the current turn combatant.";
  }
  if (!action?.enabled) return action?.disabledReason || "Recovery action is disabled.";
  if ((toNumber(currentTurnEntry?.remainingActions) ?? 0) <= 0) {
    return "No actions remaining. End Turn manually.";
  }
  if (recoveryPreview?.message === "Stamina already full.") return "Stamina already full.";
  if (recoveryPreview?.missingFields?.length > 0) {
    return `Missing: ${recoveryPreview.missingFields.join(", ")}`;
  }
  return "";
};

const RecoverActionHandler = ({
  actor = null,
  currentTurnEntry = null,
  selectedCombatAction = null,
  manualTurnActive = false,
  onRecover,
  onCommandLog,
}) => {
  const [result, setResult] = useState(null);
  const recoveryAmount = getRecoveryAmount(currentTurnEntry || actor || {}, selectedCombatAction || {});
  const recoveryPreview = useMemo(
    () => applyStaminaRecovery(currentTurnEntry || actor || {}, recoveryAmount),
    [actor, currentTurnEntry, recoveryAmount]
  );
  const currentStamina = currentTurnEntry?.currentStamina ?? actor?.currentStamina ?? "Missing";
  const maxStamina = currentTurnEntry?.maxStamina ?? actor?.maxStamina ?? "Missing";
  const guardMessage = getGuardMessage({
    actor,
    action: selectedCombatAction,
    currentTurnEntry,
    manualTurnActive,
    recoveryPreview,
  });
  const canRecover = !guardMessage && typeof onRecover === "function";

  const handleRecover = () => {
    if (!canRecover) {
      const message = commandBlockedLog({
        action: selectedCombatAction || "Recover",
        reason: guardMessage || "recovery unavailable.",
      });
      onCommandLog?.(message, "warning");
      setResult({ ok: false, message });
      return;
    }
    const nextResult = onRecover({
      actorId: currentTurnEntry?.id || getId(actor),
      action: selectedCombatAction,
      recoveryAmount,
    });
    setResult(nextResult || { ok: false, message: "Recovery did not complete." });
  };

  return (
    <Box borderWidth="1px" borderRadius="md" p={3} bg="teal.50" borderColor="teal.200">
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between" align="center" wrap="wrap">
          <Text fontWeight="bold">Recover / Catch Breath</Text>
          <Badge colorScheme="teal">Manual</Badge>
        </HStack>

        <HStack spacing={2} wrap="wrap">
          <Badge>Current stamina {currentStamina}</Badge>
          <Badge>Max stamina {maxStamina}</Badge>
          <Badge>Recovery {recoveryAmount}</Badge>
          <Badge>Actions {selectedCombatAction?.costActions ?? 1}</Badge>
        </HStack>

        <Text fontSize="sm" color="gray.700">
          {recoveryPreview.ok
            ? `Recover ${recoveryPreview.recovered} stamina: ${recoveryPreview.oldStamina}/${recoveryPreview.maxStamina} -> ${recoveryPreview.newStamina}/${recoveryPreview.maxStamina}.`
            : recoveryPreview.message || `Recover ${recoveryAmount} stamina.`}
        </Text>

        {guardMessage && (
          <Text fontSize="xs" color="orange.700">{guardMessage}</Text>
        )}

        <Button
          size="sm"
          colorScheme="teal"
          alignSelf="start"
          onClick={handleRecover}
          isDisabled={typeof onRecover !== "function"}
        >
          Recover Stamina
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

export default RecoverActionHandler;
