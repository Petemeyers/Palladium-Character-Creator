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
  canUseSkillCommand,
  getSkillCommandPreview,
} from "../utils/combatSkillCommand.js";
import { commandBlockedLog } from "../utils/combatCommandLog.js";

const UseSkillActionHandler = ({
  actor = null,
  currentTurnEntry = null,
  selectedCombatAction = null,
  onCommandLog,
}) => {
  const preview = getSkillCommandPreview({
    actor,
    action: selectedCombatAction,
  });
  const guard = canUseSkillCommand({
    actor,
    action: selectedCombatAction,
    currentTurnEntry,
  });

  return (
    <Box borderWidth="1px" borderRadius="md" p={3} bg="purple.50" borderColor="purple.200">
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between" align="center" wrap="wrap">
          <Text fontWeight="bold">{preview.actionName}</Text>
          <Badge colorScheme="purple">Use Skill</Badge>
        </HStack>

        <HStack spacing={2} wrap="wrap">
          <Badge>Skill {preview.skillName}</Badge>
          <Badge>Source {preview.skillSource}</Badge>
          {preview.skillCategory && <Badge>Category {preview.skillCategory}</Badge>}
          <Badge>Actions {preview.actionCost}</Badge>
          <Badge>Stamina {preview.staminaCost}</Badge>
        </HStack>

        <Text fontSize="sm" color="gray.700">
          {preview.previewSummary}
        </Text>
        <Text fontSize="xs" color="purple.700">
          {guard.reason || preview.handlerStatus}
        </Text>

        <Button
          size="sm"
          colorScheme="purple"
          alignSelf="start"
          onClick={() => {
            onCommandLog?.(
              commandBlockedLog({
                action: selectedCombatAction || "Use Skill",
                reason: guard.reason || "skill handler pending.",
              }),
              "warning"
            );
          }}
        >
          Use Skill Pending
        </Button>
      </VStack>
    </Box>
  );
};

export default UseSkillActionHandler;
