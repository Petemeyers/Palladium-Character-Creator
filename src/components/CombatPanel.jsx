import React, { useState, useEffect } from "react";
import {
  Box,
  Heading,
  Table,
  Tbody,
  Tr,
  Td,
  Th,
  Select,
  Text,
  VStack,
  HStack,
  Badge,
  Alert,
  AlertIcon,
  Divider,
  Button,
} from "@chakra-ui/react";
import { useParty } from "../context/PartyContext";
import { skills } from "../data/skills";
import { rollDice } from "./util";
import getSocket from "../utils/socket";
import { calculateEncumbrance, getEncumbrancePenalty } from "../utils/encumbrance";
import TacticalMap from "./TacticalMap";
import { getInitialPositions } from "../data/movementRules";

const socket = getSocket(); // Use centralized socket manager

const CombatPanel = () => {
  const { activeParty } = useParty();
  const [lastRoll, setLastRoll] = useState(null);
  const [rollHistory, setRollHistory] = useState([]);
  const [positions, setPositions] = useState({});
  const [showTacticalMap, setShowTacticalMap] = useState(false);

  // Initialize positions when party members change
  useEffect(() => {
    if (activeParty?.members?.length > 0) {
      const initialPositions = getInitialPositions(activeParty.members.length, 0);
      const positionMap = {};
      
      // Map positions to character IDs
      activeParty.members.forEach((member, index) => {
        if (initialPositions.players[index]) {
          positionMap[member._id] = initialPositions.players[index];
        }
      });
      
      setPositions(positionMap);
    }
  }, [activeParty?.members]);

  // Handle position changes on the tactical map
  const handlePositionChange = (combatantId, newPosition) => {
    setPositions(prev => ({
      ...prev,
      [combatantId]: newPosition
    }));
    
    // Broadcast position change to party chat
    if (activeParty?._id) {
      const combatant = activeParty.members.find(m => m._id === combatantId);
      if (combatant) {
        socket.emit("partyMessage", {
          partyId: activeParty._id,
          user: "System",
          text: `📍 ${combatant.name} moved to position (${newPosition.x}, ${newPosition.y})`,
          type: "system",
        });
      }
    }
  };

  if (!activeParty) {
    return (
      <Box className="container" p={4}>
        <Heading size="md" mb={4}>Combat & Skills</Heading>
        <Text>Load a party first to access combat and skills tools.</Text>
      </Box>
    );
  }

  const handleSkillRoll = (char, skillName) => {
    const skill = skills[skillName];
    if (!skill) return;

    const attrValue = char.attributes?.[skill.attribute] || 0;
    
    // Calculate encumbrance penalty
    const carry = calculateEncumbrance(char.inventory);
    const maxCarry = char.carryWeight?.maxWeight || (char.attributes?.PS || 10) * 10;
    const penalty = getEncumbrancePenalty(carry, maxCarry);
    
    // Simple Palladium-style roll: 1d20 + attribute modifier
    const roll = rollDice(20, 1);
    const attributeModifier = Math.floor((attrValue - 10) / 2);
    let total = roll + attributeModifier;

    // Apply encumbrance penalty to physical skills
    let encPenaltyText = "";
    if (skill.encumbranceAffected && penalty.skill !== 0) {
      total += penalty.skill;
      encPenaltyText = ` (encumbrance penalty ${penalty.skill})`;

      // Post encumbrance penalty notice to PartyChat
      if (activeParty?._id) {
        socket.emit("partyMessage", {
          partyId: activeParty._id,
          user: "System",
          text: `⚠️ ${char.name} is encumbered: ${penalty.skill} penalty applied to ${skillName} (Carrying ${carry}/${maxCarry})`,
          type: "system",
        });
      }
    }

    const rollResult = {
      id: Date.now(),
      char: char.name,
      skill: skillName,
      attribute: skill.attribute,
      attributeValue: attrValue,
      roll,
      attributeModifier,
      total,
      encumbrancePenalty: skill.encumbranceAffected ? penalty.skill : 0,
      timestamp: new Date().toLocaleString(),
      difficulty: skill.difficulty,
      type: skill.type
    };

    setLastRoll(rollResult);
    setRollHistory(prev => [rollResult, ...prev.slice(0, 9)]); // Keep last 10 rolls

    // Broadcast roll result to PartyChat
    if (activeParty?._id) {
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "System",
        text: `📜 ${char.name} rolled ${total} on ${skillName} (d20=${roll}, attr=${skill.attribute})${encPenaltyText}`,
        type: "system",
      });
    }
  };

  const getRollColor = (total) => {
    if (total >= 15) return "green";
    if (total >= 10) return "yellow";
    return "red";
  };

  const getRollStatus = (total) => {
    if (total >= 15) return "success";
    if (total >= 10) return "warning";
    return "error";
  };

  const getRollResult = (total) => {
    if (total >= 15) return "Success";
    if (total >= 10) return "Partial Success";
    return "Failure";
  };

  return (
    <Box className="container" p={4}>
      <Heading mb={4}>Combat & Skills</Heading>
      
      {activeParty && (
        <Alert status="info" mb={4}>
          <AlertIcon />
          Active Party: <strong>{activeParty.name}</strong> - {activeParty.members.length} members
        </Alert>
      )}

      <VStack spacing={6} align="stretch">
        {/* Tactical Map Toggle */}
        <Box p={3} borderWidth="1px" borderRadius="md" bg="blue.50">
          <HStack justify="space-between" align="center">
            <VStack align="start" spacing={1}>
              <Heading size="sm">🗺️ Combat Arena</Heading>
              <Text fontSize="xs" color="gray.600">
                Visual grid-based tactical positioning (40x30 grid, 200ft x 150ft)
              </Text>
            </VStack>
            <Button
              size="sm"
              colorScheme={showTacticalMap ? "green" : "gray"}
              variant={showTacticalMap ? "solid" : "outline"}
              onClick={() => setShowTacticalMap(!showTacticalMap)}
            >
              {showTacticalMap ? "✅ Hide Map" : "🗺️ Show Map"}
            </Button>
          </HStack>
        </Box>

        {/* Tactical Map Display */}
        {showTacticalMap && (
          <Box>
            <TacticalMap
              combatants={activeParty.members.map(m => ({ ...m, isEnemy: false }))}
              positions={positions}
              onPositionChange={handlePositionChange}
              currentTurn={null}
              highlightMovement={true}
            />
          </Box>
        )}

        <Divider />

        {/* Character Skill Rolls */}
        <Box>
          <Heading size="md" mb={3}>Character Skill Rolls</Heading>
          <Table size="sm">
            <thead>
              <Tr>
                <Th>Character</Th>
                <Th>Species/Class</Th>
                <Th>Skill Selection</Th>
              </Tr>
            </thead>
            <Tbody>
              {activeParty.members.map((char) => (
                <Tr key={char._id}>
                  <Td>
                    <VStack align="start" spacing={1}>
                      <Text fontWeight="bold">{char.name}</Text>
                      <HStack spacing={2}>
                        {char.attributes && Object.entries(char.attributes).slice(0, 4).map(([attr, value]) => (
                          <Badge key={attr} size="sm" colorScheme="blue">
                            {attr}: {value}
                          </Badge>
                        ))}
                      </HStack>
                    </VStack>
                  </Td>
                  <Td>
                    <Text fontSize="sm">
                      {char.species} {char.class}
                    </Text>
                  </Td>
                  <Td>
                    <Select
                      placeholder="Select skill"
                      size="sm"
                      onChange={(e) => handleSkillRoll(char, e.target.value)}
                    >
                      {Object.keys(skills).map((skillName) => {
                        const skill = skills[skillName];
                        return (
                          <option key={skillName} value={skillName}>
                            {skillName} ({skill.attribute}) - {skill.type}
                          </option>
                        );
                      })}
                    </Select>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>

        <Divider />

        {/* Last Roll Result */}
        {lastRoll && (
          <Box>
            <Heading size="md" mb={3}>Last Roll Result</Heading>
            <Alert status={getRollStatus(lastRoll.total)}>
              <AlertIcon />
              <VStack align="start" spacing={1}>
                <Text fontWeight="bold">
                  {lastRoll.char} rolled for {lastRoll.skill}
                </Text>
                <HStack spacing={4}>
                  <Text>
                    <strong>Total: {lastRoll.total}</strong> ({getRollResult(lastRoll.total)})
                  </Text>
                  <Text>d20: {lastRoll.roll}</Text>
                  <Text>
                    {lastRoll.attribute} ({lastRoll.attributeValue}): {lastRoll.attributeModifier >= 0 ? '+' : ''}{lastRoll.attributeModifier}
                  </Text>
                  {lastRoll.encumbrancePenalty !== 0 && (
                    <Text color="red.500">
                      Encumbrance: {lastRoll.encumbrancePenalty}
                    </Text>
                  )}
                </HStack>
                <Text fontSize="sm" color="gray.600">
                  {lastRoll.type} skill • {lastRoll.difficulty} difficulty
                </Text>
              </VStack>
            </Alert>
          </Box>
        )}

        {/* Roll History */}
        {rollHistory.length > 0 && (
          <Box>
            <Heading size="md" mb={3}>Recent Rolls</Heading>
            <Table size="sm">
              <thead>
                <Tr>
                  <Th>Character</Th>
                  <Th>Skill</Th>
                  <Th>Roll</Th>
                  <Th>Total</Th>
                  <Th>Result</Th>
                  <Th>Time</Th>
                </Tr>
              </thead>
              <Tbody>
                {rollHistory.map((roll) => (
                  <Tr key={roll.id}>
                    <Td>{roll.char}</Td>
                    <Td fontSize="sm">{roll.skill}</Td>
                    <Td>{roll.roll}</Td>
                    <Td fontWeight="bold">{roll.total}</Td>
                    <Td>
                      <Badge 
                        colorScheme={getRollColor(roll.total)}
                        size="sm"
                      >
                        {getRollResult(roll.total)}
                      </Badge>
                    </Td>
                    <Td fontSize="xs">{roll.timestamp}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}

        {/* Skill Categories Quick Reference */}
        <Box>
          <Heading size="md" mb={3}>Skill Categories Quick Reference</Heading>
          <VStack align="stretch" spacing={2}>
            {Object.entries({
              "Physical": "Athletic and movement skills",
              "Rogue": "Stealth and criminal activities", 
              "Scholar": "Knowledge and lore skills",
              "Communication": "Social interaction skills",
              "Technical": "Crafting and specialized skills"
            }).map(([type, description]) => (
              <HStack key={type} justify="space-between">
                <Badge colorScheme="purple" size="lg">{type}</Badge>
                <Text fontSize="sm" color="gray.600">{description}</Text>
              </HStack>
            ))}
          </VStack>
        </Box>
      </VStack>
    </Box>
  );
};

export default CombatPanel;
