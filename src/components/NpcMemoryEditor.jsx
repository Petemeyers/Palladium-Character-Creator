import React, { useState, useEffect } from "react";
import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Select,
  Textarea,
  FormControl,
  FormLabel,
  Switch,
  Badge,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import { useParty } from "../context/PartyContext";
import axiosInstance from "../utils/axios";

const NpcMemoryEditor = () => {
  const { activeParty } = useParty();
  const [memories, setMemories] = useState([]);
  const [selectedNpc, setSelectedNpc] = useState("");
  const [editedSummary, setEditedSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load memories when active party changes
  useEffect(() => {
    if (activeParty?._id) {
      loadMemories();
    }
  }, [activeParty]);

  // Load edited summary when selected NPC changes
  useEffect(() => {
    if (selectedNpc) {
      const memory = memories.find((m) => m.npcName === selectedNpc);
      setEditedSummary(memory?.summary || "");
    }
  }, [selectedNpc, memories]);

  const loadMemories = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/npc-memory/${activeParty._id}`);
      // Ensure memories is always an array
      const memoriesData = response.data;
      setMemories(Array.isArray(memoriesData) ? memoriesData : []);
    } catch (err) {
      setError("Failed to load NPC memories");
      console.error("Error loading memories:", err);
      // Set empty array on error to prevent map errors
      setMemories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedNpc || !activeParty?._id) return;

    try {
      setLoading(true);
      const response = await axiosInstance.put(
        `/npc-memory/${activeParty._id}/${selectedNpc}`,
        { summary: editedSummary }
      );
      
      setMemories((prev) =>
        prev.map((m) => (m.npcName === selectedNpc ? response.data : m))
      );
      setError("");
    } catch (err) {
      setError("Failed to save memory");
      console.error("Error saving memory:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLock = async () => {
    if (!selectedNpc || !activeParty?._id) return;

    try {
      const currentMemory = memories.find((m) => m.npcName === selectedNpc);
      const newLocked = !currentMemory?.locked;

      const response = await axiosInstance.put(
        `/npc-memory/${activeParty._id}/${selectedNpc}/lock`,
        { locked: newLocked }
      );

      setMemories((prev) =>
        prev.map((m) => (m.npcName === selectedNpc ? response.data : m))
      );
      setError("");
    } catch (err) {
      setError("Failed to toggle lock");
      console.error("Error toggling lock:", err);
    }
  };

  const handleDelete = async () => {
    if (!selectedNpc || !activeParty?._id) return;

    try {
      setLoading(true);
      await axiosInstance.delete(`/npc-memory/${activeParty._id}/${selectedNpc}`);
      
      setMemories((prev) => prev.filter((m) => m.npcName !== selectedNpc));
      setSelectedNpc("");
      setEditedSummary("");
      setError("");
    } catch (err) {
      setError("Failed to delete memory");
      console.error("Error deleting memory:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!activeParty) {
    return (
      <Box className="container">
        <Heading mb={4}>NPC Memory Editor</Heading>
        <Text>Please load a party to manage NPC memories.</Text>
      </Box>
    );
  }

  return (
    <Box className="container">
      <Heading mb={4}>NPC Memory Editor</Heading>
      <Text mb={4} color="gray.600">
        Manage NPC memories for {activeParty.name}
      </Text>

      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          {error}
        </Alert>
      )}

      <VStack align="stretch" spacing={4}>
        {/* NPC Selection */}
        <Box>
          <FormControl>
            <FormLabel>Select NPC to Edit:</FormLabel>
            <Select
              placeholder="Choose an NPC..."
              value={selectedNpc}
              onChange={(e) => setSelectedNpc(e.target.value)}
            >
              {(Array.isArray(memories) ? memories : []).map((memory) => (
                <option key={memory.npcName} value={memory.npcName}>
                  {memory.npcName} {memory.locked && "🔒"}
                </option>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Memory Editor */}
        {selectedNpc && (
          <Box p={4} border="1px solid" borderColor="gray.200" borderRadius="md">
            <HStack justify="space-between" mb={3}>
              <Heading size="md">{selectedNpc} Memory</Heading>
              <Badge colorScheme={memories.find((m) => m.npcName === selectedNpc)?.locked ? "red" : "green"}>
                {memories.find((m) => m.npcName === selectedNpc)?.locked ? "Locked" : "Unlocked"}
              </Badge>
            </HStack>

            <Textarea
              value={editedSummary}
              onChange={(e) => setEditedSummary(e.target.value)}
              rows={6}
              placeholder="Enter NPC memory summary..."
              mb={3}
            />

            <FormControl display="flex" alignItems="center" mb={3}>
              <FormLabel htmlFor="lock-toggle" mb="0">
                Lock Memory
              </FormLabel>
              <Switch
                id="lock-toggle"
                isChecked={memories.find((m) => m.npcName === selectedNpc)?.locked}
                onChange={handleToggleLock}
                colorScheme="red"
              />
            </FormControl>

            <Text fontSize="sm" color="gray.600" mb={3}>
              {memories.find((m) => m.npcName === selectedNpc)?.locked
                ? "🔒 Locked memories won't be auto-updated by AI conversations"
                : "🔄 Unlocked memories will evolve automatically after NPC conversations"}
            </Text>

            <HStack spacing={2}>
              <Button
                colorScheme="blue"
                onClick={handleSave}
                isLoading={loading}
                isDisabled={!editedSummary.trim()}
              >
                Save Changes
              </Button>
              <Button
                colorScheme="red"
                variant="outline"
                onClick={handleDelete}
                isLoading={loading}
              >
                Delete Memory
              </Button>
            </HStack>
          </Box>
        )}

        {/* Memory List */}
        <Box>
          <Heading size="md" mb={3}>
            All NPC Memories ({memories.length})
          </Heading>
          {memories.length === 0 ? (
            <Text color="gray.500">No NPC memories found.</Text>
          ) : (
            <VStack align="stretch" spacing={2}>
              {(Array.isArray(memories) ? memories : []).map((memory) => (
                <Box
                  key={memory.npcName}
                  p={3}
                  border="1px solid"
                  borderColor="gray.200"
                  borderRadius="md"
                  cursor="pointer"
                  onClick={() => setSelectedNpc(memory.npcName)}
                  bg={selectedNpc === memory.npcName ? "blue.50" : "white"}
                >
                  <HStack justify="space-between">
                    <Text fontWeight="bold">{memory.npcName}</Text>
                    <HStack>
                      {memory.locked && <Badge colorScheme="red">🔒 Locked</Badge>}
                      <Text fontSize="sm" color="gray.500">
                        {new Date(memory.updatedAt).toLocaleDateString()}
                      </Text>
                    </HStack>
                  </HStack>
                  <Text fontSize="sm" color="gray.600" mt={1} noOfLines={2}>
                    {memory.summary || "No memory summary"}
                  </Text>
                </Box>
              ))}
            </VStack>
          )}
        </Box>
      </VStack>
    </Box>
  );
};

export default NpcMemoryEditor;
