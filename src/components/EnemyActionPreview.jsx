import React from "react";
import { Badge, Box, Text, VStack, Wrap, WrapItem } from "@chakra-ui/react";

const hasText = (value) => value !== undefined && value !== null && String(value).trim() !== "";

const field = (label, value) => {
  if (!hasText(value)) return null;
  return (
    <WrapItem>
      <Badge variant="subtle">{label}: {String(value)}</Badge>
    </WrapItem>
  );
};

const EnemyActionPreview = ({ actions = [], emptyText = "No action preview available" }) => {
  if (!Array.isArray(actions) || actions.length === 0) {
    return <Text fontSize="xs" color="gray.500">{emptyText}</Text>;
  }

  return (
    <VStack align="stretch" spacing={2}>
      {actions.map((action, index) => (
        <Box key={`${action?.name || "action"}-${index}`} borderWidth="1px" borderRadius="md" p={2} bg="gray.50">
          <Text fontSize="xs" fontWeight="bold" mb={1}>
            {hasText(action?.name) ? String(action.name) : "Unnamed action"}
          </Text>
          <Wrap spacing={1}>
            {field("Type", action?.attackType)}
            {field("Ability", action?.abilityUsed)}
            {field("Reach", action?.reach)}
            {field("Range", action?.range)}
            {field("Hit", action?.hitBonus)}
            {field("Damage", action?.damageExpression || action?.damage)}
            {field("Damage Type", action?.damageType)}
            {field("Save", action?.save)}
            {field("Notes", action?.notes)}
          </Wrap>
        </Box>
      ))}
    </VStack>
  );
};

export default EnemyActionPreview;
