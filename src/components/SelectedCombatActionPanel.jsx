import React from "react";
import {
  Badge,
  Box,
  HStack,
  Text,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";

const typeColor = (type) => {
  if (type === "attack") return "red";
  if (type === "move" || type === "run" || type === "charge") return "blue";
  if (type === "defend" || type === "block" || type === "evade") return "green";
  if (type === "recover") return "teal";
  if (type === "use-item") return "orange";
  if (type === "use-skill") return "purple";
  return "gray";
};

const handlerStatusFor = (action) => {
  const type = action?.type;
  if (!action) return "Select an action from the Combat Action Catalog.";
  if (type === "attack") return "Attack resolver ready.";
  if (type === "move") return "Movement targeting ready.";
  if (type === "run") return "Run targeting ready.";
  if (type === "charge") return "Charge targeting ready; attack follow-through pending.";
  if (type === "defend") return "Defend handler ready.";
  if (type === "block") return "Block handler pending.";
  if (type === "evade") return "Evade handler pending.";
  if (type === "recover") return "Recover handler ready.";
  if (type === "use-item") return "Item handler pending.";
  if (type === "use-skill") return "Skill handler pending.";
  return "Compatibility handler pending.";
};

const SelectedCombatActionPanel = ({
  selectedCombatAction = null,
  actor = null,
  selectedTarget = null,
  children,
}) => {
  const action = selectedCombatAction;
  const targetName =
    selectedTarget?.name ||
    selectedTarget?.label ||
    (action?.targetId ? action.targetId : "");

  return (
    <Box borderWidth="1px" borderRadius="md" p={3} bg="white">
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between" align="center" wrap="wrap">
          <Box>
            <Text fontWeight="bold">Selected Combat Action / Command Resolver</Text>
            <Text fontSize="xs" color="gray.600">
              {actor?.name ? `Current combatant: ${actor.name}` : "No current combatant."}
            </Text>
          </Box>
          <Badge colorScheme={action ? typeColor(action.type) : "gray"}>
            {action ? action.type : "No Action"}
          </Badge>
        </HStack>

        {!action ? (
          <Text fontSize="sm" color="gray.700">
            Select an action from the Combat Action Catalog.
          </Text>
        ) : (
          <>
            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between" align="start" wrap="wrap">
                <Box>
                  <Text fontSize="sm" fontWeight="semibold">{action.name}</Text>
                  <Text fontSize="xs" color="gray.600">{action.source}</Text>
                </Box>
                <Badge colorScheme={action.enabled ? "green" : "orange"}>
                  {action.enabled ? "Enabled" : "Disabled"}
                </Badge>
              </HStack>

              <Wrap spacing={2}>
                <WrapItem><Badge>{action.category}</Badge></WrapItem>
                <WrapItem><Badge>Actions {action.costActions}</Badge></WrapItem>
                <WrapItem><Badge>Stamina {action.costStamina}</Badge></WrapItem>
                <WrapItem><Badge>{action.targetRequired ? "Target Required" : "No Target Required"}</Badge></WrapItem>
                {targetName && <WrapItem><Badge>Target {targetName}</Badge></WrapItem>}
              </Wrap>

              {action.disabledReason && (
                <Text fontSize="xs" color="orange.700">{action.disabledReason}</Text>
              )}
              {action.previewSummary && (
                <Text fontSize="xs" color="gray.700">{action.previewSummary}</Text>
              )}
              <Text fontSize="xs" color={action.type === "attack" ? "green.700" : "gray.600"}>
                {handlerStatusFor(action)}
              </Text>
            </VStack>

            {action.type !== "attack" && action.type !== "recover" && action.type !== "defend" && action.type !== "move" && action.type !== "run" && action.type !== "charge" && (
              <Box borderWidth="1px" borderRadius="md" p={2} bg="gray.50">
                <Text fontSize="xs" color="gray.700">{handlerStatusFor(action)}</Text>
              </Box>
            )}

            {(action.type === "attack" || action.type === "recover" || action.type === "defend" || action.type === "move" || action.type === "run" || action.type === "charge") && children}
          </>
        )}
      </VStack>
    </Box>
  );
};

export default SelectedCombatActionPanel;
