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
  canUseItemCommand,
  getItemCommandPreview,
} from "../utils/combatItemCommand.js";
import { commandBlockedLog } from "../utils/combatCommandLog.js";

const UseItemActionHandler = ({
  actor = null,
  currentTurnEntry = null,
  selectedCombatAction = null,
  onCommandLog,
}) => {
  const preview = getItemCommandPreview({
    actor,
    action: selectedCombatAction,
  });
  const guard = canUseItemCommand({
    actor,
    action: selectedCombatAction,
    currentTurnEntry,
  });

  return (
    <Box borderWidth="1px" borderRadius="md" p={3} bg="orange.50" borderColor="orange.200">
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between" align="center" wrap="wrap">
          <Text fontWeight="bold">{preview.actionName}</Text>
          <Badge colorScheme="orange">Use Item</Badge>
        </HStack>

        <HStack spacing={2} wrap="wrap">
          <Badge>Item {preview.itemName}</Badge>
          <Badge>Source {preview.itemSource}</Badge>
          {preview.itemCategory && <Badge>Category {preview.itemCategory}</Badge>}
          <Badge>Actions {preview.actionCost}</Badge>
          <Badge>Stamina {preview.staminaCost}</Badge>
        </HStack>

        <Text fontSize="sm" color="gray.700">
          {preview.previewSummary}
        </Text>
        <Text fontSize="xs" color="orange.700">
          {guard.reason || preview.handlerStatus}
        </Text>

        <Button
          size="sm"
          colorScheme="orange"
          alignSelf="start"
          onClick={() => {
            onCommandLog?.(
              commandBlockedLog({
                action: selectedCombatAction || "Use Item",
                reason: guard.reason || "item effect handler pending.",
              }),
              "warning"
            );
          }}
        >
          Use Item Pending
        </Button>
      </VStack>
    </Box>
  );
};

export default UseItemActionHandler;
