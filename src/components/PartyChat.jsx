import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { Box, Input, Button, VStack, Text, Heading, Divider, HStack, FormControl, FormLabel, Select } from "@chakra-ui/react";
import { useParty } from "../context/PartyContext";
import getSocket from "../utils/socket";
import axiosInstance from "../utils/axios";
import { startLocations } from "../data/startLocations";

const socket = getSocket(); // Use centralized socket manager

const PartyChat = ({ username = "GM" }) => {
  const { activeParty } = useParty();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [systemInput, setSystemInput] = useState("");
  const [selectedNpc, setSelectedNpc] = useState("");
  const [npcName, setNpcName] = useState("Old Man");
  const [npcContext, setNpcContext] = useState("You are a tavernkeeper who knows local rumors.");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!activeParty?._id) {
      setMessages([]); // Clear messages when no active party
      return;
    }

    // Load chat history when joining a party
    const loadChatHistory = async () => {
      try {
        // Suppress error logging for 404s (expected when party has no messages)
        const response = await axiosInstance.get(`/messages/${activeParty._id}`, {
          suppressErrorLogging: true
        });
        setMessages(response.data);
        console.log(`Loaded ${response.data.length} messages for party ${activeParty._id}`);
      } catch (err) {
        // 404 is expected if party has no messages yet - handle silently
        if (err.response?.status === 404) {
          setMessages([]);
          return;
        }
        // Only log non-404 errors
        console.error("Failed to load chat history:", err);
        setMessages([]);
      }
    };

    loadChatHistory();

    // Join the active party room
    socket.emit("joinParty", activeParty._id);
    console.log(`PartyChat: Joined party room ${activeParty._id}`);

    // Listen for new messages
    const handleMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };
    socket.on("partyMessage", handleMessage);

    return () => {
      socket.emit("leaveParty", activeParty._id);
      socket.off("partyMessage", handleMessage);
      console.log(`PartyChat: Left party room ${activeParty._id}`);
    };
  }, [activeParty]);

  const sendMessage = () => {
    if (input.trim() && activeParty?._id) {
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: username,
        text: input.trim(),
      });
      setInput("");
    }
  };

  const sendSystemMessage = async () => {
    if (systemInput.trim() && activeParty?._id) {
      try {
        await axiosInstance.post(`/messages/${activeParty._id}/system`, {
          text: systemInput.trim(),
          type: "system",
          user: "System"
        });
        setSystemInput("");
      } catch (err) {
        console.error("Failed to send system message:", err);
      }
    }
  };

  const triggerNpcReply = async (playerMessage) => {
    if (!activeParty?._id) return;
    try {
      await axiosInstance.post(`/npc/reply/${activeParty._id}`, {
        npcName: selectedNpc || undefined,
        playerMessage,
        // no context → backend will auto-pick from location
      });
    } catch (err) {
      console.error("Failed to get NPC reply:", err);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!activeParty) {
    return (
      <Box className="container" mt={6}>
        <Box
          border="1px solid #e2e8f0"
          borderRadius="md"
          p={4}
          bg="gray.50"
          textAlign="center"
        >
          <Text color="gray.500">
            Load a party to start chatting with your group!
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box className="container" mt={6}>
      <VStack align="stretch" spacing={3}>
        <Box>
          <Heading size="md" mb={2}>
            💬 Party Chat
          </Heading>
          <Text fontSize="sm" color="gray.600">
            {activeParty.name} • {activeParty.members?.length || 0} members
          </Text>
        </Box>
        
        {/* NPC Selector for GM */}
        {username === "GM" && activeParty?.startLocation && (() => {
          const location = startLocations.find(loc => loc.id === activeParty.startLocation.id);
          const npcOptions = location?.npcs || [];
          
          return npcOptions.length > 0 ? (
            <Box p={3} bg="purple.50" borderRadius="md" border="1px solid" borderColor="purple.200">
              <Text fontSize="sm" fontWeight="bold" color="purple.700" mb={2}>
                🤖 Choose NPC to Reply:
              </Text>
              <Select
                placeholder="Default NPC (first available)"
                value={selectedNpc}
                onChange={(e) => setSelectedNpc(e.target.value)}
                size="sm"
                bg="white"
              >
                {npcOptions.map((npc) => (
                  <option key={npc.name} value={npc.name}>
                    {npc.name} – {npc.role}
                  </option>
                ))}
              </Select>
              <Text fontSize="xs" color="purple.600" mt={1}>
                Selected NPC will respond to player messages when you click &quot;🤖 NPC Reply&quot;
              </Text>
            </Box>
          ) : null;
        })()}
        
        <Divider />
        
        <Box
          border="1px solid #e2e8f0"
          borderRadius="md"
          p={3}
          h="300px"
          overflowY="auto"
          bg="white"
          boxShadow="sm"
        >
          {messages.length === 0 ? (
            <Text color="gray.500" textAlign="center" mt={4}>
              No messages yet. Start the conversation!
            </Text>
          ) : (
            messages.map((msg, i) => (
              <Box key={msg._id || i} mb={2}>
                <Text fontSize="sm">
                  {msg.type === "system" ? (
                    <>
                      <Text as="span" color="gray.600" fontStyle="italic">
                        📜 {msg.text}
                      </Text>
                    </>
                  ) : msg.type === "npc" ? (
                    <>
                      <Text as="span" fontWeight="bold" color="purple.600">
                        {msg.user} (NPC)
                      </Text>
                      <Text as="span" color="purple.600" ml={1}>
                        : {msg.text}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text as="span" fontWeight="bold" color="blue.600">
                        {msg.user}
                      </Text>
                      <Text as="span" color="black" ml={1}>
                        : {msg.text}
                      </Text>
                    </>
                  )}
                  <Text as="span" color="gray.500" ml={2} fontSize="xs">
                    {new Date(msg.time).toLocaleTimeString()}
                  </Text>
                </Text>
                
                {/* NPC Reply button for player messages */}
                {msg.type === "player" && username === "GM" && (
                  <Box mt={1}>
                    <Button
                      size="xs"
                      variant="outline"
                      colorScheme="purple"
                      onClick={() => triggerNpcReply(msg.text)}
                      isDisabled={!activeParty?._id}
                    >
                      🤖 NPC Reply
                    </Button>
                  </Box>
                )}
              </Box>
            ))
          )}
          <div ref={messagesEndRef} />
        </Box>
        
        <Box display="flex" gap={2}>
          <Input
            placeholder={`Type a message as ${username}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            bg="white"
          />
          <Button 
            onClick={sendMessage} 
            colorScheme="blue"
            isDisabled={!input.trim()}
            minW="80px"
          >
            Send
          </Button>
        </Box>
        
        {/* GM System Message Input */}
        {username === "GM" && (
          <Box display="flex" gap={2}>
            <Input
              placeholder="📜 Type a system message (narration, events, etc.)..."
              value={systemInput}
              onChange={(e) => setSystemInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendSystemMessage();
                }
              }}
              bg="gray.50"
              borderColor="gray.300"
            />
            <Button 
              onClick={sendSystemMessage} 
              colorScheme="gray"
              isDisabled={!systemInput.trim()}
              minW="80px"
            >
              📜 System
            </Button>
          </Box>
        )}
        
        {/* GM NPC Configuration */}
        {username === "GM" && (
          <Box p={3} bg="purple.50" borderRadius="md" border="1px solid" borderColor="purple.200">
            <Text fontSize="sm" fontWeight="bold" color="purple.700" mb={2}>
              🤖 NPC Configuration
            </Text>
            
            {/* Show current location's default NPCs */}
            {activeParty?.startLocation && (
              <Box mb={2} p={2} bg="purple.100" borderRadius="sm">
                <Text fontSize="xs" fontWeight="bold" color="purple.800" mb={1}>
                  Default NPCs at {activeParty.startLocation.label}:
                </Text>
                {(() => {
                  const location = startLocations.find(loc => loc.id === activeParty.startLocation.id);
                  return location?.npcs?.map((npc, i) => (
                    <Text key={i} fontSize="xs" color="purple.700" ml={2}>
                      • {npc.name}: {npc.role}
                    </Text>
                  )) || <Text fontSize="xs" color="purple.600">No default NPCs available</Text>;
                })()}
              </Box>
            )}
            
            <HStack spacing={2} mb={2}>
              <FormControl size="sm">
                <FormLabel fontSize="xs" mb={1}>Custom NPC Name:</FormLabel>
                <Input
                  value={npcName}
                  onChange={(e) => setNpcName(e.target.value)}
                  size="sm"
                  placeholder="Old Man"
                />
              </FormControl>
              <FormControl size="sm" flex={1}>
                <FormLabel fontSize="xs" mb={1}>Custom Context:</FormLabel>
                <Input
                  value={npcContext}
                  onChange={(e) => setNpcContext(e.target.value)}
                  size="sm"
                  placeholder="You are a tavernkeeper..."
                />
              </FormControl>
            </HStack>
            <Text fontSize="xs" color="purple.600">
              Click &quot;🤖 NPC Reply&quot; on player messages to generate AI responses
              {activeParty?.startLocation ? " (uses location defaults if no custom NPC)" : ""}
            </Text>
          </Box>
        )}
        
        <Text fontSize="xs" color="gray.500" textAlign="center">
          Press Enter to send • Shift+Enter for new line
        </Text>
      </VStack>
    </Box>
  );
};

PartyChat.propTypes = {
  username: PropTypes.string,
};

export default PartyChat;
