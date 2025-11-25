import React, { useState } from "react";
import {
  Box,
  Heading,
  Button,
  Select,
  Text,
  HStack,
  VStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
} from "@chakra-ui/react";
import { useParty } from "../context/PartyContext";
import getSocket from "../utils/socket";
import { getAllEntities, getEntityDetails, getEntityById } from "../engine/encounters";

const socket = getSocket(); // Use centralized socket manager

const BestiaryPanel = () => {
  const { activeParty } = useParty();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [spawnCount, setSpawnCount] = useState(1);

  const allEntities = getAllEntities();
  const categories = ["all", "monster", "animal", "undead", "npc", "faerie_playable", "pc_playable"];

  const filteredEntities = selectedCategory === "all" 
    ? allEntities 
    : allEntities.filter(entity => entity.category === selectedCategory);

  const handleSpawnEntity = () => {
    if (!selectedEntity || !activeParty?._id) return;

    const enemies = [];
    for (let i = 0; i < spawnCount; i++) {
      const enemy = getEntityById(selectedEntity.id);
      if (enemy) {
        enemies.push(enemy);
      }
    }

    if (enemies.length > 0) {
      // Add enemies to combat tracker
      socket.emit("addEnemies", {
        partyId: activeParty._id,
        enemies: enemies,
      });

      // Announce to PartyChat
      const isPlayable = selectedEntity.playable || selectedEntity.category?.includes('playable');
      const emoji = isPlayable ? "🎲" : "👹";
      const playableText = isPlayable ? " (auto-rolled attributes)" : "";
      
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "System",
        text: `${emoji} GM spawned ${spawnCount}x ${selectedEntity.name}${spawnCount > 1 ? 's' : ''}${playableText}`,
        type: "system",
      });
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case "monster": return "red";
      case "animal": return "green";
      case "undead": return "purple";
      case "npc": return "blue";
      case "faerie_playable": return "pink";
      case "pc_playable": return "cyan";
      default: return "gray";
    }
  };

  return (
    <Box className="container" p={4}>
      <Heading mb={4}>Bestiary & NPC Compendium</Heading>
      
      <VStack align="stretch" spacing={4}>
        {/* Filters and Controls */}
        <HStack spacing={4} align="end">
          <Box>
            <Text fontSize="sm" mb={1}>Category:</Text>
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              width="150px"
              size="sm"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </Select>
          </Box>
          
          <Box>
            <Text fontSize="sm" mb={1}>Entity:</Text>
            <Select
              value={selectedEntity?.id || ""}
              onChange={(e) => {
                const entity = allEntities.find(ent => ent.id === e.target.value);
                setSelectedEntity(entity);
              }}
              width="200px"
              size="sm"
            >
              <option value="">Select Entity</option>
              {filteredEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </Select>
          </Box>
          
          <Box>
            <Text fontSize="sm" mb={1}>Count:</Text>
            <Select
              value={spawnCount}
              onChange={(e) => setSpawnCount(Number(e.target.value))}
              width="80px"
              size="sm"
            >
              {[1, 2, 3, 4, 5, 6, 8, 10].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </Select>
          </Box>
          
          <Button
            colorScheme="red"
            onClick={handleSpawnEntity}
            isDisabled={!selectedEntity || !activeParty}
            size="sm"
          >
            Spawn Entity
          </Button>
        </HStack>

        {/* Entity Details */}
        {selectedEntity && (
          <Box p={4} border="1px solid" borderColor="gray.200" borderRadius="md">
            <EntityDetails entityId={selectedEntity.id} />
          </Box>
        )}

        {/* Entity List */}
        <Box>
          <Heading size="sm" mb={3}>
            Available Entities ({filteredEntities.length})
          </Heading>
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Category</Th>
                <Th>Type</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredEntities.map((entity) => (
                <Tr key={entity.id}>
                  <Td>{entity.name}</Td>
                  <Td>
                    <Badge colorScheme={getCategoryColor(entity.category)}>
                      {entity.category}
                    </Badge>
                  </Td>
                  <Td>{entity.type}</Td>
                  <Td>
                    <Button
                      size="xs"
                      colorScheme="blue"
                      onClick={() => setSelectedEntity(entity)}
                    >
                      View Details
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </VStack>
    </Box>
  );
};

// Component to display entity details
const EntityDetails = ({ entityId }) => {
  const [entity, setEntity] = useState(null);

  React.useEffect(() => {
    const details = getEntityDetails(entityId);
    setEntity(details);
  }, [entityId]);

  if (!entity) return <Text>Loading...</Text>;

  return (
    <VStack align="stretch" spacing={3}>
      <HStack justify="space-between">
        <Heading size="md">{entity.name}</Heading>
        <Badge colorScheme={entity.category === 'monster' ? 'red' : entity.category === 'animal' ? 'green' : entity.category === 'undead' ? 'purple' : 'blue'}>
          {entity.category}
        </Badge>
      </HStack>
      
      <Text fontSize="sm" color="gray.600">{entity.description}</Text>
      
      <HStack spacing={4} wrap="wrap">
        <Text fontSize="sm"><strong>Size:</strong> {entity.size}</Text>
        <Text fontSize="sm"><strong>AR:</strong> {entity.AR}</Text>
        <Text fontSize="sm"><strong>HP:</strong> {entity.HP}</Text>
        {entity.spd && <Text fontSize="sm"><strong>Speed:</strong> {entity.spd}</Text>}
        {entity.lifeSpan && <Text fontSize="sm"><strong>Lifespan:</strong> {entity.lifeSpan}</Text>}
      </HStack>

      {entity.alignment && (
        <Box>
          <Text fontSize="sm" fontWeight="bold">Alignment:</Text>
          <HStack spacing={1}>
            {entity.alignment.map((align, idx) => (
              <Badge key={idx} colorScheme="gray" size="sm">
                {align}
              </Badge>
            ))}
          </HStack>
        </Box>
      )}

      {entity.attacks && entity.attacks.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="bold">Attacks:</Text>
          <VStack align="stretch" spacing={1}>
            {entity.attacks.map((attack, idx) => (
              <HStack key={idx} justify="space-between">
                <Text fontSize="sm">{attack.name}</Text>
                <Text fontSize="sm" color="gray.600">
                  {attack.damage} ({attack.count} attack{attack.count > 1 ? 's' : ''})
                </Text>
              </HStack>
            ))}
          </VStack>
        </Box>
      )}

      {entity.bonuses && Object.keys(entity.bonuses).length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="bold">Bonuses:</Text>
          <HStack spacing={2} wrap="wrap">
            {Object.entries(entity.bonuses).map(([key, value]) => (
              <Badge key={key} colorScheme="orange" size="sm">
                {key}: +{value}
              </Badge>
            ))}
          </HStack>
        </Box>
      )}

      {entity.abilities && entity.abilities.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="bold">Abilities:</Text>
          <VStack align="stretch" spacing={1}>
            {entity.abilities.map((ability, idx) => (
              <Text key={idx} fontSize="sm" color="gray.600">
                • {ability}
              </Text>
            ))}
          </VStack>
        </Box>
      )}
    </VStack>
  );
};

export default BestiaryPanel;
