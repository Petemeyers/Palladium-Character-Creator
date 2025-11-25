import React, { useState } from "react";
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Badge,
  Button,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Divider,
  Wrap,
  WrapItem,
  useColorModeValue
} from "@chakra-ui/react";
import combatActions from "../data/combatActions.json";

const CombatActionsPanel = ({ 
  character, 
  onActionSelect, 
  selectedAction: externalSelectedAction,
  selectedTarget: externalSelectedTarget,
  availableTargets = [],
  onTargetSelect
}) => {
  const [internalSelectedAction, setInternalSelectedAction] = useState(null);
  const [internalSelectedTarget, setInternalSelectedTarget] = useState(null);
  
  // Use external state if provided, otherwise use internal state
  const selectedAction = externalSelectedAction || internalSelectedAction;
  const selectedTarget = externalSelectedTarget || internalSelectedTarget;
  
  const bg = useColorModeValue("gray.100", "gray.700");
  const cardBg = useColorModeValue("white", "gray.800");
  
  if (!character) {
    return (
      <Box className="container" p={4}>
        <Heading size="md" mb={4}>⚔️ Combat Actions</Heading>
        <Alert status="info">
          <AlertIcon />
          No character selected
        </Alert>
      </Box>
    );
  }

  // Determine character type bonuses based on O.C.C.
  const getCharacterTypeBonuses = () => {
    const charClass = character.class || character.OCC || character.occupation;
    if (!charClass) return [];

    const bonuses = [];
    
    // Check Men of Arms
    if (combatActions.characterTypeBonus.menOfArms.classes.includes(charClass)) {
      bonuses.push({ 
        type: "menOfArms", 
        data: combatActions.characterTypeBonus.menOfArms,
        match: true 
      });
    }
    
    // Check Stealth & Skirmish
    if (combatActions.characterTypeBonus.stealthSkirmish.classes.includes(charClass)) {
      bonuses.push({ 
        type: "stealthSkirmish", 
        data: combatActions.characterTypeBonus.stealthSkirmish,
        match: true 
      });
    }
    
    // Check Men of Magic
    if (combatActions.characterTypeBonus.menOfMagic.classes.includes(charClass)) {
      bonuses.push({ 
        type: "menOfMagic", 
        data: combatActions.characterTypeBonus.menOfMagic,
        match: true 
      });
    }
    
    // Check Clergy
    if (combatActions.characterTypeBonus.clergy.classes.includes(charClass)) {
      bonuses.push({ 
        type: "clergy", 
        data: combatActions.characterTypeBonus.clergy,
        match: true 
      });
    }

    // Always include Natural & Special bonuses
    bonuses.push({ 
      type: "naturalSpecial", 
      data: combatActions.characterTypeBonus.naturalSpecial,
      match: false 
    });

    return bonuses;
  };

  // Check if character has specific abilities
  const hasSpellcasting = () => {
    const charClass = character.class || character.OCC || character.occupation;
    return combatActions.characterTypeBonus.menOfMagic.classes.includes(charClass);
  };

  const hasMiracles = () => {
    const charClass = character.class || character.OCC || character.occupation;
    return combatActions.characterTypeBonus.clergy.classes.includes(charClass);
  };

  const hasPsionics = () => {
    // Check if character has I.S.P. or psionic abilities
    return character.ISP || character.isp || character.psionics || character.pe > 15;
  };

  // Filter actions available to this character
  const getAvailableActions = () => {
    const coreActions = [...combatActions.coreActions.actions];
    
    // Add conditional actions
    if (hasSpellcasting()) {
      coreActions.push(combatActions.coreActions.actions.find(a => a.name === "Cast a spell"));
    }
    
    if (hasMiracles()) {
      coreActions.push(combatActions.coreActions.actions.find(a => a.name === "Invoke a miracle"));
    }
    
    if (hasPsionics()) {
      coreActions.push(combatActions.coreActions.actions.find(a => a.name === "Use psionics"));
    }
    
    return coreActions.filter(action => action !== undefined);
  };

  const characterBonuses = getCharacterTypeBonuses();
  const availableActions = getAvailableActions();

  const handleActionClick = (action) => {
    if (onActionSelect) {
      // Use external state management
      onActionSelect(action, character);
    } else {
      // Use internal state management
      setInternalSelectedAction(action);
      setInternalSelectedTarget(null);
    }
  };

  const handleTargetClick = (target) => {
    if (onTargetSelect) {
      // Use external state management
      onTargetSelect(target);
    } else {
      // Use internal state management
      setInternalSelectedTarget(target);
    }
  };

  return (
    <Box className="container" p={4}>
      <Heading size="md" mb={4} display="flex" alignItems="center">
        ⚔️ Combat Actions
      </Heading>
      
      {/* Character Info */}
      <Alert status="info" mb={4}>
        <AlertIcon />
        <Box>
          <AlertTitle>Current Character: {character.name}</AlertTitle>
          <AlertDescription>
            {character.species || character.race} {character.class || character.OCC}
          </AlertDescription>
        </Box>
      </Alert>

      {/* Available Actions */}
      <VStack spacing={4} align="stretch">
        <Box>
          <Heading size="sm" mb={3} color="blue.500">
            Available Actions
          </Heading>
          <Wrap spacing={2}>
            {availableActions.map((action, index) => (
              <WrapItem key={index}>
                <Button
                  size="sm"
                  variant={selectedAction && selectedAction.name === action.name ? "solid" : "outline"}
                  colorScheme={selectedAction && selectedAction.name === action.name ? "green" : "blue"}
                  onClick={() => handleActionClick(action)}
                  leftIcon={action.name.includes("Cast") ? "🔮" : 
                           action.name.includes("Invoke") ? "✨" :
                           action.name.includes("psionics") ? "🧠" :
                           action.name.includes("Strike") ? "⚔️" :
                           action.name.includes("Parry") ? "🛡️" :
                           action.name.includes("Dodge") ? "🎯" :
                           action.name.includes("Move") ? "🚶" :
                           action.name.includes("Aim") ? "🎨🧙" : "🎭"
                           }
                >
                  {action.name}
                  {selectedAction && selectedAction.name === action.name && " ✓"}
                </Button>
              </WrapItem>
            ))}
          </Wrap>
        </Box>

        {/* Selected Action Details */}
        {selectedAction && (
          <Box p={4} bg={cardBg} borderRadius="md" borderWidth="1px">
            <Heading size="sm" mb={2} color="green.500">
              {selectedAction.name}
            </Heading>
            <Text mb={2}>{selectedAction.description}</Text>
            <HStack spacing={4}>
              <Badge colorScheme="blue">Cost: {selectedAction.cost}</Badge>
              {selectedAction.mechanic && (
                <Badge colorScheme="purple">{selectedAction.mechanic}</Badge>
              )}
              {selectedAction.requires && (
                <Badge colorScheme="orange">{selectedAction.requires}</Badge>
              )}
            </HStack>
            {selectedAction.options && (
              <Box mt={2}>
                <Text fontWeight="bold" fontSize="sm">Options:</Text>
                <HStack spacing={1} mt={1}>
                  {selectedAction.options.map((option, idx) => (
                    <Badge key={idx} colorScheme="gray" size="sm">
                      {option}
                    </Badge>
                  ))}
                </HStack>
              </Box>
            )}
          </Box>
        )}

        {/* Target Selection */}
        {selectedAction && (selectedAction.name === "Strike" || selectedAction.name === "Combat Maneuvers") && availableTargets.length > 0 && (
          <Box p={4} bg={cardBg} borderRadius="md" borderWidth="1px">
            <VStack align="start" spacing={3}>
              <Heading size="sm" color="orange.600">
                Select Target
              </Heading>
              <Text fontSize="sm">Choose a target for your {selectedAction.name.toLowerCase()} action:</Text>
              
              <Wrap spacing={2}>
                {availableTargets.map((target) => (
                  <WrapItem key={target.id}>
                    <Button
                      size="sm"
                      variant={selectedTarget && selectedTarget.id === target.id ? "solid" : "outline"}
                      colorScheme={selectedTarget && selectedTarget.id === target.id ? "red" : "orange"}
                      onClick={() => handleTargetClick(target)}
                    >
                      {target.name}
                      {target.currentHP !== undefined && ` (${target.currentHP} HP)`}
                      {selectedTarget && selectedTarget.id === target.id && " ✓"}
                    </Button>
                  </WrapItem>
                ))}
              </Wrap>
            </VStack>
          </Box>
        )}


        <Divider />

        {/* Character Type Bonuses */}
        <Accordion allowMultiple defaultIndex={[0]}>
          {characterBonuses.map((bonus, index) => (
            <AccordionItem key={index}>
              <AccordionButton>
                <Box flex="1" textAlign="left">
                  <HStack>
                    <Heading size="sm">{bonus.data.label}</Heading>
                    {bonus.match && (
                      <Badge colorScheme="green" size="sm">✓</Badge>
                    )}
                  </HStack>
                </Box>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel>
                <VStack align="stretch" spacing={2}>
                  {bonus.data.bonuses.map((bonusItem, idx) => (
                    <Box key={idx} p={3} bg={bg} borderRadius="md">
                      <Heading size="xs" mb={1} color="orange.500">
                        {bonusItem.name}
                      </Heading>
                      <Text fontSize="sm">{bonusItem.description}</Text>
                      {bonusItem.mechanic && (
                        <Text fontSize="xs" color="gray.600" mt={1}>
                          <strong>Mechanic:</strong> {bonusItem.mechanic}
                        </Text>
                      )}
                      {bonusItem.classes && (
                        <HStack mt={2} spacing={1}>
                          {bonusItem.classes.map((className, classIdx) => (
                            <Badge key={classIdx} colorScheme="purple" size="sm">
                              {className}
                            </Badge>
                          ))}
                        </HStack>
                      )}
                    </Box>
                  ))}
                </VStack>
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>

        {/* Turn Flow Tips */}
        <Box p={4} bg={bg} borderRadius="md">
          <Heading size="sm" mb={3} color="cyan.500">
            Turn Flow Tips
          </Heading>
          <VStack align="stretch" spacing={2}>
            {combatActions.turnFlow.steps.map((step, index) => (
              <HStack key={index} align="start">
                <Badge colorScheme="cyan" size="sm">{step.step}</Badge>
                <Text fontSize="sm">{step.description}</Text>
              </HStack>
            ))}
          </VStack>
          <Heading size="xs" mt={3} mb={2} color="purple.500">
            Combat Tips:
          </Heading>
          <Wrap spacing={1}>
            {combatActions.quickReferenceTips && Object.values(combatActions.quickReferenceTips).map((tip, index) => (
              <WrapItem key={index}>
                <Badge colorScheme="purple" size="sm" maxWidth="200px">
                  {tip}
                </Badge>
              </WrapItem>
            ))}
          </Wrap>
        </Box>
      </VStack>
    </Box>
  );
};

export default CombatActionsPanel;
