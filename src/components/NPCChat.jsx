import React, { useState, useEffect } from "react";
import {
  Box,
  Input,
  Button,
  Text,
  VStack,
  HStack,
  Heading,
  Badge,
  Divider,
  Textarea,
  Select,
} from "@chakra-ui/react";
import axiosInstance from "../utils/axios";
import { useParty } from "../context/PartyContext";

const NPCChat = ({ npc, onClose }) => {
  const { activeParty } = useParty();
  const [log, setLog] = useState([]);
  const [input, setInput] = useState("");
  const [memory, setMemory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (npc?._id) {
      loadMemory();
    }
  }, [npc]);

  const loadMemory = async () => {
    try {
      const res = await axiosInstance.get(`/npc/${npc._id}/memory`);
      setMemory(res.data);
    } catch (err) {
      console.error("Failed to load NPC memory:", err);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    const userMessage = input.trim();
    setInput("");

    // Add user message to log
    setLog(prev => [...prev, { user: "GM", text: userMessage, timestamp: new Date() }]);

    try {
      const res = await axiosInstance.post(`/npc/${npc._id}/respond`, {
        situation: userMessage,
        partyId: activeParty?._id,
      });

      // Add NPC response to log
      setLog(prev => [...prev, { 
        user: npc.name, 
        text: res.data.reply, 
        timestamp: new Date() 
      }]);

      // Update memory
      setMemory(res.data.memory);
    } catch (err) {
      console.error("Failed to get NPC response:", err);
      setLog(prev => [...prev, { 
        user: "System", 
        text: "Error: Could not get NPC response", 
        timestamp: new Date() 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const addMemory = async () => {
    const interaction = prompt("Enter interaction to remember:");
    const sentiment = prompt("Enter sentiment (friendly/hostile/neutral/suspicious/grateful):");
    
    if (interaction) {
      try {
        await axiosInstance.post(`/npc/${npc._id}/memory`, {
          interaction,
          sentiment: sentiment || "neutral",
          participants: ["GM"],
        });
        loadMemory();
      } catch (err) {
        console.error("Failed to add memory:", err);
      }
    }
  };

  if (!npc) {
    return (
      <Box p={4}>
        <Text>No NPC selected</Text>
      </Box>
    );
  }

  return (
    <Box p={4} maxW="600px" mx="auto">
      <HStack justify="space-between" mb={4}>
        <VStack align="start" spacing={1}>
          <Heading size="md">{npc.name}</Heading>
          <HStack spacing={2}>
            <Badge colorScheme="blue">{npc.race}</Badge>
            <Badge colorScheme="purple">{npc.role}</Badge>
            <Badge colorScheme="green">{npc.personality}</Badge>
          </HStack>
        </VStack>
        <Button size="sm" onClick={onClose}>
          Close
        </Button>
      </HStack>

      <Divider mb={4} />

      {/* Chat Log */}
      <Box
        height="300px"
        overflowY="auto"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="md"
        p={3}
        mb={4}
        bg="gray.50"
      >
        <VStack align="stretch" spacing={2}>
          {log.map((message, idx) => (
            <Box key={idx}>
              <Text fontSize="sm" color="gray.600">
                <strong>{message.user}:</strong> {message.text}
              </Text>
            </Box>
          ))}
          {isLoading && (
            <Text fontSize="sm" color="gray.500" fontStyle="italic">
              {npc.name} is thinking...
            </Text>
          )}
        </VStack>
      </Box>

      {/* Input */}
      <HStack mb={4}>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Say something to the NPC..."
          isDisabled={isLoading}
        />
        <Button
          colorScheme="blue"
          onClick={sendMessage}
          isLoading={isLoading}
          loadingText="..."
        >
          Send
        </Button>
      </HStack>

      {/* Memory Section */}
      <Box>
        <HStack justify="space-between" mb={2}>
          <Heading size="sm">Recent Memory</Heading>
          <Button size="xs" onClick={addMemory}>
            Add Memory
          </Button>
        </HStack>
        <Box
          height="150px"
          overflowY="auto"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="md"
          p={2}
          bg="white"
        >
          <VStack align="stretch" spacing={1}>
            {memory.slice(-10).map((mem, idx) => (
              <Text key={idx} fontSize="xs" color="gray.700">
                <Badge size="sm" colorScheme={
                  mem.sentiment === "friendly" ? "green" :
                  mem.sentiment === "hostile" ? "red" :
                  mem.sentiment === "suspicious" ? "yellow" :
                  mem.sentiment === "grateful" ? "purple" : "gray"
                }>
                  {mem.sentiment}
                </Badge> {mem.interaction}
              </Text>
            ))}
            {memory.length === 0 && (
              <Text fontSize="xs" color="gray.500" fontStyle="italic">
                No memories yet
              </Text>
            )}
          </VStack>
        </Box>
      </Box>
    </Box>
  );
};

export default NPCChat;
