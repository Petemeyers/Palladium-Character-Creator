import React from "react";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { COMBAT_COMMAND_LAYOUT } from "../utils/combatCommandLayout.js";

const CompatibilityCombatControlsPanel = ({
  children,
  currentActionName = "",
  currentFighterName = "",
}) => (
  <Accordion allowToggle defaultIndex={[]}>
    <AccordionItem borderWidth="1px" borderRadius="md" bg="gray.50" borderColor="gray.200">
      <AccordionButton px={3} py={2}>
        <Box flex="1" textAlign="left">
          <HStack spacing={2} wrap="wrap">
            <Text fontWeight="bold">{COMBAT_COMMAND_LAYOUT.compatibilityLabel}</Text>
            <Badge colorScheme="gray">{COMBAT_COMMAND_LAYOUT.compatibilityToolsLabel}</Badge>
            {currentFighterName && <Badge colorScheme="blue">{currentFighterName}</Badge>}
            {currentActionName && <Badge colorScheme="orange">Legacy action: {currentActionName}</Badge>}
          </HStack>
          <Text fontSize="xs" color="gray.600">
            {COMBAT_COMMAND_LAYOUT.compatibilityDescription}
          </Text>
        </Box>
        <AccordionIcon />
      </AccordionButton>
      <AccordionPanel px={3} pb={3}>
        <VStack align="stretch" spacing={3}>
          {children}
        </VStack>
      </AccordionPanel>
    </AccordionItem>
  </Accordion>
);

export default CompatibilityCombatControlsPanel;
